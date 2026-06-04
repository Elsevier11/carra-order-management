import { Router } from 'express'
import { eq, isNotNull } from 'drizzle-orm'
import { z } from 'zod'
import { analyzeImportRows, rawRowSchema } from '../../db/import'
import { db, pgClient } from '../db'
import { ordini } from '../../db/schema'
import { requireAuth, requireRole } from '../middleware/auth'
import type { AuthenticatedRequest } from '../middleware/auth'
import { fetchErpOrders, resolveErpConfig, type ErpOrder } from '../sqlserver'

const router = Router()

// ── File-based import (existing) ──────────────────────────────────────────────

const previewBodySchema = z.object({
  rows: z.array(rawRowSchema).min(1).max(5000),
})

router.post('/preview', requireAuth, requireRole(['admin', 'operativo']), (req, res, next) => {
  try {
    const payload = previewBodySchema.parse(req.body)
    const report = analyzeImportRows(payload.rows)
    return res.json(report)
  } catch (error) {
    return next(error)
  }
})

// ── SQL Server ERP import ─────────────────────────────────────────────────────

/** GET /api/import/sqlserver/config — leggi data ultimo import */
router.get(
  '/sqlserver/config',
  requireAuth,
  requireRole(['admin', 'operativo']),
  async (_req, res, next) => {
    try {
      const rows = await pgClient<{ value: string }[]>`
        select value from import_config where key = 'sqlserver_last_import_date'
      `
      const lastImportDate = rows[0]?.value ?? '1970-01-01'
      return res.json({ lastImportDate })
    } catch (err) {
      return next(err)
    }
  },
)

const configBodySchema = z.object({
  lastImportDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido (YYYY-MM-DD)'),
})

/** PUT /api/import/sqlserver/config — aggiorna data ultimo import */
router.put(
  '/sqlserver/config',
  requireAuth,
  requireRole(['admin', 'operativo']),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { lastImportDate } = configBodySchema.parse(req.body)
      await pgClient`
        insert into import_config (key, value, updated_at)
        values ('sqlserver_last_import_date', ${lastImportDate}, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()
      `
      return res.json({ lastImportDate })
    } catch (err) {
      return next(err)
    }
  },
)

/** POST /api/import/sqlserver/preview — interroga ERP e restituisce lista filtrando duplicati */
router.post(
  '/sqlserver/preview',
  requireAuth,
  requireRole(['admin', 'operativo']),
  async (_req, res, next) => {
    try {
      // 1. Leggi data soglia
      const cfgRows = await pgClient<{ value: string }[]>`
        select value from import_config where key = 'sqlserver_last_import_date'
      `
      const lastImportDate = cfgRows[0]?.value ?? '1970-01-01'
      const sinceDate = new Date(lastImportDate)

      // 2. Recupera external_ref già importati
      const alreadyImported = await db
        .select({ externalRef: ordini.externalRef })
        .from(ordini)
        .where(isNotNull(ordini.externalRef))
      const alreadyImportedSet = new Set(
        alreadyImported.map((r) => r.externalRef).filter(Boolean),
      )

      // 3. Interroga SQL Server con timeout
      let erpOrders: ErpOrder[]
      try {
        const erpConfig = await resolveErpConfig(pgClient)
        erpOrders = await fetchErpOrders(erpConfig, sinceDate)
      } catch (erpErr: unknown) {
        const message =
          erpErr instanceof Error ? erpErr.message : 'Errore connessione ERP SQL Server'
        return res.status(502).json({ message: `Impossibile connettersi al server ERP: ${message}` })
      }

      // 4. Filtra già importati
      const newOrders = erpOrders.filter((o) => !alreadyImportedSet.has(o.externalRef))
      const isTruncated = erpOrders.length >= 1000

      return res.json({
        orders: newOrders,
        lastImportDate,
        alreadyImportedCount: alreadyImportedSet.size,
        isTruncated,
      })
    } catch (err) {
      return next(err)
    }
  },
)

const erpOrderSchema = z.object({
  externalRef: z.string().min(1),
  rifto: z.string(),
  cliente: z.string(),
  dataOrdine: z.string().nullable(),
  dataConsegna: z.string().nullable(),
  cantiere: z.string().nullable(),
  agenteNome: z.string().nullable(),
  agenteCodice: z.string().nullable(),
})

const executeBodySchema = z.object({
  orders: z.array(erpOrderSchema).min(1).max(500),
})

/** POST /api/import/sqlserver/execute — importa ordini selezionati in PostgreSQL */
router.post(
  '/sqlserver/execute',
  requireAuth,
  requireRole(['admin', 'operativo']),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { orders } = executeBodySchema.parse(req.body)
      const actor = req.user?.username ?? 'sistema'

      // 1. Verifica duplicati (idempotenza)
      const alreadyImported = await db
        .select({ externalRef: ordini.externalRef })
        .from(ordini)
        .where(isNotNull(ordini.externalRef))
      const alreadyImportedSet = new Set(
        alreadyImported.map((r) => r.externalRef).filter(Boolean),
      )

      const toInsert = orders.filter((o) => !alreadyImportedSet.has(o.externalRef))
      const skippedDuplicates = orders.length - toInsert.length

      let imported = 0

      if (toInsert.length > 0) {
        // 2. Transazione: insert ordini + eventi + aggiorna data
        await pgClient.begin(async (tx) => {
          for (const order of toInsert) {
            // Costruisci nota con nome agente se presente
            const note = order.agenteNome ? `Agente: ${order.agenteNome}` : null

            const inserted = await tx<{ id: number }[]>`
              insert into ordini (
                rifto, cliente, data_ordine, data_consegna, cantiere,
                note, stato, trasporto, scarico_carico, acconto_pagato,
                external_ref, created_at
              ) values (
                ${order.rifto},
                ${order.cliente || null},
                ${order.dataOrdine || null},
                ${order.dataConsegna || null},
                ${order.cantiere || null},
                ${note},
                'IN CORSO',
                false,
                false,
                false,
                ${order.externalRef},
                now()
              )
              on conflict (external_ref) where external_ref is not null do nothing
              returning id
            `

            if (inserted.length > 0) {
              const orderId = inserted[0].id
              await tx`
                insert into order_events (order_id, event_type, to_status, actor, created_at)
                values (${orderId}, 'ORDER_IMPORTED', 'IN CORSO', ${actor}, now())
              `
              imported++
            }
          }

          // 3. Aggiorna data ultimo import
          const today = new Date().toISOString().split('T')[0]
          await tx`
            insert into import_config (key, value, updated_at)
            values ('sqlserver_last_import_date', ${today}, now())
            on conflict (key) do update set value = excluded.value, updated_at = now()
          `
        })
      }

      const newLastImportDate =
        imported > 0
          ? new Date().toISOString().split('T')[0]
          : (
              await pgClient<{ value: string }[]>`
                select value from import_config where key = 'sqlserver_last_import_date'
              `
            )[0]?.value ?? '1970-01-01'

      return res.json({ imported, skippedDuplicates, newLastImportDate })
    } catch (err) {
      return next(err)
    }
  },
)

export default router

