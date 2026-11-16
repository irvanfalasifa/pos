import { Check, AlertCircle, X } from 'lucide-react'
import { useToastStore } from '../stores/toastStore'

export default function ToastHost() {
  const { toasts, remove } = useToastStore()

  return (
    <div className="fixed bottom-4 right-4 z-60 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {t.type === 'success' ? <Check className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span className="flex-1">{t.text}</span>
          <button onClick={() => remove(t.id)} aria-label="Tutup" className="opacity-80 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}