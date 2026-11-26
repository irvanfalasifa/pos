import { formatRupiah } from '../../lib/format'
import { paymentMethodLabel } from '../../lib/labels'
import type { ShiftSummary } from '../../services/shifts'

export default function ShiftSummaryCards({ summary }: { summary: ShiftSummary }) {
  const items = [
    { label: 'Modal awal', value: summary.openingCash, sign: '' },
    { label: 'Penjualan tunai', value: summary.cashSales, sign: '+' },
    { label: 'Kas masuk', value: summary.cashIn, sign: '+' },
    { label: 'Refund tunai', value: summary.cashRefunds, sign: '−' },
    { label: 'Kas keluar', value: summary.cashOut, sign: '−' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <div key={i.label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">{i.label}</p>
            <p className="mt-1 text-xl font-bold text-slate-800 dark:text-white">
              {i.sign && <span className="mr-1 text-slate-400">{i.sign}</span>}
              {formatRupiah(i.value)}
            </p>
          </div>
        ))}
        <div className="rounded-2xl bg-amber-500 p-4 text-white shadow-lg shadow-amber-500/30">
          <p className="text-sm text-white/80">Kas seharusnya di laci</p>
          <p className="mt-1 text-xl font-bold">{formatRupiah(summary.expectedCash)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-800 dark:text-white">Pembayaran selama shift</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{summary.orderCount} pesanan</p>
        </div>
        {summary.paymentsByMethod.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Belum ada pembayaran.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {summary.paymentsByMethod.map((m) => (
              <li key={m.method} className="flex items-center justify-between py-2">
                <span className="text-slate-600 dark:text-slate-300">
                  {paymentMethodLabel[m.method]} <span className="text-slate-400">· {m.count} transaksi</span>
                  {m.method !== 'CASH' && <span className="ml-1 text-xs text-slate-400">(tidak masuk laci)</span>}
                </span>
                <span className="font-semibold text-slate-800 dark:text-white">{formatRupiah(m.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        {summary.refundsTotal > 0 && (
          <p className="mt-2 text-sm text-sky-700 dark:text-sky-400">
            Total refund (semua metode): {formatRupiah(summary.refundsTotal)}
          </p>
        )}
      </div>
    </div>
  )
}