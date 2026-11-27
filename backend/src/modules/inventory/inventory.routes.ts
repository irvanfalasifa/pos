import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requirePermission } from '../../middleware/auth.js'
import type { AuthUser } from '../../middleware/auth.js'
import { auditData } from '../audit/audit.service.js'
import { StockError, allowsNegativeStock, applyMovement } from './stock.service.js'

export const inventoryRouter = Router()

const viewGuard = [requireAuth, requirePermission('inventory.view')] as const
const manageGuard = [requireAuth, requirePermission('inventory.manage')] as const

class InventoryError extends Error {
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
  if (e instanceof InventoryError) return res.status(e.status).json({ message: e.message })
  if (e instanceof StockError) return res.status(e.status).json({ message: e.message, code: e.code })
  if (prismaCode(e) === 'P2002') return res.status(409).json({ message: 'Nama atau SKU sudah dipakai bahan lain' })
  if (prismaCode(e) === 'P2025') return res.status(404).json({ message: 'Data tidak ditemukan' })
  throw e
}

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0)

/* ---------------- Ringkasan dan kebijakan ---------------- */

inventoryRouter.get('/inventory/summary', ...viewGuard, async (_req, res) => {
  const ingredients = await prisma.ingredient.findMany({
    where: { isActive: true },
    select: { currentStock: true, minimumStock: true, averageCost: true },
  })

  res.json({
    ingredients: ingredients.length,
    lowStock: ingredients.filter((i) => i.minimumStock > 0 && i.currentStock <= i.minimumStock).length,
    emptyStock: ingredients.filter((i) => i.currentStock <= 0).length,
    value: Math.round(sum(ingredients.map((i) => Math.max(0, i.currentStock) * i.averageCost))),
    allowNegativeStock: await allowsNegativeStock(prisma),
  })
})

inventoryRouter.put('/inventory/policy', requireAuth, requirePermission('settings.manage'), async (req, res) => {
  const parsed = z.object({ allowNegativeStock: z.boolean() }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data tidak valid' })

  const actor = res.locals.user as AuthUser
  const before = await allowsNegativeStock(prisma)
  const value = parsed.data.allowNegativeStock ? '1' : '0'

  await prisma.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: { key: 'allow_negative_stock' },
      update: { value },
      create: { key: 'allow_negative_stock', value },
    })
    await tx.auditLog.create({
      data: auditData({
        userId: actor.id,
        action: 'SETTINGS_UPDATED',
        entityType: 'Settings',
        entityId: 0,
        beforeData: { allow_negative_stock: before ? '1' : '0' },
        afterData: { allow_negative_stock: value },
      }),
    })
  })

  res.json({ allowNegativeStock: parsed.data.allowNegativeStock })
})

/* ---------------- Bahan baku ---------------- */

inventoryRouter.get('/inventory/ingredients', ...viewGuard, async (_req, res) => {
  res.json(await prisma.ingredient.findMany({ orderBy: { name: 'asc' } }))
})

const ingredientBase = z.object({
  name: z.string().trim().min(1).max(60),
  sku: z.string().trim().max(30).nullable().optional(),
  unit: z.string().trim().min(1).max(15),
  purchaseUnit: z.string().trim().max(15).nullable().optional(),
  purchaseFactor: z.number().int().min(1).max(1_000_000).nullable().optional(),
  minimumStock: z.number().int().min(0).max(1_000_000_000),
})

function checkPurchaseUnit(purchaseUnit: string | null | undefined, purchaseFactor: number | null | undefined) {
  if (!!purchaseUnit !== !!purchaseFactor) {
    throw new InventoryError('Satuan beli dan nilai konversinya harus diisi bersamaan')
  }
}

const createSchema = ingredientBase.extend({
  openingStock: z.number().int().min(0).max(1_000_000_000).default(0),
  openingCost: z.number().min(0).max(100_000_000).default(0),
})

inventoryRouter.post('/inventory/ingredients', ...manageGuard, async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data bahan baku tidak valid' })

  const { openingStock, openingCost, ...data } = parsed.data
  const actor = res.locals.user as AuthUser

  try {
    checkPurchaseUnit(data.purchaseUnit, data.purchaseFactor)

    const created = await prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.create({
        data: {
          name: data.name,
          sku: data.sku || null,
          unit: data.unit,
          purchaseUnit: data.purchaseUnit || null,
          purchaseFactor: data.purchaseFactor || null,
          minimumStock: data.minimumStock,
        },
      })

      if (openingStock > 0) {
        await applyMovement(tx, {
          ingredientId: ingredient.id,
          type: 'OPENING',
          quantityIn: openingStock,
          unitCost: openingCost,
          reason: 'Stok awal',
          userId: actor.id,
          allowNegative: false,
        })
      }

      return tx.ingredient.findUniqueOrThrow({ where: { id: ingredient.id } })
    })

    res.status(201).json(created)
  } catch (e) {
    return sendError(e, res)
  }
})

const patchSchema = ingredientBase.partial().extend({ isActive: z.boolean().optional() })

inventoryRouter.patch('/inventory/ingredients/:id', ...manageGuard, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = patchSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data bahan baku tidak valid' })
  const input = parsed.data

  try {
    const existing = await prisma.ingredient.findUnique({ where: { id } })
    if (!existing) throw new InventoryError('Bahan baku tidak ditemukan', 404)

    const purchaseUnit = input.purchaseUnit !== undefined ? input.purchaseUnit : existing.purchaseUnit
    const purchaseFactor = input.purchaseFactor !== undefined ? input.purchaseFactor : existing.purchaseFactor
    checkPurchaseUnit(purchaseUnit, purchaseFactor)

    // Satuan pemakaian menentukan arti semua angka stok dan resep, jadi tidak boleh berubah setelah dipakai
    if (input.unit !== undefined && input.unit !== existing.unit) {
      const used = await prisma.stockMovement.count({ where: { ingredientId: id } })
      if (used > 0) throw new InventoryError('Satuan pemakaian tidak dapat diubah setelah ada riwayat stok')
    }

    const updated = await prisma.ingredient.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.sku !== undefined ? { sku: input.sku || null } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.purchaseUnit !== undefined ? { purchaseUnit: input.purchaseUnit || null } : {}),
        ...(input.purchaseFactor !== undefined ? { purchaseFactor: input.purchaseFactor || null } : {}),
        ...(input.minimumStock !== undefined ? { minimumStock: input.minimumStock } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    })
    res.json(updated)
  } catch (e) {
    return sendError(e, res)
  }
})

/* ---------------- Pergerakan stok ---------------- */

const movementSchema = z.object({
  type: z.enum(['MANUAL_IN', 'MANUAL_OUT', 'ADJUST_UP', 'ADJUST_DOWN', 'WASTE']),
  quantity: z.number().int().min(1).max(1_000_000_000),
  unitCost: z.number().min(0).max(100_000_000).nullable().optional(),
  reason: z.string().trim().min(3).max(200),
})

const movementMap = {
  MANUAL_IN: { type: 'MANUAL_IN', direction: 'in' },
  MANUAL_OUT: { type: 'MANUAL_OUT', direction: 'out' },
  ADJUST_UP: { type: 'ADJUSTMENT', direction: 'in' },
  ADJUST_DOWN: { type: 'ADJUSTMENT', direction: 'out' },
  WASTE: { type: 'WASTE', direction: 'out' },
} as const

inventoryRouter.post('/inventory/ingredients/:id/movements', ...manageGuard, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = movementSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Jumlah dan alasan wajib diisi (alasan minimal 3 huruf)' })
  const input = parsed.data

  const actor = res.locals.user as AuthUser
  const mapping = movementMap[input.type]

  try {
    const ingredient = await prisma.$transaction(async (tx) => {
      const before = await tx.ingredient.findUnique({ where: { id } })
      if (!before) throw new InventoryError('Bahan baku tidak ditemukan', 404)

      const allowNegative = await allowsNegativeStock(tx)

      const balance = await applyMovement(tx, {
        ingredientId: id,
        type: mapping.type,
        ...(mapping.direction === 'in' ? { quantityIn: input.quantity } : { quantityOut: input.quantity }),
        unitCost: mapping.direction === 'in' ? input.unitCost : undefined,
        reason: input.reason,
        userId: actor.id,
        allowNegative,
      })

      // Semua perubahan manual selain stok masuk biasa dicatat di audit log
      if (input.type !== 'MANUAL_IN') {
        await tx.auditLog.create({
          data: auditData({
            userId: actor.id,
            action: 'STOCK_ADJUSTED',
            entityType: 'Ingredient',
            entityId: id,
            beforeData: { name: before.name, stock: before.currentStock },
            afterData: { name: before.name, stock: balance, type: input.type, quantity: input.quantity },
            reason: input.reason,
          }),
        })
      }

      return tx.ingredient.findUniqueOrThrow({ where: { id } })
    })

    res.status(201).json(ingredient)
  } catch (e) {
    return sendError(e, res)
  }
})

inventoryRouter.get('/inventory/ingredients/:id/movements', ...viewGuard, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const movements = await prisma.stockMovement.findMany({
    where: { ingredientId: id },
    orderBy: { id: 'desc' },
    take: 100,
    include: { createdBy: { select: { name: true } } },
  })
  res.json(movements)
})

/* ---------------- Resep ---------------- */

inventoryRouter.get('/inventory/recipe-data', ...viewGuard, async (_req, res) => {
  const [products, modifiers] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        price: true,
        category: { select: { name: true } },
        variants: {
          where: { isActive: true },
          orderBy: { id: 'asc' },
          select: { id: true, name: true, priceDelta: true },
        },
        recipes: {
          where: { isActive: true },
          select: {
            id: true,
            variantId: true,
            yieldQuantity: true,
            items: {
              select: {
                ingredientId: true,
                quantity: true,
                ingredient: { select: { name: true, unit: true } },
              },
            },
          },
        },
      },
    }),
    prisma.modifier.findMany({
      where: { isActive: true, group: { isActive: true } },
      orderBy: [{ groupId: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        group: { select: { name: true } },
        ingredients: {
          select: {
            ingredientId: true,
            quantity: true,
            ingredient: { select: { name: true, unit: true } },
          },
        },
      },
    }),
  ])

  res.json({ products, modifiers })
})

const recipeSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable(),
  yieldQuantity: z.number().int().min(1).max(1000),
  items: z
    .array(
      z.object({
        ingredientId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(1_000_000),
      }),
    )
    .max(30),
})

function assertUniqueIngredients(items: { ingredientId: number }[]) {
  const ids = items.map((i) => i.ingredientId)
  if (new Set(ids).size !== ids.length) throw new InventoryError('Satu bahan hanya boleh muncul sekali')
}

inventoryRouter.put('/inventory/recipes', ...manageGuard, async (req, res) => {
  const parsed = recipeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data resep tidak valid' })
  const { productId, variantId, yieldQuantity, items } = parsed.data

  try {
    assertUniqueIngredients(items)

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { variants: { select: { id: true } } },
      })
      if (!product) throw new InventoryError('Produk tidak ditemukan', 404)
      if (variantId && !product.variants.some((v) => v.id === variantId)) {
        throw new InventoryError('Varian tidak sesuai dengan produk')
      }

      const existing = await tx.recipe.findFirst({ where: { productId, variantId } })

      // Resep tanpa bahan berarti resepnya dihapus
      if (items.length === 0) {
        if (existing) await tx.recipe.delete({ where: { id: existing.id } })
        return
      }

      const found = await tx.ingredient.count({ where: { id: { in: items.map((i) => i.ingredientId) } } })
      if (found !== items.length) throw new InventoryError('Ada bahan baku yang tidak ditemukan')

      if (existing) {
        await tx.recipe.update({ where: { id: existing.id }, data: { yieldQuantity, isActive: true } })
        await tx.recipeItem.deleteMany({ where: { recipeId: existing.id } })
        await tx.recipeItem.createMany({ data: items.map((i) => ({ recipeId: existing.id, ...i })) })
      } else {
        await tx.recipe.create({ data: { productId, variantId, yieldQuantity, items: { create: items } } })
      }
    })

    res.json({ ok: true })
  } catch (e) {
    return sendError(e, res)
  }
})

const usageSchema = z.object({
  items: z
    .array(
      z.object({
        ingredientId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(1_000_000),
      }),
    )
    .max(20),
})

inventoryRouter.put('/inventory/modifiers/:id/usage', ...manageGuard, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = usageSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data pemakaian tidak valid' })
  const { items } = parsed.data

  try {
    assertUniqueIngredients(items)

    await prisma.$transaction(async (tx) => {
      const modifier = await tx.modifier.findUnique({ where: { id } })
      if (!modifier) throw new InventoryError('Modifier tidak ditemukan', 404)

      const found = await tx.ingredient.count({ where: { id: { in: items.map((i) => i.ingredientId) } } })
      if (found !== items.length) throw new InventoryError('Ada bahan baku yang tidak ditemukan')

      await tx.modifierIngredient.deleteMany({ where: { modifierId: id } })
      if (items.length > 0) {
        await tx.modifierIngredient.createMany({ data: items.map((i) => ({ modifierId: id, ...i })) })
      }
    })

    res.json({ ok: true })
  } catch (e) {
    return sendError(e, res)
  }
})