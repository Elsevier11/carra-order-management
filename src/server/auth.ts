import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { appUsers } from '../db/schema'
import { db } from './db'

export type UserRole = 'admin' | 'operativo' | 'lettura'

type AuthTokenPayload = {
  sub: string
  role: UserRole
  exp: number
}


function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url')
}

const secret = process.env.JWT_SECRET || 'carra-consegne-dev-secret'

export async function verifyCredentials(username: string, password: string): Promise<{ username: string; role: UserRole } | null> {
  const [user] = await db
    .select({
      username: appUsers.username,
      role: appUsers.role,
      passwordHash: appUsers.passwordHash,
    })
    .from(appUsers)
    .where(and(eq(appUsers.username, username), eq(appUsers.isActive, true)))
    .limit(1)

  if (!user) return null

  const isValid = await bcrypt.compare(password, user.passwordHash ?? '')
  if (!isValid) return null
  return { username: user.username, role: user.role as UserRole }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export function signToken(payload: { username: string; role: UserRole }, expiresInSeconds = 60 * 60 * 8): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const bodyPayload: AuthTokenPayload = {
    sub: payload.username,
    role: payload.role,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }
  const body = base64url(JSON.stringify(bodyPayload))
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

export function verifyToken(token: string): { username: string; role: UserRole } | null {
  const [header, body, signature] = token.split('.')
  if (!header || !body || !signature) return null

  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  if (expected !== signature) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AuthTokenPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    if (!payload.sub || !payload.role) return null
    return { username: payload.sub, role: payload.role }
  } catch {
    return null
  }
}
