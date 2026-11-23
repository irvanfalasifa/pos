import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bike, Loader2, Minus, Plus, Send, ShoppingBag, ShoppingCart, Trash2, Utensils } from 'lucide-react'
import { cartSubtotal, useCartStore } from '../../stores/cartStore'
import { useToastStore } from '../../stores/toastStore'
import { createOrder, getPosConfig, getTables } from '../../services/pos'
import { formatRupiah } from '../../lib/format'
import { calcTotals, formatPercent } from '../../lib/pricing'
import { tableStatusInfo } from '../../lib/labels'

const types = [
  { value: 'DINE_IN', label: 'Dine In', icon: Utensils },
  { value: 'TAKEAWAY', label: 'Takeaway', icon: ShoppingBag },
  { value: 'DELIVERY', label: 'Delivery', icon: Bike },
] as const

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

export default function CartPanel({ onSubmitted }: { onSubmitted?: () => void }) {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)
  const {
    lines,
    type,
    tableId,
    customerName,
    orderNote,
    setQuantity,
    removeLine,
    setType,
    setTable,
    setCustomerName,
    setOrderNote,
    clear,
  } = useCartStore()

  const configQuery = useQuery({ queryKey: ['pos-config'], queryFn: getPosConfig })
  const tablesQuery = useQuery({ queryKey: ['tables'], queryFn: getTables })

  const taxBp = configQuery.data?.taxBp ?? 0
  const serviceBp = configQuery.data?.serviceBp ?? 0
  const totals = calcTotals(cartSubtotal(lines), taxBp, serviceBp, {
    taxBase: configQuery.data?.taxBase,
    roundingStep: configQuery.data?.roundingStep,
  })
  const areas = tablesQuery.data ?? []

  const mutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (order) => {
      push('success', `Pesanan ${order.number} dikirim`)
      clear()
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      onSubmitted?.()
    },
    onError: (e) => push('error', e instanceof Error ? e.message : 'Gagal mengirim pesanan'),
  })

  const needsTable = type === 'DINE_IN' && !tableId
  const canSubmit = lines.length > 0 && !needsTable && !mutation.isPending

  function submit() {
    mutation.mutate({
      type,
      tableId: type === 'DINE_IN' ? tableId : null,
      customerName: type === 'DINE_IN' ? null : customerName.trim() || null,
      note: orderNote.trim() || null,
      items: lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        modifierIds: l.modifiers.map((m) => m.id),
        quantity: l.quantity,
        note: l.note || null,
      })),
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-800">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {types.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition ${
                type === t.value
                  ? 'bg-white text-amber-600 shadow dark:bg-slate-700 dark:text-amber-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {type === 'DINE_IN' ? (
          <select
            aria-label="Pilih meja"
            value={tableId ?? ''}
            onChange={(e) => setTable(e.target.value ? Number(e.target.value) : null)}
            className={fieldClass}
          >
            <option value="">Pilih meja...</option>
            {areas.map((a) => (
              <optgroup key={a.id} label={a.name}>
                {a.tables.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.status === 'CLEANING'}>
                    {t.name} · {t.capacity} kursi · {tableStatusInfo[t.status].label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <input
            aria-label="Nama pelanggan"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            maxLength={60}
            placeholder="Nama pelanggan (opsional)"
            className={fieldClass}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {lines.length === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
            <div className="rounded-2xl bg-amber-100 p-4 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <ShoppingCart className="h-8 w-8" />
            </div>
            <p className="mt-3 font-semibold text-slate-700 dark:text-slate-200">Keranjang kosong</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pilih produk untuk mulai memesan.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {lines.map((l) => (
              <li key={l.key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-white">
                      {l.name}
                      {l.variantName ? ` (${l.variantName})` : ''}
                    </p>
                    {l.modifiers.length > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {l.modifiers.map((m) => m.name).join(', ')}
                      </p>
                    )}
                    {l.note && <p className="text-xs italic text-slate-500 dark:text-slate-400">“{l.note}”</p>}
                  </div>
                  <button
                    aria-label={`Hapus ${l.name}`}
                    onClick={() => removeLine(l.key)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
                    <button
                      aria-label="Kurangi"
                      onClick={() => setQuantity(l.key, l.quantity - 1)}
                      className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold text-slate-800 dark:text-white">{l.quantity}</span>
                    <button
                      aria-label="Tambah"
                      onClick={() => setQuantity(l.key, l.quantity + 1)}
                      className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="font-semibold text-slate-800 dark:text-white">{formatRupiah(l.unitPrice * l.quantity)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
        {lines.length > 0 && (
          <>
            <input
              aria-label="Catatan pesanan"
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              maxLength={300}
              placeholder="Catatan pesanan (opsional)"
              className={fieldClass}
            />
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <dt>Subtotal</dt>
                <dd>{formatRupiah(totals.subtotal)}</dd>
              </div>
              {serviceBp > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <dt>Service charge ({formatPercent(serviceBp)})</dt>
                  <dd>{formatRupiah(totals.service)}</dd>
                </div>
              )}
              {taxBp > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <dt>Pajak ({formatPercent(taxBp)})</dt>
                  <dd>{formatRupiah(totals.tax)}</dd>
                </div>
              )}
              {totals.rounding !== 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <dt>Pembulatan</dt>
                  <dd>{formatRupiah(totals.rounding)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-800 dark:border-slate-800 dark:text-white">
                <dt>Total</dt>
                <dd>{formatRupiah(totals.total)}</dd>
              </div>
            </dl>
          </>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {mutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {needsTable && lines.length > 0 ? 'Pilih meja dulu' : 'Kirim Pesanan'}
        </button>

        {lines.length > 0 && (
          <button
            onClick={clear}
            className="w-full text-center text-sm text-slate-500 transition hover:text-red-600 dark:text-slate-400"
          >
            Kosongkan keranjang
          </button>
        )}
      </div>
    </div>
  )
}