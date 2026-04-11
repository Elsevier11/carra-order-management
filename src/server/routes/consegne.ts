import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import multer from 'multer'
import { z } from 'zod'
import { orderAttachments, ordini } from '../../db/schema'
import { db } from '../db'
import { BadRequestError } from '../errors'
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })
const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/
const dateOrDateTimeRegex = /^\d{4}-\d{2}-\d{2}(?:T.*)?$/
const allowedStatuses = ['IN CORSO', 'IN LAVORAZIONE', 'PRONTI & AVVISATI', 'CONCLUSI', 'SOSPESO'] as const
const transitionMap: Record<(typeof allowedStatuses)[number], (typeof allowedStatuses)[number][]> = {
  'IN CORSO': ['IN LAVORAZIONE', 'SOSPESO'],
  'IN LAVORAZIONE': ['PRONTI & AVVISATI', 'SOSPESO'],
  'PRONTI & AVVISATI': ['CONCLUSI', 'SOSPESO'],
  CONCLUSI: [],
  SOSPESO: ['IN CORSO', 'IN LAVORAZIONE'],
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
  vettore: z.string().optional(),
  stato: z.string().optional(),
  fromDate: z.string().regex(dateOnlyRegex, 'fromDate must be YYYY-MM-DD').optional(),
  toDate: z.string().regex(dateOnlyRegex, 'toDate must be YYYY-MM-DD').optional(),
  sortBy: z.enum(['rif', 'cliente', 'dataConsegna', 'vettore', 'stato']).default('dataConsegna'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
})

const consegnaInputSchema = z.object({
  rif: z.string().min(1),
  cliente: z.string().min(1),
  tipoImpianto: z.string().optional().nullable(),
  dataConsegna: z.string().regex(dateOrDateTimeRegex, 'dataConsegna must be YYYY-MM-DD or ISO datetime').optional().nullable(),
  cantiere: z.string().optional().nullable(),
  dataOrdine: z.string().regex(dateOrDateTimeRegex, 'dataOrdine must be YYYY-MM-DD or ISO datetime').optional().nullable(),
  vettore: z.string().optional().nullable(),
  scarico: z.string().optional().nullable(),
  vascheCav: z.string().optional().nullable(),
  accessori: z.string().optional().nullable(),
  operai: z.string().optional().nullable(),
  stato: z.enum(allowedStatuses).or(z.string().min(1)).default('IN CORSO'),
  note: z.string().optional().nullable(),
})

const transitionSchema = z.object({
  toStatus: z.enum(allowedStatuses),
  note: z.string().optional(),
})

type OrderEvent = {
  id: number
  orderId: number
  eventType: string
  fromStatus: string | null
  toStatus: string | null
  note: string | null
  actor: string | null
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

function normalizeRow(row: typeof ordini.$inferSelect) {
  return {
    id: row.id,
    rif: row.rifto,
    cliente: row.cliente,
    tipoImpianto: row.tipoImpianto,
    dataConsegna: toIsoDate(row.dataConsegna),
    cantiere: row.cantiere,
    dataOrdine: toIsoDate(row.dataOrdine),
    vettore: row.traspor,
    scarico: row.scarico,
    vascheCav: row.vascheCav,
    accessori: row.accessori,
    operai: row.operai,
    stato: row.stato ?? 'IN CORSO',
    note: row.note,
    createdAt: row.createdAt,
  }
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
}) {
  await db.execute(sql`
    insert into order_events (order_id, event_type, from_status, to_status, note, actor)
    values (
      ${payload.orderId},
      ${payload.eventType},
      ${payload.fromStatus ?? null},
      ${payload.toStatus ?? null},
      ${payload.note ?? null},
      ${payload.actor ?? null}
    )
  `)
}

router.get('/', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query)
    const offset = (query.page - 1) * query.pageSize
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

    if (query.vettore) {
      filters.push(ilike(ordini.traspor, `%${query.vettore.trim()}%`))
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

    const whereClause = filters.length ? and(...filters) : undefined
    const sortColumn = {
      rif: ordini.rifto,
      cliente: ordini.cliente,
      dataConsegna: ordini.dataConsegna,
      vettore: ordini.traspor,
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

    if (query.cliente) filters.push(ilike(ordini.cliente, `%${query.cliente.trim()}%`))
    if (query.vettore) filters.push(ilike(ordini.traspor, `%${query.vettore.trim()}%`))
    if (query.stato) filters.push(ilike(ordini.stato, `%${query.stato.trim()}%`))

    if (query.fromDate) filters.push(gte(ordini.dataConsegna, parseInputDate(query.fromDate)))
    if (query.toDate) {
      const endOfDay = parseInputDate(query.toDate)
      endOfDay.setHours(23, 59, 59, 999)
      filters.push(lte(ordini.dataConsegna, endOfDay))
    }

    const whereClause = filters.length ? and(...filters) : undefined
    const sortColumn = {
      rif: ordini.rifto,
      cliente: ordini.cliente,
      dataConsegna: ordini.dataConsegna,
      vettore: ordini.traspor,
      stato: ordini.stato,
    }[query.sortBy]

    const rows = await db
      .select()
      .from(ordini)
      .where(whereClause)
      .orderBy(query.sortDir === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(10000)

    const headers = ['rif', 'cliente', 'tipoImpianto', 'dataConsegna', 'cantiere', 'vettore', 'stato', 'note']
    const csvRows = rows.map((row) => {
      const normalized = normalizeRow(row)
      return [
        normalized.rif,
        normalized.cliente,
        normalized.tipoImpianto ?? '',
        normalized.dataConsegna ?? '',
        normalized.cantiere ?? '',
        normalized.vettore ?? '',
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

router.get('/board', async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(ordini)
      .orderBy(desc(ordini.dataConsegna), desc(ordini.createdAt))

    const columns = allowedStatuses.map((status) => ({
      status,
      count: rows.filter((row) => (row.stato ?? 'IN CORSO') === status).length,
      items: rows.filter((row) => (row.stato ?? 'IN CORSO') === status).map(normalizeRow),
    }))

    return res.json({ columns })
  } catch (error) {
    return next(error)
  }
})

router.get('/stats', async (_req, res, next) => {
  try {
    const now = new Date()
    const day = now.getDay() || 7
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - day + 1)
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const [weekRows, lateRows, byCarrierRows, byStatusRows, weeklyTrendRows] = await Promise.all([
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
          vettore: sql<string>`coalesce(${ordini.traspor}, 'N/D')`,
          count: count(),
        })
        .from(ordini)
        .groupBy(sql`coalesce(${ordini.traspor}, 'N/D')`)
        .orderBy(desc(count())),
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
    ])

    res.json({
      kpi: {
        consegneSettimanaCorrente: weekRows[0]?.count ?? 0,
        ritardi: lateRows[0]?.count ?? 0,
      },
      byCarrier: byCarrierRows,
      byStatus: byStatusRows,
      weeklyTrend: weeklyTrendRows.reverse(),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/filters', async (_req, res, next) => {
  try {
    const [clienti, vettori, stati] = await Promise.all([
      db.selectDistinct({ value: ordini.cliente }).from(ordini).where(sql`${ordini.cliente} is not null`),
      db.selectDistinct({ value: ordini.traspor }).from(ordini).where(sql`${ordini.traspor} is not null`),
      db.selectDistinct({ value: ordini.stato }).from(ordini).where(sql`${ordini.stato} is not null`),
    ])

    res.json({
      clienti: clienti.map((r) => r.value).filter(Boolean).sort(),
      vettori: vettori.map((r) => r.value).filter(Boolean).sort(),
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
        to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt"
      from order_events
      where order_id = ${id}
      order by created_at desc, id desc
    `)

    return res.json({
      data: events as unknown as OrderEvent[],
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
    validateAttachment(file.originalname || '', file.mimetype || '')

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
      note: created.fileName,
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
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(attachment.fileName)}"`)
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

    const [updated] = await db
      .update(ordini)
      .set({
        stato: payload.toStatus,
        note: payload.note ? `${row.note ? `${row.note}\n` : ''}${payload.note}` : row.note,
      })
      .where(eq(ordini.id, id))
      .returning()

    await addOrderEvent({
      orderId: id,
      eventType: payload.toStatus === 'SOSPESO' ? 'STATUS_SUSPENDED' : 'STATUS_CHANGED',
      fromStatus: currentStatus,
      toStatus: payload.toStatus,
      note: payload.note ?? null,
      actor: req.user?.username ?? null,
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

    return res.json(normalizeRow(row))
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
        traspor: payload.vettore ?? null,
        scarico: payload.scarico ?? null,
        vascheCav: payload.vascheCav ?? null,
        accessori: payload.accessori ?? null,
        operai: payload.operai ?? null,
        stato: payload.stato,
        note: payload.note ?? null,
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
    if ('vettore' in payload) updateData.traspor = payload.vettore ?? null
    if ('scarico' in payload) updateData.scarico = payload.scarico ?? null
    if ('vascheCav' in payload) updateData.vascheCav = payload.vascheCav ?? null
    if ('accessori' in payload) updateData.accessori = payload.accessori ?? null
    if ('operai' in payload) updateData.operai = payload.operai ?? null
    if ('stato' in payload) updateData.stato = payload.stato
    if ('note' in payload) updateData.note = payload.note ?? null

    const [updated] = await db.update(ordini).set(updateData).where(eq(ordini.id, id)).returning()

    if ((payload.stato && payload.stato !== (existing.stato ?? 'IN CORSO')) || payload.note) {
      await addOrderEvent({
        orderId: id,
        eventType: payload.stato ? 'STATUS_CHANGED' : 'ORDER_UPDATED',
        fromStatus: payload.stato ? existing.stato ?? 'IN CORSO' : null,
        toStatus: payload.stato ?? null,
        note: payload.note ?? null,
        actor: req.user?.username ?? null,
      })
    }

    res.json(normalizeRow(updated))
  } catch (error) {
    next(error)
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
