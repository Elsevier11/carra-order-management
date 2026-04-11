import type { NextFunction, Request, Response } from 'express'
import { verifyToken, type UserRole } from '../auth'

export type AuthenticatedRequest = Request & {
  user?: {
    username: string
    role: UserRole
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing bearer token' })
  }

  const token = authHeader.slice('Bearer '.length).trim()
  const user = verifyToken(token)
  if (!user) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }

  req.user = user
  return next()
}

export function requireRole(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' })
    }
    return next()
  }
}
