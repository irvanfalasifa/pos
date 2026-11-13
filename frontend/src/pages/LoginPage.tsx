import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Coffee, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuthStore, homePathFor } from '../stores/authStore'

const DEMO_PASSWORD = 'Pos12345!'
const demoAccounts = [
  { label: 'Owner', email: 'owner@pos.local' },
  { label: 'Kasir', email: 'kasir@pos.local' },
  { label: 'Dapur', email: 'dapur@pos.local' },
]

export default function LoginPage() {
  const { user, login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={homePathFor(user)} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      {/* Panel kiri: branding */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-amber-500 p-12 text-white">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-orange-600/30" />

        <div className="relative flex items-center gap-3">
          <div className="rounded-xl bg-white/20 p-2">
            <Coffee className="h-7 w-7" />
          </div>
          <span className="text-xl font-bold">POS Restoran</span>
        </div>

        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight">
            Pesanan, pembayaran,
            <br />
            dan dapur dalam satu tempat.
          </h1>
          <p className="mt-4 max-w-md text-white/85">
            Masuk untuk membuka ruang kerja sesuai peran Anda.
          </p>
        </div>

        <p className="relative text-sm text-white/70">© 2026 POS Restoran</p>
      </div>

      {/* Panel kanan: form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Coffee className="h-7 w-7 text-amber-600" />
            <span className="text-xl font-bold text-slate-800">POS Restoran</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-800">Selamat datang</h2>
          <p className="mt-1 text-slate-500">Silakan masuk ke akun Anda</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-12 text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:text-slate-600"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="h-5 w-5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
              {submitting ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          {/* Bantuan pengembangan: hapus sebelum aplikasi dipakai sungguhan */}
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Akun demo (klik untuk mengisi)
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email)
                    setPassword(DEMO_PASSWORD)
                  }}
                  className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-amber-100 hover:text-amber-800"
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}