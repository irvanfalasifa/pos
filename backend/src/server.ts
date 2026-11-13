import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

const app = express()
app.use(helmet())
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend POS berjalan' })
})

const PORT = 4000
app.listen(PORT, () => {
  console.log(`Backend berjalan di http://localhost:${PORT}`)
})