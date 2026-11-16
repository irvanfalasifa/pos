import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import Modal from '../../components/Modal'
import Toggle from '../../components/Toggle'
import { createModifierGroup, updateModifierGroup } from '../../services/products'
import type { ModifierGroup, ModifierGroupInput } from '../../services/products'
import { useToastStore } from '../../stores/toastStore'
import { formatRupiah } from '../../lib/format'

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300'

let rowKey = 0

function ruleLabel(min: number, max: number): string {
  if (min === 0) return `Opsional, maksimal ${max}`
  if (min === max) return `Wajib pilih ${min}`
  return `Wajib pilih ${min}–${max}`
}

type OptionRow = { key: number; id?: number; name: string; price: string }

function GroupForm({
  group,
  onDone,
}: {
  group: ModifierGroup | null
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)

  const [name, setName] = useState(group?.name ?? '')
  const [minSelect, setMinSelect] = useState(String(group?.minSelect ?? 0))
  const [maxSelect, setMaxSelect] = useState(String(group?.maxSelect ?? 1))
  const [options, setOptions] = useState<OptionRow[]>(
    group?.options.map((o) => ({ key: rowKey++, id: o.id, name: o.name, price: String(o.price) })) ?? [
      { key: rowKey++, name: '', price: '0' },
    ],
  )
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (data: ModifierGroupInput) =>
      group ? updateModifierGroup(group.id, data) : createModifierGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifier-groups'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      push('success', group ? 'Grup modifier diperbarui' : 'Grup modifier ditambahkan')
      onDone()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal menyimpan'),
  })

  function updateOption(key: number, patch: Partial<OptionRow>) {
    setOptions((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const min = Number(minSelect)
    const max = Number(maxSelect)
    if (!name.trim()) return setError('Nama grup wajib diisi')
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 1) {
      return setError('Minimal harus 0 atau lebih, maksimal harus 1 atau lebih')
    }
    if (min > max) return setError('Minimal pilihan tidak boleh melebihi maksimal')
    if (options.length === 0) return setError('Tambahkan minimal satu pilihan')
    if (min > options.length) return setError('Minimal pilihan lebih banyak daripada jumlah pilihan yang ada')

    for (const o of options) {
      const price = Number(o.price || 0)
      if (!o.name.trim()) return setError('Nama pilihan tidak boleh kosong')
      if (!Number.isInteger(price) || price < 0) return setError('Harga tambahan harus angka bulat, minimal 0')
    }

    mutation.mutate({
      name: name.trim(),
      minSelect: min,
      maxSelect: max,
      options: options.map((o) => ({ id: o.id, name: o.name.trim(), price: Number(o.price || 0) })),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={labelClass} htmlFor="g-name">Nama grup</label>
        <input id="g-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Level Gula" autoFocus />
      </div>

      <div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="g-min">Minimal pilihan</label>
            <input id="g-min" type="number" min={0} className={inputClass} value={minSelect} onChange={(e) => setMinSelect(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="g-max">Maksimal pilihan</label>
            <input id="g-max" type="number" min={1} className={inputClass} value={maxSelect} onChange={(e) => setMaxSelect(e.target.value)} />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Minimal 0 = opsional, minimal 1 = wajib dipilih. Maksimal 1 = pilih satu saja, lebih dari 1 = boleh memilih banyak.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Pilihan</p>
          <button
            type="button"
            onClick={() => setOptions((rows) => [...rows, { key: rowKey++, name: '', price: '0' }])}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-amber-100 hover:text-amber-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-amber-500/20"
          >
            <Plus className="h-4 w-4" />
            Pilihan
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {options.map((o) => (
            <div key={o.key} className="flex items-center gap-2">
              <input className={inputClass} placeholder="Nama (mis. Boba)" value={o.name} onChange={(e) => updateOption(o.key, { name: e.target.value })} />
              <input type="number" inputMode="numeric" min={0} step={500} className={`${inputClass} max-w-32`} placeholder="+ harga" value={o.price} onChange={(e) => updateOption(o.key, { price: e.target.value })} />
              <button
                type="button"
                aria-label="Hapus pilihan"
                onClick={() => setOptions((rows) => rows.filter((r) => r.key !== o.key))}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button type="button" onClick={onDone} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          Kembali
        </button>
        <button type="submit" disabled={mutation.isPending} className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:opacity-70">
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Simpan
        </button>
      </div>
    </form>
  )
}

export default function ModifierModal({
  groups,
  canCreate,
  canEdit,
  onClose,
}: {
  groups: ModifierGroup[]
  canCreate: boolean
  canEdit: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)
  const [editing, setEditing] = useState<ModifierGroup | 'new' | null>(null)

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateModifierGroup(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifier-groups'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e) => push('error', e instanceof Error ? e.message : 'Gagal mengubah status'),
  })

  if (editing) {
    return (
      <Modal title={editing === 'new' ? 'Grup Modifier Baru' : 'Ubah Grup Modifier'} onClose={onClose} wide>
        <GroupForm group={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
      </Modal>
    )
  }

  return (
    <Modal title="Kelola Modifier" onClose={onClose} wide>
      {canCreate && (
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Grup Baru
        </button>
      )}

      <ul className="mt-4 space-y-3">
        {groups.map((g) => (
          <li key={g.id} className={`rounded-2xl border border-slate-200 p-4 dark:border-slate-800 ${g.isActive ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 dark:text-white">{g.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {ruleLabel(g.minSelect, g.maxSelect)} · dipakai {g._count.products} produk
                </p>
              </div>
              {canEdit && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setEditing(g)}
                    aria-label={`Ubah ${g.name}`}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <Toggle
                    checked={g.isActive}
                    disabled={toggleMutation.isPending}
                    onChange={(value) => toggleMutation.mutate({ id: g.id, isActive: value })}
                    label={`Grup ${g.name} aktif`}
                  />
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {g.options.map((o) => (
                <span key={o.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {o.name}
                  {o.price > 0 ? ` +${formatRupiah(o.price)}` : ''}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {groups.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Belum ada grup modifier.</p>
      )}
    </Modal>
  )
}