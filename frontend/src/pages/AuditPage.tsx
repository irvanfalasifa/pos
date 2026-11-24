import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import { getAuditLogs } from '../services/audit'
import type { AuditLog } from '../services/audit'

const actionInfo: Record<string, { label: string; className: string }> = {
  ORDER_CANCELLED: {
    label: 'Pesanan dibatalkan',
    className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  },
  PAYMENT_REFUNDED: {
    label: 'Refund pembayaran',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  },
  APPROVAL_FAILED: {
    label: 'Otorisasi gagal',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  },
    SETTINGS_UPDATED: {
    label: 'Pengaturan diubah',
    className: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  },
    USER_CREATED: {
    label: 'Akun dibuat',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  USER_UPDATED: {
    label: 'Akun diubah',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
  },
  PASSWORD_RESET: {
    label: 'Password direset',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  },
  PASSWORD_CHANGED: {
    label: 'Password diganti',
    className: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  },
  ROLE_PERMISSIONS_UPDATED: {
    label: 'Izin role diubah',
    className: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  },
    USER_DELETED: {
    label: 'Akun dihapus',
    className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  },
}

const filters = [
  { value: '', label: 'Semua' },
  { value: 'ORDER_CANCELLED', label: 'Pembatalan' },
  { value: 'PAYMENT_REFUNDED', label: 'Refund' },
  { value: 'APPROVAL_FAILED', label: 'Otorisasi gagal' },
  { value: 'SETTINGS_UPDATED', label: 'Pengaturan' },
]

function entityLabel(log: AuditLog): string {
    if (log.entityType === 'User' || log.entityType === 'Role') {
    const name = (log.afterData ?? log.beforeData)?.name
    if (typeof name === 'string') return name
  }
  if (log.entityType === 'Settings') return 'Pengaturan usaha'
  const data = log.afterData ?? log.beforeData
  const number = data?.number
  return typeof number === 'string' ? number : `#${log.entityId}`
}

function LogRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false)
  const info = actionInfo[log.action] ?? {
    label: log.action,
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  }
  const attempted = log.afterData?.attemptedEmail

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${info.className}`}>{info.label}</span>
            {log.action !== 'APPROVAL_FAILED' && (
              <span className="font-semibold text-slate-800 dark:text-white">{entityLabel(log)}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Oleh <strong className="font-medium text-slate-700 dark:text-slate-200">{log.user.name}</strong>
            {log.approvedBy && log.approvedBy.id !== log.user.id && (
              <>
                {' '}
                · disetujui <strong className="font-medium text-slate-700 dark:text-slate-200">{log.approvedBy.name}</strong>
              </>
            )}
            {typeof attempted === 'string' && <> · mencoba memakai akun {attempted}</>}
          </p>
          {log.reason && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Alasan: {log.reason}</p>}
        </div>

        <div className="text-right">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {new Date(log.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
          <button
            onClick={() => setOpen(!open)}
            className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline dark:text-amber-400"
          >
            Detail
            <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            { title: 'Sebelum', data: log.beforeData },
            { title: 'Sesudah', data: log.afterData },
          ].map((block) => (
            <div key={block.title}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{block.title}</p>
              <pre className="overflow-x-auto rounded-xl bg-slate-100 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {block.data ? JSON.stringify(block.data, null, 2) : '—'}
              </pre>
            </div>
          ))}
        </div>
      )}
    </li>
  )
}

export default function AuditPage() {
  const [date, setDate] = useState('')
  const [action, setAction] = useState('')

  const query = useQuery({
    queryKey: ['audit-logs', date, action],
    queryFn: () => getAuditLogs({ date, action }),
    refetchInterval: 30_000,
  })
  const logs = query.data ?? []

  const chipBase = 'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition'
  const chipOn = 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
  const chipOff =
    'border border-slate-200 bg-white text-slate-600 hover:bg-amber-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Audit Log</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Jejak tindakan sensitif: pelaku, waktu, alasan, otorisasi, serta data sebelum dan sesudah.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
          {filters.map((f) => (
            <button key={f.value} onClick={() => setAction(f.value)} className={`${chipBase} ${action === f.value ? chipOn : chipOff}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Tanggal"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          />
          {date && (
            <button onClick={() => setDate('')} className="text-sm font-medium text-amber-600 hover:underline dark:text-amber-400">
              Semua tanggal
            </button>
          )}
        </div>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="p-10 text-center text-sm text-red-600">
          {query.error instanceof Error ? query.error.message : 'Gagal memuat audit log'}
        </p>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-2xl bg-amber-100 p-4 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">Belum ada catatan</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {logs.map((l) => (
            <LogRow key={l.id} log={l} />
          ))}
        </ul>
      )}
    </div>
  )
}