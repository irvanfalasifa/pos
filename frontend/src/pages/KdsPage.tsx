import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChefHat, Clock, Undo2, Volume2, VolumeX } from 'lucide-react'
import { getTickets, updateOrderStatus } from '../services/kds'
import type { Ticket } from '../services/kds'
import type { OrderStatus } from '../services/pos'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'
import { orderTypeLabel } from '../lib/labels'

// Batas durasi tunggu (menit). Bisa dijadikan pengaturan nanti.
const WARN_MINUTES = 10
const LATE_MINUTES = 15

const columns: { title: string; statuses: OrderStatus[]; head: string }[] = [
  { title: 'Baru', statuses: ['PLACED', 'CONFIRMED'], head: 'bg-amber-500' },
  { title: 'Disiapkan', statuses: ['PREPARING'], head: 'bg-violet-500' },
  { title: 'Siap', statuses: ['READY'], head: 'bg-emerald-500' },
]

function playBeep() {
  try {
    const ctx = new window.AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.15
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
    osc.onended = () => ctx.close()
  } catch {
    // browser menolak memutar suara: abaikan
  }
}

function TicketCard({
  ticket,
  now,
  canKitchen,
  canServe,
  busy,
  onChange,
}: {
  ticket: Ticket
  now: number
  canKitchen: boolean
  canServe: boolean
  busy: boolean
  onChange: (status: OrderStatus) => void
}) {
  const minutes = Math.max(0, Math.floor((now - new Date(ticket.createdAt).getTime()) / 60000))
  const waiting = ticket.status !== 'READY'
  const late = waiting && minutes >= LATE_MINUTES
  const warn = waiting && !late && minutes >= WARN_MINUTES

  const border = late
    ? 'border-red-500'
    : warn
      ? 'border-amber-400'
      : 'border-slate-200 dark:border-slate-800'
  const timer = late
    ? 'animate-pulse bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
    : warn
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'

  const primary =
    'w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60'
  const secondary =
    'flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

  return (
    <article className={`rounded-2xl border-2 bg-white p-4 shadow-sm dark:bg-slate-900 ${border}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-800 dark:text-white">{ticket.number}</p>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {orderTypeLabel[ticket.type]}
            {ticket.table ? ` · Meja ${ticket.table.name}` : ''}
            {ticket.customerName ? ` · ${ticket.customerName}` : ''}
          </p>
        </div>
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${timer}`}>
          <Clock className="h-3.5 w-3.5" />
          {late ? `Terlambat · ${minutes} mnt` : `${minutes} mnt`}
        </span>
      </div>

      <ul className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        {ticket.items.map((item) => (
          <li key={item.id}>
            <p className="text-lg font-semibold leading-snug text-slate-800 dark:text-white">
              {item.quantity}× {item.productName}
              {item.variantName && (
                <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {item.variantName}
                </span>
              )}
            </p>
            {item.modifiers.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {item.modifiers.map((m) => (
                  <span
                    key={m.id}
                    className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                  >
                    {m.name}
                  </span>
                ))}
              </div>
            )}
            {item.note && (
              <p className="mt-1 rounded-lg bg-rose-50 px-2.5 py-1 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                Catatan: {item.note}
              </p>
            )}
          </li>
        ))}
      </ul>

      {ticket.note && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          Catatan pesanan: {ticket.note}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {(ticket.status === 'PLACED' || ticket.status === 'CONFIRMED') && canKitchen && (
          <button disabled={busy} onClick={() => onChange('PREPARING')} className={`${primary} bg-amber-500 hover:bg-amber-600`}>
            Mulai Siapkan
          </button>
        )}

        {ticket.status === 'PREPARING' && canKitchen && (
          <>
            <button disabled={busy} onClick={() => onChange('READY')} className={`${primary} bg-emerald-600 hover:bg-emerald-700`}>
              Tandai Siap
            </button>
            <button disabled={busy} onClick={() => onChange('PLACED')} className={`${secondary} w-full`}>
              <Undo2 className="h-3.5 w-3.5" />
              Kembalikan ke Baru
            </button>
          </>
        )}

        {ticket.status === 'READY' && (
          <>
            {canServe ? (
              <button disabled={busy} onClick={() => onChange('SERVED')} className={`${primary} bg-sky-600 hover:bg-sky-700`}>
                {ticket.type === 'DINE_IN' ? 'Sudah disajikan' : 'Sudah diambil'}
              </button>
            ) : (
              <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                Menunggu diantar
              </p>
            )}
            {canKitchen && (
              <button disabled={busy} onClick={() => onChange('PREPARING')} className={`${secondary} w-full`}>
                <Undo2 className="h-3.5 w-3.5" />
                Kembalikan ke Disiapkan
              </button>
            )}
          </>
        )}
      </div>
    </article>
  )
}

export default function KdsPage() {
  const user = useAuthStore((s) => s.user)
  const push = useToastStore((s) => s.push)
  const queryClient = useQueryClient()

  const canKitchen = !!user?.permissions.includes('kds.update')
  const canServe = !!user?.permissions.includes('order.create')

  const [tab, setTab] = useState<'active' | 'done'>('active')
  const [now, setNow] = useState(() => Date.now())
  const [soundOn, setSoundOn] = useState(false)
  const seen = useRef<Set<number> | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  // refetchInterval = jaring pengaman bila sinyal real-time terlewat
  const query = useQuery({
    queryKey: ['kds', tab],
    queryFn: () => getTickets(tab),
    refetchInterval: 30_000,
  })
  const tickets = query.data ?? []

  // Notifikasi tiket baru
  useEffect(() => {
    if (tab !== 'active' || !query.data) return

    const ids = new Set(query.data.map((t) => t.id))
    if (seen.current) {
      const previous = seen.current
      const fresh = query.data.filter((t) => !previous.has(t.id) && t.status === 'PLACED')
      if (fresh.length > 0) {
        push('success', `Tiket baru: ${fresh.map((t) => t.number).join(', ')}`)
        if (soundOn) playBeep()
      }
    }
    seen.current = ids
  }, [query.data, tab, soundOn, push])

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) => updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kds'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (e) => {
      push('error', e instanceof Error ? e.message : 'Gagal mengubah status')
      queryClient.invalidateQueries({ queryKey: ['kds'] })
    },
  })

  function toggleSound() {
    const next = !soundOn
    setSoundOn(next)
    if (next) playBeep()
  }

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition ${
      active
        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
        : 'border border-slate-200 bg-white text-slate-600 hover:bg-amber-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
    }`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Antrean Pesanan</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Tiket masuk secara real-time. Kuning setelah {WARN_MINUTES} menit, merah setelah {LATE_MINUTES} menit.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className={tabClass(tab === 'active')} onClick={() => setTab('active')}>
            Aktif
          </button>
          <button className={tabClass(tab === 'done')} onClick={() => setTab('done')}>
            Selesai hari ini
          </button>
          <button
            onClick={toggleSound}
            aria-label={soundOn ? 'Matikan suara notifikasi' : 'Aktifkan suara notifikasi'}
            title={soundOn ? 'Suara aktif' : 'Suara mati'}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {soundOn ? <Volume2 className="h-5 w-5 text-amber-500" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="p-10 text-center text-sm text-red-600">
          {query.error instanceof Error ? query.error.message : 'Gagal memuat tiket'}
        </p>
      ) : tab === 'active' ? (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {columns.map((col) => {
            const list = tickets.filter((t) => col.statuses.includes(t.status))
            return (
              <section key={col.title}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${col.head}`} />
                  <h2 className="font-semibold text-slate-700 dark:text-slate-200">{col.title}</h2>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                    {list.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {list.length === 0 ? (
                    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
                      <ChefHat className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      <p className="mt-2 text-sm text-slate-400">Tidak ada tiket</p>
                    </div>
                  ) : (
                    list.map((t) => (
                      <TicketCard
                        key={t.id}
                        ticket={t}
                        now={now}
                        canKitchen={canKitchen}
                        canServe={canServe}
                        busy={mutation.isPending}
                        onChange={(status) => mutation.mutate({ id: t.id, status })}
                      />
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-2xl bg-amber-100 p-4 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <Check className="h-8 w-8" />
          </div>
          <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">Belum ada tiket selesai hari ini</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tickets.map((t) => (
            <li key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">{t.number}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {orderTypeLabel[t.type]}
                    {t.table ? ` · Meja ${t.table.name}` : ''}
                    {t.customerName ? ` · ${t.customerName}` : ''}
                  </p>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {t.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}