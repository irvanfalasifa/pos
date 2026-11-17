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

export type PosConfig = { taxBp: number; serviceBp: number }

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
  total: number
  createdBy: { id: number; name: string }
  createdAt: string
  items: OrderItem[]
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

export const getOrders = () => api<Order[]>('/orders')