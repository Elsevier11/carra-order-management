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
    const [rows, totalRows] = await Promise.all([
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
    ])

    return res.json({
      data: rows,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: totalRows[0]?.count ?? 0,
        totalPages: Math.ceil((totalRows[0]?.count ?? 0) / query.pageSize),
      },
    })
  } catch (error) {
    return next(error)
  }
})

export default router
