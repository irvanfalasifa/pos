import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requirePermission } from '../../middleware/auth.js'
import type { AuthUser } from '../../middleware/auth.js'
import { ApprovalError, auditData, authorize } from '../audit/audit.service.js'

export const shiftsRouter = Router()

class ShiftError extends Error {
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

function sendError(e: unknown, res: Response) {
  if (e instanceof ShiftError) return res.status(e.status).json({ message: e.message })
  if (e instanceof ApprovalError) return res.status(e.status).json({ message: e.message, code: e.code })
  if (prismaCode(e) === 'P2034') return res.status(409).json({ message: 'Server sedang sibuk, silakan coba lagi' })
  throw e
}

const operateGuard = [requireAuth, requirePermission('shift.operate')] as const
const reviewGuard = [requireAuth, requirePermission('shift.review')] as const

const shiftInclude = {
  user: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
} as const

type ShiftRow = {
  id: number
  openedAt: Date
  closedAt: Date | null
  openingCash: number
  expectedCash: number | null
  closingCash: number | null
  cashDifference: number | null
  closingNote: string | null
  status: 'OPEN' | 'CLOSED'
  reviewedAt: Date | null
  reviewNote: string | null
  user: { id: number; name: string }
  reviewedBy: { id: number; name: string } | null
}

function shiftShape(s: ShiftRow) {
  return {
    id: s.id,
    openedAt: s.openedAt,
    closedAt: s.closedAt,
    openingCash: s.openingCash,
    expectedCash: s.expectedCash,
    closingCash: s.closingCash,
    cashDifference: s.cashDifference,
    closingNote: s.closingNote,
    status: s.status,
    reviewedAt: s.reviewedAt,
    reviewNote: s.reviewNote,
    user: s.user,
    reviewedBy: s.reviewedBy,
    // Ditutup dengan selisih dan belum disahkan manajer
    needsReview: s.status === 'CLOSED' && s.cashDifference !== 0 && s.reviewedAt === null,
  }
}

// Ringkasan kas dan transaksi sebuah shift
// Kas seharusnya = modal awal + penjualan tunai + kas masuk - refund tunai - kas keluar
async function summarize(shift: { id: number; openingCash: number }) {
  const [byMethod, moves, cashRefundAgg, refundAgg, orderCount] = await Promise.all([
    prisma.payment.groupBy({
      by: ['method'],
      where: { shiftId: shift.id },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.cashMovement.groupBy({
      by: ['type'],
      where: { shiftId: shift.id },
      _sum: { amount: true },
    }),
    prisma.refund.aggregate({
      where: { shiftId: shift.id, payment: { method: 'CASH' } },
      _sum: { amount: true },
    }),
    prisma.refund.aggregate({ where: { shiftId: shift.id }, _sum: { amount: true } }),
    prisma.order.count({ where: { shiftId: shift.id } }),
  ])

  const cashSales = byMethod.find((m) => m.method === 'CASH')?._sum.amount ?? 0
  const cashIn = moves.find((m) => m.type === 'IN')?._sum.amount ?? 0
  const cashOut = moves.find((m) => m.type === 'OUT')?._sum.amount ?? 0
  const cashRefunds = cashRefundAgg._sum.amount ?? 0

  return {
    openingCash: shift.openingCash,
    cashSales,
    cashIn,
    cashOut,
    cashRefunds,
    expectedCash: shift.openingCash + cashSales + cashIn - cashRefunds - cashOut,
    orderCount,
    refundsTotal: refundAgg._sum.amount ?? 0,
    paymentsByMethod: byMethod.map((m) => ({
      method: m.method,
      amount: m._sum.amount ?? 0,
      count: m._count._all,
    })),
  }
}

async function detail(shift: ShiftRow) {
  const [summary, movements] = await Promise.all([
    summarize(shift),
    prisma.cashMovement.findMany({
      where: { shiftId: shift.id },
      orderBy: { id: 'desc' },
      include: { createdBy: { select: { name: true } } },
    }),
  ])
  return { shift: shiftShape(shift), summary, movements }
}

/* ---------------- Shift saya ---------------- */

shiftsRouter.get('/shifts/current', ...operateGuard, async (_req, res) => {
  const user = res.locals.user as AuthUser
  const shift = await prisma.shift.findFirst({
    where: { userId: user.id, status: 'OPEN' },
    include: shiftInclude,
  })
  if (!shift) return res.json({ shift: null, summary: null, movements: [] })
  res.json(await detail(shift))
})

const openSchema = z.object({ openingCash: z.number().int().min(0).max(1_000_000_000) })

shiftsRouter.post('/shifts/open', ...operateGuard, async (req, res) => {
  const parsed = openSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Modal awal tidak valid' })

  const user = res.locals.user as AuthUser

  try {
    const shift = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.shift.findFirst({ where: { userId: user.id, status: 'OPEN' } })
        if (existing) throw new ShiftError('Anda masih memiliki shift yang aktif', 409)

        return tx.shift.create({
          data: { userId: user.id, openingCash: parsed.data.openingCash },
          include: shiftInclude,
        })
      },
      { isolationLevel: 'Serializable' },
    )
    res.status(201).json(await detail(shift))
  } catch (e) {
    return sendError(e, res)
  }
})

const approverSchema = z
  .object({ email: z.string().trim().email(), password: z.string().min(1).max(200) })
  .nullable()
  .optional()

const movementSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  amount: z.number().int().min(1).max(100_000_000),
  reason: z.string().trim().min(3).max(200),
  approver: approverSchema,
})

shiftsRouter.post('/shifts/current/movements', ...operateGuard, async (req, res) => {
  const parsed = movementSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Jumlah dan alasan wajib diisi (alasan minimal 3 huruf)' })
  const { type, amount, reason, approver } = parsed.data

  const user = res.locals.user as AuthUser

  try {
    const shift = await prisma.shift.findFirst({
      where: { userId: user.id, status: 'OPEN' },
      include: shiftInclude,
    })
    if (!shift) throw new ShiftError('Tidak ada shift aktif', 404)

    // Kas keluar butuh persetujuan manajer, kas masuk tidak
    let approvedById: number | null = null
    if (type === 'OUT') {
      const summary = await summarize(shift)
      if (amount > summary.expectedCash) {
        throw new ShiftError('Kas keluar melebihi uang yang seharusnya ada di laci')
      }
      approvedById = await authorize(user, 'shift.review', approver, `cash-out:shift-${shift.id}`)
    }

    await prisma.$transaction(async (tx) => {
      await tx.cashMovement.create({
        data: { shiftId: shift.id, type, amount, reason, approvedById, createdById: user.id },
      })

      if (type === 'OUT') {
        await tx.auditLog.create({
          data: auditData({
            userId: user.id,
            action: 'CASH_OUT_RECORDED',
            entityType: 'Shift',
            entityId: shift.id,
            afterData: { cashier: user.name, amount },
            reason,
            approvedById,
          }),
        })
      }
    })

    res.status(201).json(await detail(shift))
  } catch (e) {
    return sendError(e, res)
  }
})

const closeSchema = z.object({
  closingCash: z.number().int().min(0).max(1_000_000_000),
  note: z.string().trim().max(200).nullable().optional(),
})

shiftsRouter.post('/shifts/current/close', ...operateGuard, async (req, res) => {
  const parsed = closeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Jumlah uang fisik tidak valid' })
  const { closingCash, note } = parsed.data

  const user = res.locals.user as AuthUser

  try {
    const shift = await prisma.shift.findFirst({
      where: { userId: user.id, status: 'OPEN' },
      include: shiftInclude,
    })
    if (!shift) throw new ShiftError('Tidak ada shift aktif', 404)

    const summary = await summarize(shift)
    const difference = closingCash - summary.expectedCash

    if (difference !== 0 && (note?.length ?? 0) < 3) {
      throw new ShiftError('Ada selisih kas. Isi catatan penjelasan (minimal 3 huruf)')
    }

    const closed = await prisma.$transaction(async (tx) => {
      // Hanya menutup bila shift masih terbuka (mencegah penutupan ganda)
      const result = await tx.shift.updateMany({
        where: { id: shift.id, status: 'OPEN' },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          expectedCash: summary.expectedCash,
          closingCash,
          cashDifference: difference,
          closingNote: note || null,
        },
      })
      if (result.count === 0) throw new ShiftError('Shift sudah ditutup', 409)

      await tx.auditLog.create({
        data: auditData({
          userId: user.id,
          action: 'SHIFT_CLOSED',
          entityType: 'Shift',
          entityId: shift.id,
          beforeData: { cashier: user.name, openingCash: shift.openingCash, expectedCash: summary.expectedCash },
          afterData: { cashier: user.name, closingCash, difference },
          reason: note || null,
        }),
      })

      return tx.shift.findUniqueOrThrow({ where: { id: shift.id }, include: shiftInclude })
    })

    res.json(await detail(closed))
  } catch (e) {
    return sendError(e, res)
  }
})

/* ---------------- Tinjauan manajer ---------------- */

const listQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })

shiftsRouter.get('/shifts', ...reviewGuard, async (req, res) => {
  const parsed = listQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Filter tidak valid' })

  let openedAt: { gte: Date; lt: Date } | undefined
  if (parsed.data.date) {
    const start = new Date(`${parsed.data.date}T00:00:00`)
    if (Number.isNaN(start.getTime())) return res.status(400).json({ message: 'Tanggal tidak valid' })
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    openedAt = { gte: start, lt: end }
  }

  const shifts = await prisma.shift.findMany({
    where: openedAt ? { openedAt } : {},
    orderBy: { id: 'desc' },
    take: 100,
    include: shiftInclude,
  })

  // Shift yang masih berjalan: kas seharusnya dihitung langsung
  const rows = await Promise.all(
    shifts.map(async (s) => {
      const shape = shiftShape(s)
      if (s.status === 'OPEN') {
        const summary = await summarize(s)
        return { ...shape, expectedCash: summary.expectedCash }
      }
      return shape
    }),
  )

  res.json(rows)
})

shiftsRouter.get('/shifts/:id', requireAuth, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const user = res.locals.user as AuthUser
  const shift = await prisma.shift.findUnique({ where: { id }, include: shiftInclude })
  if (!shift) return res.status(404).json({ message: 'Shift tidak ditemukan' })

  const canReview = user.permissions.includes('shift.review')
  const isOwn = shift.userId === user.id && user.permissions.includes('shift.operate')
  if (!canReview && !isOwn) return res.status(403).json({ message: 'Anda tidak punya izin untuk tindakan ini' })

  res.json(await detail(shift))
})

const reviewSchema = z.object({ note: z.string().trim().max(200).optional() })

shiftsRouter.post('/shifts/:id/review', ...reviewGuard, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = reviewSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Catatan tidak valid' })

  const user = res.locals.user as AuthUser

  try {
    const shift = await prisma.shift.findUnique({ where: { id }, include: shiftInclude })
    if (!shift) throw new ShiftError('Shift tidak ditemukan', 404)
    if (shift.status !== 'CLOSED') throw new ShiftError('Shift belum ditutup')
    if (shift.reviewedAt) throw new ShiftError('Shift ini sudah disahkan', 409)

    if (shift.userId === user.id && !user.roles.includes('owner')) {
      throw new ShiftError('Anda tidak dapat mengesahkan shift sendiri', 403)
    }

    const note = parsed.data.note ?? ''
    if (shift.cashDifference !== 0 && note.length < 3) {
      throw new ShiftError('Ada selisih kas. Isi catatan tinjauan (minimal 3 huruf)')
    }

    const reviewed = await prisma.$transaction(async (tx) => {
      const result = await tx.shift.updateMany({
        where: { id, reviewedAt: null },
        data: { reviewedById: user.id, reviewedAt: new Date(), reviewNote: note || null },
      })
      if (result.count === 0) throw new ShiftError('Shift ini sudah disahkan', 409)

      await tx.auditLog.create({
        data: auditData({
          userId: user.id,
          action: 'SHIFT_REVIEWED',
          entityType: 'Shift',
          entityId: id,
          afterData: { cashier: shift.user.name, difference: shift.cashDifference ?? 0 },
          reason: note || null,
        }),
      })

      return tx.shift.findUniqueOrThrow({ where: { id }, include: shiftInclude })
    })

    res.json(await detail(reviewed))
  } catch (e) {
    return sendError(e, res)
  }
})