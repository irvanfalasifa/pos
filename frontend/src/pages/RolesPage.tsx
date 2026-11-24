import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Lock } from 'lucide-react'
import { getRoleMatrix, saveRolePermissions } from '../services/users'
import type { RoleMatrix } from '../services/users'
import { useToastStore } from '../stores/toastStore'

const groupLabels: Record<string, string> = {
  product: 'Produk dan menu',
  order: 'Pesanan',
  payment: 'Pembayaran',
  kds: 'Dapur (KDS)',
  report: 'Laporan',
  user: 'Pengguna',
  role: 'Role dan izin',
  audit: 'Audit',
  settings: 'Pengaturan',
  table: 'Meja',
}

function MatrixEditor({ data }: { data: RoleMatrix }) {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)

  const [state, setState] = useState<Record<number, string[]>>(
    Object.fromEntries(data.roles.map((r) => [r.id, r.codes])),
  )

  const changedRoles = data.roles.filter((r) => {
    if (r.name === 'owner') return false
    const now = [...(state[r.id] ?? [])].sort().join(',')
    const was = [...r.codes].sort().join(',')
    return now !== was
  })

  const mutation = useMutation({
    mutationFn: async () => {
      for (const r of changedRoles) {
        await saveRolePermissions(r.id, state[r.id] ?? [])
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-matrix'] })
      push('success', 'Izin role disimpan')
    },
    onError: (e) => push('error', e instanceof Error ? e.message : 'Gagal menyimpan izin'),
  })

  function toggle(roleId: number, code: string) {
    setState((prev) => {
      const current = prev[roleId] ?? []
      return {
        ...prev,
        [roleId]: current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
      }
    })
  }

  // Kelompokkan izin berdasarkan modul (bagian sebelum titik)
  const groups = new Map<string, RoleMatrix['permissions']>()
  for (const p of data.permissions) {
    const key = p.code.split('.')[0] ?? p.code
    groups.set(key, [...(groups.get(key) ?? []), p])
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-160 text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Izin</th>
              {data.roles.map((r) => (
                <th key={r.id} className="px-3 py-3 text-center font-medium">
                  <span className="flex items-center justify-center gap-1">
                    {r.name === 'owner' && <Lock className="h-3 w-3" />}
                    {r.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...groups.entries()].map(([key, perms]) => (
              <>
                <tr key={`g-${key}`} className="bg-slate-50/70 dark:bg-slate-800/30">
                  <td colSpan={data.roles.length + 1} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {groupLabels[key] ?? key}
                  </td>
                </tr>
                {perms.map((p) => (
                  <tr key={p.code} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800 dark:text-white">{p.label}</p>
                      <p className="text-xs text-slate-400">{p.code}</p>
                    </td>
                    {data.roles.map((r) => {
                      const isOwner = r.name === 'owner'
                      const checked = isOwner || (state[r.id] ?? []).includes(p.code)
                      return (
                        <td key={r.id} className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isOwner}
                            onChange={() => toggle(r.id, p.code)}
                            aria-label={`${p.label} untuk ${r.label}`}
                            className="h-4 w-4 cursor-pointer accent-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Perubahan langsung berlaku untuk semua pengguna dengan role tersebut. Role Owner selalu memiliki semua izin.
        </p>
        <button
          onClick={() => mutation.mutate()}
          disabled={changedRoles.length === 0 || mutation.isPending}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Simpan {changedRoles.length > 0 ? `(${changedRoles.length} role)` : ''}
        </button>
      </div>
    </div>
  )
}

export default function RolesPage() {
  const query = useQuery({ queryKey: ['role-matrix'], queryFn: getRoleMatrix })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Role dan Izin</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Tentukan apa yang boleh dilakukan setiap role.</p>
      </div>

      {query.isLoading ? (
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      ) : query.isError || !query.data ? (
        <p className="p-10 text-center text-sm text-red-600">
          {query.error instanceof Error ? query.error.message : 'Gagal memuat izin'}
        </p>
      ) : (
        <MatrixEditor key={JSON.stringify(query.data.roles.map((r) => r.codes))} data={query.data} />
      )}
    </div>
  )
}