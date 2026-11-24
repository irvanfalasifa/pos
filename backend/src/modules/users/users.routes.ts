import { Router } from 'express'
import type { Response } from 'express'
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth, requirePermission } from '../../middleware/auth.js'
import type { AuthUser } from '../../middleware/auth.js'
import { auditData } from '../audit/audit.service.js'

export const usersRouter = Router()

class UserError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

const PRIVILEGED = ['owner', 'admin']
const userGuard = [requireAuth, requirePermission('user.manage')] as const
const roleGuard = [requireAuth, requirePermission('role.manage')] as const

function prismaCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e
    ? String((e as { code: unknown }).code)
    : undefined
}

function parseId(value: unknown): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

// Tanpa karakter yang mudah tertukar (0/O, 1/l/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

function generateTempPassword(length = 10): string {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET.charAt(randomInt(ALPHABET.length))
  return out
}

const isOwner = (actor: AuthUser) => actor.roles.includes('owner')

function assertCanAssign(actor: AuthUser, roleNames: string[]) {
  if (!isOwner(actor) && roleNames.some((r) => PRIVILEGED.includes(r))) {
    throw new UserError('Hanya Owner yang dapat memberi role Owner atau Admin', 403)
  }
}

function assertCanManage(actor: AuthUser, targetRoles: string[]) {
  if (!isOwner(actor) && targetRoles.some((r) => PRIVILEGED.includes(r))) {
    throw new UserError('Hanya Owner yang dapat mengelola akun Owner atau Admin', 403)
  }
}

async function loadRoles(names: string[]) {
  const unique = [...new Set(names)]
  const roles = await prisma.role.findMany({ where: { name: { in: unique } } })
  if (roles.length !== unique.length) throw new UserError('Ada role yang tidak dikenal')
  return roles
}

const userInclude = { roles: { include: { role: { select: { name: true } } } } } as const

type UserShape = {
  id: number
  name: string
  email: string
  isActive: boolean
  mustChangePassword: boolean
  createdAt: Date
  roles: { role: { name: string } }[]
}

function shape(user: UserShape, lastLoginAt: Date | null) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    roles: user.roles.map((r) => r.role.name),
    lastLoginAt,
  }
}

function sendError(e: unknown, res: Response) {
  if (e instanceof UserError) return res.status(e.status).json({ message: e.message })
  if (prismaCode(e) === 'P2002') return res.status(409).json({ message: 'Email sudah terdaftar' })
  if (prismaCode(e) === 'P2025') return res.status(404).json({ message: 'Pengguna tidak ditemukan' })
  throw e
}

/* ---------------- Daftar pengguna ---------------- */

usersRouter.get('/admin/users', ...userGuard, async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' }, include: userInclude })

  const logins = await prisma.loginEvent.groupBy({
    by: ['userId'],
    where: { success: true, userId: { in: users.map((u) => u.id) } },
    _max: { createdAt: true },
  })
  const lastLogin = new Map(logins.map((l) => [l.userId, l._max.createdAt]))

  res.json(users.map((u) => shape(u, lastLogin.get(u.id) ?? null)))
})

usersRouter.get('/admin/roles', ...userGuard, async (_req, res) => {
  const roles = await prisma.role.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, name: true, label: true },
  })
  res.json(roles)
})

/* ---------------- Buat akun ---------------- */

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(100),
  roles: z.array(z.string().min(1).max(30)).min(1).max(6),
  password: z.string().min(8).max(100).optional(),
})

usersRouter.post('/admin/users', ...userGuard, async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data pengguna tidak valid' })

  const actor = res.locals.user as AuthUser
  const email = parsed.data.email.toLowerCase()

  try {
    assertCanAssign(actor, parsed.data.roles)
    const roles = await loadRoles(parsed.data.roles)

    const generated = generateTempPassword()
    const plain = parsed.data.password ?? generated
    const passwordHash = await bcrypt.hash(plain, 10)

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: parsed.data.name,
          email,
          passwordHash,
          mustChangePassword: true,
          roles: { create: roles.map((r) => ({ roleId: r.id })) },
        },
        include: userInclude,
      })

      await tx.auditLog.create({
        data: auditData({
          userId: actor.id,
          action: 'USER_CREATED',
          entityType: 'User',
          entityId: created.id,
          afterData: { name: created.name, email, roles: roles.map((r) => r.name) },
        }),
      })

      return created
    })

    res.status(201).json({
      user: shape(user, null),
      tempPassword: parsed.data.password ? null : generated,
    })
  } catch (e) {
    return sendError(e, res)
  }
})

/* ---------------- Ubah akun ---------------- */

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  email: z.string().trim().email().max(100).optional(),
  roles: z.array(z.string().min(1).max(30)).min(1).max(6).optional(),
  isActive: z.boolean().optional(),
})

usersRouter.patch('/admin/users/:id', ...userGuard, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = patchSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data pengguna tidak valid' })
  const input = parsed.data

  const actor = res.locals.user as AuthUser

  try {
    const target = await prisma.user.findUnique({ where: { id }, include: userInclude })
    if (!target) throw new UserError('Pengguna tidak ditemukan', 404)

    const targetRoles = target.roles.map((r) => r.role.name)
    assertCanManage(actor, targetRoles)

    if (input.roles) {
      assertCanAssign(actor, input.roles)
      if (target.id === actor.id) throw new UserError('Anda tidak dapat mengubah role akun sendiri')
    }
    if (input.isActive === false && target.id === actor.id) {
      throw new UserError('Anda tidak dapat menonaktifkan akun sendiri')
    }

    // Harus selalu ada minimal satu Owner aktif
    const losesOwner =
      targetRoles.includes('owner') &&
      ((input.roles && !input.roles.includes('owner')) || input.isActive === false)
    if (losesOwner) {
      const otherOwners = await prisma.user.count({
        where: { id: { not: id }, isActive: true, roles: { some: { role: { name: 'owner' } } } },
      })
      if (otherOwners === 0) throw new UserError('Harus ada minimal satu Owner yang aktif')
    }

    const newRoles = input.roles ? await loadRoles(input.roles) : null

    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      })

      if (newRoles) {
        await tx.userRole.deleteMany({ where: { userId: id } })
        await tx.userRole.createMany({ data: newRoles.map((r) => ({ userId: id, roleId: r.id })) })
      }

      const fresh = await tx.user.findUniqueOrThrow({ where: { id }, include: userInclude })

      await tx.auditLog.create({
        data: auditData({
          userId: actor.id,
          action: 'USER_UPDATED',
          entityType: 'User',
          entityId: id,
          beforeData: {
            name: target.name,
            email: target.email,
            isActive: target.isActive,
            roles: targetRoles,
          },
          afterData: {
            name: fresh.name,
            email: fresh.email,
            isActive: fresh.isActive,
            roles: fresh.roles.map((r) => r.role.name),
          },
        }),
      })

      return fresh
    })

    res.json(shape(updated, null))
  } catch (e) {
    return sendError(e, res)
  }
})

/* ---------------- Reset password ---------------- */

usersRouter.post('/admin/users/:id/reset-password', ...userGuard, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const actor = res.locals.user as AuthUser

  try {
    if (id === actor.id) {
      throw new UserError('Untuk akun sendiri, gunakan menu Akun saya untuk mengubah password')
    }

    const target = await prisma.user.findUnique({ where: { id }, include: userInclude })
    if (!target) throw new UserError('Pengguna tidak ditemukan', 404)
    assertCanManage(
      actor,
      target.roles.map((r) => r.role.name),
    )

    const plain = generateTempPassword()
    const passwordHash = await bcrypt.hash(plain, 10)

    await prisma.$transaction(async (tx) => {
      // tokenVersion naik: seluruh sesi lama akun ini berakhir
      await tx.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } },
      })

      await tx.auditLog.create({
        data: auditData({
          userId: actor.id,
          action: 'PASSWORD_RESET',
          entityType: 'User',
          entityId: id,
          afterData: { name: target.name, email: target.email },
        }),
      })
    })

    res.json({ email: target.email, tempPassword: plain })
  } catch (e) {
    return sendError(e, res)
  }
})

/* ---------------- Riwayat login ---------------- */

usersRouter.get('/admin/users/:id/logins', ...userGuard, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const events = await prisma.loginEvent.findMany({
    where: { userId: id },
    orderBy: { id: 'desc' },
    take: 20,
    select: { id: true, success: true, ip: true, userAgent: true, createdAt: true },
  })
  res.json(events)
})

/* ---------------- Matriks role dan izin ---------------- */

usersRouter.get('/admin/roles/matrix', ...roleGuard, async (_req, res) => {
  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      orderBy: { id: 'asc' },
      include: { permissions: { include: { permission: { select: { code: true } } } } },
    }),
    prisma.permission.findMany({ orderBy: { code: 'asc' }, select: { code: true, label: true } }),
  ])

  res.json({
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      label: r.label,
      codes: r.permissions.map((p) => p.permission.code),
    })),
    permissions,
  })
})

const matrixSchema = z.object({ codes: z.array(z.string().min(1).max(60)).max(100) })

usersRouter.put('/admin/roles/:id/permissions', ...roleGuard, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) return res.status(400).json({ message: 'ID tidak valid' })

  const parsed = matrixSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Data izin tidak valid' })

  const actor = res.locals.user as AuthUser
  const codes = [...new Set(parsed.data.codes)]

  const role = await prisma.role.findUnique({
    where: { id },
    include: { permissions: { include: { permission: { select: { code: true } } } } },
  })
  if (!role) return res.status(404).json({ message: 'Role tidak ditemukan' })
  if (role.name === 'owner') {
    return res.status(400).json({ message: 'Role Owner selalu memiliki semua izin dan tidak dapat diubah' })
  }

  const permissions = await prisma.permission.findMany({ where: { code: { in: codes } } })
  if (permissions.length !== codes.length) return res.status(400).json({ message: 'Ada izin yang tidak dikenal' })

  const before = role.permissions.map((p) => p.permission.code).sort()

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } })
    await tx.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: id, permissionId: p.id })) })

    await tx.auditLog.create({
      data: auditData({
        userId: actor.id,
        action: 'ROLE_PERMISSIONS_UPDATED',
        entityType: 'Role',
        entityId: id,
        beforeData: { name: role.label, permissions: before },
        afterData: { name: role.label, permissions: [...codes].sort() },
      }),
    })
  })

  res.json({ id, codes })
})