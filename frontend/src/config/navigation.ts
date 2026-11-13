import {
  LayoutDashboard,
  Package,
  Boxes,
  TrendingUp,
  Users,
  ShoppingCart,
  LayoutGrid,
  Receipt,
  ChefHat,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AuthUser } from '../stores/authStore'

export type WorkspaceKey = 'manajemen' | 'pos' | 'dapur'

export type NavItem = {
  label: string
  path: string
  icon: LucideIcon
  permission?: string
  end?: boolean
}

export type Workspace = {
  key: WorkspaceKey
  label: string
  basePath: string
  icon: LucideIcon
  roles: string[]
  items: NavItem[]
}

export const workspaces: Workspace[] = [
  {
    key: 'manajemen',
    label: 'Dashboard Manajemen',
    basePath: '/manajemen',
    icon: LayoutDashboard,
    roles: ['admin', 'inventory'],
    items: [
      { label: 'Ringkasan', path: '/manajemen', icon: LayoutDashboard, end: true },
      { label: 'Produk', path: '/manajemen/produk', icon: Package, permission: 'product.view' },
      { label: 'Inventori', path: '/manajemen/inventori', icon: Boxes, permission: 'product.view' },
      { label: 'Laporan', path: '/manajemen/laporan', icon: TrendingUp, permission: 'report.view' },
      { label: 'Pengguna', path: '/manajemen/pengguna', icon: Users, permission: 'user.manage' },
    ],
  },
  {
    key: 'pos',
    label: 'Operasional POS',
    basePath: '/pos',
    icon: ShoppingCart,
    roles: ['cashier', 'waiter'],
    items: [
      { label: 'Kasir', path: '/pos', icon: ShoppingCart, permission: 'order.create', end: true },
      { label: 'Meja', path: '/pos/meja', icon: LayoutGrid, permission: 'order.view' },
      { label: 'Transaksi', path: '/pos/transaksi', icon: Receipt, permission: 'order.view' },
    ],
  },
  {
    key: 'dapur',
    label: 'Dapur (KDS)',
    basePath: '/dapur',
    icon: ChefHat,
    roles: ['kitchen'],
    items: [
      { label: 'Antrean Pesanan', path: '/dapur', icon: ChefHat, permission: 'order.view', end: true },
    ],
  },
]

export function accessibleWorkspaces(user: AuthUser): Workspace[] {
  if (user.roles.includes('owner')) return workspaces
  return workspaces.filter((w) => w.roles.some((r) => user.roles.includes(r)))
}

export function visibleItems(user: AuthUser, workspace: Workspace): NavItem[] {
  return workspace.items.filter((i) => !i.permission || user.permissions.includes(i.permission))
}