import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Modal from '../../components/Modal'
import ApprovalFields from '../../components/ApprovalFields'
import { cancelOrder } from '../../services/pos'
import type { Approver, Order } from '../../services/pos'
import { useAuthStore } from '../../stores/authStore'
import { useToastStore } from '../../stores/toastStore'
import { formatRupiah } from '../../lib/format'

const presets = ['Pelanggan membatalkan', 'Salah input pesanan', 'Menu habis', 'Terlalu lama menunggu']

export default function CancelModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const push = useToastStore((s) => s.push)
  const queryClient = useQueryClient()

  const needsApproval = !user?.permissions.includes('order.cancel')
  const netPaid =
    order.payments.reduce((s, p) => s + p.amount, 0) - order.refunds.reduce((s, r) => s + r.amount, 0)

  const [reason, setReason] = useState('')
  const [approver, setApprover] = useState<Approver>({ email: '', password: '' })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => cancelOrder(order.id, { reason: reason.trim(), approver: needsApproval ? approver : null }),
    onSuccess: (result) => {
      for (const key of ['orders', 'kds', 'tables']) queryClient.invalidateQueries({ queryKey: [key] })
      push(
        'success',
        result.refunded > 0
          ? `Pesanan dibatalkan. Kembalikan ${formatRupiah(result.refunded)} kepada pelanggan`
          : 'Pesanan dibatalkan',
      )
      onClose()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal membatalkan pesanan'),
  })

  let problem: string | null = null
  if (reason.trim().length < 3) problem = 'Isi alasan pembatalan'
  else if (needsApproval && (!approver.email.trim() || !approver.password)) problem = 'Isi email dan password pemberi otorisasi'

  return (
    <Modal title={`Batalkan ${order.number}`} onClose={onClose}>
      <div className="space-y-5">
        {(order.status === 'PREPARING' || order.status === 'READY') && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            Dapur sudah menyiapkan pesanan ini. Makanan yang telanjur dibuat tidak bisa dikembalikan.
          </p>
        )}

        {netPaid > 0 && (
          <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">
            Pembayaran sebesar <strong>{formatRupiah(netPaid)}</strong> akan dicatat sebagai refund penuh dan harus
            dikembalikan kepada pelanggan.
          </p>
        )}

        <div>
          <label htmlFor="cancel-reason" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Alasan pembatalan
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
            id="cancel-reason"
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
            Kembali
          </button>
          <button
            type="button"
            disabled={!!problem || mutation.isPending}
            onClick={() => {
              setError('')
              mutation.mutate()
            }}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Batalkan Pesanan
          </button>
        </div>
      </div>
    </Modal>
  )
}