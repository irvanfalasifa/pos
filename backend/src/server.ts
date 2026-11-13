import './config/env.js'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { prisma } from './lib/prisma.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { requireAuth, requirePermission } from './middleware/auth.js'

const app = express()

app.use(helmet())
app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend POS berjalan' })
})

app.use('/api/auth', authRouter)

// Hanya yang punya izin user.manage (owner)
app.get('/api/roles', requireAuth, requirePermission('user.manage'), async (_req, res) => {
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } } },
  })
  res.json(roles)
})

// Rute uji coba izin: hanya yang punya report.view
app.get('/api/reports/ping', requireAuth, requirePermission('report.view'), (_req, res) => {
  res.json({ message: 'Berhasil: Anda boleh melihat laporan' })
})

const PORT = 4000

app.listen(PORT, () => {
  console.log(`Backend berjalan di http://localhost:${PORT}`)
})