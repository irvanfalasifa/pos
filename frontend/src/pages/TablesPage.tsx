import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Clock, ShoppingCart, Users } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useCartStore } from '../stores/cartStore'
import { useToastStore } from '../stores/toastStore'
import { getTables, updateTableStatus } from '../services/pos'
import type { TableStatus } from '../services/pos'
import { tableStatusInfo } from '../lib/labels'

function formatDuration(since: string | null, now: number): string | null {
  if (!since) return null
  const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}j ${String(m).padStart(2, '0')}m` : `${m}m`
}

export default function TablesPage() {
  const user = useAuthStore((s) => s.user)
  const push = useToastStore((s) => s.push)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())

  const canChange = !!user?.permissions.includes('order.create')

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const tablesQuery = useQuery({ queryKey: ['tables'], queryFn: getTables, refetchInterval: 15_000 })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: TableStatus }) => updateTableStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tables'] }),
    onError: (e) => push('error', e instanceof Error ? e.message : 'Gagal mengubah status meja'),
  })

  const areas = tablesQuery.data ?? []
  const allTables = areas.flatMap((a) => a.tables)

  function startOrder(tableId: number) {
    const cart = useCartStore.getState()
    cart.setType('DINE_IN')
    cart.setTable(tableId)
    navigate('/pos')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Meja</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Pantau status meja dan mulai pesanan dari meja.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(tableStatusInfo) as TableStatus[]).map((s) => (
          <span key={s} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${tableStatusInfo[s].chip}`}>
            {tableStatusInfo[s].label}: {allTables.filter((t) => t.status === s).length}
          </span>
        ))}
      </div>

      {tablesQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : tablesQuery.isError ? (
        <p className="p-10 text-center text-sm text-red-600">
          {tablesQuery.error instanceof Error ? tablesQuery.error.message : 'Gagal memuat meja'}
        </p>
      ) : (
        areas.map((area) => (
          <section key={area.id}>
            <h2 className="mb-3 font-semibold text-slate-700 dark:text-slate-200">{area.name}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {area.tables.map((t) => {
                const info = tableStatusInfo[t.status]
                const duration = t.status === 'OCCUPIED' ? formatDuration(t.occupiedSince, now) : null

                return (
                  <div
                    key={t.id}
                    className={`rounded-2xl border-2 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900 ${info.border}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-lg font-bold text-slate-800 dark:text-white">{t.name}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${info.chip}`}>{info.label}</span>
                    </div>

                    <div className="mt-2 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {t.capacity}
                      </span>
                      {duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {duration}
                        </span>
                      )}
                    </div>

                    {canChange && (
                      <div className="mt-4 flex gap-2">
                        {t.status !== 'CLEANING' && (
                          <button
                            onClick={() => startOrder(t.id)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-2 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 active:scale-[0.97]"
                          >
                            <ShoppingCart className="h-4 w-4" />
                            Pesan
                          </button>
                        )}
                        <select
                          aria-label={`Status meja ${t.name}`}
                          value={t.status}
                          disabled={statusMutation.isPending}
                          onChange={(e) => statusMutation.mutate({ id: t.id, status: e.target.value as TableStatus })}
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {(Object.keys(tableStatusInfo) as TableStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {tableStatusInfo[s].label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}