import type { OrderStatus, OrderType, PaymentMethod, PaymentStatus, TableStatus } from '../services/pos'

export const orderTypeLabel: Record<OrderType, string> = {
  DINE_IN: 'Dine In',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
  QR_TABLE: 'QR Meja',
}

export const orderStatusInfo: Record<OrderStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Draf', className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  PLACED: { label: 'Dikirim', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  CONFIRMED: { label: 'Dikonfirmasi', className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400' },
  PREPARING: { label: 'Disiapkan', className: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400' },
  READY: { label: 'Siap', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
  SERVED: { label: 'Disajikan', className: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400' },
  COMPLETED: { label: 'Selesai', className: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
  CANCELLED: { label: 'Dibatalkan', className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
}

export const paymentStatusInfo: Record<PaymentStatus, { label: string; className: string }> = {
  UNPAID: { label: 'Belum bayar', className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400' },
  PARTIALLY_PAID: { label: 'Dibayar sebagian', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  PAID: { label: 'Lunas', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
  FAILED: { label: 'Gagal', className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
  PARTIALLY_REFUNDED: { label: 'Refund sebagian', className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400' },
  REFUNDED: { label: 'Refund', className: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
}

export const tableStatusInfo: Record<TableStatus, { label: string; chip: string; border: string }> = {
  AVAILABLE: {
    label: 'Tersedia',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-500/40',
  },
  OCCUPIED: {
    label: 'Terisi',
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    border: 'border-rose-300 dark:border-rose-500/40',
  },
  RESERVED: {
    label: 'Dipesan',
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
    border: 'border-sky-300 dark:border-sky-500/40',
  },
  CLEANING: {
    label: 'Dibersihkan',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-500/40',
  },
}

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  CASH: 'Tunai',
  QRIS: 'QRIS',
  CARD: 'Kartu',
  EWALLET: 'E-Wallet',
  TRANSFER: 'Transfer',
}