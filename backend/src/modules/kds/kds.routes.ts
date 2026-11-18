import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requirePermission } from '../../middleware/auth.js'
import type { AuthUser } from '../../middleware/auth.js'
import { emitOrdersChanged } from '../../realtime/socket.js'

export const kdsRouter = Router()

function parseId(value: unknown): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

// Sengaja tanpa harga dan data pembayaran: dapur tidak boleh melihatnya.
const ticketSelect = {
  id: true,
  number: true,
  type: true,
  status: true,
  customerName: true,
  note: true,
  createdAt: true,
  table: { select: { name: true } },
  items: {
    select: {
      id: true,
      productName: true,
      variantName: true,
      quantity: true,
      note: true,
      modifiers: { select: { id: true, name: true } },
    },
    orderBy: { id: 'asc' },
  },
} as const

const ticketQuery = z.object({ scope: z.enum(['active', 'done']).default('active') })

kdsRouter.get('/kds/tickets', requireAuth, requirePermission('order.view'), async (req, res) => {
  const parsed = ticketQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Filter tidak valid' })

  if (parsed.data.scope === 'active') {
    const tickets = await prisma.order.findMany({
      where: { status: { in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY'] } },
      orderBy: { createdAt: 'asc' },
      select: ticketSelect,
    })
    return res.json(tickets)
  }

  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const tickets = await prisma.order.findMany({
    where: { status: { in: ['SERVED', 'COMPLETED'] }, updatedAt: { gte: start } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: ticketSelect,
  })
  res.json(tickets)
})

// Perubahan status yang diizinkan, dan izin yang dibutuhkan untuk masing-masing
const rules = [
  { from: 'PLACED', to: 'PREPARING', permission: 'kds.update' },
  { from: 'CONFIRMED', to: 'PREPARING', permission: 'kds.update' },
  { from: 'PREPARING', to: 'READY', permission: 'kds.update' },
  { from: 'PREPARING', to: 'PLACED', permission: 'kds.update' },
  { from: 'READY', to: 'PREPARING', permission: 'kds.update' },
  { from: 'READY', to: 'SERVED', permission: 'order.create' },
] as const

const statusSchema = z.object({
  status: z.enum(['PLACED', 'PREPARING', 'READY', 'SERVED']),
})

kdsRouter.patch('/orders/:id/status', requireAuth, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = statusSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Status tidak valid' })

  const user = res.locals.user as AuthUser
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' })

  const rule = rules.find((r) => r.from === order.status && r.to === parsed.data.status)
  if (!rule) return res.status(400).json({ message: 'Perubahan status ini tidak diizinkan' })

  if (!user.permissions.includes(rule.permission)) {
    return res.status(403).json({ message: 'Anda tidak punya izin untuk mengubah status ini' })
  }

  // Pesanan yang sudah disajikan dan sudah lunas langsung selesai
  const nextStatus = rule.to === 'SERVED' && order.paymentStatus === 'PAID' ? 'COMPLETED' : rule.to

  const changed = await prisma.$transaction(async (tx) => {
    // Hanya berubah jika status belum diubah orang lain di saat yang sama
    const result = await tx.order.updateMany({
      where: { id, status: order.status },
      data: { status: nextStatus },
    })
    if (result.count === 0) return false

    await tx.orderStatusLog.create({
      data: { orderId: id, fromStatus: order.status, toStatus: nextStatus, userId: user.id },
    })
    return true
  })

  if (!changed) {
    return res.status(409).json({ message: 'Status pesanan sudah diubah orang lain, data dimuat ulang' })
  }

  emitOrdersChanged({ id, number: order.number, status: nextStatus, reason: 'status' })
  res.json({ id, number: order.number, status: nextStatus })
})