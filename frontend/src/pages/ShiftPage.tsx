import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, Loader2, LockKeyhole, Wallet } from 'lucide-react'
import Modal from '../components/Modal'
import ApprovalFields from '../components/ApprovalFields'
import ShiftSummaryCards from './shifts/ShiftSummaryCards'
import MovementList from './shifts/MovementList'
import { differenceInfo } from '../lib/shiftFormat'
import { addMovement, closeShift, getCurrentShift, openShift } from '../services/shifts'
import type { ShiftDetail } from '../services/shifts'
import type { Approver } from '../services/pos'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'
import { formatRupiah } from '../lib/format'

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300'

const timeFormat: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }

/* ---------- Kas masuk / keluar ---------- */

function MovementModal({ type, onClose }: { type: 'IN' | 'OUT'; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)

  const needsApproval = type === 'OUT' && !user?.permissions.includes('shift.review')

  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [approver, setApprover] = useState<Approver>({ email: '', password: '' })
  const [error, setError] = useState('')

  const amountNum = Number(amount) || 0

  const mutation = useMutation({
    mutationFn: () =>
      addMovement({ type, amount: amountNum, reason: reason.trim(), approver: needsApproval ? approver : null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-current'] })
      push('success', type === 'IN' ? 'Kas masuk dicatat' : 'Kas keluar dicatat')
      onClose()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal mencatat kas'),
  })

  let problem: string | null = null
  if (!Number.isInteger(amountNum) || amountNum <= 0) problem = 'Isi jumlah'
  else if (reason.trim().length < 3) problem = 'Isi alasan (minimal 3 huruf)'
  else if (needsApproval && (!approver.email.trim() || !approver.password)) problem = 'Isi email dan password pemberi otorisasi'

  return (
    <Modal title={type === 'IN' ? 'Kas masuk' : 'Kas keluar'} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <label className={labelClass} htmlFor="mv-amount">Jumlah (Rp)</label>
          <input
            id="mv-amount"
            type="number"
            inputMode="numeric"
            min={0}
            autoFocus
            className={fieldClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="mv-reason">Alasan</label>
          <input
            id="mv-reason"
            className={fieldClass}
            maxLength={200}
            placeholder={type === 'IN' ? 'Contoh: tambahan uang kembalian' : 'Contoh: beli es batu'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {needsApproval && <ApprovalFields value={approver} onChange={setApprover} />}

        {(error || problem) && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error || problem}</p>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Batal
          </button>
          <button
            disabled={!!problem || mutation.isPending}
            onClick={() => {
              setError('')
              mutation.mutate()
            }}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Catat
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Tutup shift ---------- */

function CloseModal({ detail, onClose }: { detail: ShiftDetail; onClose: () => void }) {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)

  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<ShiftDetail | null>(null)

  const expected = detail.summary.expectedCash
  const countedNum = Number(counted)
  const hasCount = counted !== '' && Number.isInteger(countedNum) && countedNum >= 0
  const difference = hasCount ? countedNum - expected : null

  const mutation = useMutation({
    mutationFn: () => closeShift({ closingCash: countedNum, note: note.trim() || null }),
    onSuccess: (closed) => {
      queryClient.invalidateQueries({ queryKey: ['shift-current'] })
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
      push('success', 'Shift ditutup')
      setResult(closed)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal menutup shift'),
  })

  let problem: string | null = null
  if (!hasCount) problem = 'Isi jumlah uang fisik di laci'
  else if (difference !== 0 && note.trim().length < 3) problem = 'Ada selisih. Isi catatan penjelasan'

  if (result) {
    const info = differenceInfo(result.shift.cashDifference)
    return (
      <Modal title="Shift ditutup" onClose={onClose} wide>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Uang fisik dihitung</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{formatRupiah(result.shift.closingCash ?? 0)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${info.className}`}>{info.label}</span>
          </div>
          {result.shift.needsReview && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              Ada selisih kas. Shift ini menunggu tinjauan manajer.
            </p>
          )}
          <ShiftSummaryCards summary={result.summary} />
          <button onClick={onClose} className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 active:scale-[0.98]">
            Selesai
          </button>
        </div>
      </Modal>
    )
  }

  const info = differenceInfo(difference)

  return (
    <Modal title="Tutup shift" onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
          <p className="text-sm text-slate-500 dark:text-slate-400">Kas seharusnya di laci</p>
          <p className="text-xl font-bold text-slate-800 dark:text-white">{formatRupiah(expected)}</p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="cl-counted">
              Uang fisik di laci (Rp)
            </label>
            <button
              type="button"
              onClick={() => setCounted(String(expected))}
              className="text-xs font-medium text-amber-600 hover:underline dark:text-amber-400"
            >
              Sama dengan sistem
            </button>
          </div>
          <input
            id="cl-counted"
            type="number"
            inputMode="numeric"
            min={0}
            autoFocus
            className={fieldClass}
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
          />
          {difference !== null && (
            <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold ${info.className}`}>{info.label}</span>
          )}
        </div>

        {difference !== null && difference !== 0 && (
          <div>
            <label className={labelClass} htmlFor="cl-note">Catatan penjelasan selisih</label>
            <textarea
              id="cl-note"
              rows={2}
              maxLength={200}
              className={fieldClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        )}

        {(error || problem) && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error || problem}</p>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Batal
          </button>
          <button
            disabled={!!problem || mutation.isPending}
            onClick={() => {
              setError('')
              mutation.mutate()
            }}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Tutup Shift
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------- Halaman ---------- */

export default function ShiftPage() {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)

  const [openingCash, setOpeningCash] = useState('')
  const [modal, setModal] = useState<'IN' | 'OUT' | 'CLOSE' | null>(null)
  const [error, setError] = useState('')

  const query = useQuery({ queryKey: ['shift-current'], queryFn: getCurrentShift, refetchInterval: 15_000 })

  const openMutation = useMutation({
    mutationFn: (value: number) => openShift(value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-current'] })
      push('success', 'Shift dibuka')
      setOpeningCash('')
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal membuka shift'),
  })

  function handleOpen(e: FormEvent) {
    e.preventDefault()
    setError('')
    const value = Number(openingCash)
    if (openingCash === '' || !Number.isInteger(value) || value < 0) return setError('Isi modal awal (boleh 0)')
    openMutation.mutate(value)
  }

  const data = query.data
  const shift = data?.shift ?? null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Shift</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Buka shift untuk menerima pembayaran, dan tutup saat selesai bertugas.</p>
      </div>

      {query.isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      ) : query.isError ? (
        <p className="p-10 text-center text-sm text-red-600">
          {query.error instanceof Error ? query.error.message : 'Gagal memuat shift'}
        </p>
      ) : !shift || !data?.summary ? (
        <form onSubmit={handleOpen} className="mx-auto max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-2.5 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 dark:text-white">Belum ada shift aktif</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Hitung uang di laci, lalu masukkan sebagai modal awal.</p>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="op-cash">Modal awal (Rp)</label>
            <input
              id="op-cash"
              type="number"
              inputMode="numeric"
              min={0}
              autoFocus
              className={fieldClass}
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[0, 100000, 200000, 500000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setOpeningCash(String(v))}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-amber-100 hover:text-amber-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-amber-500/20"
                >
                  {formatRupiah(v)}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={openMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:opacity-70"
          >
            {openMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Buka Shift
          </button>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <div>
              <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
                Shift aktif
              </p>
              <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80">
                Dibuka {new Date(shift.openedAt).toLocaleString('id-ID', timeFormat)} oleh {shift.user.name}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setModal('IN')} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-emerald-50 dark:bg-slate-800 dark:text-slate-200">
                <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                Kas masuk
              </button>
              <button onClick={() => setModal('OUT')} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-rose-50 dark:bg-slate-800 dark:text-slate-200">
                <ArrowUpCircle className="h-4 w-4 text-rose-600" />
                Kas keluar
              </button>
              <button onClick={() => setModal('CLOSE')} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-[0.98]">
                <LockKeyhole className="h-4 w-4" />
                Tutup shift
              </button>
            </div>
          </div>

          <ShiftSummaryCards summary={data.summary} />

          <MovementList movements={data.movements} />
        </>
      )}

      {(modal === 'IN' || modal === 'OUT') && <MovementModal type={modal} onClose={() => setModal(null)} />}
      {modal === 'CLOSE' && data?.shift && data.summary && (
        <CloseModal detail={{ shift: data.shift, summary: data.summary, movements: data.movements }} onClose={() => setModal(null)} />
      )}
    </div>
  )
}