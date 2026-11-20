import { ShieldAlert } from 'lucide-react'
import type { Approver } from '../services/pos'

const fieldClass =
  'w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-amber-500/40 dark:bg-slate-800 dark:text-white'

export default function ApprovalFields({
  value,
  onChange,
}: {
  value: Approver
  onChange: (value: Approver) => void
}) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        <ShieldAlert className="h-4 w-4" />
        Butuh otorisasi manajer
      </p>
      <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">
        Minta Owner atau Admin memasukkan email dan password mereka di bawah ini. Tindakan ini tercatat di audit log.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          type="email"
          autoComplete="off"
          placeholder="Email pemberi otorisasi"
          aria-label="Email pemberi otorisasi"
          className={fieldClass}
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Password"
          aria-label="Password pemberi otorisasi"
          className={fieldClass}
          value={value.password}
          onChange={(e) => onChange({ ...value, password: e.target.value })}
        />
      </div>
    </div>
  )
}