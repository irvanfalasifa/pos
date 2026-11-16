import { api } from './api'

export type Category = {
  id: number
  name: string
  sortOrder: number
  isActive: boolean
  _count: { products: number }
}

export type Variant = { id: number; name: string; priceDelta: number }

export type Product = {
  id: number
  name: string
  sku: string | null
  description: string | null
  price: number
  isActive: boolean
  categoryId: number
  category: { id: number; name: string }
  variants: Variant[]
    modifierGroups: {
    groupId: number
    group: {
      id: number
      name: string
      minSelect: number
      maxSelect: number
      isActive: boolean
      options: ModifierOption[]
    }
  }[]
}

export type ProductInput = {
  name: string
  sku: string | null
  description: string | null
  price: number
  categoryId: number
  isActive?: boolean
    variants?: { id?: number; name: string; priceDelta: number }[]
    modifierGroupIds?: number[]
}

export type ProductFilters = {
  search: string
  categoryId: number | null
  status: 'all' | 'active' | 'inactive'
}

export const getCategories = () => api<Category[]>('/categories')

export const createCategory = (name: string) =>
  api<Category>('/categories', { method: 'POST', body: JSON.stringify({ name }) })

export const updateCategory = (id: number, data: { name?: string; isActive?: boolean }) =>
  api<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export function getProducts(filters: ProductFilters) {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.categoryId) params.set('categoryId', String(filters.categoryId))
  params.set('status', filters.status)
  return api<Product[]>(`/products?${params.toString()}`)
}

export const createProduct = (data: ProductInput) =>
  api<Product>('/products', { method: 'POST', body: JSON.stringify(data) })

export const updateProduct = (id: number, data: Partial<ProductInput>) =>
    api<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export type ModifierOption = { id: number; name: string; price: number }

export type ModifierGroup = {
  id: number
  name: string
  minSelect: number
  maxSelect: number
  isActive: boolean
  options: ModifierOption[]
  _count: { products: number }
}

export type ModifierGroupInput = {
  name: string
  minSelect: number
  maxSelect: number
  isActive?: boolean
  options?: { id?: number; name: string; price: number }[]
}

export const getModifierGroups = () => api<ModifierGroup[]>('/modifier-groups')

export const createModifierGroup = (data: ModifierGroupInput) =>
  api<ModifierGroup>('/modifier-groups', { method: 'POST', body: JSON.stringify(data) })

export const updateModifierGroup = (id: number, data: Partial<ModifierGroupInput>) =>
  api<ModifierGroup>(`/modifier-groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) })