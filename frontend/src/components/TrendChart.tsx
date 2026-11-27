import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatRupiah } from '../lib/format'
import { formatShort } from '../lib/reportFormat'

export type TrendPoint = { label: string; value: number; orders: number }

type TooltipProps = {
  active?: boolean
  payload?: ReadonlyArray<{ value?: number | string; payload?: { orders?: number } }>
  label?: string | number
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  const first = payload?.[0]
  if (!active || !first) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="font-medium text-slate-800 dark:text-white">{label}</p>
      <p className="text-amber-600 dark:text-amber-400">{formatRupiah(Number(first.value ?? 0))}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{first.payload?.orders ?? 0} transaksi</p>
    </div>
  )
}

export default function TrendChart({ data, type }: { data: TrendPoint[]; type: 'line' | 'bar' }) {
  const common = {
    data,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
  }

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} vertical={false} />
      <XAxis dataKey="label" tick={{ fill: 'currentColor', fontSize: 12 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
      <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} axisLine={false} tickLine={false} width={48} tickFormatter={formatShort} />
      <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'currentColor', strokeOpacity: 0.15 }} />
    </>
  )

  return (
    <div className="h-64 text-slate-500 dark:text-slate-400">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'line' ? (
          <LineChart {...common}>
            {axes}
            <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={3} dot={data.length <= 31} activeDot={{ r: 5 }} />
          </LineChart>
        ) : (
          <BarChart {...common}>
            {axes}
            <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}