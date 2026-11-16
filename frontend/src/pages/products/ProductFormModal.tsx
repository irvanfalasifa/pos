import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import Modal from '../../components/Modal'
import Toggle from '../../components/Toggle'
import { createProduct, updateProduct } from '../../services/products'
import type { Category, Product, ProductInput } from '../../services/products'
import { useToastStore } from '../../stores/toastStore'
import { formatRupiah } from '../../lib/format'

type VariantRow = { key: number; id?: number; name: string; priceDelta: string }

let rowKey = 0

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300'

export default function ProductFormModal({
  product,
  categories,
  onClose,
}: {
  product: Product | null
  categories: Category[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)

  const [name, setName] = useState(product?.name ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [categoryId, setCategoryId] = useState(product ? String(product.categoryId) : '')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [isActive, setIsActive] = useState(product?.isActive ?? true)
  const [variants, setVariants] = useState<VariantRow[]>(
    product?.variants.map((v) => ({
      key: rowKey++,
      id: v.id,
      name: v.name,
      priceDelta: String(v.priceDelta),
    })) ?? [],
  )
  const [error, setError] = useState('')

  const availableCategories = categories.filter((c) => c.isActive || c.id === product?.categoryId)

  const mutation = useMutation({
    mutationFn: (data: ProductInput) => (product ? updateProduct(product.id, data) : createProduct(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      push('success', product ? 'Produk diperbarui' : 'Produk ditambahkan')
      onClose()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal menyimpan produk'),
  })

  function updateVariant(key: number, patch: Partial<VariantRow>) {
    setVariants((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const priceNumber = Number(price)
    if (!name.trim()) return setError('Nama produk wajib diisi')
    if (!categoryId) return setError('Pilih kategori')
    if (price === '' || !Number.isInteger(priceNumber) || priceNumber < 0) {
      return setError('Harga harus berupa angka bulat (Rupiah), minimal 0')
    }
    for (const v of variants) {
      const delta = Number(v.priceDelta || 0)
      if (!v.name.trim()) return setError('Nama varian tidak boleh kosong')
      if (!Number.isInteger(delta) || delta < 0) return setError('Tambahan harga varian harus angka bulat, minimal 0')
    }

    mutation.mutate({
      name: name.trim(),
      sku: sku.trim() || null,
      description: description.trim() || null,
      price: priceNumber,
      categoryId: Number(categoryId),
      isActive,
      variants: variants.map((v) => ({
        id: v.id,
        name: v.name.trim(),
        priceDelta: Number(v.priceDelta || 0),
      })),
    })
  }

  return (
    <Modal title={product ? 'Ubah Produk' : 'Tambah Produk'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="p-name">Nama produk</label>
            <input id="p-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Kopi Susu Gula Aren" autoFocus />
          </div>

          <div>
            <label className={labelClass} htmlFor="p-category">Kategori</label>
            <select id="p-category" className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Pilih kategori</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.isActive ? ' (nonaktif)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="p-sku">SKU (opsional)</label>
            <input id="p-sku" className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Contoh: KOP-004" />
          </div>

          <div>
            <label className={labelClass} htmlFor="p-price">Harga dasar (Rp)</label>
            <input id="p-price" type="number" inputMode="numeric" min={0} step={500} className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="22000" />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-3 pb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Toggle checked={isActive} onChange={setIsActive} label="Produk aktif" />
              Produk aktif (tampil di kasir)
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="p-desc">Deskripsi (opsional)</label>
            <textarea id="p-desc" rows={2} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Varian ukuran</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Isi tambahan harga dari harga dasar. Kosongkan jika produk tidak punya varian.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVariants((rows) => [...rows, { key: rowKey++, name: '', priceDelta: '0' }])}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-amber-100 hover:text-amber-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-amber-500/20"
            >
              <Plus className="h-4 w-4" />
              Varian
            </button>
          </div>

          {variants.length > 0 && (
            <div className="mt-3 space-y-2">
              {variants.map((v) => (
                <div key={v.key} className="flex items-center gap-2">
                  <input className={inputClass} placeholder="Nama (mis. Large)" value={v.name} onChange={(e) => updateVariant(v.key, { name: e.target.value })} />
                  <input type="number" inputMode="numeric" min={0} step={500} className={`${inputClass} max-w-34`} placeholder="+ harga" value={v.priceDelta} onChange={(e) => updateVariant(v.key, { priceDelta: e.target.value })} />
                  <span className="hidden w-24 shrink-0 text-right text-xs text-slate-500 sm:block dark:text-slate-400">
                    {formatRupiah((Number(price) || 0) + (Number(v.priceDelta) || 0))}
                  </span>
                  <button type="button" aria-label="Hapus varian" onClick={() => setVariants((rows) => rows.filter((r) => r.key !== v.key))} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Batal
          </button>
          <button type="submit" disabled={mutation.isPending} className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:opacity-70">
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </button>
        </div>
      </form>
    </Modal>
  )
}