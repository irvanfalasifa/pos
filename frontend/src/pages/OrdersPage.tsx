import { useQuery } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'
import { getOrders } from '../services/pos'
import { formatRupiah } from '../lib/format'
import { orderStatusInfo, orderTypeLabel, paymentStatusInfo } from '../lib/labels'

export default function OrdersPage() {
  const ordersQuery = useQuery({ queryKey: ['orders'], queryFn: getOrders, refetchInterval: 20_000 })
  const orders = ordersQuery.data ?? []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Pesanan Hari Ini</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Daftar pesanan yang masuk hari ini. Pembayaran dan struk menyusul di sesi berikutnya.
        </p>
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
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-2xl bg-amber-100 p-4 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <Receipt className="h-8 w-8" />
          </div>
          <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">Belum ada pesanan hari ini</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
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

              <div className="mt-3 flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="font-bold text-slate-800 dark:text-white">{formatRupiah(o.total)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}