import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requirePermission } from '../../middleware/auth.js'
import type { AuthUser } from '../../middleware/auth.js'
import { emitOrdersChanged, emitTablesChanged } from '../../realtime/socket.js'

export const posRouter = Router()

class OrderError extends Error {}

function prismaCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e
    ? String((e as { code: unknown }).code)
    : undefined
}

function parseId(value: unknown): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

async function getRates() {
  const rows = await prisma.setting.findMany({ where: { key: { in: ['tax_bp', 'service_bp'] } } })
  const read = (key: string) => {
    const n = Number(rows.find((r) => r.key === key)?.value)
    return Number.isInteger(n) && n >= 0 ? n : 0
  }
  return { taxBp: read('tax_bp'), serviceBp: read('service_bp') }
}

export const orderInclude = {
  table: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: { include: { modifiers: true }, orderBy: { id: 'asc' } },
  payments: {
    select: {
      id: true,
      method: true,
      amount: true,
      tendered: true,
      changeAmount: true,
      reference: true,
      createdAt: true,
    },
    orderBy: { id: 'asc' },
  },
  refunds: {
    select: { id: true, paymentId: true, amount: true, reason: true, createdAt: true },
    orderBy: { id: 'asc' },
  },
} as const

/* ---------------- Konfigurasi ---------------- */

async function getBusiness() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['business_name', 'business_address', 'receipt_footer'] } },
  })
  const read = (key: string, fallback: string) => rows.find((r) => r.key === key)?.value ?? fallback
  return {
    businessName: read('business_name', 'POS Restoran'),
    businessAddress: read('business_address', ''),
    receiptFooter: read('receipt_footer', 'Terima kasih atas kunjungan Anda'),
  }
}

posRouter.get('/pos/config', requireAuth, requirePermission('order.view'), async (_req, res) => {
  res.json({ ...(await getRates()), ...(await getBusiness()) })
})

/* ---------------- Meja ---------------- */

posRouter.get('/tables', requireAuth, requirePermission('order.view'), async (_req, res) => {
  const areas = await prisma.area.findMany({
    orderBy: { id: 'asc' },
    include: { tables: { where: { isActive: true }, orderBy: { name: 'asc' } } },
  })
  res.json(areas)
})

const statusSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING']),
})

posRouter.patch('/tables/:id/status', requireAuth, requirePermission('order.create'), async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = statusSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Status meja tidak valid' })

  const table = await prisma.restaurantTable.findUnique({ where: { id } })
  if (!table || !table.isActive) return res.status(404).json({ message: 'Meja tidak ditemukan' })

  const { status } = parsed.data
  const updated = await prisma.restaurantTable.update({
    where: { id },
    data: {
      status,
      occupiedSince: status === 'OCCUPIED' ? (table.occupiedSince ?? new Date()) : null,
    },
  })
  emitTablesChanged()
  res.json(updated)
})

/* ---------------- Pesanan ---------------- */

const orderItemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable().optional(),
  modifierIds: z.array(z.number().int().positive()).max(30).default([]),
  quantity: z.number().int().min(1).max(99),
  note: z.string().trim().max(200).nullable().optional(),
})

const orderSchema = z.object({
  type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']),
  tableId: z.number().int().positive().nullable().optional(),
  customerName: z.string().trim().max(60).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
  items: z.array(orderItemSchema).min(1).max(50),
})

type OrderInput = z.infer<typeof orderSchema>

async function createOrder(input: OrderInput, userId: number) {
  // 1. Muat produk dari database. Harga SELALU diambil dari sini, bukan dari browser.
  const productIds = [...new Set(input.items.map((i) => i.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: {
      variants: { where: { isActive: true } },
      modifierGroups: {
        include: { group: { include: { options: { where: { isActive: true } } } } },
      },
    },
  })
  const byId = new Map(products.map((p) => [p.id, p]))

  // 2. Validasi tiap item dan hitung harganya
  const lines = input.items.map((item) => {
    const product = byId.get(item.productId)
    if (!product) throw new OrderError('Ada produk yang tidak ditemukan atau sudah nonaktif')

    let variant: (typeof product.variants)[number] | null = null
    if (product.variants.length > 0) {
      variant = product.variants.find((v) => v.id === item.variantId) ?? null
      if (!variant) throw new OrderError(`Pilih varian untuk ${product.name}`)
    } else if (item.variantId) {
      throw new OrderError(`Varian tidak valid untuk ${product.name}`)
    }

    const selectedIds = new Set(item.modifierIds)
    if (selectedIds.size !== item.modifierIds.length) {
      throw new OrderError(`Pilihan modifier untuk ${product.name} tidak valid`)
    }

    const chosen: { id: number; name: string; price: number }[] = []
    for (const { group } of product.modifierGroups) {
      if (!group.isActive) continue
      const picked = group.options.filter((o) => selectedIds.has(o.id))
      if (picked.length < group.minSelect) {
        throw new OrderError(`${product.name}: pilih minimal ${group.minSelect} untuk ${group.name}`)
      }
      if (picked.length > group.maxSelect) {
        throw new OrderError(`${product.name}: ${group.name} maksimal ${group.maxSelect} pilihan`)
      }
      chosen.push(...picked)
    }
    if (chosen.length !== selectedIds.size) {
      throw new OrderError(`Ada modifier yang tidak valid untuk ${product.name}`)
    }

    const unitPrice =
      product.price + (variant?.priceDelta ?? 0) + chosen.reduce((sum, m) => sum + m.price, 0)

    return {
      product,
      variant,
      chosen,
      quantity: item.quantity,
      note: item.note,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
    }
  })

  // 3. Validasi meja
  let tableId: number | null = null
  if (input.type === 'DINE_IN') {
    const table = input.tableId
      ? await prisma.restaurantTable.findUnique({ where: { id: input.tableId } })
      : null
    if (!table || !table.isActive) throw new OrderError('Meja tidak ditemukan')
    if (table.status === 'CLEANING') throw new OrderError('Meja sedang dibersihkan')
    tableId = table.id
  }

  // 4. Hitung total (tarif disimpan sebagai snapshot di pesanan)
  const { taxBp, serviceBp } = await getRates()
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0)
  const serviceAmount = Math.round((subtotal * serviceBp) / 10000)
  const taxAmount = Math.round(((subtotal + serviceAmount) * taxBp) / 10000)
  const total = subtotal + serviceAmount + taxAmount

  // 5. Simpan. Nomor pesanan dicoba ulang bila bentrok dengan permintaan lain.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const now = new Date()
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
        const count = await tx.order.count({ where: { createdAt: { gte: start } } })
        const number = `POS-${datePart}-${String(count + 1).padStart(4, '0')}`

        const order = await tx.order.create({
          data: {
            number,
            type: input.type,
            tableId,
            customerName: input.customerName || null,
            note: input.note || null,
            subtotal,
            serviceBp,
            serviceAmount,
            taxBp,
            taxAmount,
            total,
            createdById: userId,
            items: {
              create: lines.map((l) => ({
                productId: l.product.id,
                variantId: l.variant?.id ?? null,
                productName: l.product.name,
                variantName: l.variant?.name ?? null,
                unitPrice: l.unitPrice,
                quantity: l.quantity,
                note: l.note || null,
                lineTotal: l.lineTotal,
                modifiers: {
                  create: l.chosen.map((m) => ({ modifierId: m.id, name: m.name, price: m.price })),
                },
              })),
            },
          },
          include: orderInclude,
        })

        if (tableId) {
          const table = await tx.restaurantTable.findUniqueOrThrow({ where: { id: tableId } })
          await tx.restaurantTable.update({
            where: { id: tableId },
            data: { status: 'OCCUPIED', occupiedSince: table.occupiedSince ?? new Date() },
          })
        }

        return order
      })
    } catch (e) {
      if (prismaCode(e) === 'P2002' && attempt < 4) continue
      throw e
    }
  }

  throw new OrderError('Gagal membuat nomor pesanan, silakan coba lagi')
}

posRouter.post('/orders', requireAuth, requirePermission('order.create'), async (req, res) => {
  const parsed = orderSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data pesanan tidak valid' })

  if (parsed.data.type === 'DINE_IN' && !parsed.data.tableId) {
    return res.status(400).json({ message: 'Pilih meja untuk pesanan dine-in' })
  }

  const user = res.locals.user as AuthUser

  try {
    const order = await createOrder(parsed.data, user.id)
    emitOrdersChanged({ id: order.id, number: order.number, status: order.status, reason: 'created' })
    if (order.tableId) emitTablesChanged()
    res.status(201).json(order)
  } catch (e) {
    if (e instanceof OrderError) return res.status(400).json({ message: e.message })
    throw e
  }
})

const listQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().max(40).optional(),
})

posRouter.get('/orders', requireAuth, requirePermission('order.view'), async (req, res) => {
  const parsed = listQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Filter tidak valid' })
  const { date, search } = parsed.data

  const base = date ? new Date(`${date}T00:00:00`) : new Date()
  if (Number.isNaN(base.getTime())) return res.status(400).json({ message: 'Tanggal tidak valid' })

  const start = new Date(base)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      ...(search ? { number: { contains: search, mode: 'insensitive' as const } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: orderInclude,
  })
  res.json(orders)
})

/* ---------------- Pembayaran ---------------- */

class PaymentError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

const paymentSchema = z.object({
  idempotencyKey: z.string().min(8).max(64),
  payments: z
    .array(
      z.object({
        method: z.enum(['CASH', 'QRIS', 'CARD', 'EWALLET', 'TRANSFER']),
        amount: z.number().int().min(1).max(1_000_000_000),
        tendered: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
        reference: z.string().trim().max(60).nullable().optional(),
      }),
    )
    .min(1)
    .max(5),
})

type PaymentInput = z.infer<typeof paymentSchema>

async function payOrder(orderId: number, input: PaymentInput, userId: number) {
  // Permintaan yang sama yang terkirim ulang tidak boleh mencatat pembayaran ganda
  const duplicate = await prisma.payment.findFirst({
    where: { idempotencyKey: { startsWith: `${input.idempotencyKey}:` } },
  })
  if (duplicate) {
    if (duplicate.orderId !== orderId) throw new PaymentError('Kunci pembayaran sudah dipakai')
    return prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude })
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findUnique({ where: { id: orderId }, include: { payments: true } })
          if (!order) throw new PaymentError('Pesanan tidak ditemukan', 404)
          if (order.status === 'CANCELLED') throw new PaymentError('Pesanan sudah dibatalkan')
          if (order.paymentStatus === 'REFUNDED' || order.paymentStatus === 'PARTIALLY_REFUNDED') {
          throw new PaymentError('Pesanan ini sudah direfund dan tidak bisa dibayar lagi')
          }

          const paid = order.payments.reduce((sum, p) => sum + p.amount, 0)
          const balance = order.total - paid
          if (balance <= 0) throw new PaymentError('Pesanan ini sudah lunas')

          const sum = input.payments.reduce((s, p) => s + p.amount, 0)
          if (sum > balance) throw new PaymentError('Jumlah pembayaran melebihi sisa tagihan')

          const rows = input.payments.map((p, index) => {
            const base = {
              method: p.method,
              amount: p.amount,
              reference: p.reference || null,
              idempotencyKey: `${input.idempotencyKey}:${index}`,
            }
            if (p.method === 'CASH') {
              if (p.tendered == null || p.tendered < p.amount) {
                throw new PaymentError('Uang diterima kurang dari jumlah tunai')
              }
              return { ...base, tendered: p.tendered, changeAmount: p.tendered - p.amount }
            }
            return { ...base, tendered: null, changeAmount: null }
          })

          await tx.payment.createMany({
            data: rows.map((r) => ({ ...r, orderId, createdById: userId })),
          })

                    const fullyPaid = paid + sum >= order.total
          // Pesanan yang sudah disajikan dan kini lunas otomatis selesai
          const completes = fullyPaid && order.status === 'SERVED'

          if (completes) {
            await tx.orderStatusLog.create({
              data: { orderId, fromStatus: 'SERVED', toStatus: 'COMPLETED', userId },
            })
          }

          return tx.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: fullyPaid ? 'PAID' : 'PARTIALLY_PAID',
              ...(completes ? { status: 'COMPLETED' as const } : {}),
            },
            include: orderInclude,
          })
        },
        { isolationLevel: 'Serializable' },
      )
    } catch (e) {
      const code = prismaCode(e)
      if (code === 'P2034' && attempt < 3) continue
      if (code === 'P2002') {
        return prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude })
      }
      throw e
    }
  }

  throw new PaymentError('Server sedang sibuk, silakan coba lagi', 503)
}

posRouter.post('/orders/:id/payments', requireAuth, requirePermission('payment.create'), async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = paymentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data pembayaran tidak valid' })

  const user = res.locals.user as AuthUser

  try {
    const order = await payOrder(id, parsed.data, user.id)
    emitOrdersChanged({ id: order.id, number: order.number, status: order.status, reason: 'paid' })
    res.json(order)
  } catch (e) {
    if (e instanceof PaymentError) return res.status(e.status).json({ message: e.message })
    throw e
  }
})