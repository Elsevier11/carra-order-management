import { Router } from 'express'
import { z } from 'zod'
import { signToken, verifyCredentials } from '../auth'

const router = Router()

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

router.post('/login', async (req, res) => {
  const payload = loginSchema.safeParse(req.body)
  if (!payload.success) {
    return res.status(400).json({ message: 'Missing username/password' })
  }

  const user = await verifyCredentials(payload.data.username, payload.data.password)
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  const token = signToken({ username: user.username, role: user.role })
  return res.json({
    token,
    user,
  })
})

export default router
