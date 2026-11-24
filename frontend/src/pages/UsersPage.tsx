import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock, KeyRound, Loader2, Lock, Pencil, Plus, Copy, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import Toggle from '../components/Toggle'
import { createUser, deleteUser, getLogins, getRoleOptions, getUsers, resetPassword, updateUser } from '../services/users'
import type { RoleOption, UserRow } from '../services/users'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'

const PRIVILEGED = ['owner', 'admin']

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300'

function formatDateTime(value: string | null): string {
  if (!value) return 'Belum pernah'
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

/* ---------- Password sementara ---------- */

function TempPasswordModal({
  email,
  password,
  onClose,
}: {
  email: string
  password: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // browser menolak: pengguna bisa menyalin manual
    }
  }

  return (
    <Modal title="Password sementara" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Berikan password ini kepada <strong>{email}</strong>. Password hanya tampil sekali, dan pengguna wajib
          menggantinya saat masuk pertama kali.
        </p>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
          <code className="text-lg font-bold tracking-wider text-slate-800 dark:text-white">{password}</code>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-amber-50 dark:bg-slate-700 dark:text-slate-200"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Tersalin' : 'Salin'}
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 active:scale-[0.98]"
        >
          Selesai
        </button>
      </div>
    </Modal>
  )
}

/* ---------- Riwayat login ---------- */

function LoginHistoryModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const query = useQuery({ queryKey: ['user-logins', user.id], queryFn: () => getLogins(user.id) })
  const events = query.data ?? []

  return (
    <Modal title={`Riwayat login · ${user.name}`} onClose={onClose}>
      {query.isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      ) : events.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Belum ada riwayat login.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {events.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    e.success
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                  }`}
                >
                  {e.success ? 'Berhasil' : 'Gagal'}
                </span>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {e.ip ?? 'IP tidak diketahui'} · {e.userAgent ?? 'Perangkat tidak diketahui'}
                </p>
              </div>
              <p className="shrink-0 text-sm text-slate-500 dark:text-slate-400">{formatDateTime(e.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

/* ---------- Formulir pengguna ---------- */

function UserModal({
  target,
  roles,
  isOwner,
  isSelf,
  onClose,
  onCreated,
}: {
  target: UserRow | null
  roles: RoleOption[]
  isOwner: boolean
  isSelf: boolean
  onClose: () => void
  onCreated: (email: string, tempPassword: string) => void
}) {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)

  const [name, setName] = useState(target?.name ?? '')
  const [email, setEmail] = useState(target?.email ?? '')
  const [selected, setSelected] = useState<string[]>(target?.roles ?? [])
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      if (target) {
        await updateUser(target.id, {
          name: name.trim(),
          email: email.trim(),
          ...(isSelf ? {} : { roles: selected }),
        })
        return null
      }
      return createUser({
        name: name.trim(),
        email: email.trim(),
        roles: selected,
        ...(password ? { password } : {}),
      })
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      push('success', target ? 'Akun diperbarui' : 'Akun dibuat')
      onClose()
      if (result?.tempPassword) onCreated(email.trim().toLowerCase(), result.tempPassword)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal menyimpan akun'),
  })

  function toggleRole(roleName: string) {
    setSelected((list) => (list.includes(roleName) ? list.filter((r) => r !== roleName) : [...list, roleName]))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Nama wajib diisi')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Email tidak valid')
    if (selected.length === 0) return setError('Pilih minimal satu role')
    if (!target && password && password.length < 8) return setError('Password minimal 8 karakter')
    mutation.mutate()
  }

  return (
    <Modal title={target ? 'Ubah Akun' : 'Akun Baru'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={labelClass} htmlFor="u-name">Nama</label>
          <input id="u-name" className={fieldClass} value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="u-email">Email</label>
          <input id="u-email" type="email" className={fieldClass} value={email} maxLength={100} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div>
          <p className={labelClass}>Role</p>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => {
              const on = selected.includes(r.name)
              const locked = isSelf || (!isOwner && PRIVILEGED.includes(r.name))
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={locked}
                  onClick={() => toggleRole(r.name)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    on
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                      : 'bg-slate-100 text-slate-700 hover:bg-amber-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-amber-500/20'
                  }`}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
          {isSelf && <p className="mt-2 text-xs text-slate-500">Anda tidak dapat mengubah role akun sendiri.</p>}
          {!isOwner && !isSelf && (
            <p className="mt-2 text-xs text-slate-500">Role Owner dan Admin hanya dapat diberikan oleh Owner.</p>
          )}
        </div>

        {!target && (
          <div>
            <label className={labelClass} htmlFor="u-pass">Password awal (opsional)</label>
            <input id="u-pass" type="text" autoComplete="off" className={fieldClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kosongkan agar dibuat otomatis" />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Apa pun pilihannya, pengguna wajib menggantinya saat masuk pertama kali.
            </p>
          </div>
        )}

        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Batal
          </button>
          <button type="submit" disabled={mutation.isPending} className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:opacity-70">
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Konfirmasi hapus ---------- */

function DeleteUserModal({
  user,
  pending,
  onConfirm,
  onClose,
}: {
  user: UserRow
  pending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal title="Hapus akun" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Hapus akun <strong>{user.name}</strong> ({user.email})?
        </p>
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Akun yang belum punya riwayat akan dihapus permanen. Akun yang sudah punya riwayat (pesanan, pembayaran, refund,
          atau tindakan tercatat) akan <strong>diarsipkan</strong>: hilang dari daftar dan tidak bisa masuk lagi, tetapi
          riwayatnya tetap utuh. Untuk menghentikan akses sementara saja, gunakan saklar Aktif.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Hapus Akun
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Halaman ---------- */

export default function UsersPage() {
  const me = useAuthStore((s) => s.user)
  const push = useToastStore((s) => s.push)
  const queryClient = useQueryClient()
  const isOwner = !!me?.roles.includes('owner')

  const [formFor, setFormFor] = useState<UserRow | 'new' | null>(null)
  const [historyFor, setHistoryFor] = useState<UserRow | null>(null)
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null)
  const [deleteFor, setDeleteFor] = useState<UserRow | null>(null)

  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: getUsers })
  const rolesQuery = useQuery({ queryKey: ['admin-roles'], queryFn: getRoleOptions })

  const users = usersQuery.data ?? []
  const roles = rolesQuery.data ?? []
  const roleLabel = (name: string) => roles.find((r) => r.name === name)?.label ?? name

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateUser(id, { isActive }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      push('success', vars.isActive ? 'Akun diaktifkan' : 'Akun dinonaktifkan')
    },
    onError: (e) => push('error', e instanceof Error ? e.message : 'Gagal mengubah status akun'),
  })

  const resetMutation = useMutation({
    mutationFn: (id: number) => resetPassword(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setTemp({ email: result.email, password: result.tempPassword })
    },
    onError: (e) => push('error', e instanceof Error ? e.message : 'Gagal mereset password'),
  })

    const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      push(
        'success',
        result.mode === 'deleted' ? 'Akun dihapus permanen' : 'Akun diarsipkan, riwayatnya tetap tersimpan',
      )
      setDeleteFor(null)
    },
    onError: (e) => {
      push('error', e instanceof Error ? e.message : 'Gagal menghapus akun')
      setDeleteFor(null)
    },
  })
    
    const canManage = (u: UserRow) => isOwner || !u.roles.some((r) => PRIVILEGED.includes(r))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Pengguna</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Kelola akun karyawan, role, dan akses masuk.</p>
        </div>
        <button
          onClick={() => setFormFor('new')}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Akun Baru
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {usersQuery.isLoading ? (
          <div className="space-y-px">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse bg-slate-100 dark:bg-slate-800/60" />
            ))}
          </div>
        ) : usersQuery.isError ? (
          <p className="p-10 text-center text-sm text-red-600">
            {usersQuery.error instanceof Error ? usersQuery.error.message : 'Gagal memuat pengguna'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Pengguna</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Login terakhir</th>
                  <th className="px-4 py-3 font-medium">Aktif</th>
                  <th className="px-4 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => {
                  const manageable = canManage(u)
                  const self = u.id === me?.id

                  return (
                    <tr key={u.id} className={`${u.isActive ? '' : 'opacity-60'}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-white">
                          {u.name}
                          {self && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">Anda</span>}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {u.email}
                          {u.mustChangePassword ? ' · menunggu ganti password' : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {u.roles.map((r) => (
                            <span key={r} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {roleLabel(r)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(u.lastLoginAt)}</td>
                      <td className="px-4 py-3">
                        <Toggle
                          checked={u.isActive}
                          disabled={!manageable || self || toggleMutation.isPending}
                          onChange={(value) => toggleMutation.mutate({ id: u.id, isActive: value })}
                          label={`Akun ${u.name} aktif`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setHistoryFor(u)}
                            aria-label={`Riwayat login ${u.name}`}
                            title="Riwayat login"
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Clock className="h-4 w-4" />
                          </button>
                          {manageable ? (
                            <>
                              <button
                                onClick={() => setFormFor(u)}
                                aria-label={`Ubah ${u.name}`}
                                title="Ubah akun"
                                className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-500/15"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                                                            {!self && (
                                <>
                                  <button
                                    onClick={() => resetMutation.mutate(u.id)}
                                    disabled={resetMutation.isPending}
                                    aria-label={`Reset password ${u.name}`}
                                    title="Reset password"
                                    className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-100 hover:text-amber-700 disabled:opacity-50 dark:hover:bg-amber-500/15"
                                  >
                                    <KeyRound className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteFor(u)}
                                    aria-label={`Hapus ${u.name}`}
                                    title="Hapus akun"
                                    className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            <span title="Hanya Owner yang dapat mengelola akun ini" className="p-2 text-slate-300 dark:text-slate-600">
                              <Lock className="h-4 w-4" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formFor && (
        <UserModal
          key={formFor === 'new' ? 'new' : formFor.id}
          target={formFor === 'new' ? null : formFor}
          roles={roles}
          isOwner={isOwner}
          isSelf={formFor !== 'new' && formFor.id === me?.id}
          onClose={() => setFormFor(null)}
          onCreated={(email, password) => setTemp({ email, password })}
        />
      )}
      {historyFor && <LoginHistoryModal user={historyFor} onClose={() => setHistoryFor(null)} />}
        {temp && <TempPasswordModal email={temp.email} password={temp.password} onClose={() => setTemp(null)} />}
        {deleteFor && (
        <DeleteUserModal
          user={deleteFor}
          pending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteFor.id)}
          onClose={() => setDeleteFor(null)}
        />
      )}
    </div>
  )
}