import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react'
import Modal from '../components/Modal'
import Toggle from '../components/Toggle'
import {
  createArea,
  createTable,
  deleteArea,
  getAdminTables,
  updateArea,
  updateTable,
} from '../services/tablesAdmin'
import type { AdminArea, AdminTable } from '../services/tablesAdmin'
import { useToastStore } from '../stores/toastStore'
import { tableStatusInfo } from '../lib/labels'

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300'

function SubmitButtons({ pending, onClose }: { pending: boolean; onClose: () => void }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
      <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
        Batal
      </button>
      <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:opacity-70">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Simpan
      </button>
    </div>
  )
}

function AreaModal({ area, onClose }: { area: AdminArea | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)
  const [name, setName] = useState(area?.name ?? '')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (value: string) => (area ? updateArea(area.id, value) : createArea(value)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tables'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      push('success', area ? 'Area diperbarui' : 'Area ditambahkan')
      onClose()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal menyimpan area'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Nama area wajib diisi')
    mutation.mutate(name.trim())
  }

  return (
    <Modal title={area ? 'Ubah Area' : 'Area Baru'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={labelClass} htmlFor="area-name">Nama area</label>
          <input id="area-name" className={fieldClass} value={name} maxLength={40} autoFocus placeholder="Contoh: Rooftop" onChange={(e) => setName(e.target.value)} />
        </div>
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
        <SubmitButtons pending={mutation.isPending} onClose={onClose} />
      </form>
    </Modal>
  )
}

function TableModal({
  areas,
  area,
  table,
  onClose,
}: {
  areas: AdminArea[]
  area: AdminArea
  table: AdminTable | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)
  const [name, setName] = useState(table?.name ?? '')
  const [capacity, setCapacity] = useState(String(table?.capacity ?? 4))
  const [areaId, setAreaId] = useState(String(table?.areaId ?? area.id))
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (data: { areaId: number; name: string; capacity: number }) =>
      table ? updateTable(table.id, data) : createTable(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tables'] })
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      push('success', table ? 'Meja diperbarui' : 'Meja ditambahkan')
      onClose()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal menyimpan meja'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const cap = Number(capacity)
    if (!name.trim()) return setError('Nama meja wajib diisi')
    if (!Number.isInteger(cap) || cap < 1 || cap > 50) return setError('Kapasitas harus 1 sampai 50 kursi')
    mutation.mutate({ areaId: Number(areaId), name: name.trim(), capacity: cap })
  }

  return (
    <Modal title={table ? 'Ubah Meja' : 'Meja Baru'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="t-name">Nama / nomor meja</label>
            <input id="t-name" className={fieldClass} value={name} maxLength={20} autoFocus placeholder="Contoh: I-07" onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="t-cap">Kapasitas (kursi)</label>
            <input id="t-cap" type="number" min={1} max={50} className={fieldClass} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="t-area">Area</label>
            <select id="t-area" className={fieldClass} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
        <SubmitButtons pending={mutation.isPending} onClose={onClose} />
      </form>
    </Modal>
  )
}

export default function TablesAdminPage() {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)

  const [areaModal, setAreaModal] = useState<AdminArea | 'new' | null>(null)
  const [tableModal, setTableModal] = useState<{ area: AdminArea; table: AdminTable | null } | null>(null)

  const query = useQuery({ queryKey: ['admin-tables'], queryFn: getAdminTables })
  const areas = query.data ?? []

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-tables'] })
    queryClient.invalidateQueries({ queryKey: ['tables'] })
  }

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateTable(id, { isActive }),
    onSuccess: (_data, vars) => {
      refresh()
      push('success', vars.isActive ? 'Meja diaktifkan' : 'Meja dinonaktifkan')
    },
    onError: (e) => push('error', e instanceof Error ? e.message : 'Gagal mengubah status meja'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteArea,
    onSuccess: () => {
      refresh()
      push('success', 'Area dihapus')
    },
    onError: (e) => push('error', e instanceof Error ? e.message : 'Gagal menghapus area'),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Kelola Meja</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Meja yang dinonaktifkan tidak muncul di kasir, tetapi riwayat pesanannya tetap tersimpan.
          </p>
        </div>
        <button
          onClick={() => setAreaModal('new')}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Area Baru
        </button>
      </div>

      {query.isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      ) : query.isError ? (
        <p className="p-10 text-center text-sm text-red-600">
          {query.error instanceof Error ? query.error.message : 'Gagal memuat meja'}
        </p>
      ) : (
        areas.map((area) => (
          <section key={area.id}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-semibold text-slate-700 dark:text-slate-200">{area.name}</h2>
              <button onClick={() => setAreaModal(area)} aria-label={`Ubah area ${area.name}`} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                <Pencil className="h-4 w-4" />
              </button>
              {area.tables.length === 0 && (
                <button
                  onClick={() => deleteMutation.mutate(area.id)}
                  aria-label={`Hapus area ${area.name}`}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {area.tables.map((t) => {
                const info = tableStatusInfo[t.status]
                return (
                  <div
                    key={t.id}
                    className={`rounded-2xl border border-slate-200 bg-white p-4 transition dark:border-slate-800 dark:bg-slate-900 ${t.isActive ? '' : 'opacity-60'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-lg font-bold text-slate-800 dark:text-white">{t.name}</p>
                      <button onClick={() => setTableModal({ area, table: t })} aria-label={`Ubah meja ${t.name}`} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                      <Users className="h-4 w-4" />
                      {t.capacity} kursi
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.isActive ? info.chip : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                        {t.isActive ? info.label : 'Nonaktif'}
                      </span>
                      <Toggle
                        checked={t.isActive}
                        disabled={toggleMutation.isPending}
                        onChange={(value) => toggleMutation.mutate({ id: t.id, isActive: value })}
                        label={`Meja ${t.name} aktif`}
                      />
                    </div>
                  </div>
                )
              })}

              <button
                onClick={() => setTableModal({ area, table: null })}
                className="flex min-h-32 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 transition hover:border-amber-400 hover:text-amber-600 dark:border-slate-700"
              >
                <Plus className="h-6 w-6" />
                <span className="mt-1 text-sm font-medium">Tambah meja</span>
              </button>
            </div>
          </section>
        ))
      )}

      {areaModal && <AreaModal area={areaModal === 'new' ? null : areaModal} onClose={() => setAreaModal(null)} />}
      {tableModal && (
        <TableModal areas={areas} area={tableModal.area} table={tableModal.table} onClose={() => setTableModal(null)} />
      )}
    </div>
  )
}