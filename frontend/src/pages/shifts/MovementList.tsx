import { formatRupiah } from '../../lib/format'
import type { CashMovement } from '../../services/shifts'

export default function MovementList({ movements }: { movements: CashMovement[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="font-semibold text-slate-800 dark:text-white">Kas masuk dan keluar</p>
      {movements.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Belum ada pencatatan.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {movements.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-white">{m.reason}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(m.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {m.createdBy.name}
                  {m.type === 'OUT' && m.approvedById ? ' · disetujui manajer' : ''}
                </p>
              </div>
              <p className={`shrink-0 font-semibold ${m.type === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {m.type === 'IN' ? '+' : '−'}
                {formatRupiah(m.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}