import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Banknote, CreditCard, Landmark, Loader2, Plus, QrCode, Trash2, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Modal from '../../components/Modal'
import { payOrder } from '../../services/pos'
import type { Order, PaymentMethod } from '../../services/pos'
import { useToastStore } from '../../stores/toastStore'
import { formatRupiah } from '../../lib/format'
import { paymentMethodLabel } from '../../lib/labels'

const methods: { value: PaymentMethod; icon: LucideIcon }[] = [
  { value: 'CASH', icon: Banknote },
  { value: 'QRIS', icon: QrCode },
  { value: 'CARD', icon: CreditCard },
  { value: 'EWALLET', icon: Wallet },
  { value: 'TRANSFER', icon: Landmark },
]

// auto = true berarti jumlahnya otomatis sisa tagihan (hanya berlaku untuk baris terakhir)
type Row = {
  key: number
  method: PaymentMethod
  amount: string
  tendered: string
  reference: string
  auto: boolean
}

let rowKey = 0

function newRow(method: PaymentMethod): Row {
  return { key: rowKey++, method, amount: '', tendered: '', reference: '', auto: true }
}

function cashSuggestions(amount: number): number[] {
  if (amount <= 0) return []
  const set = new Set<number>([amount])
  for (const step of [5000, 10000, 50000, 100000]) set.add(Math.ceil(amount / step) * step)
  return [...set].sort((a, b) => a - b).slice(0, 4)
}

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

export default function PaymentModal({
  order,
  onPaid,
  onClose,
}: {
  order: Order
  onPaid: (order: Order) => void
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)

  const paid = order.payments.reduce((sum, p) => sum + p.amount, 0)
  const balance = order.total - paid

  // Kunci unik untuk satu percobaan bayar, supaya pengiriman ganda tidak mencatat dua kali
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [rows, setRows] = useState<Row[]>([newRow('CASH')])
  const [error, setError] = useState('')

  // Hitung jumlah tiap baris. Baris terakhir yang "auto" = sisa tagihan setelah baris lain.
  const lastIndex = rows.length - 1
  const manualSum = rows.reduce(
    (s, r, i) => (r.auto && i === lastIndex ? s : s + (Number(r.amount) || 0)),
    0,
  )
  const parsed = rows.map((r, i) => {
    const isAuto = r.auto && i === lastIndex
    return {
      ...r,
      isAuto,
      amountNum: isAuto ? Math.max(0, balance - manualSum) : Number(r.amount) || 0,
      tenderedNum: Number(r.tendered) || 0,
    }
  })

  const sum = parsed.reduce((s, r) => s + r.amountNum, 0)
  const changeTotal = parsed.reduce(
    (s, r) => (r.method === 'CASH' ? s + Math.max(0, r.tenderedNum - r.amountNum) : s),
    0,
  )

  let problem: string | null = null
  const emptyIndex = parsed.findIndex((r) => !Number.isInteger(r.amountNum) || r.amountNum <= 0)
  const shortIndex = parsed.findIndex((r) => r.method === 'CASH' && r.tenderedNum < r.amountNum)

  if (emptyIndex >= 0) {
    problem =
      parsed.length > 1
        ? `Isi jumlah pembayaran di baris ${emptyIndex + 1}`
        : 'Isi jumlah pembayaran'
  } else if (sum > balance) {
    problem = `Total pembayaran melebihi sisa tagihan sebesar ${formatRupiah(sum - balance)}. Kecilkan "Jumlah dibayar" di salah satu baris.`
  } else if (shortIndex >= 0) {
    problem = `Uang diterima di baris ${shortIndex + 1} kurang dari jumlah tunai`
  }

  const mutation = useMutation({
    mutationFn: () =>
      payOrder(order.id, {
        idempotencyKey,
        payments: parsed.map((r) => ({
          method: r.method,
          amount: r.amountNum,
          tendered: r.method === 'CASH' ? r.tenderedNum : null,
          reference: r.method === 'CASH' ? null : r.reference.trim() || null,
        })),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      push('success', updated.paymentStatus === 'PAID' ? 'Pembayaran lunas' : 'Pembayaran sebagian dicatat')
      onPaid(updated)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal mencatat pembayaran'),
  })

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((list) => {
      const used = new Set(list.map((r) => r.method))
      const method = methods.map((m) => m.value).find((m) => !used.has(m)) ?? 'CARD'

      // Baris sebelumnya tidak lagi memegang seluruh tagihan: kosongkan agar diisi bagiannya
      const frozen = list.map((r, i) =>
        i === list.length - 1 && r.auto ? { ...r, auto: false, amount: '' } : r,
      )
      return [...frozen, newRow(method)]
    })
  }

  function removeRow(key: number) {
    setRows((list) => {
      const next = list.filter((r) => r.key !== key)
      // Baris terakhir kembali otomatis menampung sisa tagihan
      return next.map((r, i) => (i === next.length - 1 ? { ...r, auto: true } : r))
    })
  }

  return (
    <Modal title={`Pembayaran ${order.number}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
          <div>
            <p className="text-slate-500 dark:text-slate-400">Total tagihan</p>
            <p className="text-lg font-bold text-slate-800 dark:text-white">{formatRupiah(order.total)}</p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400">Sisa yang harus dibayar</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatRupiah(balance)}</p>
            {paid > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">Sudah dibayar {formatRupiah(paid)}</p>}
          </div>
        </div>

        {rows.length > 1 && (
          <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">
            Isi <strong>Jumlah dibayar</strong> untuk tiap metode. Baris terakhir otomatis terisi dengan sisa tagihan.
          </p>
        )}

        <div className="space-y-4">
          {parsed.map((r, index) => (
            <div key={r.key} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Pembayaran {index + 1}</p>
                {rows.length > 1 && (
                  <button
                    type="button"
                    aria-label="Hapus baris pembayaran"
                    onClick={() => removeRow(r.key)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {methods.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => updateRow(r.key, { method: m.value })}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 px-1 py-2 text-xs font-medium transition active:scale-[0.97] ${
                      r.method === m.value
                        ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                        : 'border-slate-200 text-slate-600 hover:border-amber-300 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <m.icon className="h-5 w-5" />
                    {paymentMethodLabel[m.value]}
                  </button>
                ))}
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Jumlah dibayar (Rp)</label>
                    {r.isAuto ? (
                      <span className="text-xs text-slate-500 dark:text-slate-400">Otomatis: sisa tagihan</span>
                    ) : (
                      index === lastIndex && (
                        <button
                          type="button"
                          onClick={() => updateRow(r.key, { auto: true })}
                          className="text-xs font-medium text-amber-600 hover:underline dark:text-amber-400"
                        >
                          Isi sisa tagihan
                        </button>
                      )
                    )}
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="Isi jumlah"
                    className={fieldClass}
                    value={r.isAuto ? String(r.amountNum) : r.amount}
                    onChange={(e) => updateRow(r.key, { amount: e.target.value, auto: false })}
                  />
                </div>

                {r.method === 'CASH' ? (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Uang diterima dari pelanggan (Rp)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className={fieldClass}
                      value={r.tendered}
                      onChange={(e) => updateRow(r.key, { tendered: e.target.value })}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {cashSuggestions(r.amountNum).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateRow(r.key, { tendered: String(value) })}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-amber-100 hover:text-amber-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-amber-500/20"
                        >
                          {value === r.amountNum ? 'Uang pas' : formatRupiah(value)}
                        </button>
                      ))}
                    </div>

                    {r.tenderedNum > 0 && r.tenderedNum < r.amountNum && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                        Uang diterima kurang {formatRupiah(r.amountNum - r.tenderedNum)} dari jumlah dibayar. Untuk
                        membagi pembayaran ke metode lain, kecilkan “Jumlah dibayar” di atas, bukan “Uang diterima”.
                      </p>
                    )}
                    {r.amountNum > 0 && r.tenderedNum >= r.amountNum && (
                      <p className="mt-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        Kembalian {formatRupiah(r.tenderedNum - r.amountNum)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Nomor referensi (opsional)
                    </label>
                    <input
                      className={fieldClass}
                      maxLength={60}
                      placeholder="Contoh: 4 digit akhir kartu atau ID transaksi"
                      value={r.reference}
                      onChange={(e) => updateRow(r.key, { reference: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= 5}
          className="flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:underline disabled:opacity-50 dark:text-amber-400"
        >
          <Plus className="h-4 w-4" />
          Tambah metode pembayaran (split)
        </button>

        <div className="space-y-1 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Dibayar sekarang</span>
            <span className="font-semibold">{formatRupiah(sum)}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Sisa setelah ini</span>
            <span className="font-semibold">{formatRupiah(Math.max(0, balance - sum))}</span>
          </div>
          {changeTotal > 0 && (
            <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
              <span>Total kembalian</span>
              <span>{formatRupiah(changeTotal)}</span>
            </div>
          )}
        </div>

        {(error || problem) && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {error || problem}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!!problem || mutation.isPending}
            onClick={() => {
              setError('')
              mutation.mutate()
            }}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {sum < balance ? 'Bayar sebagian' : 'Bayar'} · {formatRupiah(sum)}
          </button>
        </div>
      </div>
    </Modal>
  )
}