import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requirePermission } from '../../middleware/auth.js'

export const productsRouter = Router()

function prismaCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e
    ? String((e as { code: unknown }).code)
    : undefined
}

function parseId(value: unknown): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

const categoryInclude = { _count: { select: { products: true } } } as const

const productInclude = {
  category: { select: { id: true, name: true } },
  variants: { where: { isActive: true }, orderBy: { id: 'asc' } },
} as const

/* ---------------- Kategori ---------------- */

const categorySchema = z.object({
  name: z.string().trim().min(1).max(50),
  isActive: z.boolean(),
})

function sendCategoryError(e: unknown, res: Response) {
  const code = prismaCode(e)
  if (code === 'P2002') return res.status(409).json({ message: 'Nama kategori sudah dipakai' })
  if (code === 'P2025') return res.status(404).json({ message: 'Kategori tidak ditemukan' })
  throw e
}

productsRouter.get('/categories', requireAuth, requirePermission('product.view'), async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: categoryInclude,
  })
  res.json(categories)
})

productsRouter.post('/categories', requireAuth, requirePermission('product.create'), async (req, res) => {
  const parsed = categorySchema.pick({ name: true }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Nama kategori tidak valid' })

  try {
    const last = await prisma.category.aggregate({ _max: { sortOrder: true } })
    const category = await prisma.category.create({
      data: { name: parsed.data.name, sortOrder: (last._max.sortOrder ?? 0) + 1 },
      include: categoryInclude,
    })
    res.status(201).json(category)
  } catch (e) {
    return sendCategoryError(e, res)
  }
})

productsRouter.patch('/categories/:id', requireAuth, requirePermission('product.update'), async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = categorySchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data kategori tidak valid' })

  try {
    const category = await prisma.category.update({
      where: { id },
      data: parsed.data,
      include: categoryInclude,
    })
    res.json(category)
  } catch (e) {
    return sendCategoryError(e, res)
  }
})

/* ---------------- Produk ---------------- */

const variantSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(50),
  priceDelta: z.number().int().min(0).max(10_000_000),
})

const productSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sku: z.string().trim().max(40).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  price: z.number().int().min(0).max(100_000_000),
  categoryId: z.number().int().positive(),
  isActive: z.boolean().optional(),
  variants: z.array(variantSchema).max(20).optional(),
})

function sendProductError(e: unknown, res: Response) {
  const code = prismaCode(e)
  if (code === 'P2002') return res.status(409).json({ message: 'SKU sudah dipakai produk lain' })
  if (code === 'P2003') return res.status(400).json({ message: 'Kategori tidak ditemukan' })
  if (code === 'P2025') return res.status(404).json({ message: 'Produk tidak ditemukan' })
  throw e
}

const listQuery = z.object({
  search: z.string().trim().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
})

productsRouter.get('/products', requireAuth, requirePermission('product.view'), async (req, res) => {
  const parsed = listQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Filter tidak valid' })
  const { search, categoryId, status } = parsed.data

  const products = await prisma.product.findMany({
    where: {
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(status === 'active' ? { isActive: true } : {}),
      ...(status === 'inactive' ? { isActive: false } : {}),
    },
    include: productInclude,
    orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
  })
  res.json(products)
})

productsRouter.post('/products', requireAuth, requirePermission('product.create'), async (req, res) => {
  const parsed = productSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data produk tidak valid' })
  const { variants, sku, description, ...rest } = parsed.data

  try {
    const product = await prisma.product.create({
      data: {
        ...rest,
        sku: sku || null,
        description: description || null,
        ...(variants?.length
          ? { variants: { create: variants.map((v) => ({ name: v.name, priceDelta: v.priceDelta })) } }
          : {}),
      },
      include: productInclude,
    })
    res.status(201).json(product)
  } catch (e) {
    return sendProductError(e, res)
  }
})

productsRouter.patch('/products/:id', requireAuth, requirePermission('product.update'), async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = productSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data produk tidak valid' })
  const { variants, sku, description, ...rest } = parsed.data

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...rest,
          ...(sku !== undefined ? { sku: sku || null } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
        },
      })

      if (variants) {
        // Varian yang tidak ada di daftar baru dinonaktifkan (bukan dihapus),
        // supaya transaksi lama yang merujuknya tetap utuh.
        const keepIds = variants.filter((v) => v.id).map((v) => v.id as number)
        await tx.productVariant.updateMany({
          where: { productId: id, id: { notIn: keepIds } },
          data: { isActive: false },
        })

        for (const v of variants) {
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id, productId: id },
              data: { name: v.name, priceDelta: v.priceDelta, isActive: true },
            })
          } else {
            await tx.productVariant.create({
              data: { productId: id, name: v.name, priceDelta: v.priceDelta },
            })
          }
        }
      }
    })

    const product = await prisma.product.findUniqueOrThrow({ where: { id }, include: productInclude })
    res.json(product)
  } catch (e) {
    return sendProductError(e, res)
  }
})