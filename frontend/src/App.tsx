import { Coffee } from 'lucide-react'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center transition hover:shadow-xl">
        <Coffee className="mx-auto h-12 w-12 text-amber-600" />
        <h1 className="mt-4 text-2xl font-bold text-slate-800">POS Restoran</h1>
        <p className="mt-1 text-slate-500">Frontend berhasil berjalan 🎉</p>
      </div>
    </div>
  )
}