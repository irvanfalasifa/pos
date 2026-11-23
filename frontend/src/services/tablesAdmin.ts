import { api } from './api'
import type { TableStatus } from './pos'

export type AdminTable = {
  id: number
  name: string
  capacity: number
  status: TableStatus
  isActive: boolean
  areaId: number
}

export type AdminArea = { id: number; name: string; tables: AdminTable[] }

export const getAdminTables = () => api<AdminArea[]>('/admin/tables')

export const createArea = (name: string) =>
  api<AdminArea>('/admin/areas', { method: 'POST', body: JSON.stringify({ name }) })

export const updateArea = (id: number, name: string) =>
  api<AdminArea>(`/admin/areas/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })

export const deleteArea = (id: number) => api<{ id: number }>(`/admin/areas/${id}`, { method: 'DELETE' })

export const createTable = (data: { areaId: number; name: string; capacity: number }) =>
  api<AdminTable>('/admin/tables', { method: 'POST', body: JSON.stringify(data) })

export const updateTable = (
  id: number,
  data: Partial<{ areaId: number; name: string; capacity: number; isActive: boolean }>,
) => api<AdminTable>(`/admin/tables/${id}`, { method: 'PATCH', body: JSON.stringify(data) })