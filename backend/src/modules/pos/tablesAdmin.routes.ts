import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requirePermission } from '../../middleware/auth.js'
import { emitTablesChanged } from '../../realtime/socket.js'

export const tablesAdminRouter = Router()

const guard = [requireAuth, requirePermission('table.manage')] as const

function prismaCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e
    ? String((e as { code: unknown }).code)
    : undefined
}

function parseId(value: unknown): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

function sendError(e: unknown, res: Response, duplicateMessage: string) {
  const code = prismaCode(e)
  if (code === 'P2002') return res.status(409).json({ message: duplicateMessage })
  if (code === 'P2003') return res.status(400).json({ message: 'Area tidak ditemukan' })
  if (code === 'P2025') return res.status(404).json({ message: 'Data tidak ditemukan' })
  throw e
}

tablesAdminRouter.get('/admin/tables', ...guard, async (_req, res) => {
  const areas = await prisma.area.findMany({
    orderBy: { id: 'asc' },
    include: { tables: { orderBy: { name: 'asc' } } },
  })
  res.json(areas)
})

/* ---------------- Area ---------------- */

const areaSchema = z.object({ name: z.string().trim().min(1).max(40) })

tablesAdminRouter.post('/admin/areas', ...guard, async (req, res) => {
  const parsed = areaSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Nama area tidak valid' })

  try {
    const area = await prisma.area.create({ data: parsed.data, include: { tables: true } })
    emitTablesChanged()
    res.status(201).json(area)
  } catch (e) {
    return sendError(e, res, 'Nama area sudah dipakai')
  }
})

tablesAdminRouter.patch('/admin/areas/:id', ...guard, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = areaSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Nama area tidak valid' })

  try {
    const area = await prisma.area.update({ where: { id }, data: parsed.data, include: { tables: true } })
    emitTablesChanged()
    res.json(area)
  } catch (e) {
    return sendError(e, res, 'Nama area sudah dipakai')
  }
})

tablesAdminRouter.delete('/admin/areas/:id', ...guard, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const tableCount = await prisma.restaurantTable.count({ where: { areaId: id } })
  if (tableCount > 0) {
    return res.status(409).json({ message: 'Area masih memiliki meja. Nonaktifkan meja atau pindahkan dulu.' })
  }

  try {
    await prisma.area.delete({ where: { id } })
    emitTablesChanged()
    res.json({ id })
  } catch (e) {
    return sendError(e, res, 'Area tidak dapat dihapus')
  }
})

/* ---------------- Meja ---------------- */

const tableSchema = z.object({
  areaId: z.number().int().positive(),
  name: z.string().trim().min(1).max(20),
  capacity: z.number().int().min(1).max(50),
})

const tablePatchSchema = tableSchema.partial().extend({ isActive: z.boolean().optional() })

tablesAdminRouter.post('/admin/tables', ...guard, async (req, res) => {
  const parsed = tableSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data meja tidak valid' })

  try {
    const table = await prisma.restaurantTable.create({ data: parsed.data })
    emitTablesChanged()
    res.status(201).json(table)
  } catch (e) {
    return sendError(e, res, 'Nama meja sudah dipakai di area ini')
  }
})

tablesAdminRouter.patch('/admin/tables/:id', ...guard, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = tablePatchSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data meja tidak valid' })

  // Meja yang masih dipakai tidak boleh dinonaktifkan
  if (parsed.data.isActive === false) {
    const open = await prisma.order.count({
      where: { tableId: id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    })
    if (open > 0) {
      return res.status(409).json({ message: 'Meja ini masih memiliki pesanan aktif dan belum bisa dinonaktifkan' })
    }
  }

  try {
    const table = await prisma.restaurantTable.update({ where: { id }, data: parsed.data })
    emitTablesChanged()
    res.json(table)
  } catch (e) {
    return sendError(e, res, 'Nama meja sudah dipakai di area ini')
  }
})