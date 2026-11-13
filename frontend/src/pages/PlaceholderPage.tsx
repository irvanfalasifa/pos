import { Hammer } from 'lucide-react'

export default function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{title}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{description}</p>

      <div className="mt-8 flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
        <div className="rounded-2xl bg-amber-100 p-4 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
          <Hammer className="h-8 w-8" />
        </div>
        <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">Sedang dalam pengembangan</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Halaman ini akan dibangun pada sesi berikutnya.
        </p>
      </div>
    </div>
  )
}