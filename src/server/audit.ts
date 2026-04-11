import type { NextFunction, Request, Response } from 'express'
import { db } from './db'
import { auditLogs } from '../db/schema'

type AuditMeta = {
  action?: string
  entity?: string
  entityId?: number
  details?: Record<string, unknown>
}

type RequestWithAudit = Request & {
  user?: { username: string; role: string }
  auditMeta?: AuditMeta
}

function inferEntity(pathname: string): string | null {
  if (pathname.startsWith('/api/auth')) return 'auth'
  if (pathname.startsWith('/api/consegne')) return 'consegna'
  if (pathname.startsWith('/api/audit')) return 'audit'
  return null
}

function inferEntityId(pathname: string): number | null {
  const match = pathname.match(/\/api\/consegne\/(\d+)(?:\/|$)/)
  if (!match) return null
  return Number(match[1])
}

export async function writeAuditLog(payload: {
  username?: string | null
  role?: string | null
  action: string
  method: string
  path: string
  entity?: string | null
  entityId?: number | null
  success: boolean
  statusCode: number
  ipAddress?: string | null
  userAgent?: string | null
  details?: Record<string, unknown> | null
}) {
  try {
    await db.insert(auditLogs).values({
      username: payload.username ?? null,
      role: payload.role ?? null,
      action: payload.action,
      method: payload.method,
      path: payload.path,
      entity: payload.entity ?? null,
      entityId: payload.entityId ?? null,
      success: payload.success,
      statusCode: payload.statusCode,
      ipAddress: payload.ipAddress ?? null,
      userAgent: payload.userAgent ?? null,
      details: payload.details ?? null,
    })
  } catch {
    // Audit must never break business flow.
  }
}

export function auditMiddleware(req: RequestWithAudit, res: Response, next: NextFunction) {
  const startedAt = Date.now()
  const pathname = req.path

  res.on('finish', () => {
    if (!pathname.startsWith('/api')) return
    if (pathname.startsWith('/api/audit')) return

    const details: Record<string, unknown> = {
      durationMs: Date.now() - startedAt,
    }

    if (req.method === 'GET') {
      const query = req.query as Record<string, unknown>
      if (Object.keys(query).length > 0) details.query = query
    }

    const shouldMaskBody = pathname === '/api/auth/login'
    if (!shouldMaskBody && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const body = req.body as Record<string, unknown> | undefined
      if (body && Object.keys(body).length > 0) details.bodyKeys = Object.keys(body)
    }

    const meta = req.auditMeta ?? {}

    void writeAuditLog({
      username: req.user?.username ?? null,
      role: req.user?.role ?? null,
      action: meta.action ?? `${req.method} ${pathname}`,
      method: req.method,
      path: req.originalUrl || pathname,
      entity: meta.entity ?? inferEntity(pathname),
      entityId: meta.entityId ?? inferEntityId(pathname),
      success: res.statusCode < 400,
      statusCode: res.statusCode,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
      details: { ...details, ...(meta.details ?? {}) },
    })
  })

  next()
}

