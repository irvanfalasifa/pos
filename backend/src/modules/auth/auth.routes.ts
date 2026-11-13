import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { JWT_SECRET } from '../../config/env.js'
import { COOKIE_NAME, loadUser, requireAuth } from '../../middleware/auth.js'

export const authRouter = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Email atau password tidak valid' })
  }

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  const passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false

  if (!user || !user.isActive || !passwordOk) {
    return res.status(401).json({ message: 'Email atau password salah' })
  }

  const token = jwt.sign({}, JWT_SECRET, { subject: String(user.id), expiresIn: '8h' })

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  })

  res.json(await loadUser(user.id))
})

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME)
  res.json({ message: 'Berhasil keluar' })
})

authRouter.get('/me', requireAuth, (_req, res) => {
  res.json(res.locals.user)
})