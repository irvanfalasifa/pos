export function calcTotals(subtotal: number, taxBp: number, serviceBp: number) {
  const service = Math.round((subtotal * serviceBp) / 10000)
  const tax = Math.round(((subtotal + service) * taxBp) / 10000)
  return { subtotal, service, tax, total: subtotal + service + tax }
}

export function formatPercent(bp: number): string {
  return `${bp / 100}%`
}