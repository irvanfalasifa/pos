import { useState } from 'react'
import { LogOut, ShieldCheck, ShieldAlert } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'

export default function WorkspacePage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  const { user, logout } = useAuthStore()
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  if (!user) return null

  async function testReportAccess() {
    try {
      const data = await api<{ message: string }>('/reports/ping')
      setResult({ ok: true, text: data.message })
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Gagal' })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
            <p className="mt-1 text-slate-500">{description}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>

        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="font-semibold text-slate-800">{user.name}</p>
          <p className="text-sm text-slate-500">{user.email}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {user.roles.map((r) => (
              <span key={r} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {r}
              </span>
            ))}
          </div>

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">Izin akun</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {user.permissions.map((p) => (
              <span key={p} className="rounded-md bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                {p}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={testReportAccess}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 active:scale-[0.98]"
          >
            Uji izin: lihat laporan
          </button>

          {result && (
            <div
              className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {result.ok ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
              {result.text}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}