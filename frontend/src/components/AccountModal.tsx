import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Modal from './Modal'
import ChangePasswordForm from './ChangePasswordForm'
import { api } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import type { AuthUser } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'

export default function AccountModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const push = useToastStore((s) => s.push)
  const [tab, setTab] = useState<'profile' | 'password'>('profile')
  const [name, setName] = useState(user?.name ?? '')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api<AuthUser>('/auth/profile', { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) }),
    onSuccess: (updated) => {
      useAuthStore.setState({ user: updated })
      push('success', 'Profil diperbarui')
      onClose()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal menyimpan profil'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Nama wajib diisi')
    mutation.mutate()
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
      active
        ? 'bg-white text-amber-600 shadow dark:bg-slate-700 dark:text-amber-400'
        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
    }`

  return (
    <Modal title="Akun saya" onClose={onClose}>
      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        <button className={tabClass(tab === 'profile')} onClick={() => setTab('profile')}>
          Profil
        </button>
        <button className={tabClass(tab === 'password')} onClick={() => setTab('password')}>
          Ubah password
        </button>
      </div>

      {tab === 'profile' ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="acc-name" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nama
            </label>
            <input
              id="acc-name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
            <p className="text-slate-500 dark:text-slate-400">Email</p>
            <p className="font-medium text-slate-800 dark:text-white">{user?.email}</p>
            <p className="mt-2 text-slate-500 dark:text-slate-400">Role</p>
            <p className="font-medium capitalize text-slate-800 dark:text-white">{user?.roles.join(', ')}</p>
          </div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:opacity-70"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan Profil
          </button>
        </form>
      ) : (
        <ChangePasswordForm onDone={onClose} />
      )}
    </Modal>
  )
}
