import { api } from './api'
import type { OrderStatus, OrderType } from './pos'

export type TicketItem = {
  id: number
  productName: string
  variantName: string | null
  quantity: number
  note: string | null
  modifiers: { id: number; name: string }[]
}

export type Ticket = {
  id: number
  number: string
  type: OrderType
  status: OrderStatus
  customerName: string | null
  note: string | null
  createdAt: string
  table: { name: string } | null
  items: TicketItem[]
}

export const getTickets = (scope: 'active' | 'done') => api<Ticket[]>(`/kds/tickets?scope=${scope}`)

export const updateOrderStatus = (id: number, status: OrderStatus) =>
  api<{ id: number; number: string; status: OrderStatus }>(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })