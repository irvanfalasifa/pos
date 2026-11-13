import { Wallet, ShoppingBag, TrendingUp, Package } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

const stats = [
  {
    label: 'Omzet hari ini',
    value: 'Rp 4.250.000',
    note: '+12% dari kemarin',
    icon: Wallet,
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  },
  {
    label: 'Jumlah transaksi',
    value: '86',
    note: '+5 dari kemarin',
    icon: ShoppingBag,
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  {
    label: 'Rata-rata transaksi',
    value: 'Rp 49.400',
    note: 'Stabil',
    icon: TrendingUp,
    color: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  },
  {
    label: 'Stok menipis',
    value: '3 bahan',
    note: 'Perlu dibeli',
    icon: Package,
    color: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
  },
]

const weekly = [
  { day: 'Sen', value: 3.1 },
  { day: 'Sel', value: 2.8 },
  { day: 'Rab', value: 3.6 },
  { day: 'Kam', value: 3.3 },
  { day: 'Jum', value: 4.4 },
  { day: 'Sab', value: 5.2 },
  { day: 'Min', value: 4.25 },
]

const topProducts = [
  { name: 'Kopi Susu Gula Aren', sold: 42 },
  { name: 'Nasi Goreng Spesial', sold: 31 },
  { name: 'Es Teh Lemon', sold: 27 },
  { name: 'Kentang Goreng', sold: 22 },
  { name: 'Roti Bakar Cokelat', sold: 18 },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const maxValue = Math.max(...weekly.map((w) => w.value))
  const maxSold = Math.max(...topProducts.map((p) => p.sold))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          {greeting()}, {user?.name}
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Ringkasan operasional (data contoh, nanti terhubung ke transaksi sungguhan).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
              <div className={`rounded-xl p-2 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-800 dark:text-white">{s.value}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-800 dark:text-white">Penjualan 7 hari terakhir</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Dalam juta rupiah</p>

          <div className="mt-6 flex h-52 items-end gap-3">
            {weekly.map((w) => (
              <div key={w.day} className="group flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-medium text-slate-500 opacity-0 transition group-hover:opacity-100 dark:text-slate-400">
                  {w.value}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg bg-amber-400 transition-all group-hover:bg-amber-500"
                    style={{ height: `${(w.value / maxValue) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">{w.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-800 dark:text-white">Produk terlaris</h2>
          <ul className="mt-4 space-y-4">
            {topProducts.map((p, i) => (
              <li key={p.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-200">
                    {i + 1}. {p.name}
                  </span>
                  <span className="font-medium text-slate-500 dark:text-slate-400">{p.sold}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-amber-500"
                    style={{ width: `${(p.sold / maxSold) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}