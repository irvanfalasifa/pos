import { api } from './api'

export type AuditLog = {
  id: number
  action: string
  entityType: string
  entityId: number
  beforeData: Record<string, unknown> | null
  afterData: Record<string, unknown> | null
  reason: string | null
  createdAt: string
  user: { id: number; name: string }
  approvedBy: { id: number; name: string } | null
}

export function getAuditLogs(params: { date: string; action: string }) {
  const query = new URLSearchParams()
  if (params.date) query.set('date', params.date)
  if (params.action) query.set('action', params.action)
  return api<AuditLog[]>(`/audit-logs?${query.toString()}`)
}