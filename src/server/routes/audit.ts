import { Router } from 'express'
import { and, count, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { auditLogs } from '../../db/schema'
import { db } from '../db'
import { requireAuth, requireRole } from '../middleware/auth'

const router = Router()

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  username: z.string().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  entityId: z.coerce.number().int().positive().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  success: z.enum(['true', 'false']).optional(),
})

function buildWhereClause(query: z.infer<typeof querySchema>) {
  const filters = []

  if (query.username) {
    filters.push(ilike(auditLogs.username, `%${query.username.trim()}%`))
  }
  if (query.action) {
    filters.push(ilike(auditLogs.action, `%${query.action.trim()}%`))
  }
  if (query.entity) {
    filters.push(eq(auditLogs.entity, query.entity.trim()))
  }
  if (query.entityId) {
    filters.push(eq(auditLogs.entityId, query.entityId))
  }
  if (query.success) {
    filters.push(eq(auditLogs.success, query.success === 'true'))
  }
  if (query.fromDate) {
    filters.push(gte(auditLogs.createdAt, new Date(query.fromDate)))
  }
  if (query.toDate) {
    const to = new Date(query.toDate)
    to.setHours(23, 59, 59, 999)
    filters.push(lte(auditLogs.createdAt, to))
  }

  return filters.length > 0 ? and(...filters) : undefined
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

router.get('/export', requireAuth, requireRole(['admin']), async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query)
    const whereClause = buildWhereClause(query)
    const rows = await db
      .select({
        id: auditLogs.id,
        createdAt: sql<string>`to_char(${auditLogs.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
        username: auditLogs.username,
        role: auditLogs.role,
        action: auditLogs.action,
        method: auditLogs.method,
        path: auditLogs.path,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        success: auditLogs.success,
        statusCode: auditLogs.statusCode,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        details: auditLogs.details,
      })
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(10000)

    const headers = ['id', 'createdAt', 'username', 'role', 'action', 'method', 'path', 'entity', 'entityId', 'success', 'statusCode', 'ipAddress', 'userAgent', 'details']
    const body = rows.map((row) =>
      [
        row.id,
        row.createdAt,
        row.username,
        row.role,
        row.action,
        row.method,
        row.path,
        row.entity,
        row.entityId,
        row.success ? 'true' : 'false',
        row.statusCode,
        row.ipAddress,
        row.userAgent,
        row.details ? JSON.stringify(row.details) : '',
      ]
        .map(csvCell)
        .join(','),
    )
    const csv = [headers.join(','), ...body].join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="audit_export_${new Date().toISOString().slice(0, 10)}.csv"`)
    return res.status(200).send(csv)
  } catch (error) {
    return next(error)
  }
})

router.get('/', requireAuth, requireRole(['admin']), async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query)
    const offset = (query.page - 1) * query.pageSize
    const whereClause = buildWhereClause(query)
    const technicalCondition = sql`(${auditLogs.action} ~ '^(GET|POST|PUT|PATCH|DELETE)\\s+/api/' or ${auditLogs.action} = 'CONSEGNE_LIST')`
    const operationalWhereClause = whereClause ? and(whereClause, sql`not ${technicalCondition}`) : sql`not ${technicalCondition}`
    const technicalWhereClause = whereClause ? and(whereClause, technicalCondition) : technicalCondition
    const now = new Date()
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const recent24hClause = and(operationalWhereClause, gte(auditLogs.createdAt, since24h))
    const recent7dClause = and(operationalWhereClause, gte(auditLogs.createdAt, since7d))
    const [rows, totalRows, technicalRows, summaryRows, recent24hRows, recent7dRows, actionRows, actorRows, entityRows, orderRows] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          username: auditLogs.username,
          role: auditLogs.role,
          action: auditLogs.action,
          method: auditLogs.method,
          path: auditLogs.path,
          entity: auditLogs.entity,
          entityId: auditLogs.entityId,
          success: auditLogs.success,
          statusCode: auditLogs.statusCode,
          ipAddress: auditLogs.ipAddress,
          userAgent: auditLogs.userAgent,
          details: auditLogs.details,
          createdAt: sql<string>`to_char(${auditLogs.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
        })
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .offset(offset)
        .limit(query.pageSize),
      db.select({ count: count() }).from(auditLogs).where(whereClause),
      db.select({ count: count() }).from(auditLogs).where(technicalWhereClause),
      db
        .select({
          orderDeleted: sql<number>`coalesce(sum(case when ${auditLogs.action} = 'ORDER_DELETED' then 1 else 0 end), 0)::int`,
          statusChanged: sql<number>`coalesce(sum(case when ${auditLogs.action} = 'STATUS_CHANGED' then 1 else 0 end), 0)::int`,
          errors: sql<number>`coalesce(sum(case when ${auditLogs.success} = false then 1 else 0 end), 0)::int`,
        })
        .from(auditLogs)
        .where(operationalWhereClause),
      db.select({ count: count() }).from(auditLogs).where(recent24hClause),
      db.select({ count: count() }).from(auditLogs).where(recent7dClause),
      db
        .select({
          label: auditLogs.action,
          count: count(),
        })
        .from(auditLogs)
        .where(operationalWhereClause)
        .groupBy(auditLogs.action),
      db
        .select({
          label: sql<string>`coalesce(${auditLogs.username}, 'Sistema')`,
          count: count(),
        })
        .from(auditLogs)
        .where(operationalWhereClause)
        .groupBy(sql`coalesce(${auditLogs.username}, 'Sistema')`),
      db
        .select({
          label: sql<string>`coalesce(${auditLogs.entity}, 'Sistema')`,
          count: count(),
        })
        .from(auditLogs)
        .where(operationalWhereClause)
        .groupBy(sql`coalesce(${auditLogs.entity}, 'Sistema')`),
      db
        .select({
          label: sql<string>`'Ordine #' || cast(${auditLogs.entityId} as text)`,
          count: count(),
        })
        .from(auditLogs)
        .where(and(operationalWhereClause, eq(auditLogs.entity, 'consegna'), sql`${auditLogs.entityId} is not null`))
        .groupBy(auditLogs.entityId)
    ])

    const sortBuckets = (rows: Array<{ label: string; count: number }>) =>
      [...rows]
        .map((row) => ({ label: row.label || 'Sistema', count: Number(row.count ?? 0) }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'it'))

    return res.json({
      data: rows,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: totalRows[0]?.count ?? 0,
        totalPages: Math.ceil((totalRows[0]?.count ?? 0) / query.pageSize),
      },
      summary: {
        total: totalRows[0]?.count ?? 0,
        orderDeleted: summaryRows[0]?.orderDeleted ?? 0,
        statusChanged: summaryRows[0]?.statusChanged ?? 0,
        errors: summaryRows[0]?.errors ?? 0,
        technical: technicalRows[0]?.count ?? 0,
        recent24h: recent24hRows[0]?.count ?? 0,
        recent7d: recent7dRows[0]?.count ?? 0,
        byAction: sortBuckets(actionRows),
        byActor: sortBuckets(actorRows),
        byEntity: sortBuckets(entityRows),
        byOrder: sortBuckets(orderRows),
      },
    })
  } catch (error) {
    return next(error)
  }
})

export default router
