import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

export type UserRole = 'admin' | 'operativo' | 'lettura'

type AuthUser = {
  username: string
  role: UserRole
  passwordHash: string
}

type AuthTokenPayload = {
  sub: string
  role: UserRole
  exp: number
}

const defaultUsers: AuthUser[] = [
  {
    username: 'admin',
    role: 'admin',
    passwordHash: '$2a$10$LTMCqnFzt52SiOOd/SL6zuth4IG.8vCrQ8ZJ5jmCmjHyAMIKKyYbO', // admin123
  },
  {
    username: 'operativo',
    role: 'operativo',
    passwordHash: '$2a$10$hRgri/LbyEZnPxmZgiR9XeNMRdVc155ViUAkcQ.KjMbollmRMyPNC', // operativo123
  },
  {
    username: 'lettura',
    role: 'lettura',
    passwordHash: '$2a$10$q5XIUbDRpR9Ln6YSa/37Cuxl4c6Xosf/P00lWmNeQTQckDJUw5JL6', // lettura123
  },
]

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url')
}

function parseUsersFromEnv(): AuthUser[] {
  const raw = process.env.AUTH_USERS_JSON
  if (!raw) return defaultUsers

  try {
    const parsed = JSON.parse(raw) as AuthUser[]
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultUsers
    return parsed
  } catch {
    return defaultUsers
  }
}

const authUsers = parseUsersFromEnv()
const secret = process.env.JWT_SECRET || 'carra-consegne-dev-secret'

export async function verifyCredentials(username: string, password: string): Promise<{ username: string; role: UserRole } | null> {
  const user = authUsers.find((item) => item.username === username)
  if (!user) return null

  const isValid = await bcrypt.compare(password, user.passwordHash)
  if (!isValid) return null
  return { username: user.username, role: user.role }
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
