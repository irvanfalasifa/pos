import type { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

export default function RequirePermission({
  code,
  children,
}: {
  code: string
  children: ReactNode
}) {
  const user = useAuthStore((s) => s.user)

  if (!user || !user.permissions.includes(code)) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
        <h2 className="mt-4 text-lg font-bold text-slate-800 dark:text-white">Akses ditolak</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Akun Anda tidak memiliki izin untuk membuka halaman ini.
        </p>
      </div>
    )
  }

  return <>{children}</>
}