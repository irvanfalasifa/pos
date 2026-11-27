import { prisma } from '../../lib/prisma.js'

// Cukup memuat tabel yang dipakai. Bisa diisi `prisma` biasa maupun `tx` di dalam transaksi.
export type Db = Pick<
  typeof prisma,
  'ingredient' | 'stockMovement' | 'order' | 'orderItem' | 'recipe' | 'modifierIngredient' | 'setting'
>

export type MovementType =
  | 'OPENING'
  | 'PURCHASE_IN'
  | 'MANUAL_IN'
  | 'MANUAL_OUT'
  | 'ADJUSTMENT'
  | 'WASTE'
  | 'SALE_USAGE'
  | 'SALE_RETURN'

export class StockError extends Error {
  status: number
  code: string

  constructor(message: string, status = 400, code = 'STOCK_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function allowsNegativeStock(db: Pick<typeof prisma, 'setting'>): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: 'allow_negative_stock' } })
  return row?.value === '1'
}

export type MovementInput = {
  ingredientId: number
  type: MovementType
  quantityIn?: number
  quantityOut?: number
  unitCost?: number | null
  reason?: string | null
  referenceType?: string
  referenceId?: number
  userId: number
  allowNegative: boolean
}

/**
 * Satu-satunya pintu perubahan stok. Mengubah saldo dan menulis baris ledger
 * dalam satu langkah, sehingga saldo selalu bisa direkonsiliasi dengan riwayat.
 */
export async function applyMovement(db: Db, input: MovementInput): Promise<number> {
  const qIn = input.quantityIn ?? 0
  const qOut = input.quantityOut ?? 0
  if (qIn < 0 || qOut < 0 || (qIn === 0 && qOut === 0) || (qIn > 0 && qOut > 0)) {
    throw new StockError('Jumlah pergerakan stok tidak valid')
  }

  const ingredient = await db.ingredient.findUnique({ where: { id: input.ingredientId } })
  if (!ingredient) throw new StockError('Bahan baku tidak ditemukan', 404)

  if (qOut > 0) {
    // Pengurangan atomik: tidak jadi bila stok kurang (kecuali stok negatif diizinkan)
    const result = input.allowNegative
      ? await db.ingredient.updateMany({
          where: { id: ingredient.id },
          data: { currentStock: { decrement: qOut } },
        })
      : await db.ingredient.updateMany({
          where: { id: ingredient.id, currentStock: { gte: qOut } },
          data: { currentStock: { decrement: qOut } },
        })

    if (result.count === 0) {
      throw new StockError(
        `Stok ${ingredient.name} tidak cukup (tersisa ${ingredient.currentStock} ${ingredient.unit})`,
        409,
        'INSUFFICIENT_STOCK',
      )
    }
  }

  if (qIn > 0) {
    // Biaya rata-rata bergerak, dihitung hanya bila stok masuk membawa harga
    let averageCost = ingredient.averageCost
    if (input.unitCost != null && input.unitCost >= 0) {
      const base = Math.max(0, ingredient.currentStock)
      averageCost = (base * ingredient.averageCost + qIn * input.unitCost) / (base + qIn)
    }
    await db.ingredient.update({
      where: { id: ingredient.id },
      data: { currentStock: { increment: qIn }, averageCost },
    })
  }

  const after = await db.ingredient.findUniqueOrThrow({
    where: { id: ingredient.id },
    select: { currentStock: true },
  })

  await db.stockMovement.create({
    data: {
      ingredientId: ingredient.id,
      type: input.type,
      quantityIn: qIn,
      quantityOut: qOut,
      unitCost: input.unitCost ?? ingredient.averageCost,
      balanceAfter: after.currentStock,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      reason: input.reason ?? null,
      createdById: input.userId,
    },
  })

  return after.currentStock
}

// Kebutuhan bahan sebuah pesanan: resep produk/varian + pemakaian oleh modifier
async function computeOrderUsage(db: Db, orderId: number): Promise<Map<number, number>> {
  const items = await db.orderItem.findMany({
    where: { orderId },
    select: { productId: true, variantId: true, quantity: true, modifiers: { select: { modifierId: true } } },
  })

  const productIds = [...new Set(items.map((i) => i.productId))]
  const modifierIds = [...new Set(items.flatMap((i) => i.modifiers.map((m) => m.modifierId)))]

  const [recipes, usages] = await Promise.all([
    db.recipe.findMany({
      where: { isActive: true, productId: { in: productIds } },
      include: { items: true },
    }),
    modifierIds.length
      ? db.modifierIngredient.findMany({ where: { modifierId: { in: modifierIds } } })
      : Promise.resolve([]),
  ])

  const total = new Map<number, number>()
  const add = (ingredientId: number, quantity: number) =>
    total.set(ingredientId, (total.get(ingredientId) ?? 0) + quantity)

  for (const item of items) {
    // Resep khusus varian didahulukan, lalu resep umum produk
    const recipe =
      recipes.find((r) => r.productId === item.productId && r.variantId !== null && r.variantId === item.variantId) ??
      recipes.find((r) => r.productId === item.productId && r.variantId === null)

    if (recipe) {
      for (const ri of recipe.items) add(ri.ingredientId, (ri.quantity * item.quantity) / recipe.yieldQuantity)
    }

    for (const m of item.modifiers) {
      for (const u of usages.filter((x) => x.modifierId === m.modifierId)) {
        add(u.ingredientId, u.quantity * item.quantity)
      }
    }
  }

  // Dibulatkan ke atas agar tidak ada bahan terpakai yang tidak tercatat
  const rounded = new Map<number, number>()
  for (const [id, qty] of total) {
    const value = Math.ceil(qty - 1e-9)
    if (value > 0) rounded.set(id, value)
  }
  return rounded
}

// Dipanggil saat dapur mulai menyiapkan pesanan
export async function deductForOrder(db: Db, orderId: number, userId: number) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, number: true, stockDeductedAt: true },
  })
  if (!order || order.stockDeductedAt) return

  const usage = await computeOrderUsage(db, orderId)
  const allowNegative = await allowsNegativeStock(db)

  if (usage.size > 0 && !allowNegative) {
    const ingredients = await db.ingredient.findMany({ where: { id: { in: [...usage.keys()] } } })
    const short = ingredients
      .filter((i) => i.currentStock < (usage.get(i.id) ?? 0))
      .map((i) => `${i.name} (butuh ${usage.get(i.id)}, tersisa ${i.currentStock} ${i.unit})`)

    if (short.length > 0) {
      throw new StockError(`Stok tidak cukup: ${short.join(', ')}`, 409, 'INSUFFICIENT_STOCK')
    }
  }

  for (const [ingredientId, quantity] of usage) {
    await applyMovement(db, {
      ingredientId,
      type: 'SALE_USAGE',
      quantityOut: quantity,
      reason: `Pesanan ${order.number}`,
      referenceType: 'Order',
      referenceId: orderId,
      userId,
      allowNegative,
    })
  }

  await db.order.update({ where: { id: orderId }, data: { stockDeductedAt: new Date() } })
}

/**
 * Membalik pemakaian stok sebuah pesanan dengan baris ledger baru (riwayat tidak dihapus).
 * RETURN: bahan belum dipakai, kembali ke stok.
 * WASTE : bahan sudah terpakai, dikembalikan lalu dicatat sebagai waste.
 */
export async function restoreForOrder(
  db: Db,
  orderId: number,
  userId: number,
  mode: 'RETURN' | 'WASTE',
  reason: string,
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, stockDeductedAt: true },
  })
  if (!order?.stockDeductedAt) return

  const movements = await db.stockMovement.findMany({
    where: { referenceType: 'Order', referenceId: orderId, type: { in: ['SALE_USAGE', 'SALE_RETURN'] } },
  })

  // Sisa pemakaian bersih per bahan
  const net = new Map<number, number>()
  for (const m of movements) {
    net.set(m.ingredientId, (net.get(m.ingredientId) ?? 0) + m.quantityOut - m.quantityIn)
  }

  for (const [ingredientId, quantity] of net) {
    if (quantity <= 0) continue

    await applyMovement(db, {
      ingredientId,
      type: 'SALE_RETURN',
      quantityIn: quantity,
      reason,
      referenceType: 'Order',
      referenceId: orderId,
      userId,
      allowNegative: true,
    })

    if (mode === 'WASTE') {
      await applyMovement(db, {
        ingredientId,
        type: 'WASTE',
        quantityOut: quantity,
        reason: `Terbuang: ${reason}`,
        referenceType: 'Order',
        referenceId: orderId,
        userId,
        allowNegative: true,
      })
    }
  }

  await db.order.update({ where: { id: orderId }, data: { stockDeductedAt: null } })
}