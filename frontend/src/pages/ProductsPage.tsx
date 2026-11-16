import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Package, Pencil, Plus, Search, Tags } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'
import { getCategories, getProducts, updateProduct } from '../services/products'
import type { Product, ProductFilters } from '../services/products'
import { formatRupiah } from '../lib/format'
import Toggle from '../components/Toggle'
import ProductFormModal from './products/ProductFormModal'
import CategoryModal from './products/CategoryModal'

export default function ProductsPage() {
  const user = useAuthStore((s) => s.user)
  const push = useToastStore((s) => s.push)
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [status, setStatus] = useState<ProductFilters['status']>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  const canCreate = !!user?.permissions.includes('product.create')
  const canUpdate = !!user?.permissions.includes('product.update')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: getCategories })

  const productsQuery = useQuery({
    queryKey: ['products', debouncedSearch, categoryId, status],
    queryFn: () => getProducts({ search: debouncedSearch, categoryId, status }),
    placeholderData: keepPreviousData,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateProduct(id, { isActive }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      push('success', vars.isActive ? 'Produk diaktifkan' : 'Produk dinonaktifkan')
    },
    onError: (e) => push('error', e instanceof Error ? e.message : 'Gagal mengubah status'),
  })

  const categories = categoriesQuery.data ?? []
  const products = productsQuery.data ?? []

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(product: Product) {
    setEditing(product)
    setFormOpen(true)
  }

  const chipBase = 'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition'
  const chipOn = 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
  const chipOff =
    'bg-white text-slate-600 hover:bg-amber-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Produk</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Kelola menu, harga, kategori, dan varian.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCategoriesOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Tags className="h-4 w-4" />
            Kategori
          </button>
          {canCreate && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Tambah Produk
            </button>
          )}
        </div>
      </div>

      {/* Pencarian dan filter */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama produk..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProductFilters['status'])}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="all">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setCategoryId(null)} className={`${chipBase} ${categoryId === null ? chipOn : chipOff}`}>
            Semua
          </button>
          {categories
            .filter((c) => c.isActive)
            .map((c) => (
              <button key={c.id} onClick={() => setCategoryId(c.id)} className={`${chipBase} ${categoryId === c.id ? chipOn : chipOff}`}>
                {c.name}
              </button>
            ))}
        </div>
      </div>

      {/* Daftar produk */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {productsQuery.isLoading ? (
          <div className="space-y-px">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex animate-pulse items-center gap-4 p-4">
                <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-1/5 rounded bg-slate-100 dark:bg-slate-800/60" />
                </div>
              </div>
            ))}
          </div>
        ) : productsQuery.isError ? (
          <div className="p-10 text-center text-sm text-red-600">
            {productsQuery.error instanceof Error ? productsQuery.error.message : 'Gagal memuat produk'}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center p-12 text-center">
            <div className="rounded-2xl bg-amber-100 p-4 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <Package className="h-8 w-8" />
            </div>
            <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">Tidak ada produk</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Coba ubah kata kunci atau filter, atau tambahkan produk baru.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Produk</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium">Harga</th>
                  <th className="px-4 py-3 font-medium">Aktif</th>
                  {canUpdate && <th className="px-4 py-3 text-right font-medium">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.map((p) => (
                  <tr key={p.id} className={`transition hover:bg-slate-50 dark:hover:bg-slate-800/40 ${p.isActive ? '' : 'opacity-60'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800 dark:text-white">{p.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{p.sku ?? 'Tanpa SKU'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.category.name}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-white">{formatRupiah(p.price)}</p>
                      {p.variants.length > 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {p.variants.map((v) => v.name).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Toggle
                        checked={p.isActive}
                        disabled={!canUpdate || toggleMutation.isPending}
                        onChange={(value) => toggleMutation.mutate({ id: p.id, isActive: value })}
                        label={`Produk ${p.name} aktif`}
                      />
                    </td>
                    {canUpdate && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(p)}
                          aria-label={`Ubah ${p.name}`}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-500/15"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen && (
        <ProductFormModal
          key={editing?.id ?? 'baru'}
          product={editing}
          categories={categories}
          onClose={() => setFormOpen(false)}
        />
      )}

      {categoriesOpen && (
        <CategoryModal
          categories={categories}
          canCreate={canCreate}
          canEdit={canUpdate}
          onClose={() => setCategoriesOpen(false)}
        />
      )}
    </div>
  )
}