import cors from 'cors'
import express from 'express'
import { ZodError } from 'zod'
import consegneRoutes from './routes/consegne'
import authRoutes from './routes/auth'
import { BadRequestError } from './errors'

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: true,
      credentials: false,
    }),
  )
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'carra-consegne-api',
      timestamp: new Date().toISOString(),
    })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/consegne', consegneRoutes)

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

    if (err instanceof Error) {
      return res.status(500).json({ message: 'Internal server error' })
    }

    return res.status(500).json({ message: 'Unexpected server error' })
  })

  return app
}
