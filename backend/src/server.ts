import './config/env.js'
import { createServer } from 'node:http'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { prisma } from './lib/prisma.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { productsRouter } from './modules/products/products.routes.js'
import { modifiersRouter } from './modules/products/modifiers.routes.js'
import { posRouter } from './modules/pos/pos.routes.js'
import { kdsRouter } from './modules/kds/kds.routes.js'
import { initSocket } from './realtime/socket.js'
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
app.use('/api', productsRouter)
app.use('/api', modifiersRouter)
app.use('/api', posRouter)
app.use('/api', kdsRouter)

app.get('/api/roles', requireAuth, requirePermission('user.manage'), async (_req, res) => {
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } } },
  })
  res.json(roles)
})

app.get('/api/reports/ping', requireAuth, requirePermission('report.view'), (_req, res) => {
  res.json({ message: 'Berhasil: Anda boleh melihat laporan' })
})

const PORT = 4000

// Socket.IO berbagi server HTTP yang sama dengan Express
const httpServer = createServer(app)
initSocket(httpServer)

httpServer.listen(PORT, () => {
  console.log(`Backend berjalan di http://localhost:${PORT}`)
})