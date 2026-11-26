import { formatRupiah } from './format'

export function differenceInfo(difference: number | null): { label: string; className: string } {
  if (difference === null) {
    return { label: 'Belum dihitung', className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' }
  }
  if (difference === 0) {
    return { label: 'Pas', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' }
  }
  if (difference > 0) {
    return {
      label: `Lebih ${formatRupiah(difference)}`,
      className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
    }
  }
  return {
    label: `Kurang ${formatRupiah(Math.abs(difference))}`,
    className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  }
}