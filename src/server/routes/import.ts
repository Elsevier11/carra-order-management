import { Router } from 'express'
import { z } from 'zod'
import { analyzeImportRows, rawRowSchema } from '../../db/import'
import { requireAuth, requireRole } from '../middleware/auth'

const router = Router()

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

export default router

