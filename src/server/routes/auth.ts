import { Router } from 'express'
import { z } from 'zod'
import { signToken, verifyCredentials } from '../auth'
import { writeAuditLog } from '../audit'

const router = Router()

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

router.post('/login', async (req, res) => {
  const payload = loginSchema.safeParse(req.body)
  if (!payload.success) {
    await writeAuditLog({
      username: null,
      role: null,
      action: 'AUTH_LOGIN_FAILED',
      method: req.method,
      path: req.originalUrl,
      entity: 'auth',
      success: false,
      statusCode: 400,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
      details: { reason: 'missing_credentials' },
    })
    return res.status(400).json({ message: 'Missing username/password' })
  }

  const user = await verifyCredentials(payload.data.username, payload.data.password)
  if (!user) {
    await writeAuditLog({
      username: payload.data.username,
      role: null,
      action: 'AUTH_LOGIN_FAILED',
      method: req.method,
      path: req.originalUrl,
      entity: 'auth',
      success: false,
      statusCode: 401,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
      details: { reason: 'invalid_credentials' },
    })
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  const token = signToken({ username: user.username, role: user.role })
  await writeAuditLog({
    username: user.username,
    role: user.role,
    action: 'AUTH_LOGIN_SUCCESS',
    method: req.method,
    path: req.originalUrl,
    entity: 'auth',
    success: true,
    statusCode: 200,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
    details: null,
  })
  return res.json({
    token,
    user,
  })
})

export default router
