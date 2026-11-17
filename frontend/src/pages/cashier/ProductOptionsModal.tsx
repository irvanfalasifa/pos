import { useMemo, useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import Modal from '../../components/Modal'
import { formatRupiah } from '../../lib/format'
import type { Product } from '../../services/products'
import type { CartLine } from '../../stores/cartStore'

type Group = Product['modifierGroups'][number]['group']

function ruleText(group: Group): string {
  const kind = group.minSelect >= 1 ? 'Wajib' : 'Opsional'
  return group.maxSelect === 1 ? `${kind}, pilih satu` : `${kind}, maksimal ${group.maxSelect}`
}

export default function ProductOptionsModal({
  product,
  onAdd,
  onClose,
}: {
  product: Product
  onAdd: (line: Omit<CartLine, 'key'>) => void
  onClose: () => void
}) {
  const groups = useMemo(
    () => product.modifierGroups.map((m) => m.group).filter((g) => g.isActive && g.options.length > 0),
    [product],
  )

  const [variantId, setVariantId] = useState<number | null>(product.variants[0]?.id ?? null)
  const [selected, setSelected] = useState<Record<number, number[]>>({})
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')

  const variant = product.variants.find((v) => v.id === variantId) ?? null
  const chosen = groups.flatMap((g) => g.options.filter((o) => (selected[g.id] ?? []).includes(o.id)))
  const unitPrice = product.price + (variant?.priceDelta ?? 0) + chosen.reduce((s, o) => s + o.price, 0)
  const missing = groups.find((g) => (selected[g.id]?.length ?? 0) < g.minSelect)

  function toggleOption(group: Group, optionId: number) {
    setSelected((prev) => {
      const current = prev[group.id] ?? []

      if (current.includes(optionId)) {
        // Grup wajib pilih satu: pilihan tidak boleh dikosongkan
        if (group.minSelect >= 1 && group.maxSelect === 1) return prev
        return { ...prev, [group.id]: current.filter((i) => i !== optionId) }
      }
      if (group.maxSelect === 1) return { ...prev, [group.id]: [optionId] }
      if (current.length >= group.maxSelect) return prev
      return { ...prev, [group.id]: [...current, optionId] }
    })
  }

  function handleAdd() {
    onAdd({
      productId: product.id,
      name: product.name,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      modifiers: chosen.map((o) => ({ id: o.id, name: o.name, price: o.price })),
      unitPrice,
      quantity,
      note: note.trim(),
    })
    onClose()
  }

  const optionBase = 'flex items-center justify-between gap-2 rounded-xl border-2 px-3.5 py-2.5 text-left text-sm font-medium transition active:scale-[0.98]'
  const optionOn = 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
  const optionOff = 'border-slate-200 text-slate-700 hover:border-amber-300 dark:border-slate-700 dark:text-slate-200 dark:hover:border-amber-500/50'

  return (
    <Modal title={product.name} onClose={onClose}>
      <div className="space-y-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Harga dasar {formatRupiah(product.price)}</p>

        {product.variants.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
              Ukuran <span className="font-normal text-slate-500">· Wajib, pilih satu</span>
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  className={`${optionBase} ${variantId === v.id ? optionOn : optionOff}`}
                >
                  <span>{v.name}</span>
                  <span className="text-xs opacity-80">{v.priceDelta > 0 ? `+${formatRupiah(v.priceDelta)}` : ''}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {groups.map((g) => (
          <section key={g.id}>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
              {g.name} <span className="font-normal text-slate-500">· {ruleText(g)}</span>
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {g.options.map((o) => {
                const on = (selected[g.id] ?? []).includes(o.id)
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleOption(g, o.id)}
                    className={`${optionBase} ${on ? optionOn : optionOff}`}
                  >
                    <span className="flex items-center gap-1.5">
                      {on && <Check className="h-4 w-4" />}
                      {o.name}
                    </span>
                    <span className="text-xs opacity-80">{o.price > 0 ? `+${formatRupiah(o.price)}` : ''}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}

        <section>
          <label htmlFor="item-note" className="text-sm font-semibold text-slate-800 dark:text-white">
            Catatan <span className="font-normal text-slate-500">· Opsional</span>
          </label>
          <input
            id="item-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Contoh: es dipisah"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </section>

        <div className="flex items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 p-1 dark:border-slate-700">
            <button
              type="button"
              aria-label="Kurangi"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center font-semibold text-slate-800 dark:text-white">{quantity}</span>
            <button
              type="button"
              aria-label="Tambah"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!!missing}
            className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {missing ? `Pilih ${missing.name} dulu` : `Tambah · ${formatRupiah(unitPrice * quantity)}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}