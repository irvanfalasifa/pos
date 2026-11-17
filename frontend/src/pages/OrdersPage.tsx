import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, Printer, Receipt as ReceiptIcon, Search } from 'lucide-react'
import { getOrders, getPosConfig } from '../services/pos'
import type { Order, PaymentStatus } from '../services/pos'
import { useAuthStore } from '../stores/authStore'
import { formatRupiah } from '../lib/format'
import { orderStatusInfo, orderTypeLabel, paymentMethodLabel, paymentStatusInfo } from '../lib/labels'
import PaymentModal from './orders/PaymentModal'
import ReceiptModal from './orders/ReceiptModal'

type Filter = 'ALL' | PaymentStatus

const filters: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'UNPAID', label: 'Belum bayar' },
  { value: 'PARTIALLY_PAID', label: 'Sebagian' },
  { value: 'PAID', label: 'Lunas' },
]

const paidOf = (o: Order) => o.payments.reduce((sum, p) => sum + p.amount, 0)

export default function OrdersPage() {
  const user = useAuthStore((s) => s.user)
  const canPay = !!user?.permissions.includes('payment.create')

  const [date, setDate] = useState(() => new Date().toLocaleDateString('sv-SE'))
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [payTarget, setPayTarget] = useState<Order | null>(null)
  const [receipt, setReceipt] = useState<{ order: Order; isCopy: boolean } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const ordersQuery = useQuery({
    queryKey: ['orders', date, debouncedSearch],
    queryFn: () => getOrders({ date, search: debouncedSearch }),
    refetchInterval: 20_000,
  })
  const configQuery = useQuery({ queryKey: ['pos-config'], queryFn: getPosConfig })

  const orders = ordersQuery.data ?? []
  const visible = orders.filter((o) => filter === 'ALL' || o.paymentStatus === filter)

  const active = orders.filter((o) => o.status !== 'CANCELLED')
  const received = active.reduce((sum, o) => sum + paidOf(o), 0)
  const outstanding = active.reduce((sum, o) => sum + (o.total - paidOf(o)), 0)

  const chipBase = 'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition'
  const chipOn = 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
  const chipOff =
    'border border-slate-200 bg-white text-slate-600 hover:bg-amber-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Transaksi</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Riwayat pesanan, pembayaran, dan struk.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Jumlah pesanan', value: String(active.length) },
          { label: 'Pembayaran diterima', value: formatRupiah(received) },
          { label: 'Belum dibayar', value: formatRupiah(outstanding) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">{s.label}</p>
            <p className="mt-1 text-xl font-bold text-slate-800 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor pesanan..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <input
          type="date"
          aria-label="Tanggal"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} className={`${chipBase} ${filter === f.value ? chipOn : chipOff}`}>
            {f.label}
          </button>
        ))}
      </div>

      {ordersQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : ordersQuery.isError ? (
        <p className="p-10 text-center text-sm text-red-600">
          {ordersQuery.error instanceof Error ? ordersQuery.error.message : 'Gagal memuat pesanan'}
        </p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-2xl bg-amber-100 p-4 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <ReceiptIcon className="h-8 w-8" />
          </div>
          <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">Tidak ada pesanan</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Coba ubah tanggal, kata kunci, atau filter.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((o) => {
            const paid = paidOf(o)
            const balance = o.total - paid
            const canPayThis = canPay && o.paymentStatus !== 'PAID' && o.status !== 'CANCELLED'

            return (
              <li key={o.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{o.number}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {new Date(o.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                      {orderTypeLabel[o.type]}
                      {o.table ? ` · Meja ${o.table.name}` : ''}
                      {o.customerName ? ` · ${o.customerName}` : ''} · oleh {o.createdBy.name}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${orderStatusInfo[o.status].className}`}>
                      {orderStatusInfo[o.status].label}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${paymentStatusInfo[o.paymentStatus].className}`}>
                      {paymentStatusInfo[o.paymentStatus].label}
                    </span>
                  </div>
                </div>

                <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {o.items.map((item) => (
                    <li key={item.id}>
                      <span className="font-medium">{item.quantity}×</span> {item.productName}
                      {item.variantName ? ` (${item.variantName})` : ''}
                      {item.modifiers.length > 0 && (
                        <span className="text-slate-500 dark:text-slate-400"> · {item.modifiers.map((m) => m.name).join(', ')}</span>
                      )}
                      {item.note && <span className="italic text-slate-500 dark:text-slate-400"> · “{item.note}”</span>}
                    </li>
                  ))}
                </ul>

                {o.note && <p className="mt-2 text-sm italic text-slate-500 dark:text-slate-400">Catatan: {o.note}</p>}

                {o.payments.length > 0 && (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Dibayar: {o.payments.map((p) => `${paymentMethodLabel[p.method]} ${formatRupiah(p.amount)}`).join(' + ')}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div>
                    <p className="text-lg font-bold text-slate-800 dark:text-white">{formatRupiah(o.total)}</p>
                    {balance > 0 && paid > 0 && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">Sisa {formatRupiah(balance)}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setReceipt({ order: o, isCopy: o.paymentStatus === 'PAID' })}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Printer className="h-4 w-4" />
                      {o.paymentStatus === 'PAID' ? 'Struk' : 'Tagihan'}
                    </button>
                    {canPayThis && (
                      <button
                        onClick={() => setPayTarget(o)}
                        className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98]"
                      >
                        <Banknote className="h-4 w-4" />
                        Bayar
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {payTarget && (
        <PaymentModal
          order={payTarget}
          onClose={() => setPayTarget(null)}
          onPaid={(updated) => {
            setPayTarget(null)
            setReceipt({ order: updated, isCopy: false })
          }}
        />
      )}

      {receipt && (
        <ReceiptModal
          order={receipt.order}
          config={configQuery.data}
          isCopy={receipt.isCopy}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  )
}