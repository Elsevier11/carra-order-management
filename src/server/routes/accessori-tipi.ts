import { Router } from 'express'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { accessoriTipi } from '../../db/schema'
import { db } from '../db'
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth'

const router = Router()

const accessorioSchema = z.object({
  nome: z.string().min(1).max(200).trim(),
  ordine: z.number().int().default(0),
})

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const rows = await db.select().from(accessoriTipi).orderBy(asc(accessoriTipi.ordine), asc(accessoriTipi.nome))
    return res.json({ data: rows })
  } catch (error) {
    return next(error)
  }
})

router.post('/', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const payload = accessorioSchema.parse(req.body)
    const [created] = await db.insert(accessoriTipi).values({ nome: payload.nome, ordine: payload.ordine }).returning()
    return res.status(201).json(created)
  } catch (error) {
    return next(error)
  }
})

router.put('/:id', requireAuth, requireRole(['admin']), async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const payload = accessorioSchema.parse(req.body)
    const [updated] = await db.update(accessoriTipi).set({ nome: payload.nome, ordine: payload.ordine }).where(eq(accessoriTipi.id, id)).returning()
    if (!updated) return res.status(404).json({ message: 'Tipo accessorio non trovato' })
    return res.json(updated)
  } catch (error) {
    return next(error)
  }
})

router.delete('/:id', requireAuth, requireRole(['admin']), async (_req, res, next) => {
  try {
    const id = Number(_req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' })
    const [deleted] = await db.delete(accessoriTipi).where(eq(accessoriTipi.id, id)).returning({ id: accessoriTipi.id })
    if (!deleted) return res.status(404).json({ message: 'Tipo accessorio non trovato' })
    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
})

export default router
