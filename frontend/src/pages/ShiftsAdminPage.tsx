import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Modal from '../components/Modal'
import ShiftSummaryCards from './shifts/ShiftSummaryCards'
import MovementList from './shifts/MovementList'
import { differenceInfo } from '../lib/shiftFormat'
import { getShiftDetail, getShifts, reviewShift } from '../services/shifts'
import type { Shift } from '../services/shifts'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'
import { formatRupiah } from '../lib/format'

const timeFormat: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }

type Filter = 'ALL' | 'OPEN' | 'REVIEW'

function statusBadge(s: Shift): { label: string; className: string } {
  if (s.status === 'OPEN') {
    return { label: 'Aktif', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' }
  }
  if (s.needsReview) {
    return { label: 'Menunggu tinjauan', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' }
  }
  return { label: 'Selesai', className: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' }
}

function ShiftDetailModal({ shiftId, onClose }: { shiftId: number; onClose: () => void }) {
  const me = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)

  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const query = useQuery({ queryKey: ['shift-detail', shiftId], queryFn: () => getShiftDetail(shiftId) })

  const mutation = useMutation({
    mutationFn: () => reviewShift(shiftId, note.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      queryClient.invalidateQueries({ queryKey: ['shift-detail', shiftId] })
      push('success', 'Penutupan shift disahkan')
      setNote('')
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal mengesahkan shift'),
  })

  const detail = query.data
  const shift = detail?.shift

  const canReview =
    !!shift && shift.needsReview && (shift.user.id !== me?.id || !!me?.roles.includes('owner'))

  return (
    <Modal title={shift ? `Shift #${shift.id} · ${shift.user.name}` : 'Detail shift'} onClose={onClose} wide>
      {query.isLoading || !detail || !shift ? (
        <div className="h-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2 dark:bg-slate-800/60">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Dibuka</p>
              <p className="font-medium text-slate-800 dark:text-white">{new Date(shift.openedAt).toLocaleString('id-ID', timeFormat)}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Ditutup</p>
              <p className="font-medium text-slate-800 dark:text-white">
                {shift.closedAt ? new Date(shift.closedAt).toLocaleString('id-ID', timeFormat) : 'Masih berjalan'}
              </p>
            </div>
            {shift.status === 'CLOSED' && (
              <>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Uang fisik dihitung</p>
                  <p className="font-medium text-slate-800 dark:text-white">{formatRupiah(shift.closingCash ?? 0)}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Selisih</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${differenceInfo(shift.cashDifference).className}`}>
                    {differenceInfo(shift.cashDifference).label}
                  </span>
                </div>
              </>
            )}
            {shift.closingNote && (
              <div className="sm:col-span-2">
                <p className="text-slate-500 dark:text-slate-400">Catatan kasir</p>
                <p className="font-medium text-slate-800 dark:text-white">{shift.closingNote}</p>
              </div>
            )}
            {shift.reviewedAt && (
              <div className="sm:col-span-2">
                <p className="text-slate-500 dark:text-slate-400">
                  Disahkan oleh {shift.reviewedBy?.name} · {new Date(shift.reviewedAt).toLocaleString('id-ID', timeFormat)}
                </p>
                {shift.reviewNote && <p className="font-medium text-slate-800 dark:text-white">{shift.reviewNote}</p>}
              </div>
            )}
          </div>

          <ShiftSummaryCards summary={detail.summary} />
          <MovementList movements={detail.movements} />

          {canReview && (
            <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Shift ini menunggu tinjauan</p>
              <textarea
                rows={2}
                maxLength={200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Catatan tinjauan (wajib bila ada selisih)"
                className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-amber-500/40 dark:bg-slate-800 dark:text-white"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                onClick={() => {
                  setError('')
                  mutation.mutate()
                }}
                disabled={mutation.isPending}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:opacity-60"
              >
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Sahkan penutupan
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function ShiftsAdminPage() {
  const [date, setDate] = useState(() => new Date().toLocaleDateString('sv-SE'))
  const [filter, setFilter] = useState<Filter>('ALL')
  const [selected, setSelected] = useState<number | null>(null)

  const query = useQuery({
    queryKey: ['shifts', date],
    queryFn: () => getShifts(date),
    refetchInterval: 30_000,
  })

  const shifts = query.data ?? []
  const reviewCount = shifts.filter((s) => s.needsReview).length
  const visible = shifts.filter((s) => {
    if (filter === 'OPEN') return s.status === 'OPEN'
    if (filter === 'REVIEW') return s.needsReview
    return true
  })

  const chipBase = 'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition'
  const chipOn = 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
  const chipOff =
    'border border-slate-200 bg-white text-slate-600 hover:bg-amber-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'

  const filters: { value: Filter; label: string }[] = [
    { value: 'ALL', label: 'Semua' },
    { value: 'OPEN', label: 'Aktif' },
    { value: 'REVIEW', label: `Menunggu tinjauan${reviewCount > 0 ? ` (${reviewCount})` : ''}` },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Shift & Kas</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Pantau shift kasir, selisih kas, dan sahkan penutupan.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)} className={`${chipBase} ${filter === f.value ? chipOn : chipOff}`}>
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="date"
          aria-label="Tanggal"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {query.isLoading ? (
          <div className="space-y-px">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse bg-slate-100 dark:bg-slate-800/60" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="p-10 text-center text-sm text-red-600">
            {query.error instanceof Error ? query.error.message : 'Gagal memuat shift'}
          </p>
        ) : visible.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Tidak ada shift pada tanggal ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Kasir</th>
                  <th className="px-4 py-3 font-medium">Waktu</th>
                  <th className="px-4 py-3 font-medium">Seharusnya</th>
                  <th className="px-4 py-3 font-medium">Dihitung</th>
                  <th className="px-4 py-3 font-medium">Selisih</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.map((s) => {
                  const badge = statusBadge(s)
                  const diff = differenceInfo(s.cashDifference)
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setSelected(s.id)}
                      className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{s.user.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {new Date(s.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {s.closedAt ? new Date(s.closedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'sekarang'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {s.expectedCash !== null ? formatRupiah(s.expectedCash) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {s.closingCash !== null ? formatRupiah(s.closingCash) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {s.status === 'CLOSED' ? (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${diff.className}`}>{diff.label}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected !== null && <ShiftDetailModal shiftId={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}