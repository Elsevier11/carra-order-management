import { Router } from 'express'
import { z } from 'zod'
import { pgClient } from '../db'
import { requireAuth, requireRole } from '../middleware/auth'
import { describeErpConnectionError, resolveErpConfig, testErpConnection } from '../sqlserver'

const router = Router()

// ── GET /api/settings/sqlserver ───────────────────────────────────────────────

router.get('/sqlserver', requireAuth, requireRole(['admin']), async (_req, res, next) => {
  try {
    const rows = await pgClient<{ key: string; value: string }[]>`
      select key, value from import_config
      where key in (
        'sqlserver_host', 'sqlserver_port', 'sqlserver_database',
        'sqlserver_user', 'sqlserver_password', 'sqlserver_timeout_ms'
      )
    `
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

    const param = (
      dbKey: string,
      envKey: string,
      fallback = '',
    ): { value: string; source: 'db' | 'env' } => {
      if (map[dbKey] !== undefined) return { value: map[dbKey], source: 'db' }
      return { value: process.env[envKey] ?? fallback, source: 'env' }
    }

    return res.json({
      host: param('sqlserver_host', 'SQLSERVER_HOST'),
      port: param('sqlserver_port', 'SQLSERVER_PORT', '1433'),
      database: param('sqlserver_database', 'SQLSERVER_DATABASE'),
      user: param('sqlserver_user', 'SQLSERVER_USER'),
      password: {
        value: '***',
        source: map['sqlserver_password'] !== undefined ? 'db' : ('env' as const),
      },
      timeoutMs: param('sqlserver_timeout_ms', 'SQLSERVER_QUERY_TIMEOUT_MS', '15000'),
    })
  } catch (err) {
    return next(err)
  }
})

// ── PUT /api/settings/sqlserver ───────────────────────────────────────────────

const sqlServerConfigSchema = z.object({
  host: z.string().min(1, 'Host obbligatorio'),
  port: z.string().regex(/^\d+$/, 'Porta deve essere un numero'),
  database: z.string().min(1, 'Database obbligatorio'),
  user: z.string(),
  password: z.string(),
  timeoutMs: z.string().regex(/^\d+$/, 'Timeout deve essere un numero'),
})

router.put('/sqlserver', requireAuth, requireRole(['admin']), async (req, res, next) => {
  try {
    const { host, port, database, user, password, timeoutMs } = sqlServerConfigSchema.parse(
      req.body,
    )

    const updates: Array<{ key: string; value: string }> = [
      { key: 'sqlserver_host', value: host },
      { key: 'sqlserver_port', value: port },
      { key: 'sqlserver_database', value: database },
      { key: 'sqlserver_user', value: user },
      { key: 'sqlserver_timeout_ms', value: timeoutMs },
    ]

    if (password !== '') {
      updates.push({ key: 'sqlserver_password', value: password })
    }

    for (const { key, value } of updates) {
      await pgClient`
        insert into import_config (key, value, updated_at)
        values (${key}, ${value}, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()
      `
    }

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

// ── POST /api/settings/sqlserver/test ────────────────────────────────────────

router.post('/sqlserver/test', requireAuth, requireRole(['admin']), async (_req, res) => {
  let config: Awaited<ReturnType<typeof resolveErpConfig>> | null = null
  try {
    config = await resolveErpConfig(pgClient)
    await testErpConnection(config)
    return res.json({ ok: true })
  } catch (err) {
    const message = describeErpConnectionError(err, config ?? undefined)
    return res.json({ ok: false, message })
  }
})

export default router
