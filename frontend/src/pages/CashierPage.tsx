import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Package, Plus, Search, ShoppingCart } from 'lucide-react'
import { getCategories, getProducts } from '../services/products'
import type { Product } from '../services/products'
import { getPosConfig } from '../services/pos'
import { cartSubtotal, useCartStore } from '../stores/cartStore'
import { formatRupiah } from '../lib/format'
import { calcTotals } from '../lib/pricing'
import Modal from '../components/Modal'
import CartPanel from './cashier/CartPanel'
import ProductOptionsModal from './cashier/ProductOptionsModal'

export default function CashierPage() {
  const lines = useCartStore((s) => s.lines)
  const addLine = useCartStore((s) => s.addLine)

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [optionsFor, setOptionsFor] = useState<Product | null>(null)
  const [cartOpen, setCartOpen] = useState(false)

  const productsQuery = useQuery({
    queryKey: ['pos-products'],
    queryFn: () => getProducts({ search: '', categoryId: null, status: 'active' }),
    refetchInterval: 60_000,
  })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: getCategories })
  const configQuery = useQuery({ queryKey: ['pos-config'], queryFn: getPosConfig })

  const categories = (categoriesQuery.data ?? []).filter((c) => c.isActive)

  const visible = useMemo(() => {
    const activeIds = new Set(categories.map((c) => c.id))
    const keyword = search.trim().toLowerCase()
    return (productsQuery.data ?? []).filter(
      (p) =>
        (categoriesQuery.data ? activeIds.has(p.categoryId) : true) &&
        (categoryId === null || p.categoryId === categoryId) &&
        (keyword === '' || p.name.toLowerCase().includes(keyword)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsQuery.data, categoriesQuery.data, search, categoryId])

  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0)
  const totals = calcTotals(cartSubtotal(lines), configQuery.data?.taxBp ?? 0, configQuery.data?.serviceBp ?? 0)

  function handlePick(p: Product) {
    const hasOptions =
      p.variants.length > 0 || p.modifierGroups.some((m) => m.group.isActive && m.group.options.length > 0)

    if (hasOptions) {
      setOptionsFor(p)
      return
    }

    addLine({
      productId: p.id,
      name: p.name,
      variantId: null,
      variantName: null,
      modifiers: [],
      unitPrice: p.price,
      quantity: 1,
      note: '',
    })
  }

  const chipBase = 'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition'
  const chipOn = 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
  const chipOff =
    'border border-slate-200 bg-white text-slate-600 hover:bg-amber-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'

  return (
    <div className="flex gap-5 pb-24 lg:pb-0">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari menu..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setCategoryId(null)} className={`${chipBase} ${categoryId === null ? chipOn : chipOff}`}>
            Semua
          </button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCategoryId(c.id)} className={`${chipBase} ${categoryId === c.id ? chipOn : chipOff}`}>
              {c.name}
            </button>
          ))}
        </div>

        {productsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        ) : productsQuery.isError ? (
          <p className="p-10 text-center text-sm text-red-600">
            {productsQuery.error instanceof Error ? productsQuery.error.message : 'Gagal memuat menu'}
          </p>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center p-12 text-center">
            <div className="rounded-2xl bg-amber-100 p-4 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <Package className="h-8 w-8" />
            </div>
            <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">Menu tidak ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePick(p)}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg active:scale-[0.97] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-500/50"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl font-bold text-amber-700 transition group-hover:bg-amber-500 group-hover:text-white dark:bg-amber-500/15 dark:text-amber-400">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <p className="mt-3 line-clamp-2 flex-1 font-semibold text-slate-800 dark:text-white">{p.name}</p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{formatRupiah(p.price)}</p>
                  <span className="rounded-full bg-slate-100 p-1 text-slate-500 transition group-hover:bg-amber-500 group-hover:text-white dark:bg-slate-800">
                    <Plus className="h-4 w-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Keranjang untuk layar lebar */}
      <aside className="hidden w-96 shrink-0 lg:block">
        <div className="sticky top-20 h-[calc(100vh-7rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CartPanel />
        </div>
      </aside>

      {/* Bilah keranjang untuk layar kecil */}
      <div className="fixed inset-x-0 bottom-0 z-30 p-3 lg:hidden">
        <button
          onClick={() => setCartOpen(true)}
          className="flex w-full items-center justify-between rounded-2xl bg-amber-500 px-5 py-3.5 font-semibold text-white shadow-xl shadow-amber-500/40 active:scale-[0.98]"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Keranjang{itemCount > 0 ? ` · ${itemCount} item` : ''}
          </span>
          {itemCount > 0 && <span>{formatRupiah(totals.total)}</span>}
        </button>
      </div>

      {cartOpen && (
        <Modal title="Keranjang" onClose={() => setCartOpen(false)}>
          <div className="-m-5">
            <CartPanel onSubmitted={() => setCartOpen(false)} />
          </div>
        </Modal>
      )}

      {optionsFor && (
        <ProductOptionsModal
          key={optionsFor.id}
          product={optionsFor}
          onAdd={addLine}
          onClose={() => setOptionsFor(null)}
        />
      )}
    </div>
  )
}