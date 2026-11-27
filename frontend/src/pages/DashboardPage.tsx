import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ClipboardList, Receipt, ShoppingBag, TrendingUp, Undo2, Wallet } from 'lucide-react'
import KpiCard from '../components/KpiCard'
import TrendChart from '../components/TrendChart'
import { getLiveStats, getOverview } from '../services/reports'
import { useAuthStore } from '../stores/authStore'
import { formatRupiah } from '../lib/format'
import { paymentMethodLabel, tableStatusInfo } from '../lib/labels'
import { addDays, formatDay, todayString } from '../lib/reportFormat'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

const card = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const canView = !!user?.permissions.includes('report.view')

  const today = todayString()
  const weekStart = addDays(today, -6)

  const todayQuery = useQuery({
    queryKey: ['report-overview', today, today],
    queryFn: () => getOverview(today, today),
    enabled: canView,
    refetchInterval: 30_000,
  })
  const weekQuery = useQuery({
    queryKey: ['report-overview', weekStart, today],
    queryFn: () => getOverview(weekStart, today),
    enabled: canView,
    refetchInterval: 60_000,
  })
  const liveQuery = useQuery({
    queryKey: ['report-live'],
    queryFn: getLiveStats,
    enabled: canView,
    refetchInterval: 15_000,
  })

  if (!canView) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          {greeting()}, {user?.name}
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Ringkasan penjualan hanya tersedia untuk akun dengan izin laporan. Gunakan menu di samping untuk bekerja.
        </p>
      </div>
    )
  }

  const t = todayQuery.data
  const live = liveQuery.data
  const topProducts = (t?.products ?? []).slice(0, 5)
  const maxQty = Math.max(1, ...topProducts.map((p) => p.quantity))

  const trend = (weekQuery.data?.daily ?? []).map((d) => ({ label: formatDay(d.date), value: d.sales, orders: d.orders }))
  const hourly = (t?.hourly ?? [])
    .filter((h) => h.hour >= 6 && h.hour <= 23)
    .map((h) => ({ label: `${String(h.hour).padStart(2, '0')}:00`, value: h.sales, orders: h.orders }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          {greeting()}, {user?.name}
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Ringkasan hari ini, dibandingkan dengan kemarin. Data diperbarui otomatis.
        </p>
      </div>

      {todayQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : todayQuery.isError || !t ? (
        <p className="p-10 text-center text-sm text-red-600">
          {todayQuery.error instanceof Error ? todayQuery.error.message : 'Gagal memuat ringkasan'}
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Penjualan hari ini"
              value={formatRupiah(t.current.gross)}
              current={t.current.gross}
              previous={t.previous.gross}
              icon={Wallet}
              color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
              compareLabel="kemarin"
            />
            <KpiCard
              label="Jumlah transaksi"
              value={String(t.current.orders)}
              current={t.current.orders}
              previous={t.previous.orders}
              icon={ShoppingBag}
              color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
              compareLabel="kemarin"
            />
            <KpiCard
              label="Rata-rata transaksi"
              value={formatRupiah(t.current.aov)}
              current={t.current.aov}
              previous={t.previous.aov}
              icon={TrendingUp}
              color="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400"
              compareLabel="kemarin"
            />
            <KpiCard
              label="Refund"
              value={formatRupiah(t.current.refundsTotal)}
              current={t.current.refundsTotal}
              previous={t.previous.refundsTotal}
              inverse
              icon={Undo2}
              color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
              compareLabel="kemarin"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className={`${card} xl:col-span-2`}>
              <h2 className="font-semibold text-slate-800 dark:text-white">Penjualan 7 hari terakhir</h2>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Pesanan lunas, termasuk pajak dan service</p>
              {weekQuery.isLoading ? (
                <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              ) : (
                <TrendChart data={trend} type="line" />
              )}
            </div>

            <div className={card}>
              <h2 className="font-semibold text-slate-800 dark:text-white">Produk terlaris hari ini</h2>
              {topProducts.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Belum ada penjualan hari ini.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {topProducts.map((p, i) => (
                    <li key={p.productId}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate text-slate-700 dark:text-slate-200">
                          {i + 1}. {p.name}
                        </span>
                        <span className="ml-2 shrink-0 font-medium text-slate-500 dark:text-slate-400">{p.quantity}</span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-2 rounded-full bg-amber-500" style={{ width: `${(p.quantity / maxQty) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className={`${card} xl:col-span-2`}>
              <h2 className="font-semibold text-slate-800 dark:text-white">Penjualan per jam hari ini</h2>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Menunjukkan jam ramai</p>
              <TrendChart data={hourly} type="bar" />
            </div>

            <div className={card}>
              <h2 className="font-semibold text-slate-800 dark:text-white">Pembayaran hari ini</h2>
              {t.payments.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Belum ada pembayaran.</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {t.payments.map((p) => (
                    <li key={p.method} className="flex items-center justify-between py-2.5">
                      <span className="text-slate-600 dark:text-slate-300">
                        {paymentMethodLabel[p.method]} <span className="text-slate-400">· {p.count}</span>
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-white">{formatRupiah(p.received)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {/* Kondisi operasional saat ini */}
      <div>
        <h2 className="mb-3 font-semibold text-slate-800 dark:text-white">Kondisi saat ini</h2>
        {live ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className={card}>
              <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <ClipboardList className="h-4 w-4" /> Pesanan aktif
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800 dark:text-white">{live.activeOrders}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sedang di dapur atau menunggu disajikan</p>
            </div>

            <div className={card}>
              <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Receipt className="h-4 w-4" /> Menunggu pembayaran
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-800 dark:text-white">{live.unpaidOrders}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Pesanan belum lunas</p>
            </div>

            <div className={card}>
              <p className="text-sm text-slate-500 dark:text-slate-400">Meja</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'] as const).map((s) => (
                  <span key={s} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tableStatusInfo[s].chip}`}>
                    {tableStatusInfo[s].label}: {live.tables[s]}
                  </span>
                ))}
              </div>
            </div>

            <div className={card}>
              <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Wallet className="h-4 w-4" /> Shift
              </p>
              {live.openShifts.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Tidak ada shift aktif.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                  {live.openShifts.map((s) => (
                    <li key={s.id}>
                      {s.cashier}{' '}
                      <span className="text-xs text-slate-400">
                        sejak {new Date(s.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {live.pendingReviews > 0 && (
                <Link
                  to="/manajemen/shift"
                  className="mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                >
                  {live.pendingReviews} shift menunggu tinjauan
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        )}
      </div>
    </div>
  )
}