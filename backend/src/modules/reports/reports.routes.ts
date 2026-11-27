import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requirePermission } from '../../middleware/auth.js'
import { buildLive, buildOverview, buildStaff, parseRange } from './reports.service.js'

export const reportsRouter = Router()

const rangeQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const RANGE_ERROR = 'Rentang tanggal tidak valid (maksimal 366 hari)'

reportsRouter.get('/reports/overview', requireAuth, requirePermission('report.view'), async (req, res) => {
  const parsed = rangeQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: RANGE_ERROR })

  const range = parseRange(parsed.data.from, parsed.data.to)
  if (!range) return res.status(400).json({ message: RANGE_ERROR })

  res.json(await buildOverview(range, parsed.data.from, parsed.data.to))
})

reportsRouter.get('/reports/staff', requireAuth, requirePermission('report.staff'), async (req, res) => {
  const parsed = rangeQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: RANGE_ERROR })

  const range = parseRange(parsed.data.from, parsed.data.to)
  if (!range) return res.status(400).json({ message: RANGE_ERROR })

  res.json(await buildStaff(range))
})

reportsRouter.get('/reports/live', requireAuth, requirePermission('report.view'), async (_req, res) => {
  res.json(await buildLive())
})