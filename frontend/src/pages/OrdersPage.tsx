import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Banknote, Check, Printer, Receipt as ReceiptIcon, RotateCcw, Search } from 'lucide-react'
import { getOrders, getPosConfig } from '../services/pos'
import { Link } from 'react-router-dom'
import { getCurrentShift } from '../services/shifts'
import type { Order, PaymentStatus } from '../services/pos'
import { updateOrderStatus } from '../services/kds'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'
import { formatRupiah } from '../lib/format'
import { orderStatusInfo, orderTypeLabel, paymentMethodLabel, paymentStatusInfo } from '../lib/labels'
import PaymentModal from './orders/PaymentModal'
import ReceiptModal from './orders/ReceiptModal'
import CancelModal from './orders/CancelModal'
import RefundModal from './orders/RefundModal'


type Filter = 'ALL' | 'READY' | 'REFUND' | 'CANCELLED' | PaymentStatus

const filters: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'READY', label: 'Siap disajikan' },
  { value: 'UNPAID', label: 'Belum bayar' },
  { value: 'PARTIALLY_PAID', label: 'Sebagian' },
  { value: 'PAID', label: 'Lunas' },
  { value: 'REFUND', label: 'Refund' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
]

const CANCELLABLE = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY']

const paidOf = (o: Order) => o.payments.reduce((sum, p) => sum + p.amount, 0)
const refundedOf = (o: Order) => o.refunds.reduce((sum, r) => sum + r.amount, 0)

export default function OrdersPage() {
  const user = useAuthStore((s) => s.user)
  const push = useToastStore((s) => s.push)
  const queryClient = useQueryClient()

  const canPay = !!user?.permissions.includes('payment.create')
  const canServe = !!user?.permissions.includes('order.create')

  const [date, setDate] = useState(() => new Date().toLocaleDateString('sv-SE'))
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [payTarget, setPayTarget] = useState<Order | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null)
  const [refundTarget, setRefundTarget] = useState<Order | null>(null)
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
  const shiftQuery = useQuery({
    queryKey: ['shift-current'],
    queryFn: getCurrentShift,
    enabled: canPay,
    retry: false,
  })
  const noShift = canPay && shiftQuery.isSuccess && shiftQuery.data.shift === null

  const serveMutation = useMutation({
    mutationFn: (id: number) => updateOrderStatus(id, 'SERVED'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['kds'] })
      push('success', 'Pesanan ditandai sudah selesai disajikan')
    },
    onError: (e) => push('error', e instanceof Error ? e.message : 'Gagal mengubah status'),
  })

  const orders = ordersQuery.data ?? []
  const active = orders.filter((o) => o.status !== 'CANCELLED')
  const readyCount = active.filter((o) => o.status === 'READY').length

  const visible = orders.filter((o) => {
    if (filter === 'ALL') return true
    if (filter === 'READY') return o.status === 'READY'
    if (filter === 'CANCELLED') return o.status === 'CANCELLED'
    if (filter === 'REFUND') return o.refunds.length > 0
    return o.paymentStatus === filter
  })

  const received = orders.reduce((sum, o) => sum + paidOf(o) - refundedOf(o), 0)
  const outstanding = active
    .filter((o) => o.paymentStatus === 'UNPAID' || o.paymentStatus === 'PARTIALLY_PAID')
    .reduce((sum, o) => sum + (o.total - paidOf(o)), 0)

  const chipBase = 'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition'
  const chipOn = 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
  const chipOff =
    'border border-slate-200 bg-white text-slate-600 hover:bg-amber-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
  const subtleButton =
    'flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Transaksi</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Riwayat pesanan, pembayaran, refund, dan struk.</p>
      </div>

      {noShift && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-5 py-4 dark:bg-amber-500/10">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            Belum ada shift aktif. Buka shift untuk dapat menerima pembayaran.
          </p>
          <Link
            to="/pos/shift"
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 active:scale-[0.98]"
          >
            Buka shift
          </Link>
        </div>
      )}
      
      {canServe && readyCount > 0 && filter !== 'READY' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sky-50 px-5 py-4 dark:bg-sky-500/10">
          <p className="font-medium text-sky-800 dark:text-sky-300">{readyCount} pesanan siap disajikan atau diambil</p>
          <button
            onClick={() => setFilter('READY')}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 active:scale-[0.98]"
          >
            Lihat
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Jumlah pesanan', value: String(active.length) },
          { label: 'Pembayaran diterima (bersih)', value: formatRupiah(received) },
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
            {f.value === 'READY' && readyCount > 0 ? ` (${readyCount})` : ''}
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
            const refunded = refundedOf(o)
            const balance = o.total - paid
            const cancelled = o.status === 'CANCELLED'
            const payable = o.paymentStatus === 'UNPAID' || o.paymentStatus === 'PARTIALLY_PAID'

            const canPayThis = canPay && payable && !cancelled
            const canCancelThis = canServe && CANCELLABLE.includes(o.status)
            const canRefundThis = canPay && paid - refunded > 0

            return (
              <li
                key={o.id}
                className={`rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 ${
                  cancelled ? 'opacity-75' : ''
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={`font-bold text-slate-800 dark:text-white ${cancelled ? 'line-through' : ''}`}>{o.number}</p>
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

                {o.refunds.length > 0 && (
                  <p className="mt-1 text-sm text-sky-700 dark:text-sky-400">
                    Direfund {formatRupiah(refunded)} · {o.refunds[o.refunds.length - 1].reason}
                  </p>
                )}

                {cancelled && o.cancelReason && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">Dibatalkan: {o.cancelReason}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div>
                    <p className="text-lg font-bold text-slate-800 dark:text-white">{formatRupiah(o.total)}</p>
                    {payable && !cancelled && balance > 0 && paid > 0 && (
                      <p className="text-xs text-rose-600 dark:text-rose-400">Sisa {formatRupiah(balance)}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canServe && o.status === 'READY' && (
                      <button
                        onClick={() => serveMutation.mutate(o.id)}
                        disabled={serveMutation.isPending}
                        className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 active:scale-[0.98] disabled:opacity-60"
                      >
                        <Check className="h-4 w-4" />
                        {o.type === 'DINE_IN' ? 'Sudah disajikan' : 'Sudah diambil'}
                      </button>
                    )}
                    {canCancelThis && (
                      <button
                        onClick={() => setCancelTarget(o)}
                        className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:hover:bg-red-500/10"
                      >
                        <Ban className="h-4 w-4" />
                        Batalkan
                      </button>
                    )}
                    {canRefundThis && (
                      <button onClick={() => setRefundTarget(o)} className={subtleButton}>
                        <RotateCcw className="h-4 w-4" />
                        Refund
                      </button>
                    )}
                    <button onClick={() => setReceipt({ order: o, isCopy: o.paymentStatus === 'PAID' })} className={subtleButton}>
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

      {cancelTarget && <CancelModal order={cancelTarget} onClose={() => setCancelTarget(null)} />}
      {refundTarget && <RefundModal order={refundTarget} onClose={() => setRefundTarget(null)} />}

      {receipt && (
        <ReceiptModal order={receipt.order} config={configQuery.data} isCopy={receipt.isCopy} onClose={() => setReceipt(null)} />
      )}
    </div>
  )
}