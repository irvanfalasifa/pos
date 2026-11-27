import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requirePermission } from '../../middleware/auth.js'
import type { AuthUser } from '../../middleware/auth.js'
import { ApprovalError, auditData, authorize } from '../audit/audit.service.js'
import { emitOrdersChanged, emitTablesChanged } from '../../realtime/socket.js'
import { restoreForOrder } from '../inventory/stock.service.js'

export const orderActionsRouter = Router()

class ActionError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

function prismaCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e
    ? String((e as { code: unknown }).code)
    : undefined
}

function parseId(value: unknown): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

const approverSchema = z
  .object({ email: z.string().trim().email(), password: z.string().min(1).max(200) })
  .nullable()
  .optional()

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0)

/* ---------------- Pembatalan pesanan ---------------- */

const cancelSchema = z.object({
  reason: z.string().trim().min(3).max(200),
  approver: approverSchema,
  stockOutcome: z.enum(['RETURN', 'WASTE']).optional(),
})

const CANCELLABLE: readonly string[] = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY']

orderActionsRouter.post('/orders/:id/cancel', requireAuth, requirePermission('order.create'), async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = cancelSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Alasan pembatalan wajib diisi (minimal 3 huruf)' })
  const { reason, approver, stockOutcome } = parsed.data

  const user = res.locals.user as AuthUser

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: { include: { refunds: true } } },
    })
    if (!order) throw new ActionError('Pesanan tidak ditemukan', 404)

    if (order.status === 'CANCELLED') throw new ActionError('Pesanan ini sudah dibatalkan')
    if (!CANCELLABLE.includes(order.status)) {
      throw new ActionError('Pesanan yang sudah disajikan tidak bisa dibatalkan. Gunakan refund bila diperlukan.')
    }

    // Bila bahan sudah dikurangi, wajib dijelaskan nasibnya
    if (order.stockDeductedAt && !stockOutcome) {
      throw new ActionError('Pilih apakah bahan dikembalikan ke stok atau dicatat sebagai waste')
    }
    
    const approverId = await authorize(user, 'order.cancel', approver, `cancel:${order.number}`)

    const grossPaid = sum(order.payments.map((p) => p.amount))

    const refundedTotal = await prisma.$transaction(async (tx) => {
      // Hanya berubah jika status belum diubah orang lain di saat yang sama
      const changed = await tx.order.updateMany({
        where: { id, status: order.status },
        data: { status: 'CANCELLED', cancelReason: reason, cancelledAt: new Date() },
      })
      if (changed.count === 0) {
        throw new ActionError('Status pesanan sudah berubah, muat ulang halaman', 409)
      }
      
      if (order.stockDeductedAt) {
        await restoreForOrder(tx, id, user.id, stockOutcome ?? 'WASTE', `Pembatalan pesanan ${order.number}: ${reason}`)
      }

      // Uang tunai yang harus keluar dari laci memerlukan shift aktif
      const cashToReturn = sum(
        order.payments
          .filter((p) => p.method === 'CASH')
          .map((p) => Math.max(0, p.amount - sum(p.refunds.map((r) => r.amount)))),
      )
      const shift = await tx.shift.findFirst({ where: { userId: user.id, status: 'OPEN' } })
      if (cashToReturn > 0 && !shift) {
        throw new ActionError('Buka shift terlebih dahulu untuk mengembalikan uang tunai kepada pelanggan', 403)
      }

      // Pembayaran yang sudah masuk dikembalikan penuh (setelah dikurangi refund sebelumnya)
      let refunded = 0
      for (const p of order.payments) {
        const remaining = p.amount - sum(p.refunds.map((r) => r.amount))
        if (remaining > 0) {
          await tx.refund.create({
            data: {
              paymentId: p.id,
              orderId: id,
              amount: remaining,
              reason: `Pembatalan pesanan: ${reason}`,
              approvedById: approverId,
              createdById: user.id,
              shiftId: shift?.id ?? null,
            },
          })
          refunded += remaining
        }
      }
      if (refunded > 0) {
        await tx.order.update({ where: { id }, data: { paymentStatus: 'REFUNDED' } })
      }

      await tx.orderStatusLog.create({
        data: { orderId: id, fromStatus: order.status, toStatus: 'CANCELLED', userId: user.id },
      })

      // Kosongkan meja bila tidak ada pesanan terbuka lain di meja itu
      if (order.tableId) {
        const others = await tx.order.count({
          where: { tableId: order.tableId, id: { not: id }, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        })
        if (others === 0) {
          await tx.restaurantTable.updateMany({
            where: { id: order.tableId, status: 'OCCUPIED' },
            data: { status: 'AVAILABLE', occupiedSince: null },
          })
        }
      }

      await tx.auditLog.create({
        data: auditData({
          userId: user.id,
          action: 'ORDER_CANCELLED',
          entityType: 'Order',
          entityId: id,
          beforeData: {
            number: order.number,
            status: order.status,
            paymentStatus: order.paymentStatus,
            total: order.total,
            paid: grossPaid,
          },
          afterData: { number: order.number, status: 'CANCELLED', refunded },
          reason,
          approvedById: approverId,
        }),
      })

      return refunded
    })

    emitOrdersChanged({ id, number: order.number, status: 'CANCELLED', reason: 'cancelled' })
    if (order.tableId) emitTablesChanged()

    res.json({ id, number: order.number, status: 'CANCELLED', refunded: refundedTotal })
  } catch (e) {
    if (e instanceof ApprovalError) return res.status(e.status).json({ message: e.message, code: e.code })
    if (e instanceof ActionError) return res.status(e.status).json({ message: e.message })
    throw e
  }
})

/* ---------------- Refund ---------------- */

const refundSchema = z.object({
  reason: z.string().trim().min(3).max(200),
  refunds: z
    .array(
      z.object({
        paymentId: z.number().int().positive(),
        amount: z.number().int().min(1).max(1_000_000_000),
      }),
    )
    .min(1)
    .max(5),
  approver: approverSchema,
})

orderActionsRouter.post('/orders/:id/refunds', requireAuth, requirePermission('payment.create'), async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = refundSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data refund tidak valid (alasan minimal 3 huruf)' })
  const input = parsed.data

  const user = res.locals.user as AuthUser

  try {
    const existing = await prisma.order.findUnique({ where: { id }, select: { number: true } })
    if (!existing) throw new ActionError('Pesanan tidak ditemukan', 404)

    const approverId = await authorize(user, 'payment.refund', input.approver, `refund:${existing.number}`)

    let result: { total: number; paymentStatus: 'PARTIALLY_REFUNDED' | 'REFUNDED' } | null = null

    for (let attempt = 0; attempt < 4 && !result; attempt++) {
      try {
        result = await prisma.$transaction(
          async (tx) => {
            const order = await tx.order.findUnique({
              where: { id },
              include: { payments: { include: { refunds: true } } },
            })
            if (!order) throw new ActionError('Pesanan tidak ditemukan', 404)

            const byId = new Map(order.payments.map((p) => [p.id, p]))
            const seen = new Set<number>()
            let total = 0

            for (const r of input.refunds) {
              const payment = byId.get(r.paymentId)
              if (!payment) throw new ActionError('Pembayaran tidak ditemukan pada pesanan ini')
              if (seen.has(payment.id)) throw new ActionError('Satu pembayaran hanya boleh muncul sekali')
              seen.add(payment.id)

              const remaining = payment.amount - sum(payment.refunds.map((x) => x.amount))
              if (r.amount > remaining) {
                throw new ActionError('Jumlah refund melebihi sisa yang dapat dikembalikan untuk pembayaran tersebut')
              }
              total += r.amount
            }

            // Refund tunai mengeluarkan uang dari laci, jadi butuh shift aktif
            const cashRefund = input.refunds.reduce(
              (s, r) => (byId.get(r.paymentId)?.method === 'CASH' ? s + r.amount : s),
              0,
            )
            const shift = await tx.shift.findFirst({ where: { userId: user.id, status: 'OPEN' } })
            if (cashRefund > 0 && !shift) {
              throw new ActionError('Buka shift terlebih dahulu untuk mengembalikan uang tunai kepada pelanggan', 403)
            }

            await tx.refund.createMany({
              data: input.refunds.map((r) => ({
                paymentId: r.paymentId,
                orderId: id,
                amount: r.amount,
                reason: input.reason,
                approvedById: approverId,
                createdById: user.id,
                shiftId: shift?.id ?? null,
              })),
            })

            const grossPaid = sum(order.payments.map((p) => p.amount))
            const refundedBefore = sum(order.payments.flatMap((p) => p.refunds.map((x) => x.amount)))
            const net = grossPaid - refundedBefore - total
            const paymentStatus = net <= 0 ? 'REFUNDED' : 'PARTIALLY_REFUNDED'

            await tx.order.update({ where: { id }, data: { paymentStatus } })

            await tx.auditLog.create({
              data: auditData({
                userId: user.id,
                action: 'PAYMENT_REFUNDED',
                entityType: 'Order',
                entityId: id,
                beforeData: {
                  number: order.number,
                  paymentStatus: order.paymentStatus,
                  paid: grossPaid,
                  refunded: refundedBefore,
                },
                afterData: {
                  number: order.number,
                  paymentStatus,
                  refunded: refundedBefore + total,
                  refunds: input.refunds.map((r) => ({ paymentId: r.paymentId, amount: r.amount })),
                },
                reason: input.reason,
                approvedById: approverId,
              }),
            })

            return { total, paymentStatus } as const
          },
          { isolationLevel: 'Serializable' },
        )
      } catch (e) {
        if (prismaCode(e) === 'P2034' && attempt < 3) continue
        throw e
      }
    }

    if (!result) throw new ActionError('Server sedang sibuk, silakan coba lagi', 503)

    emitOrdersChanged({ id, number: existing.number, status: result.paymentStatus, reason: 'refunded' })

    res.json({ id, number: existing.number, total: result.total, paymentStatus: result.paymentStatus })
  } catch (e) {
    if (e instanceof ApprovalError) return res.status(e.status).json({ message: e.message, code: e.code })
    if (e instanceof ActionError) return res.status(e.status).json({ message: e.message })
    throw e
  }
})