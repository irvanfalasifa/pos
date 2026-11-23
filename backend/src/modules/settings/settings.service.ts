import { prisma } from '../../lib/prisma.js'

export type TaxBase = 'SUBTOTAL' | 'SUBTOTAL_PLUS_SERVICE'

export type Settings = {
  businessName: string
  businessAddress: string
  businessPhone: string
  receiptFooter: string
  receiptPaper: '58' | '80'
  taxBp: number
  serviceBp: number
  taxBase: TaxBase
  roundingStep: number
}

const defaults: Settings = {
  businessName: 'POS Restoran',
  businessAddress: '',
  businessPhone: '',
  receiptFooter: 'Terima kasih atas kunjungan Anda',
  receiptPaper: '80',
  taxBp: 0,
  serviceBp: 0,
  taxBase: 'SUBTOTAL_PLUS_SERVICE',
  roundingStep: 0,
}

const KEYS = [
  'business_name',
  'business_address',
  'business_phone',
  'receipt_footer',
  'receipt_paper',
  'tax_bp',
  'service_bp',
  'tax_base',
  'rounding_step',
]

const ROUNDING_STEPS = [0, 100, 500, 1000]

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } })
  const map = new Map(rows.map((r) => [r.key, r.value]))

  const text = (key: string, fallback: string) => map.get(key) ?? fallback

  const int = (key: string, fallback: number, max: number) => {
    const raw = map.get(key)
    const n = Number(raw)
    return raw !== undefined && Number.isInteger(n) && n >= 0 && n <= max ? n : fallback
  }

  const rounding = int('rounding_step', defaults.roundingStep, 1000)

  return {
    businessName: text('business_name', defaults.businessName),
    businessAddress: text('business_address', defaults.businessAddress),
    businessPhone: text('business_phone', defaults.businessPhone),
    receiptFooter: text('receipt_footer', defaults.receiptFooter),
    receiptPaper: text('receipt_paper', defaults.receiptPaper) === '58' ? '58' : '80',
    taxBp: int('tax_bp', defaults.taxBp, 5000),
    serviceBp: int('service_bp', defaults.serviceBp, 3000),
    taxBase: text('tax_base', defaults.taxBase) === 'SUBTOTAL' ? 'SUBTOTAL' : 'SUBTOTAL_PLUS_SERVICE',
    roundingStep: ROUNDING_STEPS.includes(rounding) ? rounding : 0,
  }
}

// Bentuk penyimpanan di tabel Setting (semua nilai berupa teks)
export function toStored(s: Settings): Record<string, string> {
  return {
    business_name: s.businessName,
    business_address: s.businessAddress,
    business_phone: s.businessPhone,
    receipt_footer: s.receiptFooter,
    receipt_paper: s.receiptPaper,
    tax_bp: String(s.taxBp),
    service_bp: String(s.serviceBp),
    tax_base: s.taxBase,
    rounding_step: String(s.roundingStep),
  }
}