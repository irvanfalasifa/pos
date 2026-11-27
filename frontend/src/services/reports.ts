import { api } from './api'
import type { OrderStatus, OrderType, PaymentMethod, TableStatus } from './pos'

export type Totals = {
  orders: number
  gross: number
  subtotal: number
  service: number
  tax: number
  rounding: number
  refundsCount: number
  refundsTotal: number
  net: number
  aov: number
  cancelledCount: number
  cancelledValue: number
}

export type Overview = {
  range: { from: string; to: string; days: number }
  current: Totals
  previous: Totals
  daily: { date: string; sales: number; orders: number }[]
  hourly: { hour: number; sales: number; orders: number }[]
  byType: { type: OrderType; orders: number; sales: number }[]
  statuses: { status: OrderStatus; count: number }[]
  products: { productId: number; name: string; quantity: number; revenue: number; share: number }[]
  categories: { id: number; name: string; quantity: number; revenue: number; share: number }[]
  slowProducts: { name: string; category: string }[]
  payments: { method: PaymentMethod; received: number; count: number; refunded: number; net: number }[]
  refunds: {
    id: number
    number: string
    amount: number
    reason: string
    method: PaymentMethod
    createdAt: string
    by: string
    approvedBy: string
  }[]
  cancellations: {
    id: number
    number: string
    total: number
    reason: string | null
    cancelledAt: string
    refunded: number
    by: string | null
  }[]
}

export type StaffReport = {
  service: {
    userId: number
    name: string
    orders: number
    sales: number
    aov: number
    cancellations: number
    refundsCount: number
    refundsTotal: number
    shifts: number
    shiftsWithDifference: number
    totalAbsDifference: number
  }[]
  kitchen: { userId: number; name: string; tickets: number; avgMinutes: number }[]
}

export type LiveStats = {
  activeOrders: number
  unpaidOrders: number
  tables: Record<TableStatus, number>
  openShifts: { id: number; openedAt: string; cashier: string }[]
  pendingReviews: number
}

const rangeQuery = (from: string, to: string) => `from=${from}&to=${to}`

export const getOverview = (from: string, to: string) =>
  api<Overview>(`/reports/overview?${rangeQuery(from, to)}`)

export const getStaffReport = (from: string, to: string) =>
  api<StaffReport>(`/reports/staff?${rangeQuery(from, to)}`)

export const getLiveStats = () => api<LiveStats>('/reports/live')