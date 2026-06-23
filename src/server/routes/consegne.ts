import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import { and, asc, count, desc, eq, gte, ilike, lt, lte, or, sql } from 'drizzle-orm'
import multer from 'multer'
import XLSX from 'xlsx'
import { z } from 'zod'
import { accessoriTipi, cementiTipi, commerciali, mittentiDisegno, operai as operaiTable, orderAccessori, orderAttachments, orderCementi, orderOperai, ordini, responsabiliInterni, vettori } from '../../db/schema'
import { db } from '../db'
import { BadRequestError } from '../errors'
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth'
import { scanBufferWithAntivirus } from '../security/antivirus'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })
const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/
const dateOrDateTimeRegex = /^\d{4}-\d{2}-\d{2}(?:T.*)?$/
const allowedStatuses = ['IN CORSO', 'DISEGNO IN GESTIONE', 'DISEGNO APPROVATO', 'DA ASSEGNARE', 'ASSEGNATO', 'CONCLUSI', 'PRONTI & AVVISATI', 'CONSEGNA PIANIFICATA', 'CONSEGNA EFFETTUATA', 'SOSPESO'] as const
const transitionMap: Record<(typeof allowedStatuses)[number], (typeof allowedStatuses)[number][]> = {
  'IN CORSO': ['DISEGNO IN GESTIONE', 'SOSPESO'],
  'DISEGNO IN GESTIONE': ['DISEGNO APPROVATO', 'SOSPESO'],
  'DISEGNO APPROVATO': ['DA ASSEGNARE', 'SOSPESO'],
  'DA ASSEGNARE': ['ASSEGNATO', 'SOSPESO'],
  ASSEGNATO: ['CONCLUSI', 'SOSPESO'],
  CONCLUSI: ['PRONTI & AVVISATI', 'SOSPESO'],
  'PRONTI & AVVISATI': ['CONSEGNA PIANIFICATA', 'SOSPESO'],
  'CONSEGNA PIANIFICATA': ['CONSEGNA EFFETTUATA', 'SOSPESO'],
  'CONSEGNA EFFETTUATA': [],
  SOSPESO: ['IN CORSO', 'DISEGNO IN GESTIONE', 'DISEGNO APPROVATO', 'DA ASSEGNARE', 'ASSEGNATO', 'CONCLUSI', 'PRONTI & AVVISATI', 'CONSEGNA PIANIFICATA', 'CONSEGNA EFFETTUATA'],
}
const attachmentsRoot = path.resolve(process.env.ATTACHMENTS_DIR ?? './data/uploads')
const allowedAttachmentExtensions = (process.env.ATTACHMENTS_ALLOWED_EXTENSIONS ?? 'pdf,xls,xlsx,csv,txt,jpg,jpeg,png,doc,docx')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean)
const allowedAttachmentMimeTypes = (process.env.ATTACHMENTS_ALLOWED_MIME ?? 'application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean)
const completedStatuses = new Set(['CONCLUSI', 'PRONTI & AVVISATI', 'CONSEGNA EFFETTUATA'])
const roleAttachmentLimits = {
  admin: {
    maxBytes: Number(process.env.ATTACHMENTS_MAX_SIZE_ADMIN ?? 15 * 1024 * 1024),
    allowedExtensions: (process.env.ATTACHMENTS_ALLOWED_EXTENSIONS_ADMIN ?? allowedAttachmentExtensions.join(','))
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  },
  operativo: {
    maxBytes: Number(process.env.ATTACHMENTS_MAX_SIZE_OPERATIVO ?? 10 * 1024 * 1024),
    allowedExtensions: (process.env.ATTACHMENTS_ALLOWED_EXTENSIONS_OPERATIVO ?? allowedAttachmentExtensions.join(','))
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  },
} as const

function parseInputDate(value: string): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`Invalid date value: ${value}`)
  }
  return parsed
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  cliente: z.string().optional(),
  stato: z.string().optional(),
  fromDate: z.string().regex(dateOnlyRegex, 'fromDate must be YYYY-MM-DD').optional(),
  toDate: z.string().regex(dateOnlyRegex, 'toDate must be YYYY-MM-DD').optional(),
  sortBy: z.enum(['rif', 'cliente', 'dataConsegna', 'stato']).default('dataConsegna'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
})

type ListQuery = z.infer<typeof listQuerySchema>

function buildListFilters(query: ListQuery) {
  const filters = []

  if (query.q) {
    const pattern = `%${query.q.trim()}%`
    filters.push(
      or(
        ilike(ordini.rifto, pattern),
        ilike(ordini.cliente, pattern),
        ilike(ordini.tipoImpianto, pattern),
        ilike(ordini.cantiere, pattern),
      ),
    )
  }

  if (query.cliente) {
    filters.push(ilike(ordini.cliente, `%${query.cliente.trim()}%`))
  }

  if (query.stato) {
    filters.push(ilike(ordini.stato, `%${query.stato.trim()}%`))
  }

  if (query.fromDate) {
    filters.push(gte(ordini.dataConsegna, parseInputDate(query.fromDate)))
  }

  if (query.toDate) {
    const endOfDay = parseInputDate(query.toDate)
    endOfDay.setHours(23, 59, 59, 999)
    filters.push(lte(ordini.dataConsegna, endOfDay))
  }

  return filters.length ? and(...filters) : undefined
}

const consegnaInputSchema = z.object({
  rif: z.string().min(1),
  cliente: z.string().min(1),
  tipoImpianto: z.string().optional().nullable(),
  dataConsegna: z.string().regex(dateOrDateTimeRegex, 'dataConsegna must be YYYY-MM-DD or ISO datetime').optional().nullable(),
  cantiere: z.string().optional().nullable(),
  dataOrdine: z.string().regex(dateOrDateTimeRegex, 'dataOrdine must be YYYY-MM-DD or ISO datetime').optional().nullable(),
  referente: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  scarico: z.string().optional().nullable(),
  vascheCav: z.string().optional().nullable(),
  accessori: z.string().optional().nullable(),
  operai: z.string().optional().nullable(),
  stato: z.enum(allowedStatuses).or(z.string().min(1)).default('IN CORSO'),
  note: z.string().optional().nullable(),
  trasporto: z.boolean().optional().default(false),
  scaricoCarico: z.boolean().optional().default(false),
  accontoPagato: z.boolean().optional().default(false),
  commercialeId: z.number().int().positive().optional().nullable(),
  responsabileInternoId: z.number().int().positive().optional().nullable(),
  folderLinkDocumenti: z.string().optional().nullable(),
  folderLinkFoto: z.string().optional().nullable(),
  // campi DISEGNO IN GESTIONE
  disegnoSpeditoAt: z.string().regex(dateOrDateTimeRegex, 'disegnoSpeditoAt must be YYYY-MM-DD or ISO datetime').optional().nullable(),
  disegnoMittenteId: z.number().int().positive().optional().nullable(),
  disegnoNote: z.string().optional().nullable(),
  // campi DISEGNO APPROVATO
  massicciataNota: z.string().optional().nullable(),
  tipoCariciNota: z.string().optional().nullable(),
  // campi ASSEGNATO
  lavorazioneAssegnataAt: z.string().regex(dateOrDateTimeRegex, 'lavorazioneAssegnataAt must be YYYY-MM-DD or ISO datetime').optional().nullable(),
  // campi CONSEGNA PIANIFICATA
  consegnaDataEffettiva: z.string().regex(dateOrDateTimeRegex, 'consegnaDataEffettiva must be YYYY-MM-DD or ISO datetime').optional().nullable(),
  vettoreId: z.number().int().positive().optional().nullable(),
  bilici: z.number().int().min(0).optional().default(0),
  ddtPronti: z.boolean().optional().default(false),
  bancale: z.boolean().optional().default(false),
  chiusini: z.boolean().optional().default(false),
  caricoVerificato: z.boolean().optional().default(false),
  // tab C.A.M.
  camSiNo: z.boolean().optional().default(false),
})

const transitionSchema = z.object({
  toStatus: z.enum(allowedStatuses),
  note: z.string().optional(),
  lavorazioneAssegnataAt: z.string().regex(dateOrDateTimeRegex, 'lavorazioneAssegnataAt must be YYYY-MM-DD or ISO datetime').optional().nullable(),
  operaiIds: z.array(z.number().int().positive()).optional(),
  skipAssegnazione: z.boolean().optional().default(false),
  conclusiMode: z.enum(['week', 'date']).optional(),
  conclusiWeek: z.string().regex(/^\d{4}-W\d{2}$/, 'conclusiWeek must be YYYY-Www').optional().nullable(),
  conclusiDate: z.string().regex(dateOrDateTimeRegex, 'conclusiDate must be YYYY-MM-DD or ISO datetime').optional().nullable(),
})

type OrderEvent = {
  id: number
  orderId: number
  eventType: string
  fromStatus: string | null
  toStatus: string | null
  note: string | null
  actor: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

type Attachment = {
  id: number
  orderId: number
  fileName: string
  mimeType: string
  sizeBytes: number
  uploadedBy: string | null
  createdAt: string
}

function toIsoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

function formatItalianDate(value: Date | null | undefined): string {
  if (!value) return ''
  const day = String(value.getDate()).padStart(2, '0')
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const year = value.getFullYear()
  return `${day}/${month}/${year}`
}

function yesNo(value: boolean | null | undefined): string {
  return value ? 'Si' : 'No'
}

function styleCell(sheet: XLSX.WorkSheet, ref: string, style: NonNullable<XLSX.CellObject['s']>) {
  const cell = sheet[ref]
  if (!cell) return
  cell.s = {
    ...(cell.s ?? {}),
    ...style,
  }
}

function joinValues(values: Array<string | null | undefined>, separator = ' | '): string {
  return values
    .map((value) => (value ?? '').trim())
    .filter(Boolean)
    .join(separator)
}

function formatRelationItem(name: string, ordinata?: boolean | null, fatta?: boolean | null): string {
  const flags = [`ord:${yesNo(ordinata)}`, `fat:${yesNo(fatta)}`]
  return `${name} (${flags.join(', ')})`
}

function normalizeRow(row: typeof ordini.$inferSelect) {
  return {
    id: row.id,
    rif: row.rifto,
    cliente: row.cliente,
    tipoImpianto: row.tipoImpianto,
    dataConsegna: toIsoDate(row.dataConsegna),
    cantiere: row.cantiere,
    dataOrdine: toIsoDate(row.dataOrdine),
    referente: row.referente,
    telefono: row.telefono,
    scarico: row.scarico,
    vascheCav: row.vascheCav,
    accessori: row.accessori,
    operai: row.operai,
    stato: row.stato ?? 'IN CORSO',
    note: row.note,
    trasporto: row.trasporto ?? false,
    scaricoCarico: row.scaricoCarico ?? false,
    accontoPagato: row.accontoPagato ?? false,
    commercialeId: row.commercialeId ?? null,
    responsabileInternoId: row.responsabileInternoId ?? null,
    folderLinkDocumenti: row.folderLinkDocumenti ?? null,
    folderLinkFoto: row.folderLinkFoto ?? null,
    // campi DISEGNO IN GESTIONE
    disegnoSpeditoAt: toIsoDate(row.disegnoSpeditoAt),
    disegnoMittenteId: row.disegnoMittenteId ?? null,
    disegnoNote: row.disegnoNote ?? null,
    // campi DISEGNO APPROVATO
    massicciataNota: row.massicciataNota ?? null,
    tipoCariciNota: row.tipoCariciNota ?? null,
    // campi ASSEGNATO
    lavorazioneAssegnataAt: toIsoDate(row.lavorazioneAssegnataAt),
    // campi CONSEGNA PIANIFICATA
    consegnaDataEffettiva: toIsoDate(row.consegnaDataEffettiva),
    vettoreId: row.vettoreId ?? null,
    bilici: row.bilici ?? 0,
    ddtPronti: row.ddtPronti ?? false,
    bancale: row.bancale ?? false,
    chiusini: row.chiusini ?? false,
    caricoVerificato: row.caricoVerificato ?? false,
    // tab C.A.M.
    camSiNo: row.camSiNo ?? false,
    createdAt: row.createdAt,
  }
}

function parseEventDetails(details: unknown): Record<string, unknown> | null {
  if (!details) return null
  if (typeof details === 'string') {
    try {
      const parsed = JSON.parse(details)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  return typeof details === 'object' && !Array.isArray(details) ? (details as Record<string, unknown>) : null
}

function compareNullableDatesDesc(a: Date | null | undefined, b: Date | null | undefined): number {
  const aTime = a?.getTime() ?? Number.NEGATIVE_INFINITY
  const bTime = b?.getTime() ?? Number.NEGATIVE_INFINITY
  return bTime - aTime
}

function sortBoardItems(
  status: string,
  rows: typeof ordini.$inferSelect[],
  lastModifiedByOrder: Map<number, Date | null>,
): typeof ordini.$inferSelect[] {
  if (status === 'IN CORSO') {
    return [...rows].sort((a, b) => {
      const byOrderDate = compareNullableDatesDesc(a.dataOrdine, b.dataOrdine)
      if (byOrderDate !== 0) return byOrderDate
      return compareNullableDatesDesc(a.createdAt, b.createdAt)
    })
  }

  if (status === 'CONSEGNA PIANIFICATA') {
    return [...rows].sort((a, b) => {
      const byDeliveryDate = compareNullableDatesDesc(a.dataConsegna, b.dataConsegna)
      if (byDeliveryDate !== 0) return byDeliveryDate
      return compareNullableDatesDesc(a.createdAt, b.createdAt)
    })
  }

  return [...rows].sort((a, b) => {
    const byLastModified = compareNullableDatesDesc(lastModifiedByOrder.get(a.id), lastModifiedByOrder.get(b.id))
    if (byLastModified !== 0) return byLastModified
    const byCreatedAt = compareNullableDatesDesc(a.createdAt, b.createdAt)
    if (byCreatedAt !== 0) return byCreatedAt
    return compareNullableDatesDesc(a.dataOrdine, b.dataOrdine)
  })
}

function safeFilename(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_')
}

function getFileExtension(value: string): string {
  const index = value.lastIndexOf('.')
  if (index <= 0) return ''
  return value.slice(index + 1).toLowerCase()
}

function validateAttachment(fileName: string, mimeType: string) {
  const extension = getFileExtension(fileName)
  if (!extension || !allowedAttachmentExtensions.includes(extension)) {
    throw new BadRequestError(`Unsupported file extension: ${extension || 'none'}`)
  }
  if (!allowedAttachmentMimeTypes.includes((mimeType || '').toLowerCase())) {
    throw new BadRequestError(`Unsupported mime type: ${mimeType || 'unknown'}`)
  }
}

function validateAttachmentByRole(role: 'admin' | 'operativo' | 'lettura' | undefined, fileName: string, sizeBytes: number) {
  if (!role || role === 'lettura') {
    throw new BadRequestError('Attachment upload role not allowed')
  }
  const limits = roleAttachmentLimits[role]
  const extension = getFileExtension(fileName)
  if (!limits.allowedExtensions.includes(extension)) {
    throw new BadRequestError(`Extension ${extension || 'none'} not allowed for role ${role}`)
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > limits.maxBytes) {
    throw new BadRequestError(`File too large for role ${role}: max ${limits.maxBytes} bytes`)
  }
}

function resolveAttachmentPath(storagePath: string): string {
  const resolved = path.resolve(attachmentsRoot, storagePath)
  if (!resolved.startsWith(attachmentsRoot)) {
    throw new BadRequestError('Invalid attachment path')
  }
  return resolved
}

async function addOrderEvent(payload: {
  orderId: number
  eventType: string
  fromStatus?: string | null
  toStatus?: string | null
  note?: string | null
  actor?: string | null
  details?: Record<string, unknown> | null
}) {
  await db.execute(sql`
    insert into order_events (order_id, event_type, from_status, to_status, note, actor, details)
    values (
      ${payload.orderId},
      ${payload.eventType},
      ${payload.fromStatus ?? null},
      ${payload.toStatus ?? null},
      ${payload.note ?? null},
      ${payload.actor ?? null},
      ${payload.details ? JSON.stringify(payload.details) : null}
    )
  `)
}

async function replaceOrderOperai(tx: any, orderId: number, operaiIds: number[]) {
  await tx.delete(orderOperai).where(eq(orderOperai.orderId, orderId))
  if (operaiIds.length > 0) {
    await tx.insert(orderOperai).values(operaiIds.map((operaioId) => ({ orderId, operaioId })))
  }
}

router.get('/', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query)
    const offset = (query.page - 1) * query.pageSize
    const whereClause = buildListFilters(query)
    const sortColumn = {
      rif: ordini.rifto,
      cliente: ordini.cliente,
      dataConsegna: ordini.dataConsegna,
      stato: ordini.stato,
    }[query.sortBy]

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(ordini)
        .where(whereClause)
        .orderBy(query.sortDir === 'asc' ? asc(sortColumn) : desc(sortColumn))
        .limit(query.pageSize)
        .offset(offset),
      db.select({ count: count() }).from(ordini).where(whereClause),
    ])

    res.json({
      data: rows.map(normalizeRow),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: totalRows[0]?.count ?? 0,
        totalPages: Math.ceil((totalRows[0]?.count ?? 0) / query.pageSize),
      },
    })
    ;(req as AuthenticatedRequest).auditMeta = {
      action: 'CONSEGNE_LIST',
      entity: 'consegna',
      details: { total: totalRows[0]?.count ?? 0 },
    }
  } catch (error) {
    next(error)
  }
})

router.get('/export', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query)
    const whereClause = buildListFilters(query)
    const sortColumn = {
      rif: ordini.rifto,
      cliente: ordini.cliente,
      dataConsegna: ordini.dataConsegna,
      stato: ordini.stato,
    }[query.sortBy]

    const rows = await db
      .select()
      .from(ordini)
      .where(whereClause)
      .orderBy(query.sortDir === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(10000)

    const headers = ['rif', 'cliente', 'tipoImpianto', 'dataConsegna', 'cantiere', 'stato', 'note']
    const csvRows = rows.map((row) => {
      const normalized = normalizeRow(row)
      return [
        normalized.rif,
        normalized.cliente,
        normalized.tipoImpianto ?? '',
        normalized.dataConsegna ?? '',
        normalized.cantiere ?? '',
        normalized.stato ?? '',
        normalized.note ?? '',
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    })
    const csv = [headers.join(','), ...csvRows].join('\n')

    req.auditMeta = {
      action: 'CONSEGNE_EXPORT',
      entity: 'consegna',
      details: { exportedRows: rows.length },
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="consegne_export_${new Date().toISOString().slice(0, 10)}.csv"`)
    return res.status(200).send(csv)
  } catch (error) {
    return next(error)
  }
})

router.get('/export/xlsx', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const [orders, commercialiRows, responsabiliRows, mittentiRows, vettoriRows, operaiRows, cementiRows, accessoriRows, attachmentRows] = await Promise.all([
      db.select().from(ordini),
      db.select({ id: commerciali.id, nome: commerciali.nome }).from(commerciali),
      db.select({ id: responsabiliInterni.id, nome: responsabiliInterni.nome }).from(responsabiliInterni),
      db.select({ id: mittentiDisegno.id, nome: mittentiDisegno.nome }).from(mittentiDisegno),
      db.select({ id: vettori.id, nome: vettori.nome }).from(vettori),
      db
        .select({ orderId: orderOperai.orderId, nome: operaiTable.nome })
        .from(orderOperai)
        .innerJoin(operaiTable, eq(orderOperai.operaioId, operaiTable.id)),
      db
        .select({ orderId: orderCementi.orderId, nome: cementiTipi.nome, ordinata: orderCementi.ordinata, fatta: orderCementi.fatta })
        .from(orderCementi)
        .innerJoin(cementiTipi, eq(orderCementi.tipoId, cementiTipi.id)),
      db
        .select({ orderId: orderAccessori.orderId, nome: accessoriTipi.nome, ordinata: orderAccessori.ordinata, fatta: orderAccessori.fatta })
        .from(orderAccessori)
        .innerJoin(accessoriTipi, eq(orderAccessori.tipoId, accessoriTipi.id)),
      db.select({ orderId: orderAttachments.orderId, count: count() }).from(orderAttachments).groupBy(orderAttachments.orderId),
    ])

    const commercialiMap = new Map(commercialiRows.map((row) => [row.id, row.nome]))
    const responsabiliMap = new Map(responsabiliRows.map((row) => [row.id, row.nome]))
    const mittentiMap = new Map(mittentiRows.map((row) => [row.id, row.nome]))
    const vettoriMap = new Map(vettoriRows.map((row) => [row.id, row.nome]))
    const attachmentsMap = new Map(attachmentRows.map((row) => [row.orderId, Number(row.count)]))

    const operaiByOrder = new Map<number, string[]>()
    for (const row of operaiRows) {
      const current = operaiByOrder.get(row.orderId) ?? []
      current.push(row.nome)
      operaiByOrder.set(row.orderId, current)
    }

    const cementiByOrder = new Map<number, string[]>()
    for (const row of cementiRows) {
      const current = cementiByOrder.get(row.orderId) ?? []
      current.push(formatRelationItem(row.nome, row.ordinata, row.fatta))
      cementiByOrder.set(row.orderId, current)
    }

    const accessoriByOrder = new Map<number, string[]>()
    for (const row of accessoriRows) {
      const current = accessoriByOrder.get(row.orderId) ?? []
      current.push(formatRelationItem(row.nome, row.ordinata, row.fatta))
      accessoriByOrder.set(row.orderId, current)
    }

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const msPerDay = 24 * 60 * 60 * 1000

    const exportedRows = orders.map((row) => {
      const status = row.stato ?? 'IN CORSO'
      const dueDate = row.dataConsegna ?? null
      const daysToDeadline = dueDate ? Math.round((dueDate.getTime() - startOfToday.getTime()) / msPerDay) : null
      const isLate = daysToDeadline != null && daysToDeadline < 0 && !completedStatuses.has(status.toUpperCase())
      const commerciale = row.commercialeId ? commercialiMap.get(row.commercialeId) ?? '' : ''
      const responsabile = row.responsabileInternoId ? responsabiliMap.get(row.responsabileInternoId) ?? '' : ''
      const mittente = row.disegnoMittenteId ? mittentiMap.get(row.disegnoMittenteId) ?? '' : ''
      const vettore = row.vettoreId ? vettoriMap.get(row.vettoreId) ?? '' : ''

      return {
        'ID interno': row.id,
        'External ref': row.externalRef ?? '',
        Rif: row.rifto ?? '',
        Cliente: row.cliente ?? '',
        Stato: status,
        'Data ordine': formatItalianDate(row.dataOrdine),
        'Data consegna': formatItalianDate(row.dataConsegna),
        'Giorni al termine': daysToDeadline ?? '',
        'Giorni ritardo': isLate && daysToDeadline != null ? Math.abs(daysToDeadline) : 0,
        'In ritardo': yesNo(isLate),
        Cantiere: row.cantiere ?? '',
        'Tipo impianto': row.tipoImpianto ?? '',
        Scarico: row.scarico ?? '',
        'Vasche/Cav': row.vascheCav ?? '',
        Accessori: row.accessori ?? '',
        Operai: row.operai ?? '',
        'Operai assegnati': joinValues(operaiByOrder.get(row.id) ?? []),
        Commerciale: commerciale,
        'Responsabile interno': responsabile,
        Trasporto: yesNo(row.trasporto),
        'Scarico/Carico': yesNo(row.scaricoCarico),
        'Acconto pagato': yesNo(row.accontoPagato),
        CAM: yesNo(row.camSiNo),
        'Disegno spedito il': formatItalianDate(row.disegnoSpeditoAt),
        'Mittente disegno': mittente,
        'Note disegno': row.disegnoNote ?? '',
        'Massicciata nota': row.massicciataNota ?? '',
        'Tipo carici nota': row.tipoCariciNota ?? '',
        'Lavorazione assegnata il': formatItalianDate(row.lavorazioneAssegnataAt),
        'Consegna effettiva il': formatItalianDate(row.consegnaDataEffettiva),
        Vettore: vettore,
        'DDT pronti': yesNo(row.ddtPronti),
        Bancale: yesNo(row.bancale),
        Chiusini: yesNo(row.chiusini),
        'Carico verificato': yesNo(row.caricoVerificato),
        Cementi: joinValues(cementiByOrder.get(row.id) ?? []),
        'Cementi count': (cementiByOrder.get(row.id) ?? []).length,
        'Accessori relazioni': joinValues(accessoriByOrder.get(row.id) ?? []),
        'Accessori count': (accessoriByOrder.get(row.id) ?? []).length,
        Allegati: attachmentsMap.get(row.id) ?? 0,
        'Link documenti': row.folderLinkDocumenti ?? '',
        'Link foto': row.folderLinkFoto ?? '',
        Note: row.note ?? '',
        'Creato il': row.createdAt ? `${formatItalianDate(row.createdAt)} ${String(row.createdAt.getHours()).padStart(2, '0')}:${String(row.createdAt.getMinutes()).padStart(2, '0')}` : '',
      }
    })

    const statusCounts = new Map<string, { total: number; late: number }>()
    for (const row of exportedRows) {
      const status = String(row.Stato || 'IN CORSO')
      const current = statusCounts.get(status) ?? { total: 0, late: 0 }
      current.total += 1
      current.late += row['In ritardo'] === 'Si' ? 1 : 0
      statusCounts.set(status, current)
    }

    const clientCounts = new Map<string, number>()
    for (const row of exportedRows) {
      const cliente = String(row.Cliente || '-')
      clientCounts.set(cliente, (clientCounts.get(cliente) ?? 0) + 1)
    }

    const summaryRows = [
      ['Riepilogo export ordini'],
      ['KPI'],
      ['Totale ordini', exportedRows.length],
      ['Ordini in ritardo', exportedRows.filter((row) => row['In ritardo'] === 'Si').length],
      ['Senza data consegna', exportedRows.filter((row) => !row['Data consegna']).length],
      ['Senza commerciale', exportedRows.filter((row) => !row.Commerciale).length],
      ['Senza responsabile', exportedRows.filter((row) => !row['Responsabile interno']).length],
      ['Senza link documenti', exportedRows.filter((row) => !row['Link documenti']).length],
      ['Senza link foto', exportedRows.filter((row) => !row['Link foto']).length],
      [''],
      ['Stato', 'Totale', 'In ritardo'],
      ...allowedStatuses.map((status) => [status, statusCounts.get(status)?.total ?? 0, statusCounts.get(status)?.late ?? 0]),
      [''],
      ['Top clienti', 'Ordini'],
      ...Array.from(clientCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([cliente, total]) => [cliente, total]),
    ]

    const workbook = XLSX.utils.book_new()
    const ordersSheet = XLSX.utils.json_to_sheet(exportedRows)
    const orderHeaders = Object.keys(exportedRows[0] ?? {})
    ordersSheet['!cols'] = [
      { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
      { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 24 }, { wch: 22 }, { wch: 18 }, { wch: 12 },
      { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 24 },
      { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    ]
    ordersSheet['!freeze'] = {
      xSplit: '0',
      ySplit: '1',
      topLeftCell: 'A2',
      activePane: 'bottomLeft',
      state: 'frozen',
    }
    ordersSheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(0, exportedRows.length), c: Math.max(0, Object.keys(exportedRows[0] ?? {}).length - 1) },
      }),
    }
    ordersSheet['!rows'] = [{ hpt: 22 }]
    for (const [index, header] of orderHeaders.entries()) {
      const cellRef = `${XLSX.utils.encode_col(index)}1`
      if (ordersSheet[cellRef]) {
        ordersSheet[cellRef].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { patternType: 'solid', fgColor: { rgb: '1D4ED8' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: 'D1D5DB' } },
            bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
          },
        }
      }
      if (header === 'In ritardo' || header === 'Giorni ritardo') {
        styleCell(ordersSheet, cellRef, {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'DC2626' } },
        })
      }
    }
    const booleanColumns = ['Trasporto', 'Scarico/Carico', 'Acconto pagato', 'CAM', 'DDT pronti', 'Bancale', 'Carico verificato']
    const booleanColumnIndices = new Map(booleanColumns.map((header) => [header, orderHeaders.indexOf(header)]))
    exportedRows.forEach((row, rowIndex) => {
      const excelRow = rowIndex + 2
      for (const [header, columnIndex] of booleanColumnIndices.entries()) {
        if (columnIndex < 0) continue
        const ref = `${XLSX.utils.encode_col(columnIndex)}${excelRow}`
        const isYes = row[header as keyof typeof row] === 'Si'
        styleCell(ordersSheet, ref, {
          font: { bold: true, color: { rgb: isYes ? '065F46' : '6B7280' } },
          fill: {
            patternType: 'solid',
            fgColor: { rgb: isYes ? 'D1FAE5' : 'F3F4F6' },
          },
          alignment: { horizontal: 'center', vertical: 'center' },
        })
      }
      if (row['In ritardo'] === 'Si') {
        const lateRef = `${XLSX.utils.encode_col(orderHeaders.indexOf('In ritardo'))}${excelRow}`
        const delayRef = `${XLSX.utils.encode_col(orderHeaders.indexOf('Giorni ritardo'))}${excelRow}`
        styleCell(ordersSheet, lateRef, {
          font: { bold: true, color: { rgb: '991B1B' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'FEE2E2' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        })
        styleCell(ordersSheet, delayRef, {
          font: { bold: true, color: { rgb: '991B1B' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'FEE2E2' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        })
      }
    })
    XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Ordini')

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }]
    summarySheet['!freeze'] = {
      xSplit: '0',
      ySplit: '1',
      topLeftCell: 'A2',
      activePane: 'bottomLeft',
      state: 'frozen',
    }
    summarySheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 10, c: 0 },
        e: { r: 10 + allowedStatuses.length, c: 2 },
      }),
    }
    for (const cellRef of ['A11', 'B11', 'C11', 'A22', 'B22']) {
      if (summarySheet[cellRef]) {
        summarySheet[cellRef].s = {
          font: { bold: true, color: { rgb: '1F2937' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } },
        }
      }
    }
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Riepilogo')

    const workbookBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer', cellStyles: true })

    req.auditMeta = {
      action: 'CONSEGNE_EXPORT_XLSX',
      entity: 'consegna',
      details: { exportedRows: exportedRows.length },
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="consegne_export_${new Date().toISOString().slice(0, 10)}.xlsx"`)
    return res.status(200).send(workbookBuffer)
  } catch (error) {
    return next(error)
  }
})

router.get('/board', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query)
    const whereClause = buildListFilters(query)
    const [rows, cementiRows, lastModifiedRows, conclusiRows] = await Promise.all([
      db
        .select()
        .from(ordini)
        .where(whereClause)
        .orderBy(desc(ordini.dataConsegna), desc(ordini.createdAt)),
      db
        .select({
          orderId: orderCementi.orderId,
          tipoId: orderCementi.tipoId,
          nome: cementiTipi.nome,
          ordine: cementiTipi.ordine,
          ordinata: orderCementi.ordinata,
          fatta: orderCementi.fatta,
        })
        .from(orderCementi)
        .innerJoin(cementiTipi, eq(orderCementi.tipoId, cementiTipi.id))
        .orderBy(asc(orderCementi.orderId), asc(cementiTipi.ordine)),
      db.execute(sql`
        select
          order_id as "orderId",
          max(created_at) as "lastModifiedAt"
        from order_events
        group by order_id
      `),
      db.execute(sql`
        select
          order_id as "orderId",
          details
        from order_events
        where to_status = 'CONCLUSI'
        order by created_at desc, id desc
      `),
    ])
    const cementiByOrder = new Map<number, typeof cementiRows>()
    for (const row of cementiRows) {
      const current = cementiByOrder.get(row.orderId) ?? []
      current.push(row)
      cementiByOrder.set(row.orderId, current)
    }

    const lastModifiedByOrder = new Map<number, Date | null>()
    for (const row of lastModifiedRows as Array<{ orderId: number; lastModifiedAt: string | Date | null }>) {
      lastModifiedByOrder.set(row.orderId, row.lastModifiedAt ? new Date(row.lastModifiedAt) : null)
    }

    const conclusiByOrder = new Map<number, { conclusiMode: 'week' | 'date' | null; conclusiWeek: string | null; conclusiDate: string | null }>()
    for (const row of conclusiRows as Array<{ orderId: number; details: unknown }>) {
      if (conclusiByOrder.has(row.orderId)) continue
      const details = parseEventDetails(row.details)
      if (!details) continue
      conclusiByOrder.set(row.orderId, {
        conclusiMode: (details.conclusiMode as 'week' | 'date' | undefined) ?? null,
        conclusiWeek: (details.conclusiWeek as string | undefined) ?? null,
        conclusiDate: (details.conclusiDate as string | undefined) ?? null,
      })
    }

    const columns = allowedStatuses.map((status) => ({
      status,
      count: rows.filter((row) => (row.stato ?? 'IN CORSO') === status).length,
      items: sortBoardItems(
        status,
        rows.filter((row) => (row.stato ?? 'IN CORSO') === status),
        lastModifiedByOrder,
      ).map((row) => ({
        ...normalizeRow(row),
        conclusiMode: conclusiByOrder.get(row.id)?.conclusiMode ?? null,
        conclusiWeek: conclusiByOrder.get(row.id)?.conclusiWeek ?? null,
        conclusiDate: conclusiByOrder.get(row.id)?.conclusiDate ?? null,
        cementi: (cementiByOrder.get(row.id) ?? []).map((cemento) => ({
          tipoId: cemento.tipoId,
          nome: cemento.nome,
          ordine: cemento.ordine,
          ordinata: cemento.ordinata,
          fatta: cemento.fatta,
        })),
      })),
    }))

    return res.json({ columns })
  } catch (error) {
    return next(error)
  }
})

router.get('/stats', async (_req, res, next) => {
  try {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const day = now.getDay() || 7
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - day + 1)
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const nextMonday = new Date(startOfWeek)
    nextMonday.setDate(startOfWeek.getDate() + 7)
    const nextSunday = new Date(nextMonday)
    nextSunday.setDate(nextMonday.getDate() + 6)
    nextSunday.setHours(23, 59, 59, 999)

    const eightWeeksOut = new Date(startOfToday.getTime() + 8 * 7 * 24 * 60 * 60 * 1000)

    const activeFilter = sql`upper(coalesce(${ordini.stato}, 'IN CORSO')) not in ('CONCLUSI')`

    const [
      weekRows,
      lateRows,
      byStatusRows,
      weeklyTrendRows,
      totalAttiviRows,
      nextWeekRows,
      accontiRows,
      incompleteRows,
      missingResponsabileRows,
      missingDocumentiRows,
      missingFotoRows,
      pipelineRows,
      pipelineLateRows,
      upcomingRows,
      byClienteRows,
    ] = await Promise.all([
      db
        .select({ count: count() })
        .from(ordini)
        .where(and(gte(ordini.dataConsegna, startOfWeek), lte(ordini.dataConsegna, endOfWeek))),
      db
        .select({ count: count() })
        .from(ordini)
        .where(
          and(
            lte(ordini.dataConsegna, now),
            or(sql`${ordini.stato} is null`, sql`upper(${ordini.stato}) not in ('CONSEGNATO', 'CHIUSO')`),
          ),
        ),
      db
        .select({
          stato: sql<string>`coalesce(${ordini.stato}, 'IN CORSO')`,
          count: count(),
        })
        .from(ordini)
        .groupBy(sql`coalesce(${ordini.stato}, 'IN CORSO')`)
        .orderBy(desc(count())),
      db
        .select({
          week: sql<string>`to_char(date_trunc('week', ${ordini.dataConsegna}), 'IYYY-IW')`,
          count: count(),
        })
        .from(ordini)
        .where(sql`${ordini.dataConsegna} is not null`)
        .groupBy(sql`date_trunc('week', ${ordini.dataConsegna})`)
        .orderBy(sql`date_trunc('week', ${ordini.dataConsegna}) desc`)
        .limit(8),
      // totale ordini attivi (non CONCLUSI)
      db.select({ count: count() }).from(ordini).where(activeFilter),
      // consegne settimana prossima
      db
        .select({ count: count() })
        .from(ordini)
        .where(and(gte(ordini.dataConsegna, nextMonday), lte(ordini.dataConsegna, nextSunday), activeFilter)),
      // acconti da incassare
      db.select({ count: count() }).from(ordini).where(and(eq(ordini.accontoPagato, false), activeFilter)),
      // ordini incompleti
      db
        .select({ count: count() })
        .from(ordini)
        .where(
          and(
            activeFilter,
            or(
              sql`${ordini.dataConsegna} is null`,
              sql`${ordini.responsabileInternoId} is null`,
              sql`${ordini.folderLinkDocumenti} is null`,
              sql`${ordini.folderLinkDocumenti} = ''`,
              sql`${ordini.folderLinkFoto} is null`,
              sql`${ordini.folderLinkFoto} = ''`,
            ),
          ),
        ),
      // qualità dati: responsabile mancante
      db.select({ count: count() }).from(ordini).where(and(activeFilter, or(sql`${ordini.responsabileInternoId} is null`, sql`${ordini.responsabileInternoId} = 0`))),
      // qualità dati: cartella documenti mancante
      db.select({ count: count() }).from(ordini).where(and(activeFilter, or(sql`${ordini.folderLinkDocumenti} is null`, sql`${ordini.folderLinkDocumenti} = ''`))),
      // qualità dati: cartella foto mancante
      db.select({ count: count() }).from(ordini).where(and(activeFilter, or(sql`${ordini.folderLinkFoto} is null`, sql`${ordini.folderLinkFoto} = ''`))),
      // pipeline: totale per stato
      db
        .select({ stato: sql<string>`coalesce(${ordini.stato}, 'IN CORSO')`, total: count() })
        .from(ordini)
        .groupBy(sql`coalesce(${ordini.stato}, 'IN CORSO')`),
      // pipeline: ritardi per stato (data consegna passata, non conclusi)
      db
        .select({ stato: sql<string>`coalesce(${ordini.stato}, 'IN CORSO')`, late: count() })
        .from(ordini)
        .where(and(lt(ordini.dataConsegna, startOfToday), activeFilter))
        .groupBy(sql`coalesce(${ordini.stato}, 'IN CORSO')`),
      // carico prossime 8 settimane
      db
        .select({
          week: sql<string>`to_char(date_trunc('week', ${ordini.dataConsegna}), 'IYYY-IW')`,
          count: count(),
        })
        .from(ordini)
        .where(
          and(
            sql`${ordini.dataConsegna} is not null`,
            gte(ordini.dataConsegna, startOfToday),
            lte(ordini.dataConsegna, eightWeeksOut),
            activeFilter,
          ),
        )
        .groupBy(sql`date_trunc('week', ${ordini.dataConsegna})`)
        .orderBy(sql`date_trunc('week', ${ordini.dataConsegna}) asc`),
      // top 10 clienti per ordini attivi
      db
        .select({ cliente: ordini.cliente, count: count() })
        .from(ordini)
        .where(and(sql`${ordini.cliente} is not null`, activeFilter))
        .groupBy(ordini.cliente)
        .orderBy(desc(count()))
        .limit(10),
    ])

    const pipelineLateMap = new Map(pipelineLateRows.map((r) => [r.stato, Number(r.late)]))
    const pipelineConRitardi = pipelineRows.map((r) => ({
      stato: r.stato,
      total: Number(r.total),
      late: pipelineLateMap.get(r.stato) ?? 0,
    }))

    res.json({
      kpi: {
        consegneSettimanaCorrente: Number(weekRows[0]?.count ?? 0),
        consegneProssimaSettimana: Number(nextWeekRows[0]?.count ?? 0),
        ritardi: Number(lateRows[0]?.count ?? 0),
        totaleAttivi: Number(totalAttiviRows[0]?.count ?? 0),
        accontiDaIncassare: Number(accontiRows[0]?.count ?? 0),
        ordiniIncompleti: Number(incompleteRows[0]?.count ?? 0),
        senzaResponsabile: Number(missingResponsabileRows[0]?.count ?? 0),
        senzaDocumenti: Number(missingDocumentiRows[0]?.count ?? 0),
        senzaFoto: Number(missingFotoRows[0]?.count ?? 0),
      },
      byStatus: byStatusRows,
      pipelineConRitardi,
      weeklyTrend: weeklyTrendRows.reverse(),
      upcomingByWeek: upcomingRows,
      byClienteAttivi: byClienteRows.map((r) => ({ cliente: r.cliente ?? '—', count: Number(r.count) })),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/filters', async (_req, res, next) => {
  try {
    const [clienti, stati] = await Promise.all([
      db.selectDistinct({ value: ordini.cliente }).from(ordini).where(sql`${ordini.cliente} is not null`),
      db.selectDistinct({ value: ordini.stato }).from(ordini).where(sql`${ordini.stato} is not null`),
    ])

    res.json({
      clienti: clienti.map((r) => r.value).filter(Boolean).sort(),
      stati: stati.map((r) => r.value).filter(Boolean).sort(),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/:id/history', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'Invalid id' })
    }

    const events = await db.execute(sql`
      select
        id,
        order_id as "orderId",
        event_type as "eventType",
        from_status as "fromStatus",
        to_status as "toStatus",
        note,
        actor,
        details,
        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt"
      from order_events
      where order_id = ${id}
      order by created_at desc, id desc
    `)

    return res.json({
      data: (events as unknown as OrderEvent[]).map((event) => ({
        ...event,
        details: typeof event.details === 'string' && event.details
          ? JSON.parse(event.details)
          : event.details,
      })),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/:id/attachments', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'Invalid id' })
    }

    const rows = await db
      .select({
        id: orderAttachments.id,
        orderId: orderAttachments.orderId,
        fileName: orderAttachments.fileName,
        mimeType: orderAttachments.mimeType,
        sizeBytes: orderAttachments.sizeBytes,
        uploadedBy: orderAttachments.uploadedBy,
        createdAt: sql<string>`to_char(${orderAttachments.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
      })
      .from(orderAttachments)
      .where(eq(orderAttachments.orderId, id))
      .orderBy(desc(orderAttachments.createdAt), desc(orderAttachments.id))

    return res.json({ data: rows as Attachment[] })
  } catch (error) {
    return next(error)
  }
})

router.post('/:id/attachments', requireAuth, requireRole(['admin', 'operativo']), upload.single('file'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'Invalid id' })
    }

    const [row] = await db.select({ id: ordini.id }).from(ordini).where(eq(ordini.id, id)).limit(1)
    if (!row) {
      return res.status(404).json({ message: 'Consegna not found' })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({ message: 'Missing file' })
    }
    validateAttachmentByRole(req.user?.role, file.originalname || '', file.size)
    validateAttachment(file.originalname || '', file.mimetype || '')
    const scanResult = await scanBufferWithAntivirus(file.buffer, file.originalname || '')
    if (!scanResult.clean) {
      return res.status(400).json({ message: 'Attachment blocked by antivirus scan' })
    }

    const safeName = safeFilename(file.originalname || 'attachment.bin')
    const uniqueName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}_${safeName}`
    const relativePath = path.join(String(id), uniqueName)
    const absolutePath = resolveAttachmentPath(relativePath)

    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, file.buffer)

    const [created] = await db
      .insert(orderAttachments)
      .values({
        orderId: id,
        fileName: file.originalname || uniqueName,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        storagePath: relativePath,
        uploadedBy: req.user?.username ?? null,
      })
      .returning({
        id: orderAttachments.id,
        orderId: orderAttachments.orderId,
        fileName: orderAttachments.fileName,
        mimeType: orderAttachments.mimeType,
        sizeBytes: orderAttachments.sizeBytes,
        uploadedBy: orderAttachments.uploadedBy,
        createdAt: orderAttachments.createdAt,
      })

    await addOrderEvent({
      orderId: id,
      eventType: 'ATTACHMENT_ADDED',
      note: `${created.fileName} [scan:${scanResult.scanner}]`,
      actor: req.user?.username ?? null,
    })

    return res.status(201).json({
      id: created.id,
      orderId: created.orderId,
      fileName: created.fileName,
      mimeType: created.mimeType,
      sizeBytes: created.sizeBytes,
      uploadedBy: created.uploadedBy,
      createdAt: created.createdAt?.toISOString?.() ?? null,
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/:id/attachments/:attachmentId', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Number(req.params.id)
    const attachmentId = Number(req.params.attachmentId)
    if (!Number.isFinite(id) || !Number.isFinite(attachmentId)) {
      return res.status(400).json({ message: 'Invalid id' })
    }

    const [attachment] = await db
      .select()
      .from(orderAttachments)
      .where(and(eq(orderAttachments.id, attachmentId), eq(orderAttachments.orderId, id)))
      .limit(1)
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' })
    }

    const absolutePath = resolveAttachmentPath(attachment.storagePath)
    const content = await fs.readFile(absolutePath)
    res.setHeader('Content-Type', attachment.mimeType)
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename(attachment.fileName)}"`)
    return res.send(content)
  } catch (error) {
    return next(error)
  }
})

router.delete('/:id/attachments/:attachmentId', requireAuth, requireRole(['admin', 'operativo']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Number(req.params.id)
    const attachmentId = Number(req.params.attachmentId)
    if (!Number.isFinite(id) || !Number.isFinite(attachmentId)) {
      return res.status(400).json({ message: 'Invalid id' })
    }

    const [deleted] = await db
      .delete(orderAttachments)
      .where(and(eq(orderAttachments.id, attachmentId), eq(orderAttachments.orderId, id)))
      .returning({
        id: orderAttachments.id,
        fileName: orderAttachments.fileName,
        storagePath: orderAttachments.storagePath,
      })

    if (!deleted) {
      return res.status(404).json({ message: 'Attachment not found' })
    }

    const absolutePath = resolveAttachmentPath(deleted.storagePath)
    await fs.rm(absolutePath, { force: true })

    await addOrderEvent({
      orderId: id,
      eventType: 'ATTACHMENT_REMOVED',
      note: deleted.fileName,
      actor: req.user?.username ?? null,
    })

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
})

router.post('/:id/transition', requireAuth, requireRole(['admin', 'operativo']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'Invalid id' })
    }

    const payload = transitionSchema.parse(req.body)
    const [row] = await db.select().from(ordini).where(eq(ordini.id, id)).limit(1)

    if (!row) {
      return res.status(404).json({ message: 'Consegna not found' })
    }

    const currentStatus = row.stato ?? 'IN CORSO'
    if (payload.toStatus === currentStatus) {
      return res.status(400).json({ message: 'Order already in requested status' })
    }

    const allowedNext = transitionMap[currentStatus as keyof typeof transitionMap] ?? []
    if (!allowedNext.includes(payload.toStatus)) {
      return res.status(400).json({
        message: `Transizione non consentita: ${currentStatus} -> ${payload.toStatus}`,
      })
    }

    if (payload.toStatus === 'SOSPESO' && !payload.note?.trim()) {
      return res.status(400).json({ message: 'Sospensione richiede un motivo' })
    }

    if (payload.toStatus === 'PRONTI & AVVISATI' && !row.accontoPagato) {
      return res.status(400).json({
        message: "Impossibile avanzare a 'PRONTI & AVVISATI': acconto non ancora registrato come pagato.",
      })
    }

    if (payload.toStatus === 'ASSEGNATO' && !payload.skipAssegnazione) {
      if (!payload.lavorazioneAssegnataAt) {
        return res.status(400).json({ message: 'Data assegnazione obbligatoria per ASSEGNATO' })
      }
      if (!payload.operaiIds?.length) {
        return res.status(400).json({ message: 'Seleziona almeno un operaio' })
      }
    }
    if (payload.toStatus === 'CONCLUSI') {
      const conclusiMode = payload.conclusiMode ?? 'week'
      if (conclusiMode === 'week' && !payload.conclusiWeek) {
        return res.status(400).json({ message: 'Settimana obbligatoria per CONCLUSI' })
      }
      if (conclusiMode === 'date' && !payload.conclusiDate) {
        return res.status(400).json({ message: 'Data obbligatoria per CONCLUSI' })
      }
    }

    const [updated] = await db.transaction(async (tx) => {
      const updateData: Partial<typeof ordini.$inferInsert> = {
        stato: payload.toStatus,
        note: payload.note ? `${row.note ? `${row.note}\n` : ''}${payload.note}` : row.note,
      }

      if (payload.toStatus === 'ASSEGNATO' && !payload.skipAssegnazione) {
        updateData.lavorazioneAssegnataAt = parseInputDate(payload.lavorazioneAssegnataAt!)
      }

      const [result] = await tx.update(ordini).set(updateData).where(eq(ordini.id, id)).returning()
      if (payload.toStatus === 'ASSEGNATO' && !payload.skipAssegnazione) {
        await replaceOrderOperai(tx, id, payload.operaiIds ?? [])
      }
      return result ? [result] : []
    })

    const transitionDetails =
      payload.toStatus === 'ASSEGNATO'
        ? {
          lavorazioneAssegnataAt: payload.lavorazioneAssegnataAt,
          operaiIds: payload.operaiIds ?? [],
          skipAssegnazione: payload.skipAssegnazione ?? false,
        }
        : payload.toStatus === 'CONCLUSI'
          ? {
            conclusiMode: payload.conclusiMode ?? 'week',
            conclusiWeek: (payload.conclusiMode ?? 'week') === 'week' ? payload.conclusiWeek ?? null : null,
            conclusiDate: (payload.conclusiMode ?? 'week') === 'date' ? payload.conclusiDate ?? null : null,
          }
          : null

    await addOrderEvent({
      orderId: id,
      eventType: payload.toStatus === 'SOSPESO' ? 'STATUS_SUSPENDED' : 'STATUS_CHANGED',
      fromStatus: currentStatus,
      toStatus: payload.toStatus,
      note: payload.note ?? null,
      actor: req.user?.username ?? null,
      details: transitionDetails,
    })

    return res.json(normalizeRow(updated))
  } catch (error) {
    return next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'Invalid id' })
    }

    const [row] = await db.select().from(ordini).where(eq(ordini.id, id)).limit(1)
    if (!row) {
      return res.status(404).json({ message: 'Consegna not found' })
    }

    const [operaiRows, cementiRows, accessoriRows] = await Promise.all([
      db
        .select({ id: operaiTable.id, nome: operaiTable.nome })
        .from(orderOperai)
        .innerJoin(operaiTable, eq(orderOperai.operaioId, operaiTable.id))
        .where(eq(orderOperai.orderId, id)),
      db
        .select({
          tipoId: orderCementi.tipoId,
          nome: cementiTipi.nome,
          ordine: cementiTipi.ordine,
          ordinata: orderCementi.ordinata,
          fatta: orderCementi.fatta,
        })
        .from(orderCementi)
        .innerJoin(cementiTipi, eq(orderCementi.tipoId, cementiTipi.id))
        .where(eq(orderCementi.orderId, id))
        .orderBy(cementiTipi.ordine),
      db
        .select({
          tipoId: orderAccessori.tipoId,
          nome: accessoriTipi.nome,
          ordine: accessoriTipi.ordine,
          ordinata: orderAccessori.ordinata,
          fatta: orderAccessori.fatta,
        })
        .from(orderAccessori)
        .innerJoin(accessoriTipi, eq(orderAccessori.tipoId, accessoriTipi.id))
        .where(eq(orderAccessori.orderId, id))
        .orderBy(accessoriTipi.ordine),
    ])

    const [conclusiEvent] = await db.execute(sql`
      select details
      from order_events
      where order_id = ${id} and to_status = 'CONCLUSI'
      order by created_at desc, id desc
      limit 1
    `)
    const conclusiDetails = conclusiEvent && typeof (conclusiEvent as { details?: unknown }).details === 'string'
      ? JSON.parse(String((conclusiEvent as { details: string }).details))
      : (conclusiEvent as { details?: Record<string, unknown> } | undefined)?.details ?? null

    return res.json({
      ...normalizeRow(row),
      operaiAssegnati: operaiRows,
      cementi: cementiRows,
      accessori: accessoriRows,
      conclusiMode: (conclusiDetails?.conclusiMode as 'week' | 'date' | undefined) ?? null,
      conclusiWeek: (conclusiDetails?.conclusiWeek as string | undefined) ?? null,
      conclusiDate: (conclusiDetails?.conclusiDate as string | undefined) ?? null,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/', requireAuth, requireRole(['admin', 'operativo']), async (req, res, next) => {
  try {
    const payload = consegnaInputSchema.parse(req.body)

    const [created] = await db
      .insert(ordini)
      .values({
        rifto: payload.rif,
        cliente: payload.cliente,
        tipoImpianto: payload.tipoImpianto ?? null,
        dataConsegna: payload.dataConsegna ? parseInputDate(payload.dataConsegna) : null,
        cantiere: payload.cantiere ?? null,
        dataOrdine: payload.dataOrdine ? parseInputDate(payload.dataOrdine) : null,
        referente: payload.referente ?? null,
        telefono: payload.telefono ?? null,
        scarico: payload.scarico ?? null,
        vascheCav: payload.vascheCav ?? null,
        accessori: payload.accessori ?? null,
        operai: payload.operai ?? null,
        stato: payload.stato,
        note: payload.note ?? null,
        trasporto: payload.trasporto ?? false,
        scaricoCarico: payload.scaricoCarico ?? false,
        accontoPagato: payload.accontoPagato ?? false,
        commercialeId: payload.commercialeId ?? null,
        responsabileInternoId: payload.responsabileInternoId ?? null,
        bilici: payload.bilici ?? 0,
        chiusini: payload.chiusini ?? false,
      })
      .returning()

    await addOrderEvent({
      orderId: created.id,
      eventType: 'ORDER_CREATED',
      fromStatus: null,
      toStatus: created.stato ?? 'IN CORSO',
      note: created.note ?? null,
      actor: null,
    })

    res.status(201).json(normalizeRow(created))
  } catch (error) {
    next(error)
  }
})

router.put('/:id', requireAuth, requireRole(['admin', 'operativo']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'Invalid id' })
    }

    const payload = consegnaInputSchema.partial().parse(req.body)
    const [existing] = await db.select().from(ordini).where(eq(ordini.id, id)).limit(1)
    if (!existing) {
      return res.status(404).json({ message: 'Consegna not found' })
    }
    const updateData: Partial<typeof ordini.$inferInsert> = {}

    if ('rif' in payload) updateData.rifto = payload.rif
    if ('cliente' in payload) updateData.cliente = payload.cliente
    if ('tipoImpianto' in payload) updateData.tipoImpianto = payload.tipoImpianto ?? null
    if ('dataConsegna' in payload) updateData.dataConsegna = payload.dataConsegna ? parseInputDate(payload.dataConsegna) : null
    if ('cantiere' in payload) updateData.cantiere = payload.cantiere ?? null
    if ('dataOrdine' in payload) updateData.dataOrdine = payload.dataOrdine ? parseInputDate(payload.dataOrdine) : null
    if ('referente' in payload) updateData.referente = payload.referente ?? null
    if ('telefono' in payload) updateData.telefono = payload.telefono ?? null
    if ('scarico' in payload) updateData.scarico = payload.scarico ?? null
    if ('vascheCav' in payload) updateData.vascheCav = payload.vascheCav ?? null
    if ('accessori' in payload) updateData.accessori = payload.accessori ?? null
    if ('operai' in payload) updateData.operai = payload.operai ?? null
    if ('stato' in payload) updateData.stato = payload.stato
    if ('note' in payload) updateData.note = payload.note ?? null
    if ('trasporto' in payload) updateData.trasporto = payload.trasporto ?? false
    if ('scaricoCarico' in payload) updateData.scaricoCarico = payload.scaricoCarico ?? false
    if ('accontoPagato' in payload) updateData.accontoPagato = payload.accontoPagato ?? false
    if ('commercialeId' in payload) updateData.commercialeId = payload.commercialeId ?? null
    if ('responsabileInternoId' in payload) updateData.responsabileInternoId = payload.responsabileInternoId ?? null
    if ('folderLinkDocumenti' in payload) updateData.folderLinkDocumenti = payload.folderLinkDocumenti ?? null
    if ('folderLinkFoto' in payload) updateData.folderLinkFoto = payload.folderLinkFoto ?? null
    // nuovi campi scalar
    if ('disegnoSpeditoAt' in payload) updateData.disegnoSpeditoAt = payload.disegnoSpeditoAt ? parseInputDate(payload.disegnoSpeditoAt) : null
    if ('disegnoMittenteId' in payload) updateData.disegnoMittenteId = payload.disegnoMittenteId ?? null
    if ('disegnoNote' in payload) updateData.disegnoNote = payload.disegnoNote ?? null
    if ('massicciataNota' in payload) updateData.massicciataNota = payload.massicciataNota ?? null
    if ('tipoCariciNota' in payload) updateData.tipoCariciNota = payload.tipoCariciNota ?? null
    if ('lavorazioneAssegnataAt' in payload) updateData.lavorazioneAssegnataAt = payload.lavorazioneAssegnataAt ? parseInputDate(payload.lavorazioneAssegnataAt) : null
    if ('consegnaDataEffettiva' in payload) updateData.consegnaDataEffettiva = payload.consegnaDataEffettiva ? parseInputDate(payload.consegnaDataEffettiva) : null
    if ('vettoreId' in payload) updateData.vettoreId = payload.vettoreId ?? null
    if ('bilici' in payload) updateData.bilici = payload.bilici ?? 0
    if ('ddtPronti' in payload) updateData.ddtPronti = payload.ddtPronti ?? false
    if ('bancale' in payload) updateData.bancale = payload.bancale ?? false
    if ('chiusini' in payload) updateData.chiusini = payload.chiusini ?? false
    if ('caricoVerificato' in payload) updateData.caricoVerificato = payload.caricoVerificato ?? false
    if ('camSiNo' in payload) updateData.camSiNo = payload.camSiNo ?? false

    // Calculate field-level diff (old vs new)
    const diff: Record<string, { from: unknown; to: unknown }> = {}
    const normDate = (d: Date | null | undefined): string | null =>
      d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null
    const diffStr = (field: string, o: string | null | undefined, n: string | null | undefined): void => {
      if ((o ?? '') !== (n ?? '')) diff[field] = { from: o ?? null, to: n ?? null }
    }
    const diffBool = (field: string, o: boolean | null | undefined, n: boolean | null | undefined): void => {
      if ((o ?? false) !== (n ?? false)) diff[field] = { from: o ?? false, to: n ?? false }
    }
    const diffNum = (field: string, o: number | null | undefined, n: number | null | undefined): void => {
      if ((o ?? null) !== (n ?? null)) diff[field] = { from: o ?? null, to: n ?? null }
    }

    if ('rif' in payload) diffStr('rif', existing.rifto, payload.rif)
    if ('cliente' in payload) diffStr('cliente', existing.cliente, payload.cliente)
    if ('tipoImpianto' in payload) diffStr('tipoImpianto', existing.tipoImpianto, payload.tipoImpianto)
    if ('dataConsegna' in payload) diffStr('dataConsegna', normDate(existing.dataConsegna), payload.dataConsegna)
    if ('cantiere' in payload) diffStr('cantiere', existing.cantiere, payload.cantiere)
    if ('dataOrdine' in payload) diffStr('dataOrdine', normDate(existing.dataOrdine), payload.dataOrdine)
    if ('scarico' in payload) diffStr('scarico', existing.scarico, payload.scarico)
    if ('vascheCav' in payload) diffStr('vascheCav', existing.vascheCav, payload.vascheCav)
    if ('accessori' in payload) diffStr('accessori', existing.accessori, payload.accessori)
    if ('operai' in payload) diffStr('operai', existing.operai, payload.operai)
    if ('stato' in payload) diffStr('stato', existing.stato, payload.stato)
    if ('note' in payload) diffStr('note', existing.note, payload.note)
    if ('trasporto' in payload) diffBool('trasporto', existing.trasporto, payload.trasporto)
    if ('scaricoCarico' in payload) diffBool('scaricoCarico', existing.scaricoCarico, payload.scaricoCarico)
    if ('accontoPagato' in payload) diffBool('accontoPagato', existing.accontoPagato, payload.accontoPagato)
    if ('commercialeId' in payload) diffNum('commercialeId', existing.commercialeId, payload.commercialeId)
    if ('responsabileInternoId' in payload) diffNum('responsabileInternoId', existing.responsabileInternoId, payload.responsabileInternoId)
    if ('folderLinkDocumenti' in payload) diffStr('folderLinkDocumenti', existing.folderLinkDocumenti, payload.folderLinkDocumenti)
    if ('folderLinkFoto' in payload) diffStr('folderLinkFoto', existing.folderLinkFoto, payload.folderLinkFoto)
    if ('disegnoSpeditoAt' in payload) diffStr('disegnoSpeditoAt', normDate(existing.disegnoSpeditoAt), payload.disegnoSpeditoAt)
    if ('disegnoMittenteId' in payload) diffNum('disegnoMittenteId', existing.disegnoMittenteId, payload.disegnoMittenteId)
    if ('disegnoNote' in payload) diffStr('disegnoNote', existing.disegnoNote, payload.disegnoNote)
    if ('massicciataNota' in payload) diffStr('massicciataNota', existing.massicciataNota, payload.massicciataNota)
    if ('tipoCariciNota' in payload) diffStr('tipoCariciNota', existing.tipoCariciNota, payload.tipoCariciNota)
    if ('lavorazioneAssegnataAt' in payload) diffStr('lavorazioneAssegnataAt', normDate(existing.lavorazioneAssegnataAt), payload.lavorazioneAssegnataAt)
    if ('consegnaDataEffettiva' in payload) diffStr('consegnaDataEffettiva', normDate(existing.consegnaDataEffettiva), payload.consegnaDataEffettiva)
    if ('vettoreId' in payload) diffNum('vettoreId', existing.vettoreId, payload.vettoreId)
    if ('bilici' in payload) diffNum('bilici', existing.bilici, payload.bilici)
    if ('ddtPronti' in payload) diffBool('ddtPronti', existing.ddtPronti, payload.ddtPronti)
    if ('bancale' in payload) diffBool('bancale', existing.bancale, payload.bancale)
    if ('chiusini' in payload) diffBool('chiusini', existing.chiusini, payload.chiusini)
    if ('caricoVerificato' in payload) diffBool('caricoVerificato', existing.caricoVerificato, payload.caricoVerificato)
    if ('camSiNo' in payload) diffBool('camSiNo', existing.camSiNo, payload.camSiNo)

    const [updated] = await db.update(ordini).set(updateData).where(eq(ordini.id, id)).returning()

    if (Object.keys(diff).length > 0) {
      await addOrderEvent({
        orderId: id,
        eventType: diff.stato ? 'STATUS_CHANGED' : 'ORDER_UPDATED',
        fromStatus: diff.stato ? String(diff.stato.from ?? '') || null : null,
        toStatus: diff.stato ? String(diff.stato.to ?? '') || null : null,
        note: null,
        actor: req.user?.username ?? null,
        details: { diff },
      })
    }

    req.auditMeta = {
      action: diff.stato ? 'STATUS_CHANGED' : 'ORDER_UPDATED',
      entity: 'consegna',
      entityId: id,
      details: Object.keys(diff).length > 0 ? { diff } : undefined,
    }

    res.json(normalizeRow(updated))
  } catch (error) {
    next(error)
  }
})

// --- Sub-endpoint: operai assegnati ---

router.get('/:id/operai', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const rows = await db
      .select({ id: operaiTable.id, nome: operaiTable.nome })
      .from(orderOperai)
      .innerJoin(operaiTable, eq(orderOperai.operaioId, operaiTable.id))
      .where(eq(orderOperai.orderId, id))
    return res.json({ data: rows })
  } catch (error) {
    return next(error)
  }
})

router.put('/:id/operai', requireAuth, requireRole(['admin', 'operativo']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })

    const bodySchema = z.object({ operaiIds: z.array(z.number().int().positive()) })
    const { operaiIds } = bodySchema.parse(req.body)

    const [existing] = await db.select({ id: ordini.id }).from(ordini).where(eq(ordini.id, id)).limit(1)
    if (!existing) return res.status(404).json({ message: 'Consegna not found' })

    await db.transaction(async (tx) => {
      await replaceOrderOperai(tx, id, operaiIds)
      await tx.execute(sql`
        insert into order_events (order_id, event_type, from_status, to_status, note, actor, details)
        values (
          ${id},
          ${'OPERAI_UPDATED'},
          ${null},
          ${null},
          ${null},
          ${req.user?.username ?? null},
          ${JSON.stringify({ operaiIds })}
        )
      `)
    })

    const rows = await db
      .select({ id: operaiTable.id, nome: operaiTable.nome })
      .from(orderOperai)
      .innerJoin(operaiTable, eq(orderOperai.operaioId, operaiTable.id))
      .where(eq(orderOperai.orderId, id))
    return res.json({ data: rows })
  } catch (error) {
    return next(error)
  }
})

// --- Sub-endpoint: cementi ---

router.get('/:id/cementi', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const rows = await db
      .select({
        tipoId: orderCementi.tipoId,
        nome: cementiTipi.nome,
        ordine: cementiTipi.ordine,
        ordinata: orderCementi.ordinata,
        fatta: orderCementi.fatta,
      })
      .from(orderCementi)
      .innerJoin(cementiTipi, eq(orderCementi.tipoId, cementiTipi.id))
      .where(eq(orderCementi.orderId, id))
      .orderBy(cementiTipi.ordine)
    return res.json({ data: rows })
  } catch (error) {
    return next(error)
  }
})

router.put('/:id/cementi', requireAuth, requireRole(['admin', 'operativo']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })

    const itemSchema = z.object({ tipoId: z.number().int().positive(), ordinata: z.boolean(), fatta: z.boolean() })
    const items = z.array(itemSchema).parse(req.body)

    const [existing] = await db.select({ id: ordini.id }).from(ordini).where(eq(ordini.id, id)).limit(1)
    if (!existing) return res.status(404).json({ message: 'Consegna not found' })

    await db.transaction(async (tx) => {
      await tx.delete(orderCementi).where(eq(orderCementi.orderId, id))
      if (items.length > 0) {
        await tx.insert(orderCementi).values(items.map((item) => ({ orderId: id, tipoId: item.tipoId, ordinata: item.ordinata, fatta: item.fatta })))
      }
      await tx.execute(sql`
        insert into order_events (order_id, event_type, from_status, to_status, note, actor, details)
        values (
          ${id},
          ${'CEMENTI_UPDATED'},
          ${null},
          ${null},
          ${null},
          ${req.user?.username ?? null},
          ${JSON.stringify({ count: items.length })}
        )
      `)
    })

    const rows = await db
      .select({
        tipoId: orderCementi.tipoId,
        nome: cementiTipi.nome,
        ordine: cementiTipi.ordine,
        ordinata: orderCementi.ordinata,
        fatta: orderCementi.fatta,
      })
      .from(orderCementi)
      .innerJoin(cementiTipi, eq(orderCementi.tipoId, cementiTipi.id))
      .where(eq(orderCementi.orderId, id))
      .orderBy(cementiTipi.ordine)
    return res.json({ data: rows })
  } catch (error) {
    return next(error)
  }
})

// --- Sub-endpoint: accessori ---

router.get('/:id/accessori', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const rows = await db
      .select({
        tipoId: orderAccessori.tipoId,
        nome: accessoriTipi.nome,
        ordine: accessoriTipi.ordine,
        ordinata: orderAccessori.ordinata,
        fatta: orderAccessori.fatta,
      })
      .from(orderAccessori)
      .innerJoin(accessoriTipi, eq(orderAccessori.tipoId, accessoriTipi.id))
      .where(eq(orderAccessori.orderId, id))
      .orderBy(accessoriTipi.ordine)
    return res.json({ data: rows })
  } catch (error) {
    return next(error)
  }
})

router.put('/:id/accessori', requireAuth, requireRole(['admin', 'operativo']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })

    const itemSchema = z.object({ tipoId: z.number().int().positive(), ordinata: z.boolean(), fatta: z.boolean() })
    const items = z.array(itemSchema).parse(req.body)

    const [existing] = await db.select({ id: ordini.id }).from(ordini).where(eq(ordini.id, id)).limit(1)
    if (!existing) return res.status(404).json({ message: 'Consegna not found' })

    await db.transaction(async (tx) => {
      await tx.delete(orderAccessori).where(eq(orderAccessori.orderId, id))
      if (items.length > 0) {
        await tx.insert(orderAccessori).values(items.map((item) => ({ orderId: id, tipoId: item.tipoId, ordinata: item.ordinata, fatta: item.fatta })))
      }
      await tx.execute(sql`
        insert into order_events (order_id, event_type, from_status, to_status, note, actor, details)
        values (
          ${id},
          ${'ACCESSORI_UPDATED'},
          ${null},
          ${null},
          ${null},
          ${req.user?.username ?? null},
          ${JSON.stringify({ count: items.length })}
        )
      `)
    })

    const rows = await db
      .select({
        tipoId: orderAccessori.tipoId,
        nome: accessoriTipi.nome,
        ordine: accessoriTipi.ordine,
        ordinata: orderAccessori.ordinata,
        fatta: orderAccessori.fatta,
      })
      .from(orderAccessori)
      .innerJoin(accessoriTipi, eq(orderAccessori.tipoId, accessoriTipi.id))
      .where(eq(orderAccessori.orderId, id))
      .orderBy(accessoriTipi.ordine)
    return res.json({ data: rows })
  } catch (error) {
    return next(error)
  }
})

router.delete('/:id', requireAuth, requireRole(['admin', 'operativo']), async (req, res, next) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'Invalid id' })
    }

    const [deleted] = await db.delete(ordini).where(eq(ordini.id, id)).returning({ id: ordini.id })

    if (!deleted) {
      return res.status(404).json({ message: 'Consegna not found' })
    }

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
