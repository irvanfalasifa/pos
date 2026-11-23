import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requirePermission } from '../../middleware/auth.js'
import type { AuthUser } from '../../middleware/auth.js'
import { auditData } from '../audit/audit.service.js'
import { getSettings, toStored } from './settings.service.js'

export const settingsRouter = Router()

const settingsSchema = z.object({
  businessName: z.string().trim().min(1).max(60),
  businessAddress: z.string().trim().max(150),
  businessPhone: z.string().trim().max(30),
  receiptFooter: z.string().trim().max(120),
  receiptPaper: z.enum(['58', '80']),
  taxBp: z.number().int().min(0).max(5000),
  serviceBp: z.number().int().min(0).max(3000),
  taxBase: z.enum(['SUBTOTAL', 'SUBTOTAL_PLUS_SERVICE']),
  roundingStep: z.union([z.literal(0), z.literal(100), z.literal(500), z.literal(1000)]),
})

settingsRouter.get('/settings', requireAuth, requirePermission('settings.manage'), async (_req, res) => {
  res.json(await getSettings())
})

settingsRouter.put('/settings', requireAuth, requirePermission('settings.manage'), async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data pengaturan tidak valid' })

  const user = res.locals.user as AuthUser
  const before = toStored(await getSettings())
  const after = toStored(parsed.data)

  const changed = Object.entries(after).filter(([key, value]) => before[key] !== value)
  if (changed.length === 0) return res.json(await getSettings())

  await prisma.$transaction(async (tx) => {
    for (const [key, value] of changed) {
      await tx.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
    }

    // Hanya nilai yang berubah yang dicatat
    await tx.auditLog.create({
      data: auditData({
        userId: user.id,
        action: 'SETTINGS_UPDATED',
        entityType: 'Settings',
        entityId: 0,
        beforeData: Object.fromEntries(changed.map(([key]) => [key, before[key] ?? ''])),
        afterData: Object.fromEntries(changed),
      }),
    })
  })

  res.json(await getSettings())
})