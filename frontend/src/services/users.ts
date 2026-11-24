import { api } from './api'

export type UserRow = {
  id: number
  name: string
  email: string
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
  roles: string[]
  lastLoginAt: string | null
}

export type RoleOption = { id: number; name: string; label: string }

export type LoginEvent = {
  id: number
  success: boolean
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export type RoleMatrix = {
  roles: { id: number; name: string; label: string; codes: string[] }[]
  permissions: { code: string; label: string }[]
}

export const getUsers = () => api<UserRow[]>('/admin/users')
export const getRoleOptions = () => api<RoleOption[]>('/admin/roles')

export const createUser = (data: { name: string; email: string; roles: string[]; password?: string }) =>
  api<{ user: UserRow; tempPassword: string | null }>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateUser = (
  id: number,
  data: Partial<{ name: string; email: string; roles: string[]; isActive: boolean }>,
) => api<UserRow>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const resetPassword = (id: number) =>
  api<{ email: string; tempPassword: string }>(`/admin/users/${id}/reset-password`, { method: 'POST' })

export const getLogins = (id: number) => api<LoginEvent[]>(`/admin/users/${id}/logins`)

export const getRoleMatrix = () => api<RoleMatrix>('/admin/roles/matrix')

export const saveRolePermissions = (id: number, codes: string[]) =>
  api<{ id: number; codes: string[] }>(`/admin/roles/${id}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ codes }),
  })

export const deleteUser = (id: number) =>
  api<{ id: number; mode: 'deleted' | 'archived' }>(`/admin/users/${id}`, { method: 'DELETE' })