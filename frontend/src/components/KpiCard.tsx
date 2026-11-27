import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { deltaPercent } from '../lib/reportFormat'

// inverse = true untuk angka yang naiknya buruk (refund, pembatalan)
export default function KpiCard({
  label,
  value,
  current,
  previous,
  inverse = false,
  icon: Icon,
  color,
  compareLabel = 'periode sebelumnya',
}: {
  label: string
  value: string
  current: number
  previous: number
  inverse?: boolean
  icon: LucideIcon
  color: string
  compareLabel?: string
}) {
  const delta = deltaPercent(current, previous)
  const up = delta !== null && delta > 0
  const down = delta !== null && delta < 0
  const good = inverse ? down : up
  const bad = inverse ? up : down

  const tone = good
    ? 'text-emerald-600 dark:text-emerald-400'
    : bad
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-500 dark:text-slate-400'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <div className={`rounded-xl p-2 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
      <p className={`mt-1 flex items-center gap-1 text-xs ${tone}`}>
        {up ? <TrendingUp className="h-3.5 w-3.5" /> : down ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
        {delta === null
          ? previous === 0 && current === 0
            ? `Sama seperti ${compareLabel}`
            : `Belum ada pembanding`
          : `${delta > 0 ? '+' : ''}${delta.toLocaleString('id-ID', { maximumFractionDigits: 1 })}% dari ${compareLabel}`}
      </p>
    </div>
  )
}