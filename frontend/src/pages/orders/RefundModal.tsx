import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Modal from '../../components/Modal'
import ApprovalFields from '../../components/ApprovalFields'
import { refundOrder } from '../../services/pos'
import type { Approver, Order } from '../../services/pos'
import { useAuthStore } from '../../stores/authStore'
import { useToastStore } from '../../stores/toastStore'
import { formatRupiah } from '../../lib/format'
import { paymentMethodLabel } from '../../lib/labels'

const presets = ['Makanan tidak sesuai', 'Pelanggan komplain', 'Salah hitung', 'Kelebihan bayar']

export default function RefundModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const push = useToastStore((s) => s.push)
  const queryClient = useQueryClient()

  const needsApproval = !user?.permissions.includes('payment.refund')

  const rows = order.payments
    .map((p) => {
      const refunded = order.refunds.filter((r) => r.paymentId === p.id).reduce((s, r) => s + r.amount, 0)
      return { payment: p, refunded, remaining: p.amount - refunded }
    })
    .filter((r) => r.remaining > 0)

  const [amounts, setAmounts] = useState<Record<number, string>>(
    Object.fromEntries(rows.map((r) => [r.payment.id, String(r.remaining)])),
  )
  const [reason, setReason] = useState('')
  const [approver, setApprover] = useState<Approver>({ email: '', password: '' })
  const [error, setError] = useState('')

  const entries = rows.map((r) => ({ ...r, amount: Number(amounts[r.payment.id]) || 0 }))
  const total = entries.reduce((s, r) => s + r.amount, 0)

  const mutation = useMutation({
    mutationFn: () =>
      refundOrder(order.id, {
        reason: reason.trim(),
        refunds: entries.filter((r) => r.amount > 0).map((r) => ({ paymentId: r.payment.id, amount: r.amount })),
        approver: needsApproval ? approver : null,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      push('success', `Refund ${formatRupiah(result.total)} dicatat. Kembalikan kepada pelanggan`)
      onClose()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal memproses refund'),
  })

  let problem: string | null = null
  if (entries.some((r) => !Number.isInteger(r.amount) || r.amount < 0 || r.amount > r.remaining)) {
    problem = 'Jumlah refund tidak boleh melebihi sisa yang dapat dikembalikan'
  } else if (total <= 0) {
    problem = 'Isi jumlah refund'
  } else if (reason.trim().length < 3) {
    problem = 'Isi alasan refund'
  } else if (needsApproval && (!approver.email.trim() || !approver.password)) {
    problem = 'Isi email dan password pemberi otorisasi'
  }

  return (
    <Modal title={`Refund ${order.number}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="space-y-3">
          {entries.map((r) => (
            <div key={r.payment.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-800 dark:text-white">
                  {paymentMethodLabel[r.payment.method]} · dibayar {formatRupiah(r.payment.amount)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Dapat direfund {formatRupiah(r.remaining)}
                  {r.refunded > 0 ? ` (sudah direfund ${formatRupiah(r.refunded)})` : ''}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={`Jumlah refund ${paymentMethodLabel[r.payment.method]}`}
                  value={amounts[r.payment.id] ?? ''}
                  onChange={(e) => setAmounts((a) => ({ ...a, [r.payment.id]: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setAmounts((a) => ({ ...a, [r.payment.id]: String(r.remaining) }))}
                  className="shrink-0 text-xs font-medium text-amber-600 hover:underline dark:text-amber-400"
                >
                  Penuh
                </button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <label htmlFor="refund-reason" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Alasan refund
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setReason(p)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-amber-100 hover:text-amber-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-amber-500/20"
              >
                {p}
              </button>
            ))}
          </div>
          <textarea
            id="refund-reason"
            rows={2}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {needsApproval && <ApprovalFields value={approver} onChange={setApprover} />}

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
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Refund · {formatRupiah(total)}
          </button>
        </div>
      </div>
    </Modal>
  )
}