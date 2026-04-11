import type { UserRole } from './auth'

export type SeedUser = {
  username: string
  role: UserRole
  passwordHash: string
  isActive?: boolean
}

export const defaultSeedUsers: SeedUser[] = [
  {
    username: 'admin',
    role: 'admin',
    passwordHash: '$2a$10$LTMCqnFzt52SiOOd/SL6zuth4IG.8vCrQ8ZJ5jmCmjHyAMIKKyYbO', // admin123
    isActive: true,
  },
  {
    username: 'operativo',
    role: 'operativo',
    passwordHash: '$2a$10$hRgri/LbyEZnPxmZgiR9XeNMRdVc155ViUAkcQ.KjMbollmRMyPNC', // operativo123
    isActive: true,
  },
  {
    username: 'lettura',
    role: 'lettura',
    passwordHash: '$2a$10$q5XIUbDRpR9Ln6YSa/37Cuxl4c6Xosf/P00lWmNeQTQckDJUw5JL6', // lettura123
    isActive: true,
  },
]

export function parseSeedUsersFromEnv(): SeedUser[] {
  const raw = process.env.AUTH_USERS_JSON
  if (!raw) return defaultSeedUsers

  try {
    const parsed = JSON.parse(raw) as SeedUser[]
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultSeedUsers
    return parsed
      .filter((item) => item?.username && item?.role && item?.passwordHash)
      .map((item) => ({
        username: String(item.username),
        role: item.role,
        passwordHash: String(item.passwordHash),
        isActive: item.isActive !== false,
      }))
  } catch {
    return defaultSeedUsers
  }
}
