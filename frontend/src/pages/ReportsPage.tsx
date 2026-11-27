import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, ShoppingBag, TrendingUp, Undo2, Ban, Wallet, Receipt } from 'lucide-react'
import KpiCard from '../components/KpiCard'
import TrendChart from '../components/TrendChart'
import { getOverview, getStaffReport } from '../services/reports'
import type { Overview } from '../services/reports'
import { useAuthStore } from '../stores/authStore'
import { formatRupiah } from '../lib/format'
import { orderStatusInfo, orderTypeLabel, paymentMethodLabel } from '../lib/labels'
import { downloadCsv, formatDay, presetRange } from '../lib/reportFormat'
import type { PresetKey } from '../lib/reportFormat'

type TabKey = 'sales' | 'products' | 'payments' | 'refunds' | 'staff'

const presets: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Hari ini' },
  { key: '7d', label: '7 hari' },
  { key: '30d', label: '30 hari' },
  { key: 'month', label: 'Bulan ini' },
  { key: 'lastMonth', label: 'Bulan lalu' },
  { key: 'custom', label: 'Kustom' },
]

const card = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900'
const th = 'px-4 py-3 font-medium'
const thead =
  'border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400'
const tbody = 'divide-y divide-slate-100 dark:divide-slate-800'
const percent = (v: number) => `${(v * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`

function CsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <Download className="h-4 w-4" />
      Unduh CSV
    </button>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{text}</p>
}

/* ---------- Tab Penjualan ---------- */

function SalesTab({ data }: { data: Overview }) {
  const t = data.current
  const daily = data.daily.map((d) => ({ label: formatDay(d.date), value: d.sales, orders: d.orders }))
  const hourly = data.hourly
    .filter((h) => h.hour >= 6)
    .map((h) => ({ label: `${String(h.hour).padStart(2, '0')}:00`, value: h.sales, orders: h.orders }))

  function exportCsv() {
    downloadCsv(`penjualan-harian_${data.range.from}_${data.range.to}.csv`, [
      ['Tanggal', 'Penjualan (Rp)', 'Transaksi'],
      ...data.daily.map((d) => [d.date, d.sales, d.orders]),
    ])
  }

  const composition = [
    { label: 'Penjualan menu (subtotal)', value: t.subtotal },
    { label: 'Service charge', value: t.service },
    { label: 'Pajak', value: t.tax },
    { label: 'Pembulatan', value: t.rounding },
  ]

  return (
    <div className="space-y-4">
      {data.range.days > 1 && (
        <div className={card}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-800 dark:text-white">Penjualan per hari</h3>
            <CsvButton onClick={exportCsv} />
          </div>
          <TrendChart data={daily} type="line" />
        </div>
      )}

      <div className={card}>
        <h3 className="mb-3 font-semibold text-slate-800 dark:text-white">Penjualan per jam</h3>
        <TrendChart data={hourly} type="bar" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={card}>
          <h3 className="font-semibold text-slate-800 dark:text-white">Komposisi penjualan kotor</h3>
          <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {composition.map((c) => (
              <li key={c.label} className="flex justify-between py-2.5">
                <span className="text-slate-600 dark:text-slate-300">{c.label}</span>
                <span className="font-medium text-slate-800 dark:text-white">{formatRupiah(c.value)}</span>
              </li>
            ))}
            <li className="flex justify-between py-2.5 font-bold text-slate-800 dark:text-white">
              <span>Total</span>
              <span>{formatRupiah(t.gross)}</span>
            </li>
          </ul>
        </div>

        <div className={card}>
          <h3 className="font-semibold text-slate-800 dark:text-white">Per jenis layanan</h3>
          {data.byType.length === 0 ? (
            <Empty text="Belum ada penjualan." />
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {data.byType.map((b) => (
                <li key={b.type} className="flex justify-between py-2.5">
                  <span className="text-slate-600 dark:text-slate-300">
                    {orderTypeLabel[b.type]} <span className="text-slate-400">· {b.orders}</span>
                  </span>
                  <span className="font-medium text-slate-800 dark:text-white">{formatRupiah(b.sales)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={card}>
          <h3 className="font-semibold text-slate-800 dark:text-white">Status semua pesanan</h3>
          {data.statuses.length === 0 ? (
            <Empty text="Belum ada pesanan." />
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.statuses.map((s) => (
                <li key={s.status} className="flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${orderStatusInfo[s.status].className}`}>
                    {orderStatusInfo[s.status].label}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-white">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Tab Produk dan kategori ---------- */

function ProductsTab({ data }: { data: Overview }) {
  function exportCsv() {
    downloadCsv(`produk_${data.range.from}_${data.range.to}.csv`, [
      ['Produk', 'Terjual', 'Pendapatan (Rp)', 'Kontribusi (%)'],
      ...data.products.map((p) => [p.name, p.quantity, p.revenue, Math.round(p.share * 1000) / 10]),
    ])
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Nilai produk dan kategori dihitung dari harga item sebelum pajak dan service.
      </p>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-white">Produk terlaris</h3>
          <CsvButton onClick={exportCsv} />
        </div>
        {data.products.length === 0 ? (
          <Empty text="Belum ada penjualan pada periode ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className={thead}>
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Produk</th>
                  <th className={th}>Terjual</th>
                  <th className={th}>Pendapatan</th>
                  <th className={th}>Kontribusi</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {data.products.map((p, i) => (
                  <tr key={p.productId}>
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.quantity}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatRupiah(p.revenue)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-2 rounded-full bg-amber-500" style={{ width: `${p.share * 100}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{percent(p.share)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="font-semibold text-slate-800 dark:text-white">Per kategori</h3>
          {data.categories.length === 0 ? (
            <Empty text="Belum ada penjualan." />
          ) : (
            <ul className="mt-4 space-y-4">
              {data.categories.map((c) => (
                <li key={c.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-200">
                      {c.name} <span className="text-slate-400">· {c.quantity} terjual</span>
                    </span>
                    <span className="font-medium text-slate-800 dark:text-white">{formatRupiah(c.revenue)}</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-2 rounded-full bg-amber-500" style={{ width: `${c.share * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={card}>
          <h3 className="font-semibold text-slate-800 dark:text-white">Belum terjual pada periode ini</h3>
          {data.slowProducts.length === 0 ? (
            <Empty text="Semua produk aktif sudah terjual." />
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {data.slowProducts.map((p) => (
                <span key={p.name} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {p.name} <span className="text-slate-400">· {p.category}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Tab Pembayaran ---------- */

function PaymentsTab({ data }: { data: Overview }) {
  const totals = data.payments.reduce(
    (s, p) => ({ received: s.received + p.received, count: s.count + p.count, refunded: s.refunded + p.refunded, net: s.net + p.net }),
    { received: 0, count: 0, refunded: 0, net: 0 },
  )

  function exportCsv() {
    downloadCsv(`pembayaran_${data.range.from}_${data.range.to}.csv`, [
      ['Metode', 'Transaksi', 'Diterima (Rp)', 'Refund (Rp)', 'Bersih (Rp)'],
      ...data.payments.map((p) => [paymentMethodLabel[p.method], p.count, p.received, p.refunded, p.net]),
    ])
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Dihitung dari pembayaran yang diterima pada periode ini, termasuk refund karena pembatalan. Selisih uang tunai per
        shift ada di menu Shift & Kas.
      </p>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-white">Komposisi per metode</h3>
          <CsvButton onClick={exportCsv} />
        </div>
        {data.payments.length === 0 ? (
          <Empty text="Belum ada pembayaran pada periode ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className={thead}>
                <tr>
                  <th className={th}>Metode</th>
                  <th className={th}>Transaksi</th>
                  <th className={th}>Diterima</th>
                  <th className={th}>Refund</th>
                  <th className={th}>Bersih</th>
                  <th className={th}>Porsi</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {data.payments.map((p) => (
                  <tr key={p.method}>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{paymentMethodLabel[p.method]}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.count}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatRupiah(p.received)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatRupiah(p.refunded)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{formatRupiah(p.net)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {totals.received > 0 ? percent(p.received / totals.received) : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold text-slate-800 dark:bg-slate-800/40 dark:text-white">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3">{totals.count}</td>
                  <td className="px-4 py-3">{formatRupiah(totals.received)}</td>
                  <td className="px-4 py-3">{formatRupiah(totals.refunded)}</td>
                  <td className="px-4 py-3">{formatRupiah(totals.net)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Tab Refund dan pembatalan ---------- */

function RefundsTab({ data }: { data: Overview }) {
  const fmt: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }

  function exportCsv() {
    downloadCsv(`refund-pembatalan_${data.range.from}_${data.range.to}.csv`, [
      ['Jenis', 'No. pesanan', 'Waktu', 'Jumlah (Rp)', 'Alasan', 'Oleh', 'Disetujui'],
      ...data.refunds.map((r) => ['Refund', r.number, new Date(r.createdAt).toLocaleString('id-ID'), r.amount, r.reason, r.by, r.approvedBy]),
      ...data.cancellations.map((c) => ['Pembatalan', c.number, new Date(c.cancelledAt).toLocaleString('id-ID'), c.total, c.reason ?? '', c.by ?? '', '']),
    ])
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CsvButton onClick={exportCsv} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <h3 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-800 dark:border-slate-800 dark:text-white">
          Refund
        </h3>
        {data.refunds.length === 0 ? (
          <Empty text="Tidak ada refund pada periode ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className={thead}>
                <tr>
                  <th className={th}>Pesanan</th>
                  <th className={th}>Waktu</th>
                  <th className={th}>Metode</th>
                  <th className={th}>Jumlah</th>
                  <th className={th}>Alasan</th>
                  <th className={th}>Oleh</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {data.refunds.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{r.number}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{new Date(r.createdAt).toLocaleString('id-ID', fmt)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{paymentMethodLabel[r.method]}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{formatRupiah(r.amount)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.reason}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {r.by}
                      <span className="block text-xs text-slate-400">disetujui {r.approvedBy}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <h3 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-800 dark:border-slate-800 dark:text-white">
          Pesanan dibatalkan
        </h3>
        {data.cancellations.length === 0 ? (
          <Empty text="Tidak ada pembatalan pada periode ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className={thead}>
                <tr>
                  <th className={th}>Pesanan</th>
                  <th className={th}>Waktu</th>
                  <th className={th}>Nilai</th>
                  <th className={th}>Dikembalikan</th>
                  <th className={th}>Alasan</th>
                  <th className={th}>Oleh</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {data.cancellations.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{c.number}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{new Date(c.cancelledAt).toLocaleString('id-ID', fmt)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatRupiah(c.total)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.refunded > 0 ? formatRupiah(c.refunded) : '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.reason ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.by ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Tab Kinerja staf ---------- */

function StaffTab({ from, to }: { from: string; to: string }) {
  const query = useQuery({ queryKey: ['report-staff', from, to], queryFn: () => getStaffReport(from, to) })
  const data = query.data

  if (query.isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
  if (query.isError || !data) {
    return <p className="p-10 text-center text-sm text-red-600">{query.error instanceof Error ? query.error.message : 'Gagal memuat'}</p>
  }

  return (
    <div className="space-y-4">
      <p className="rounded-2xl bg-sky-50 px-5 py-4 text-sm text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">
        Angka ini membantu melihat beban kerja dan pola, bukan satu-satunya ukuran produktivitas. Penjualan kasir tidak
        bisa dibandingkan langsung dengan pekerjaan dapur, dan jumlah refund atau pembatalan yang tinggi perlu dilihat
        bersama alasannya di tab Refund & pembatalan.
      </p>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <h3 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-800 dark:border-slate-800 dark:text-white">
          Kasir dan pelayan
        </h3>
        {data.service.length === 0 ? (
          <Empty text="Belum ada aktivitas pada periode ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className={thead}>
                <tr>
                  <th className={th}>Nama</th>
                  <th className={th}>Transaksi</th>
                  <th className={th}>Penjualan</th>
                  <th className={th}>Rata-rata</th>
                  <th className={th}>Refund</th>
                  <th className={th}>Batal</th>
                  <th className={th}>Shift</th>
                  <th className={th}>Selisih kas</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {data.service.map((s) => (
                  <tr key={s.userId}>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{s.name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.orders}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatRupiah(s.sales)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatRupiah(s.aov)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {s.refundsCount} {s.refundsCount > 0 && <span className="text-xs text-slate-400">({formatRupiah(s.refundsTotal)})</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.cancellations}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.shifts}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {s.shifts === 0
                        ? '—'
                        : s.shiftsWithDifference === 0
                          ? 'Semua pas'
                          : `${s.shiftsWithDifference} shift (${formatRupiah(s.totalAbsDifference)})`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <h3 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-800 dark:border-slate-800 dark:text-white">Dapur</h3>
        {data.kitchen.length === 0 ? (
          <Empty text="Belum ada tiket yang ditandai siap pada periode ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-96 text-left text-sm">
              <thead className={thead}>
                <tr>
                  <th className={th}>Nama</th>
                  <th className={th}>Tiket ditandai siap</th>
                  <th className={th}>Rata-rata dari pesanan dibuat</th>
                </tr>
              </thead>
              <tbody className={tbody}>
                {data.kitchen.map((k) => (
                  <tr key={k.userId}>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{k.name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{k.tickets}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{k.avgMinutes} menit</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Halaman ---------- */

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user)
  const canStaff = !!user?.permissions.includes('report.staff')

  const [preset, setPreset] = useState<PresetKey>('7d')
  const [range, setRange] = useState(() => presetRange('7d'))
  const [tab, setTab] = useState<TabKey>('sales')

  const query = useQuery({
    queryKey: ['report-overview', range.from, range.to],
    queryFn: () => getOverview(range.from, range.to),
    placeholderData: (previous) => previous,
  })
  const data = query.data

  function choose(key: PresetKey) {
    setPreset(key)
    if (key !== 'custom') setRange(presetRange(key))
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'sales', label: 'Penjualan' },
    { key: 'products', label: 'Produk & kategori' },
    { key: 'payments', label: 'Pembayaran' },
    { key: 'refunds', label: 'Refund & pembatalan' },
    ...(canStaff ? [{ key: 'staff' as const, label: 'Kinerja staf' }] : []),
  ]

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
      active
        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
        : 'border border-slate-200 bg-white text-slate-600 hover:bg-amber-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
    }`

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Laporan</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Periode {formatDay(range.from)} – {formatDay(range.to)}, dibandingkan dengan periode sebelumnya yang sama panjang.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {presets.map((p) => (
            <button key={p.key} onClick={() => choose(p.key)} className={chip(preset === p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="Dari tanggal"
              value={range.from}
              max={range.to}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            />
            <span className="text-slate-400">–</span>
            <input
              type="date"
              aria-label="Sampai tanggal"
              value={range.to}
              min={range.from}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
        )}
      </div>

      {query.isLoading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : query.isError && !data ? (
        <p className="p-10 text-center text-sm text-red-600">
          {query.error instanceof Error ? query.error.message : 'Gagal memuat laporan'}
        </p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="Penjualan kotor"
              value={formatRupiah(data.current.gross)}
              current={data.current.gross}
              previous={data.previous.gross}
              icon={Wallet}
              color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
            />
            <KpiCard
              label="Refund"
              value={formatRupiah(data.current.refundsTotal)}
              current={data.current.refundsTotal}
              previous={data.previous.refundsTotal}
              inverse
              icon={Undo2}
              color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
            />
            <KpiCard
              label="Penjualan bersih"
              value={formatRupiah(data.current.net)}
              current={data.current.net}
              previous={data.previous.net}
              icon={Receipt}
              color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
            />
            <KpiCard
              label="Jumlah transaksi"
              value={String(data.current.orders)}
              current={data.current.orders}
              previous={data.previous.orders}
              icon={ShoppingBag}
              color="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400"
            />
            <KpiCard
              label="Rata-rata transaksi"
              value={formatRupiah(data.current.aov)}
              current={data.current.aov}
              previous={data.previous.aov}
              icon={TrendingUp}
              color="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
            />
            <KpiCard
              label="Pesanan dibatalkan"
              value={`${data.current.cancelledCount} · ${formatRupiah(data.current.cancelledValue)}`}
              current={data.current.cancelledCount}
              previous={data.previous.cancelledCount}
              inverse
              icon={Ban}
              color="bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            />
          </div>

          <details className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
            <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">Cara menghitung angka ini</summary>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-slate-600 dark:text-slate-300">
              <li>Penjualan kotor = total tagihan pesanan yang sudah lunas (termasuk pajak, service, dan pembulatan).</li>
              <li>Penjualan bersih = penjualan kotor dikurangi refund yang dilakukan pada periode ini.</li>
              <li>Pesanan yang dibatalkan tidak dihitung sebagai penjualan. Uang yang dikembalikan karena pembatalan tampil di tab Refund & pembatalan.</li>
              <li>Pesanan yang masih berjalan atau baru dibayar sebagian belum dihitung sampai lunas.</li>
              <li>Hari dan jam mengikuti zona waktu komputer server.</li>
            </ul>
          </details>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={chip(tab === t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'sales' && <SalesTab data={data} />}
          {tab === 'products' && <ProductsTab data={data} />}
          {tab === 'payments' && <PaymentsTab data={data} />}
          {tab === 'refunds' && <RefundsTab data={data} />}
          {tab === 'staff' && canStaff && <StaffTab from={range.from} to={range.to} />}
        </>
      ) : null}
    </div>
  )
}