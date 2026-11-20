import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requirePermission } from '../../middleware/auth.js'

export const auditRouter = Router()

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  action: z.string().max(40).optional(),
})

auditRouter.get('/audit-logs', requireAuth, requirePermission('audit.view'), async (req, res) => {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Filter tidak valid' })
  const { date, action } = parsed.data

  let createdAt: { gte: Date; lt: Date } | undefined
  if (date) {
    const start = new Date(`${date}T00:00:00`)
    if (Number.isNaN(start.getTime())) return res.status(400).json({ message: 'Tanggal tidak valid' })
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    createdAt = { gte: start, lt: end }
  }

  const logs = await prisma.auditLog.findMany({
    where: { ...(createdAt ? { createdAt } : {}), ...(action ? { action } : {}) },
    orderBy: { id: 'desc' },
    take: 200,
    include: { user: { select: { id: true, name: true } } },
  })

  const approverIds = [...new Set(logs.map((l) => l.approvedById).filter((v): v is number => v !== null))]
  const approvers = approverIds.length
    ? await prisma.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, name: true } })
    : []
  const approverById = new Map(approvers.map((a) => [a.id, a]))

  res.json(
    logs.map((l) => ({
      ...l,
      approvedBy: l.approvedById ? (approverById.get(l.approvedById) ?? null) : null,
    })),
  )
})