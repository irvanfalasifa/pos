import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requirePermission } from '../../middleware/auth.js'

export const modifiersRouter = Router()

function prismaCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e
    ? String((e as { code: unknown }).code)
    : undefined
}

function parseId(value: unknown): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

const groupInclude = {
  options: { where: { isActive: true }, orderBy: { id: 'asc' } },
  _count: { select: { products: true } },
} as const

const optionSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(50),
  price: z.number().int().min(0).max(10_000_000),
})

const groupSchema = z.object({
  name: z.string().trim().min(1).max(50),
  minSelect: z.number().int().min(0).max(20),
  maxSelect: z.number().int().min(1).max(20),
  isActive: z.boolean().optional(),
  options: z.array(optionSchema).max(30).optional(),
})

function sendGroupError(e: unknown, res: Response) {
  const code = prismaCode(e)
  if (code === 'P2002') return res.status(409).json({ message: 'Nama grup modifier sudah dipakai' })
  if (code === 'P2025') return res.status(404).json({ message: 'Grup modifier tidak ditemukan' })
  throw e
}

modifiersRouter.get('/modifier-groups', requireAuth, requirePermission('product.view'), async (_req, res) => {
  const groups = await prisma.modifierGroup.findMany({
    orderBy: { name: 'asc' },
    include: groupInclude,
  })
  res.json(groups)
})

modifiersRouter.post('/modifier-groups', requireAuth, requirePermission('product.create'), async (req, res) => {
  const parsed = groupSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data grup modifier tidak valid' })

  const { options, ...rest } = parsed.data
  if (rest.minSelect > rest.maxSelect) {
    return res.status(400).json({ message: 'Minimal pilihan tidak boleh melebihi maksimal' })
  }

  try {
    const group = await prisma.modifierGroup.create({
      data: {
        ...rest,
        ...(options?.length
          ? { options: { create: options.map((o) => ({ name: o.name, price: o.price })) } }
          : {}),
      },
      include: groupInclude,
    })
    res.status(201).json(group)
  } catch (e) {
    return sendGroupError(e, res)
  }
})

modifiersRouter.patch('/modifier-groups/:id', requireAuth, requirePermission('product.update'), async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = groupSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data grup modifier tidak valid' })
  const { options, ...rest } = parsed.data

  const existing = await prisma.modifierGroup.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ message: 'Grup modifier tidak ditemukan' })

  const min = rest.minSelect ?? existing.minSelect
  const max = rest.maxSelect ?? existing.maxSelect
  if (min > max) {
    return res.status(400).json({ message: 'Minimal pilihan tidak boleh melebihi maksimal' })
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.modifierGroup.update({ where: { id }, data: rest })

      if (options) {
        // Pilihan yang dihapus dari daftar dinonaktifkan, bukan dihapus,
        // supaya pesanan lama yang memakainya tetap utuh.
        const keepIds = options.filter((o) => o.id).map((o) => o.id as number)
        await tx.modifier.updateMany({
          where: { groupId: id, id: { notIn: keepIds } },
          data: { isActive: false },
        })

        for (const o of options) {
          if (o.id) {
            await tx.modifier.update({
              where: { id: o.id, groupId: id },
              data: { name: o.name, price: o.price, isActive: true },
            })
          } else {
            await tx.modifier.create({ data: { groupId: id, name: o.name, price: o.price } })
          }
        }
      }
    })

    const group = await prisma.modifierGroup.findUniqueOrThrow({ where: { id }, include: groupInclude })
    res.json(group)
  } catch (e) {
    return sendGroupError(e, res)
  }
})