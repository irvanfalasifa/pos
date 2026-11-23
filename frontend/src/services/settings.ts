import { api } from './api'

export type Settings = {
  businessName: string
  businessAddress: string
  businessPhone: string
  receiptFooter: string
  receiptPaper: '58' | '80'
  taxBp: number
  serviceBp: number
  taxBase: 'SUBTOTAL' | 'SUBTOTAL_PLUS_SERVICE'
  roundingStep: number
}

export const getSettings = () => api<Settings>('/settings')

export const saveSettings = (data: Settings) =>
  api<Settings>('/settings', { method: 'PUT', body: JSON.stringify(data) })