import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma.js'
import { loadUser } from '../../middleware/auth.js'
import type { AuthUser } from '../../middleware/auth.js'

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
export type JsonObject = { [key: string]: Json }

export type AuditInput = {
  userId: number
  action: string
  entityType: string
  entityId: number
  beforeData?: JsonObject
  afterData?: JsonObject
  reason?: string | null
  approvedById?: number | null
}

// Membentuk data untuk tx.auditLog.create({ data: auditData({...}) })
export function auditData(input: AuditInput) {
  return {
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeData: input.beforeData,
    afterData: input.afterData,
    reason: input.reason ?? null,
    approvedById: input.approvedById ?? null,
  }
}

export class ApprovalError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export type Approver = { email: string; password: string } | null | undefined

const MAX_FAILURES = 5
const LOCK_MINUTES = 10

/**
 * Memastikan tindakan sensitif diizinkan.
 * - Jika pengguna sendiri punya izin, ia menyetujui sendiri.
 * - Jika tidak, wajib ada email + password pihak berwenang yang valid.
 * Mengembalikan ID pihak yang menyetujui.
 */
export async function authorize(
  user: AuthUser,
  permission: string,
  approver: Approver,
  context: string,
): Promise<number> {
  if (user.permissions.includes(permission)) return user.id

  if (!approver) {
    throw new ApprovalError('Butuh otorisasi manajer', 403, 'APPROVAL_REQUIRED')
  }

  const since = new Date(Date.now() - LOCK_MINUTES * 60 * 1000)
  const failures = await prisma.auditLog.count({
    where: { userId: user.id, action: 'APPROVAL_FAILED', createdAt: { gte: since } },
  })
  if (failures >= MAX_FAILURES) {
    throw new ApprovalError(
      `Terlalu banyak percobaan otorisasi gagal. Coba lagi dalam ${LOCK_MINUTES} menit.`,
      429,
      'APPROVAL_LOCKED',
    )
  }

  const candidate = await prisma.user.findUnique({ where: { email: approver.email.toLowerCase() } })
  const passwordOk = candidate ? await bcrypt.compare(approver.password, candidate.passwordHash) : false
  const approverUser = candidate && candidate.isActive && passwordOk ? await loadUser(candidate.id) : null

  if (!approverUser || !approverUser.permissions.includes(permission)) {
    await prisma.auditLog.create({
      data: auditData({
        userId: user.id,
        action: 'APPROVAL_FAILED',
        entityType: 'Approval',
        entityId: 0,
        afterData: { context, attemptedEmail: approver.email },
      }),
    })
    throw new ApprovalError(
      'Email atau password otorisator salah, atau akun tersebut tidak berwenang',
      403,
      'APPROVAL_DENIED',
    )
  }

  return approverUser.id
}