import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { JWT_SECRET } from '../config/env.js'

export const COOKIE_NAME = 'pos_token'

export type AuthUser = {
  id: number
  name: string
  email: string
  roles: string[]
  permissions: string[]
}

export async function loadUser(userId: number): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  })

  if (!user || !user.isActive) return null

  const roles = user.roles.map((ur) => ur.role.name)
  const permissions = [
    ...new Set(
      user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)),
    ),
  ]

  return { id: user.id, name: user.name, email: user.email, roles, permissions }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    return res.status(401).json({ message: 'Belum login' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload
    const user = await loadUser(Number(payload.sub))
    if (!user) {
      return res.status(401).json({ message: 'Akun tidak valid atau nonaktif' })
    }
    res.locals.user = user
    next()
  } catch {
    res.status(401).json({ message: 'Sesi tidak valid atau sudah berakhir' })
  }
}

export function requirePermission(code: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as AuthUser | undefined
    if (!user || !user.permissions.includes(code)) {
      return res.status(403).json({ message: 'Anda tidak punya izin untuk tindakan ini' })
    }
    next()
  }
}