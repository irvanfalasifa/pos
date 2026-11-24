import { LogOut, ShieldAlert } from 'lucide-react'
import ChangePasswordForm from '../components/ChangePasswordForm'
import { useAuthStore } from '../stores/authStore'

export default function ForcePasswordChange() {
  const { user, logout } = useAuthStore()

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 p-2.5 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Ganti password Anda</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Anda masuk dengan password sementara. Demi keamanan, buat password baru sebelum melanjutkan.
        </p>

        <div className="mt-5">
          <ChangePasswordForm />
        </div>

        <button
          onClick={logout}
          className="mt-4 flex w-full items-center justify-center gap-2 text-sm text-slate-500 transition hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </button>
      </div>
    </div>
  )
}