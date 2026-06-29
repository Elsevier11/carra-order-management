import cors from 'cors'
import express from 'express'
import { ZodError } from 'zod'
import consegneRoutes from './routes/consegne'
import authRoutes from './routes/auth'
import auditRoutes from './routes/audit'
import importRoutes from './routes/import'
import usersRoutes from './routes/users'
import commercialiRoutes from './routes/commerciali'
import responsabiliRoutes from './routes/responsabili'
import settingsRoutes from './routes/settings'
import mittentiDisegnoRoutes from './routes/mittenti-disegno'
import operaiRoutes from './routes/operai'
import vettoriRoutes from './routes/vettori'
import cementiTipiRoutes from './routes/cementi-tipi'
import accessoriTipiRoutes from './routes/accessori-tipi'
import { BadRequestError, ConcurrencyConflictError } from './errors'
import { auditMiddleware } from './audit'

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: true,
      credentials: false,
    }),
  )
  app.use(express.json())
  app.use(auditMiddleware)

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'carra-consegne-api',
      timestamp: new Date().toISOString(),
    })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/consegne', consegneRoutes)
  app.use('/api/audit', auditRoutes)
  app.use('/api/import', importRoutes)
  app.use('/api/users', usersRoutes)
  app.use('/api/commerciali', commercialiRoutes)
  app.use('/api/responsabili', responsabiliRoutes)
  app.use('/api/settings', settingsRoutes)
  app.use('/api/mittenti-disegno', mittentiDisegnoRoutes)
  app.use('/api/operai', operaiRoutes)
  app.use('/api/vettori', vettoriRoutes)
  app.use('/api/cementi-tipi', cementiTipiRoutes)
  app.use('/api/accessori-tipi', accessoriTipiRoutes)

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        message: 'Validation error',
        issues: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    if (err instanceof BadRequestError) {
      return res.status(400).json({ message: err.message })
    }

    if (err instanceof ConcurrencyConflictError) {
      return res.status(409).json({ message: err.message })
    }

    if (err instanceof Error) {
      console.error('[500]', err.message)
      return res.status(500).json({ message: 'Internal server error' })
    }

    return res.status(500).json({ message: 'Unexpected server error' })
  })

  return app
}
