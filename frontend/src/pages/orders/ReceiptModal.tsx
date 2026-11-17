import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Printer, Sparkles } from 'lucide-react'
import Modal from '../../components/Modal'
import Receipt from '../../components/Receipt'
import { updateTableStatus } from '../../services/pos'
import type { Order, PosConfig } from '../../services/pos'
import { useAuthStore } from '../../stores/authStore'
import { useToastStore } from '../../stores/toastStore'

export default function ReceiptModal({
  order,
  config,
  isCopy,
  onClose,
}: {
  order: Order
  config: PosConfig | undefined
  isCopy: boolean
  onClose: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const push = useToastStore((s) => s.push)
  const queryClient = useQueryClient()

  const canMarkTable =
    !!user?.permissions.includes('order.create') &&
    order.type === 'DINE_IN' &&
    !!order.table &&
    order.paymentStatus === 'PAID'

  const cleaningMutation = useMutation({
    mutationFn: () => updateTableStatus(order.table!.id, 'CLEANING'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] })
      push('success', `Meja ${order.table?.name} ditandai dibersihkan`)
      onClose()
    },
    onError: (e) => push('error', e instanceof Error ? e.message : 'Gagal mengubah status meja'),
  })

  return (
    <>
      <Modal title={order.paymentStatus === 'PAID' ? 'Struk' : 'Tagihan'} onClose={onClose}>
        <div className="max-h-96 overflow-y-auto rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
          <Receipt order={order} config={config} isCopy={isCopy} />
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Untuk printer thermal, pilih printer dan ukuran kertas 80 mm di jendela cetak.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98]"
          >
            <Printer className="h-4 w-4" />
            Cetak
          </button>

          {canMarkTable && (
            <button
              onClick={() => cleaningMutation.mutate()}
              disabled={cleaningMutation.isPending}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Sparkles className="h-4 w-4" />
              Tandai meja dibersihkan
            </button>
          )}

          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Tutup
          </button>
        </div>
      </Modal>

      {/* Salinan khusus cetak: tampil di luar aplikasi saat jendela cetak dibuka */}
      {createPortal(
        <div className="hidden print:block">
          <Receipt order={order} config={config} isCopy={isCopy} />
        </div>,
        document.body,
      )}
    </>
  )
}