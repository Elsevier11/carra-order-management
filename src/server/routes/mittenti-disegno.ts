import { Router } from 'express'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { mittentiDisegno } from '../../db/schema'
import { db } from '../db'
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth'

const router = Router()

const nomeSchema = z.object({
  nome: z.string().min(1).max(200).trim(),
})

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const rows = await db.select().from(mittentiDisegno).orderBy(asc(mittentiDisegno.nome))
    return res.json({ data: rows })
  } catch (error) {
    return next(error)
  }
})

router.post('/', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const payload = nomeSchema.parse(req.body)
    const [created] = await db.insert(mittentiDisegno).values({ nome: payload.nome }).returning()
    return res.status(201).json(created)
  } catch (error) {
    return next(error)
  }
})

router.put('/:id', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const payload = nomeSchema.parse(req.body)
    const [updated] = await db.update(mittentiDisegno).set({ nome: payload.nome }).where(eq(mittentiDisegno.id, id)).returning()
    if (!updated) return res.status(404).json({ message: 'Mittente disegno non trovato' })
    return res.json(updated)
  } catch (error) {
    return next(error)
  }
})

router.delete('/:id', requireAuth, requireRole(['admin']), async (_req, res, next) => {
  try {
    const id = Number(_req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const [deleted] = await db.delete(mittentiDisegno).where(eq(mittentiDisegno.id, id)).returning({ id: mittentiDisegno.id })
    if (!deleted) return res.status(404).json({ message: 'Mittente disegno non trovato' })
    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
})

export default router
