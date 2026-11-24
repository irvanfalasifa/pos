import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { COOKIE_NAME, loadUser, requireAuth, startSession, toPublicUser } from '../../middleware/auth.js'
import type { AuthUser } from '../../middleware/auth.js'
import { auditData } from '../audit/audit.service.js'

export const authRouter = Router()

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
})

const WINDOW_MS = 10 * 60 * 1000
const MAX_EMAIL_FAILURES = 5
const MAX_IP_FAILURES = 20

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Email atau password tidak valid' })
  }

  const email = parsed.data.email.toLowerCase()
  const ip = req.ip ?? null
  const userAgent = (req.get('user-agent') ?? '').slice(0, 200) || null

  // Pembatasan percobaan login
  const since = new Date(Date.now() - WINDOW_MS)
  const [emailFailures, ipFailures] = await Promise.all([
    prisma.loginEvent.count({ where: { email, success: false, createdAt: { gte: since } } }),
    ip
      ? prisma.loginEvent.count({ where: { ip, success: false, createdAt: { gte: since } } })
      : Promise.resolve(0),
  ])
  if (emailFailures >= MAX_EMAIL_FAILURES || ipFailures >= MAX_IP_FAILURES) {
    return res.status(429).json({ message: 'Terlalu banyak percobaan login. Coba lagi dalam 10 menit.' })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  const passwordOk = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false
  const ok = !!user && user.isActive && passwordOk

  await prisma.loginEvent.create({
    data: { userId: user?.id ?? null, email, success: ok, ip, userAgent },
  })

  if (!user || !ok) {
    return res.status(401).json({ message: 'Email atau password salah' })
  }

  startSession(res, user.id, user.tokenVersion)

  const authUser = await loadUser(user.id)
  res.json(authUser ? toPublicUser(authUser) : null)
})

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME)
  res.json({ message: 'Berhasil keluar' })
})

authRouter.get('/me', requireAuth, (_req, res) => {
  res.json(toPublicUser(res.locals.user as AuthUser))
})

/* ---------------- Ubah password dan profil ---------------- */

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z
    .string()
    .min(8)
    .max(100)
    .regex(/[A-Za-z]/)
    .regex(/\d/),
})

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body)
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: 'Password baru minimal 8 karakter dan harus mengandung huruf serta angka' })
  }

  const { currentPassword, newPassword } = parsed.data
  const actor = res.locals.user as AuthUser

  const record = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } })
  if (!(await bcrypt.compare(currentPassword, record.passwordHash))) {
    return res.status(400).json({ message: 'Password saat ini salah' })
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'Password baru harus berbeda dari password saat ini' })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)

  // Menaikkan tokenVersion mengakhiri semua sesi lama di perangkat lain
  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: actor.id },
      data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
    })
    await tx.auditLog.create({
      data: auditData({
        userId: actor.id,
        action: 'PASSWORD_CHANGED',
        entityType: 'User',
        entityId: actor.id,
        afterData: { name: actor.name, email: actor.email },
      }),
    })
    return user
  })

  startSession(res, updated.id, updated.tokenVersion)

  const fresh = await loadUser(actor.id)
  res.json(fresh ? toPublicUser(fresh) : null)
})

const profileSchema = z.object({ name: z.string().trim().min(1).max(60) })

authRouter.patch('/profile', requireAuth, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Nama tidak valid' })

  const actor = res.locals.user as AuthUser
  await prisma.user.update({ where: { id: actor.id }, data: { name: parsed.data.name } })

  const fresh = await loadUser(actor.id)
  res.json(fresh ? toPublicUser(fresh) : null)
})