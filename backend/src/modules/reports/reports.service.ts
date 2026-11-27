import { prisma } from '../../lib/prisma.js'

export type Range = { start: Date; end: Date; days: number }

const DAY_MS = 86_400_000

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0)

// Hari mengikuti zona waktu komputer server
const dayKey = (d: Date) => d.toLocaleDateString('sv-SE')

// from dan to berformat YYYY-MM-DD dan keduanya termasuk dalam periode
export function parseRange(from: string, to: string): Range | null {
  const start = new Date(`${from}T00:00:00`)
  const last = new Date(`${to}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(last.getTime()) || last < start) return null

  const end = new Date(last)
  end.setDate(end.getDate() + 1)

  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS)
  if (days > 366) return null

  return { start, end, days }
}

// Periode pembanding: rentang yang sama panjangnya tepat sebelum periode ini
function previousRange(range: Range): Range {
  const start = new Date(range.start)
  start.setDate(start.getDate() - range.days)
  return { start, end: range.start, days: range.days }
}

async function loadPeriod(start: Date, end: Date) {
  const [orders, refunds, cancelled, payments] = await Promise.all([
    // Penjualan = pesanan tidak dibatalkan yang sudah lunas
    prisma.order.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        status: { not: 'CANCELLED' },
        paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
      },
      select: {
        id: true,
        number: true,
        type: true,
        total: true,
        subtotal: true,
        serviceAmount: true,
        taxAmount: true,
        roundingAmount: true,
        createdAt: true,
        createdById: true,
        items: {
          select: {
            productId: true,
            productName: true,
            quantity: true,
            lineTotal: true,
            product: { select: { category: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
    prisma.refund.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        amount: true,
        reason: true,
        createdAt: true,
        payment: { select: { method: true } },
        order: { select: { number: true, status: true } },
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
    }),
    prisma.order.findMany({
      where: { cancelledAt: { gte: start, lt: end } },
      orderBy: { cancelledAt: 'desc' },
      select: {
        id: true,
        number: true,
        total: true,
        cancelReason: true,
        cancelledAt: true,
        refunds: { select: { amount: true } },
      },
    }),
    prisma.payment.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { method: true, amount: true },
    }),
  ])

  return { orders, refunds, cancelled, payments }
}

type PeriodData = Awaited<ReturnType<typeof loadPeriod>>

function totalsOf(d: PeriodData) {
  // Refund karena pembatalan dilaporkan terpisah, tidak mengurangi penjualan
  const refunds = d.refunds.filter((r) => r.order.status !== 'CANCELLED')
  const gross = sum(d.orders.map((o) => o.total))
  const refundsTotal = sum(refunds.map((r) => r.amount))

  return {
    orders: d.orders.length,
    gross,
    subtotal: sum(d.orders.map((o) => o.subtotal)),
    service: sum(d.orders.map((o) => o.serviceAmount)),
    tax: sum(d.orders.map((o) => o.taxAmount)),
    rounding: sum(d.orders.map((o) => o.roundingAmount)),
    refundsCount: refunds.length,
    refundsTotal,
    net: gross - refundsTotal,
    aov: d.orders.length > 0 ? Math.round(gross / d.orders.length) : 0,
    cancelledCount: d.cancelled.length,
    cancelledValue: sum(d.cancelled.map((c) => c.total)),
  }
}

export async function buildOverview(range: Range, from: string, to: string) {
  const prev = previousRange(range)

  const [cur, previous, statusGroups] = await Promise.all([
    loadPeriod(range.start, range.end),
    loadPeriod(prev.start, prev.end),
    prisma.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: range.start, lt: range.end } },
      _count: { _all: true },
    }),
  ])

  // Penjualan per hari (hari tanpa penjualan tetap tampil dengan nilai 0)
  const dailyMap = new Map<string, { sales: number; orders: number }>()
  for (let d = new Date(range.start); d < range.end; d.setDate(d.getDate() + 1)) {
    dailyMap.set(dayKey(d), { sales: 0, orders: 0 })
  }
  for (const o of cur.orders) {
    const entry = dailyMap.get(dayKey(o.createdAt))
    if (entry) {
      entry.sales += o.total
      entry.orders += 1
    }
  }
  const daily = [...dailyMap.entries()].map(([date, v]) => ({ date, ...v }))

  // Penjualan per jam
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, sales: 0, orders: 0 }))
  for (const o of cur.orders) {
    const bucket = hourly[o.createdAt.getHours()]
    if (bucket) {
      bucket.sales += o.total
      bucket.orders += 1
    }
  }

  // Per jenis layanan
  const typeMap = new Map<string, { orders: number; sales: number }>()
  for (const o of cur.orders) {
    const entry = typeMap.get(o.type) ?? { orders: 0, sales: 0 }
    entry.orders += 1
    entry.sales += o.total
    typeMap.set(o.type, entry)
  }

  // Produk dan kategori (nilai item sebelum pajak dan service)
  const productMap = new Map<number, { name: string; quantity: number; revenue: number }>()
  const categoryMap = new Map<number, { name: string; quantity: number; revenue: number }>()
  for (const o of cur.orders) {
    for (const item of o.items) {
      const p = productMap.get(item.productId) ?? { name: item.productName, quantity: 0, revenue: 0 }
      p.quantity += item.quantity
      p.revenue += item.lineTotal
      productMap.set(item.productId, p)

      const cat = item.product.category
      const c = categoryMap.get(cat.id) ?? { name: cat.name, quantity: 0, revenue: 0 }
      c.quantity += item.quantity
      c.revenue += item.lineTotal
      categoryMap.set(cat.id, c)
    }
  }
  const itemRevenue = sum([...productMap.values()].map((p) => p.revenue))
  const share = (value: number) => (itemRevenue > 0 ? value / itemRevenue : 0)

  const products = [...productMap.entries()]
    .map(([productId, p]) => ({ productId, ...p, share: share(p.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)

  const categories = [...categoryMap.entries()]
    .map(([id, c]) => ({ id, ...c, share: share(c.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)

  const slowProducts = await prisma.product.findMany({
    where: { isActive: true, id: { notIn: [...productMap.keys()] } },
    orderBy: { name: 'asc' },
    take: 30,
    select: { name: true, category: { select: { name: true } } },
  })

  // Komposisi pembayaran per metode
  const methodMap = new Map<string, { received: number; count: number; refunded: number }>()
  for (const p of cur.payments) {
    const entry = methodMap.get(p.method) ?? { received: 0, count: 0, refunded: 0 }
    entry.received += p.amount
    entry.count += 1
    methodMap.set(p.method, entry)
  }
  for (const r of cur.refunds) {
    const entry = methodMap.get(r.payment.method) ?? { received: 0, count: 0, refunded: 0 }
    entry.refunded += r.amount
    methodMap.set(r.payment.method, entry)
  }
  const payments = [...methodMap.entries()]
    .map(([method, v]) => ({ method, ...v, net: v.received - v.refunded }))
    .sort((a, b) => b.received - a.received)

  // Siapa yang membatalkan pesanan (dari audit log)
  const cancelledIds = cur.cancelled.map((c) => c.id)
  const cancelAudits = cancelledIds.length
    ? await prisma.auditLog.findMany({
        where: { action: 'ORDER_CANCELLED', entityId: { in: cancelledIds } },
        select: { entityId: true, user: { select: { name: true } } },
      })
    : []
  const cancelledBy = new Map(cancelAudits.map((a) => [a.entityId, a.user.name]))

  return {
    range: { from, to, days: range.days },
    current: totalsOf(cur),
    previous: totalsOf(previous),
    daily,
    hourly,
    byType: [...typeMap.entries()].map(([type, v]) => ({ type, ...v })),
    statuses: statusGroups.map((s) => ({ status: s.status, count: s._count._all })),
    products,
    categories,
    slowProducts: slowProducts.map((p) => ({ name: p.name, category: p.category.name })),
    payments,
    refunds: cur.refunds
      .filter((r) => r.order.status !== 'CANCELLED')
      .slice(0, 50)
      .map((r) => ({
        id: r.id,
        number: r.order.number,
        amount: r.amount,
        reason: r.reason,
        method: r.payment.method,
        createdAt: r.createdAt,
        by: r.createdBy.name,
        approvedBy: r.approvedBy.name,
      })),
    cancellations: cur.cancelled.slice(0, 50).map((c) => ({
      id: c.id,
      number: c.number,
      total: c.total,
      reason: c.cancelReason,
      cancelledAt: c.cancelledAt,
      refunded: sum(c.refunds.map((r) => r.amount)),
      by: cancelledBy.get(c.id) ?? null,
    })),
  }
}

export async function buildStaff(range: Range) {
  const [orders, refunds, shifts, cancelAudits, readyLogs] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: range.start, lt: range.end },
        status: { not: 'CANCELLED' },
        paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
      },
      select: { createdById: true, total: true },
    }),
    prisma.refund.findMany({
      where: { createdAt: { gte: range.start, lt: range.end }, order: { status: { not: 'CANCELLED' } } },
      select: { createdById: true, amount: true },
    }),
    prisma.shift.findMany({
      where: { status: 'CLOSED', closedAt: { gte: range.start, lt: range.end } },
      select: { userId: true, cashDifference: true },
    }),
    prisma.auditLog.findMany({
      where: { action: 'ORDER_CANCELLED', createdAt: { gte: range.start, lt: range.end } },
      select: { userId: true },
    }),
    prisma.orderStatusLog.findMany({
      where: { toStatus: 'READY', createdAt: { gte: range.start, lt: range.end } },
      select: { userId: true, createdAt: true, order: { select: { createdAt: true } } },
    }),
  ])

  type Service = {
    orders: number
    sales: number
    cancellations: number
    refundsCount: number
    refundsTotal: number
    shifts: number
    shiftsWithDifference: number
    totalAbsDifference: number
  }
  const blank = (): Service => ({
    orders: 0,
    sales: 0,
    cancellations: 0,
    refundsCount: 0,
    refundsTotal: 0,
    shifts: 0,
    shiftsWithDifference: 0,
    totalAbsDifference: 0,
  })

  const service = new Map<number, Service>()
  const get = (id: number) => {
    const existing = service.get(id)
    if (existing) return existing
    const created = blank()
    service.set(id, created)
    return created
  }

  for (const o of orders) {
    const s = get(o.createdById)
    s.orders += 1
    s.sales += o.total
  }
  for (const r of refunds) {
    const s = get(r.createdById)
    s.refundsCount += 1
    s.refundsTotal += r.amount
  }
  for (const a of cancelAudits) get(a.userId).cancellations += 1
  for (const sh of shifts) {
    const s = get(sh.userId)
    s.shifts += 1
    if ((sh.cashDifference ?? 0) !== 0) {
      s.shiftsWithDifference += 1
      s.totalAbsDifference += Math.abs(sh.cashDifference ?? 0)
    }
  }

  // Dapur: tiket yang ditandai Siap dan lama dari pesanan dibuat sampai siap
  const kitchen = new Map<number, { tickets: number; minutes: number }>()
  for (const log of readyLogs) {
    const entry = kitchen.get(log.userId) ?? { tickets: 0, minutes: 0 }
    entry.tickets += 1
    entry.minutes += (log.createdAt.getTime() - log.order.createdAt.getTime()) / 60000
    kitchen.set(log.userId, entry)
  }

  const ids = [...new Set([...service.keys(), ...kitchen.keys()])]
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : []
  const nameOf = new Map(users.map((u) => [u.id, u.name]))

  return {
    service: [...service.entries()]
      .map(([id, s]) => ({
        userId: id,
        name: nameOf.get(id) ?? `#${id}`,
        ...s,
        aov: s.orders > 0 ? Math.round(s.sales / s.orders) : 0,
      }))
      .sort((a, b) => b.sales - a.sales),
    kitchen: [...kitchen.entries()]
      .map(([id, k]) => ({
        userId: id,
        name: nameOf.get(id) ?? `#${id}`,
        tickets: k.tickets,
        avgMinutes: k.tickets > 0 ? Math.round((k.minutes / k.tickets) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.tickets - a.tickets),
  }
}

export async function buildLive() {
  const [activeOrders, unpaidOrders, tableGroups, openShifts, pendingReviews] = await Promise.all([
    prisma.order.count({ where: { status: { in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY'] } } }),
    prisma.order.count({
      where: { status: { not: 'CANCELLED' }, paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
    }),
    prisma.restaurantTable.groupBy({
      by: ['status'],
      where: { isActive: true },
      _count: { _all: true },
    }),
    prisma.shift.findMany({
      where: { status: 'OPEN' },
      select: { id: true, openedAt: true, user: { select: { name: true } } },
    }),
    prisma.shift.count({ where: { status: 'CLOSED', reviewedAt: null, cashDifference: { not: 0 } } }),
  ])

  const tables = { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, CLEANING: 0 }
  for (const g of tableGroups) tables[g.status] = g._count._all

  return {
    activeOrders,
    unpaidOrders,
    tables,
    openShifts: openShifts.map((s) => ({ id: s.id, openedAt: s.openedAt, cashier: s.user.name })),
    pendingReviews,
  }
}