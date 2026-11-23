import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Receipt from '../components/Receipt'
import { getSettings, saveSettings } from '../services/settings'
import type { Settings } from '../services/settings'
import type { Order, PosConfig } from '../services/pos'
import { useToastStore } from '../stores/toastStore'
import { calcTotals } from '../lib/pricing'

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300'
const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900'

const toPercent = (bp: number) => String(bp / 100)

function toBp(value: string): number | null {
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}

const roundingOptions = [
  { value: 0, label: 'Tanpa pembulatan' },
  { value: 100, label: 'Kelipatan Rp100' },
  { value: 500, label: 'Kelipatan Rp500' },
  { value: 1000, label: 'Kelipatan Rp1.000' },
]

function SettingsForm({ initial }: { initial: Settings }) {
  const queryClient = useQueryClient()
  const push = useToastStore((s) => s.push)

  const [businessName, setBusinessName] = useState(initial.businessName)
  const [businessAddress, setBusinessAddress] = useState(initial.businessAddress)
  const [businessPhone, setBusinessPhone] = useState(initial.businessPhone)
  const [receiptFooter, setReceiptFooter] = useState(initial.receiptFooter)
  const [receiptPaper, setReceiptPaper] = useState<Settings['receiptPaper']>(initial.receiptPaper)
  const [taxPercent, setTaxPercent] = useState(toPercent(initial.taxBp))
  const [servicePercent, setServicePercent] = useState(toPercent(initial.serviceBp))
  const [taxBase, setTaxBase] = useState<Settings['taxBase']>(initial.taxBase)
  const [roundingStep, setRoundingStep] = useState(initial.roundingStep)
  const [error, setError] = useState('')

  const taxBp = toBp(taxPercent)
  const serviceBp = toBp(servicePercent)

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['pos-config'] })
      push('success', 'Pengaturan disimpan')
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan'),
  })

  let problem: string | null = null
  if (!businessName.trim()) problem = 'Nama usaha wajib diisi'
  else if (taxBp === null || taxBp > 5000) problem = 'Tarif pajak harus antara 0 dan 50 persen'
  else if (serviceBp === null || serviceBp > 3000) problem = 'Service charge harus antara 0 dan 30 persen'

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (problem || taxBp === null || serviceBp === null) return

    mutation.mutate({
      businessName: businessName.trim(),
      businessAddress: businessAddress.trim(),
      businessPhone: businessPhone.trim(),
      receiptFooter: receiptFooter.trim(),
      receiptPaper,
      taxBp,
      serviceBp,
      taxBase,
      roundingStep,
    })
  }

  // Pratinjau struk memakai komponen struk yang sama dengan struk asli
  const previewConfig: PosConfig = {
    taxBp: taxBp ?? 0,
    serviceBp: serviceBp ?? 0,
    taxBase,
    roundingStep,
    businessName: businessName.trim() || 'Nama Usaha',
    businessAddress,
    businessPhone,
    receiptFooter,
    receiptPaper,
  }
  const totals = calcTotals(98000, previewConfig.taxBp, previewConfig.serviceBp, { taxBase, roundingStep })

  const sample: Order = {
    id: 0,
    number: 'POS-20260101-0001',
    type: 'DINE_IN',
    status: 'COMPLETED',
    paymentStatus: 'PAID',
    table: { id: 0, name: 'I-01' },
    customerName: null,
    note: null,
    subtotal: totals.subtotal,
    serviceBp: previewConfig.serviceBp,
    serviceAmount: totals.service,
    taxBp: previewConfig.taxBp,
    taxAmount: totals.tax,
    roundingAmount: totals.rounding,
    total: totals.total,
    createdBy: { id: 0, name: 'Kasir Demo' },
    createdAt: new Date().toISOString(),
    cancelReason: null,
    cancelledAt: null,
    items: [
      {
        id: 1,
        productName: 'Kopi Susu Gula Aren',
        variantName: 'Large',
        unitPrice: 33000,
        quantity: 2,
        note: null,
        lineTotal: 66000,
        modifiers: [{ id: 1, name: 'Boba', price: 5000 }],
      },
      {
        id: 2,
        productName: 'Nasi Goreng Spesial',
        variantName: null,
        unitPrice: 32000,
        quantity: 1,
        note: null,
        lineTotal: 32000,
        modifiers: [],
      },
    ],
    payments: [
      {
        id: 1,
        method: 'CASH',
        amount: totals.total,
        tendered: Math.ceil(totals.total / 50000) * 50000,
        changeAmount: Math.ceil(totals.total / 50000) * 50000 - totals.total,
        reference: null,
        createdAt: new Date().toISOString(),
      },
    ],
    refunds: [],
  }

  const choice = (active: boolean) =>
    `rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition ${
      active
        ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
        : 'border-slate-200 text-slate-700 hover:border-amber-300 dark:border-slate-700 dark:text-slate-200'
    }`

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <section className={cardClass}>
          <h2 className="font-semibold text-slate-800 dark:text-white">Identitas usaha</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="s-name">Nama usaha</label>
              <input id="s-name" className={fieldClass} value={businessName} maxLength={60} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="s-address">Alamat</label>
              <input id="s-address" className={fieldClass} value={businessAddress} maxLength={150} onChange={(e) => setBusinessAddress(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="s-phone">Telepon</label>
              <input id="s-phone" className={fieldClass} value={businessPhone} maxLength={30} onChange={(e) => setBusinessPhone(e.target.value)} />
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="font-semibold text-slate-800 dark:text-white">Pajak dan biaya</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Perubahan hanya berlaku untuk pesanan baru. Pesanan lama tetap memakai tarif saat dibuat.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="s-tax">Pajak (%)</label>
              <input id="s-tax" inputMode="decimal" className={fieldClass} value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="s-service">Service charge (%)</label>
              <input id="s-service" inputMode="decimal" className={fieldClass} value={servicePercent} onChange={(e) => setServicePercent(e.target.value)} />
            </div>
          </div>

          <div className="mt-5">
            <p className={labelClass}>Pajak dihitung dari</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setTaxBase('SUBTOTAL_PLUS_SERVICE')} className={choice(taxBase === 'SUBTOTAL_PLUS_SERVICE')}>
                Subtotal + service charge
              </button>
              <button type="button" onClick={() => setTaxBase('SUBTOTAL')} className={choice(taxBase === 'SUBTOTAL')}>
                Subtotal saja
              </button>
            </div>
          </div>

          <div className="mt-5">
            <label className={labelClass} htmlFor="s-rounding">Pembulatan total</label>
            <select id="s-rounding" className={fieldClass} value={roundingStep} onChange={(e) => setRoundingStep(Number(e.target.value))}>
              {roundingOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Total dibulatkan ke kelipatan terdekat, dan selisihnya tampil sebagai baris Pembulatan.
            </p>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="font-semibold text-slate-800 dark:text-white">Struk</h2>
          <div className="mt-4 space-y-4">
            <div>
              <p className={labelClass}>Lebar kertas</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => setReceiptPaper('80')} className={choice(receiptPaper === '80')}>
                  80 mm (standar)
                </button>
                <button type="button" onClick={() => setReceiptPaper('58')} className={choice(receiptPaper === '58')}>
                  58 mm (kecil)
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="s-footer">Teks penutup struk</label>
              <input id="s-footer" className={fieldClass} value={receiptFooter} maxLength={120} onChange={(e) => setReceiptFooter(e.target.value)} />
            </div>
          </div>
        </section>

        {(error || problem) && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error || problem}</p>
        )}

        <button
          type="submit"
          disabled={!!problem || mutation.isPending}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Simpan Pengaturan
        </button>
      </div>

      <aside>
        <div className="sticky top-20">
          <p className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">Pratinjau struk</p>
          <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
            <Receipt order={sample} config={previewConfig} />
          </div>
        </div>
      </aside>
    </form>
  )
}

export default function SettingsPage() {
  const query = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Pengaturan</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Identitas usaha, pajak, service charge, pembulatan, dan struk.</p>
      </div>

      {query.isLoading ? (
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      ) : query.isError || !query.data ? (
        <p className="p-10 text-center text-sm text-red-600">
          {query.error instanceof Error ? query.error.message : 'Gagal memuat pengaturan'}
        </p>
      ) : (
        <SettingsForm initial={query.data} />
      )}
    </div>
  )
}