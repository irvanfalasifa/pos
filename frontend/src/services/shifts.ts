import { api } from './api'
import type { Approver, PaymentMethod } from './pos'

export type Shift = {
  id: number
  openedAt: string
  closedAt: string | null
  openingCash: number
  expectedCash: number | null
  closingCash: number | null
  cashDifference: number | null
  closingNote: string | null
  status: 'OPEN' | 'CLOSED'
  reviewedAt: string | null
  reviewNote: string | null
  user: { id: number; name: string }
  reviewedBy: { id: number; name: string } | null
  needsReview: boolean
}

export type ShiftSummary = {
  openingCash: number
  cashSales: number
  cashIn: number
  cashOut: number
  cashRefunds: number
  expectedCash: number
  orderCount: number
  refundsTotal: number
  paymentsByMethod: { method: PaymentMethod; amount: number; count: number }[]
}

export type CashMovement = {
  id: number
  type: 'IN' | 'OUT'
  amount: number
  reason: string
  approvedById: number | null
  createdAt: string
  createdBy: { name: string }
}

export type ShiftDetail = { shift: Shift; summary: ShiftSummary; movements: CashMovement[] }

export type CurrentShift = {
  shift: Shift | null
  summary: ShiftSummary | null
  movements: CashMovement[]
}

export const getCurrentShift = () => api<CurrentShift>('/shifts/current')

export const openShift = (openingCash: number) =>
  api<ShiftDetail>('/shifts/open', { method: 'POST', body: JSON.stringify({ openingCash }) })

export const addMovement = (data: {
  type: 'IN' | 'OUT'
  amount: number
  reason: string
  approver: Approver | null
}) => api<ShiftDetail>('/shifts/current/movements', { method: 'POST', body: JSON.stringify(data) })

export const closeShift = (data: { closingCash: number; note: string | null }) =>
  api<ShiftDetail>('/shifts/current/close', { method: 'POST', body: JSON.stringify(data) })

export const getShifts = (date: string) =>
  api<Shift[]>(`/shifts${date ? `?date=${date}` : ''}`)

export const getShiftDetail = (id: number) => api<ShiftDetail>(`/shifts/${id}`)

export const reviewShift = (id: number, note: string) =>
  api<ShiftDetail>(`/shifts/${id}/review`, { method: 'POST', body: JSON.stringify({ note }) })