import { create } from 'zustand'

export type CartModifier = { id: number; name: string; price: number }

export type CartLine = {
  key: string
  productId: number
  name: string
  variantId: number | null
  variantName: string | null
  modifiers: CartModifier[]
  unitPrice: number
  quantity: number
  note: string
}

type OrderTypeChoice = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'

type CartState = {
  lines: CartLine[]
  type: OrderTypeChoice
  tableId: number | null
  customerName: string
  orderNote: string
  addLine: (line: Omit<CartLine, 'key'>) => void
  setQuantity: (key: string, quantity: number) => void
  removeLine: (key: string) => void
  setType: (type: OrderTypeChoice) => void
  setTable: (tableId: number | null) => void
  setCustomerName: (name: string) => void
  setOrderNote: (note: string) => void
  clear: () => void
}

const MAX_QTY = 99

// Dua item dianggap sama bila produk, varian, modifier, dan catatannya sama.
function lineKey(line: Omit<CartLine, 'key'>): string {
  const mods = line.modifiers
    .map((m) => m.id)
    .sort((a, b) => a - b)
    .join(',')
  return `${line.productId}|${line.variantId ?? 0}|${mods}|${line.note.trim().toLowerCase()}`
}

export const useCartStore = create<CartState>((set) => ({
  lines: [],
  type: 'DINE_IN',
  tableId: null,
  customerName: '',
  orderNote: '',

  addLine: (line) =>
    set((state) => {
      const key = lineKey(line)
      const existing = state.lines.find((l) => l.key === key)
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.key === key ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + line.quantity) } : l,
          ),
        }
      }
      return { lines: [...state.lines, { ...line, key }] }
    }),

  setQuantity: (key, quantity) =>
    set((state) => ({
      lines:
        quantity <= 0
          ? state.lines.filter((l) => l.key !== key)
          : state.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l)),
    })),

  removeLine: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),
  setType: (type) => set({ type }),
  setTable: (tableId) => set({ tableId }),
  setCustomerName: (customerName) => set({ customerName }),
  setOrderNote: (orderNote) => set({ orderNote }),
  clear: () => set({ lines: [], tableId: null, customerName: '', orderNote: '' }),
}))

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
}