import { api } from './api'

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING'
export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'QR_TABLE'
export type OrderStatus =
  | 'DRAFT'
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'COMPLETED'
  | 'CANCELLED'
export type PaymentStatus =
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'FAILED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'

export type RestaurantTable = {
  id: number
  name: string
  capacity: number
  status: TableStatus
  occupiedSince: string | null
  areaId: number
}

export type Area = { id: number; name: string; tables: RestaurantTable[] }

export type PosConfig = {
  taxBp: number
  serviceBp: number
  taxBase: 'SUBTOTAL' | 'SUBTOTAL_PLUS_SERVICE'
  roundingStep: number
  businessName: string
  businessAddress: string
  businessPhone: string
  receiptFooter: string
  receiptPaper: '58' | '80'
}

export type OrderItem = {
  id: number
  productName: string
  variantName: string | null
  unitPrice: number
  quantity: number
  note: string | null
  lineTotal: number
  modifiers: { id: number; name: string; price: number }[]
}

export type Order = {
  id: number
  number: string
  type: OrderType
  status: OrderStatus
  paymentStatus: PaymentStatus
  table: { id: number; name: string } | null
  customerName: string | null
  note: string | null
  subtotal: number
  serviceBp: number
  serviceAmount: number
  taxBp: number
  taxAmount: number
  roundingAmount: number
  total: number
  createdBy: { id: number; name: string }
  createdAt: string
  items: OrderItem[]
  payments: Payment[]
  refunds: Refund[]
  cancelReason: string | null
  cancelledAt: string | null
}

export type OrderInput = {
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
  tableId: number | null
  customerName: string | null
  note: string | null
  items: {
    productId: number
    variantId: number | null
    modifierIds: number[]
    quantity: number
    note: string | null
  }[]
}

export const getPosConfig = () => api<PosConfig>('/pos/config')
export const getTables = () => api<Area[]>('/tables')

export const updateTableStatus = (id: number, status: TableStatus) =>
  api<RestaurantTable>(`/tables/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })

export const createOrder = (data: OrderInput) =>
  api<Order>('/orders', { method: 'POST', body: JSON.stringify(data) })

export function getOrders(params: { date: string; search: string }) {
  const query = new URLSearchParams({ date: params.date })
  if (params.search) query.set('search', params.search)
  return api<Order[]>(`/orders?${query.toString()}`)
}

export type PaymentMethod = 'CASH' | 'QRIS' | 'CARD' | 'EWALLET' | 'TRANSFER'

export type Payment = {
  id: number
  method: PaymentMethod
  amount: number
  tendered: number | null
  changeAmount: number | null
  reference: string | null
  createdAt: string
}

export type PaymentInput = {
  idempotencyKey: string
  payments: {
    method: PaymentMethod
    amount: number
    tendered: number | null
    reference: string | null
  }[]
}

export const payOrder = (orderId: number, data: PaymentInput) =>
  api<Order>(`/orders/${orderId}/payments`, { method: 'POST', body: JSON.stringify(data) })

export type Refund = {
  id: number
  paymentId: number
  amount: number
  reason: string
  createdAt: string
}

export type Approver = { email: string; password: string }

export const cancelOrder = (id: number, data: { reason: string; approver: Approver | null }) =>
  api<{ id: number; number: string; status: OrderStatus; refunded: number }>(`/orders/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const refundOrder = (
  id: number,
  data: { reason: string; refunds: { paymentId: number; amount: number }[]; approver: Approver | null },
) =>
  api<{ id: number; number: string; total: number; paymentStatus: PaymentStatus }>(`/orders/${id}/refunds`, {
    method: 'POST',
    body: JSON.stringify(data),
  })