export type PricingOptions = {
  taxBase?: 'SUBTOTAL' | 'SUBTOTAL_PLUS_SERVICE'
  roundingStep?: number
}

// Rumus ini harus sama persis dengan yang dipakai server saat pesanan dibuat.
export function calcTotals(subtotal: number, taxBp: number, serviceBp: number, options: PricingOptions = {}) {
  const service = Math.round((subtotal * serviceBp) / 10000)
  const taxable = options.taxBase === 'SUBTOTAL' ? subtotal : subtotal + service
  const tax = Math.round((taxable * taxBp) / 10000)
  const beforeRounding = subtotal + service + tax

  const step = options.roundingStep ?? 0
  const rounding = step > 0 ? Math.round(beforeRounding / step) * step - beforeRounding : 0

  return { subtotal, service, tax, rounding, total: beforeRounding + rounding }
}

export function formatPercent(bp: number): string {
  return `${bp / 100}%`
}