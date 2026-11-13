import { create } from 'zustand'
import { api } from '../services/api'

export type AuthUser = {
  id: number
  name: string
  email: string
  roles: string[]
  permissions: string[]
}

type AuthState = {
  user: AuthUser | null
  loading: boolean
  fetchMe: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  fetchMe: async () => {
    try {
      const user = await api<AuthUser>('/auth/me')
      set({ user })
    } catch {
      set({ user: null })
    } finally {
      set({ loading: false })
    }
  },

  login: async (email, password) => {
    const user = await api<AuthUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    set({ user })
  },

  logout: async () => {
    await api('/auth/logout', { method: 'POST' })
    set({ user: null })
  },
}))

export function homePathFor(user: AuthUser): string {
  if (user.roles.some((r) => ['owner', 'admin', 'inventory'].includes(r))) return '/manajemen'
  if (user.roles.some((r) => ['cashier', 'waiter'].includes(r))) return '/pos'
  if (user.roles.includes('kitchen')) return '/dapur'
  return '/tanpa-akses'
}
