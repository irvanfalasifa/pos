import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Check, X } from 'lucide-react'
import Modal from '../../components/Modal'
import Toggle from '../../components/Toggle'
import { createCategory, updateCategory } from '../../services/products'
import type { Category } from '../../services/products'
import { useToastStore } from '../../stores/toastStore'

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

function CategoryRow({ category, canEdit }: { category: Category; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)

  const mutation = useMutation({
    mutationFn: (data: { name?: string; isActive?: boolean }) => updateCategory(category.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setEditing(false)
      push('success', 'Kategori diperbarui')
    },
    onError: (e) => push('error', e instanceof Error ? e.message : 'Gagal memperbarui kategori'),
  })

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            className={inputClass}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') mutation.mutate({ name })
              if (e.key === 'Escape') {
                setName(category.name)
                setEditing(false)
              }
            }}
          />
        ) : (
          <>
            <p className={`truncate font-medium ${category.isActive ? 'text-slate-800 dark:text-white' : 'text-slate-400 line-through'}`}>
              {category.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{category._count.products} produk</p>
          </>
        )}
      </div>

      {canEdit && (
        <>
          {editing ? (
            <>
              <button onClick={() => mutation.mutate({ name })} aria-label="Simpan nama" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setName(category.name)
                  setEditing(false)
                }}
                aria-label="Batal"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} aria-label="Ubah nama" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <Toggle
            checked={category.isActive}
            onChange={(value) => mutation.mutate({ isActive: value })}
            disabled={mutation.isPending}
            label={`Kategori ${category.name} aktif`}
          />
        </>
      )}
    </li>
  )
}

export default function CategoryModal({
  categories,
  canCreate,
  canEdit,
  onClose,
}: {
  categories: Category[]
  canCreate: boolean
  canEdit: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)
  const [newName, setNewName] = useState('')

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setNewName('')
      push('success', 'Kategori ditambahkan')
    },
    onError: (e) => push('error', e instanceof Error ? e.message : 'Gagal menambah kategori'),
  })

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (newName.trim()) createMutation.mutate(newName.trim())
  }

  return (
    <Modal title="Kelola Kategori" onClose={onClose}>
      {canCreate && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input className={inputClass} placeholder="Nama kategori baru" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button type="submit" disabled={createMutation.isPending} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-70">
            <Plus className="h-4 w-4" />
            Tambah
          </button>
        </form>
      )}

      <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} canEdit={canEdit} />
        ))}
      </ul>

      {categories.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Belum ada kategori.</p>}
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Kategori yang dinonaktifkan tidak muncul saat memilih kategori produk baru.
      </p>
    </Modal>
  )
}