import { Router } from 'express'
import { and, count, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { appUsers } from '../../db/schema'
import { hashPassword, type UserRole } from '../auth'
import { db } from '../db'
import { BadRequestError } from '../errors'
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth'

const router = Router()
const roleSchema = z.enum(['admin', 'operativo', 'lettura'])

const createUserSchema = z.object({
  username: z.string().min(3).max(60).regex(/^[A-Za-z0-9._-]+$/, 'Username non valido'),
  role: roleSchema,
  password: z.string().min(8).max(128),
  isActive: z.boolean().optional().default(true),
})

const updateUserSchema = z.object({
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
})

const resetPasswordSchema = z.object({
  password: z.string().min(8).max(128),
})

async function assertNotLastAdmin(targetUserId: number, nextRole: UserRole, nextIsActive: boolean) {
  const [target] = await db
    .select({ id: appUsers.id, role: appUsers.role, isActive: appUsers.isActive })
    .from(appUsers)
    .where(eq(appUsers.id, targetUserId))
    .limit(1)
  if (!target) {
    throw new BadRequestError('Utente non trovato')
  }

  const targetCurrentlyActiveAdmin = target.role === 'admin' && target.isActive
  const targetWillRemainActiveAdmin = nextRole === 'admin' && nextIsActive
  if (!targetCurrentlyActiveAdmin || targetWillRemainActiveAdmin) return

  const [otherAdmins] = await db
    .select({ c: count() })
    .from(appUsers)
    .where(and(eq(appUsers.role, 'admin'), eq(appUsers.isActive, true), ne(appUsers.id, targetUserId)))
  if ((otherAdmins?.c ?? 0) < 1) {
    throw new BadRequestError('Operazione non consentita: deve restare almeno un admin attivo')
  }
}

router.get('/', requireAuth, requireRole(['admin']), async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: appUsers.id,
        username: appUsers.username,
        role: appUsers.role,
        isActive: appUsers.isActive,
        createdAt: sql<string>`to_char(${appUsers.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
        updatedAt: sql<string>`to_char(${appUsers.updatedAt}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
      })
      .from(appUsers)
      .orderBy(appUsers.username)
    return res.json({ data: rows })
  } catch (error) {
    return next(error)
  }
})

router.post('/', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const payload = createUserSchema.parse(req.body)
    const normalizedUsername = payload.username.trim()

    const [existing] = await db
      .select({ id: appUsers.id })
      .from(appUsers)
      .where(eq(appUsers.username, normalizedUsername))
      .limit(1)

    if (existing) {
      throw new BadRequestError('Username gia esistente')
    }

    const passwordHash = await hashPassword(payload.password)

    const [created] = await db
      .insert(appUsers)
      .values({
        username: normalizedUsername,
        role: payload.role,
        passwordHash,
        isActive: payload.isActive,
      })
      .returning({
        id: appUsers.id,
        username: appUsers.username,
        role: appUsers.role,
        isActive: appUsers.isActive,
        createdAt: appUsers.createdAt,
        updatedAt: appUsers.updatedAt,
      })

    req.auditMeta = {
      action: 'USER_CREATED',
      entity: 'user',
      entityId: created.id,
      details: { username: created.username, role: created.role },
    }

    return res.status(201).json({
      ...created,
      createdAt: created.createdAt?.toISOString?.() ?? null,
      updatedAt: created.updatedAt?.toISOString?.() ?? null,
    })
  } catch (error) {
    return next(error)
  }
})

router.put('/:id', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })

    const payload = updateUserSchema.parse(req.body)
    if (!('role' in payload) && !('isActive' in payload)) {
      return res.status(400).json({ message: 'Nessuna modifica richiesta' })
    }

    const [current] = await db
      .select({ id: appUsers.id, role: appUsers.role, isActive: appUsers.isActive, username: appUsers.username })
      .from(appUsers)
      .where(eq(appUsers.id, id))
      .limit(1)
    if (!current) return res.status(404).json({ message: 'Utente non trovato' })

    const nextRole = (payload.role ?? current.role) as UserRole
    const nextIsActive = payload.isActive ?? current.isActive
    await assertNotLastAdmin(id, nextRole, nextIsActive)

    const [updated] = await db
      .update(appUsers)
      .set({
        role: payload.role ?? current.role,
        isActive: payload.isActive ?? current.isActive,
        updatedAt: new Date(),
      })
      .where(eq(appUsers.id, id))
      .returning({
        id: appUsers.id,
        username: appUsers.username,
        role: appUsers.role,
        isActive: appUsers.isActive,
        createdAt: appUsers.createdAt,
        updatedAt: appUsers.updatedAt,
      })

    req.auditMeta = {
      action: 'USER_UPDATED',
      entity: 'user',
      entityId: updated.id,
      details: {
        username: updated.username,
        role: updated.role,
        isActive: updated.isActive,
      },
    }
    return res.json({
      ...updated,
      createdAt: updated.createdAt?.toISOString?.() ?? null,
      updatedAt: updated.updatedAt?.toISOString?.() ?? null,
    })
  } catch (error) {
    return next(error)
  }
})

router.put('/:id/password', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const payload = resetPasswordSchema.parse(req.body)
    const passwordHash = await hashPassword(payload.password)

    const [updated] = await db
      .update(appUsers)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(appUsers.id, id))
      .returning({
        id: appUsers.id,
        username: appUsers.username,
      })
    if (!updated) return res.status(404).json({ message: 'Utente non trovato' })

    req.auditMeta = {
      action: 'USER_PASSWORD_RESET',
      entity: 'user',
      entityId: updated.id,
      details: { username: updated.username },
    }
    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
})

export default router
