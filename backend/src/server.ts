import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { prisma } from './lib/prisma.js'

const app = express()

app.use(helmet())
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend POS berjalan' })
})

app.get('/api/roles', async (_req, res) => {
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } } },
  })
  res.json(roles)
})

const PORT = 4000

app.listen(PORT, () => {
  console.log(`Backend berjalan di http://localhost:${PORT}`)
})