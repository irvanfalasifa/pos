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
  mustChangePassword: boolean
  tokenVersion: number
}

// Bentuk yang aman dikirim ke browser (tanpa tokenVersion)
export type PublicUser = Omit<AuthUser, 'tokenVersion'>

export function toPublicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    permissions: user.permissions,
    mustChangePassword: user.mustChangePassword,
  }
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

  // Owner selalu memiliki seluruh izin, termasuk izin yang baru ditambahkan di masa depan
  const permissions = roles.includes('owner')
    ? (await prisma.permission.findMany({ select: { code: true } })).map((p) => p.code)
    : [...new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)))]

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles,
    permissions,
    mustChangePassword: user.mustChangePassword,
    tokenVersion: user.tokenVersion,
  }
}

// Membuat token sesi dan menyimpannya di cookie httpOnly
export function startSession(res: Response, userId: number, tokenVersion: number) {
  const token = jwt.sign({ tv: tokenVersion }, JWT_SECRET, {
    subject: String(userId),
    expiresIn: '8h',
  })

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  })
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

    // Token lama (sebelum password diganti/direset) tidak berlaku lagi
    if (payload.tv !== user.tokenVersion) {
      return res.status(401).json({ message: 'Sesi berakhir, silakan masuk kembali' })
    }

    // Akun dengan password sementara hanya boleh memakai endpoint akun sampai password diganti
    if (user.mustChangePassword && !req.originalUrl.startsWith('/api/auth/')) {
      return res
        .status(403)
        .json({ message: 'Anda harus mengganti password terlebih dahulu', code: 'PASSWORD_CHANGE_REQUIRED' })
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