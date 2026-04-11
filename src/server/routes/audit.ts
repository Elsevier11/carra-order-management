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

router.get('/', requireAuth, requireRole(['admin']), async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query)
    const offset = (query.page - 1) * query.pageSize
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

    const whereClause = filters.length > 0 ? and(...filters) : undefined
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

