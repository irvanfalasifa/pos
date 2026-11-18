import { create } from 'zustand'

type RealtimeState = {
  connected: boolean
  setConnected: (value: boolean) => void
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),
}))