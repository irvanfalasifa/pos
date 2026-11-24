import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { api } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import type { AuthUser } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-11 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300'

export default function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const push = useToastStore((s) => s.push)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api<AuthUser>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      }),
    onSuccess: (user) => {
      useAuthStore.setState({ user })
      push('success', 'Password berhasil diganti')
      onDone?.()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal mengganti password'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
      return setError('Password baru minimal 8 karakter dan harus mengandung huruf serta angka')
    }
    if (next !== confirm) return setError('Konfirmasi password tidak sama')
    mutation.mutate()
  }

  const type = show ? 'text' : 'password'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {[
        { id: 'cp-current', label: 'Password saat ini', value: current, set: setCurrent, auto: 'current-password' },
        { id: 'cp-new', label: 'Password baru', value: next, set: setNext, auto: 'new-password' },
        { id: 'cp-confirm', label: 'Ulangi password baru', value: confirm, set: setConfirm, auto: 'new-password' },
      ].map((f, index) => (
        <div key={f.id}>
          <label className={labelClass} htmlFor={f.id}>{f.label}</label>
          <div className="relative">
            <input
              id={f.id}
              type={type}
              autoComplete={f.auto}
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              className={fieldClass}
            />
            {index === 0 && (
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
              >
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
      ))}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Minimal 8 karakter dengan kombinasi huruf dan angka. Setelah diganti, perangkat lain akan diminta masuk ulang.
      </p>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:opacity-70"
      >
        {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Simpan Password
      </button>
    </form>
  )
}