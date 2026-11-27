export function todayString(): string {
  return new Date().toLocaleDateString('sv-SE')
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('sv-SE')
}

export type PresetKey = 'today' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom'

export function presetRange(key: Exclude<PresetKey, 'custom'>): { from: string; to: string } {
  const today = todayString()
  const now = new Date()

  switch (key) {
    case 'today':
      return { from: today, to: today }
    case '7d':
      return { from: addDays(today, -6), to: today }
    case '30d':
      return { from: addDays(today, -29), to: today }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('sv-SE'), to: today }
    case 'lastMonth':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('sv-SE'),
        to: new Date(now.getFullYear(), now.getMonth(), 0).toLocaleDateString('sv-SE'),
      }
  }
}

// Singkat untuk sumbu grafik: 1,2 jt / 350 rb
export function formatShort(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  if (abs >= 1_000) return `${Math.round(n / 1_000)} rb`
  return String(n)
}

export function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

// Perubahan persen dibanding periode sebelumnya. null bila tidak bisa dibandingkan.
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

function escapeCsv(value: string | number): string {
  const text = String(value)
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  // BOM agar Excel membaca huruf UTF-8 dengan benar
  const csv = '\uFEFF' + rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}