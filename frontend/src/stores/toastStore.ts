import { create } from 'zustand'

type Toast = { id: number; type: 'success' | 'error'; text: string }

type ToastState = {
  toasts: Toast[]
  push: (type: Toast['type'], text: string) => void
  remove: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (type, text) => {
    const id = nextId++
    set({ toasts: [...get().toasts, { id, type, text }] })
    setTimeout(() => get().remove(id), 3500)
  },
  remove: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))