import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '../services/socket'
import { useRealtimeStore } from '../stores/realtimeStore'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'

type OrdersChangedEvent = {
  id: number
  number: string
  status: string
  reason: 'created' | 'status' | 'paid'
}

export function useRealtime(enabled: boolean) {
  const queryClient = useQueryClient()
  const setConnected = useRealtimeStore((s) => s.setConnected)

  useEffect(() => {
    if (!enabled) return

    const socket = getSocket()

    // Ambil ulang semua data yang bergantung pada pesanan dan meja
    const refresh = () => {
      for (const key of ['orders', 'kds', 'tables']) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
    }

    const onConnect = () => {
      setConnected(true)
      refresh() // sinkronisasi ulang setiap kali tersambung (termasuk setelah terputus)
    }
    const onDisconnect = () => setConnected(false)

    const onOrdersChanged = (event: OrdersChangedEvent) => {
      refresh()

      const canServe = useAuthStore.getState().user?.permissions.includes('order.create')
      if (event.reason === 'status' && event.status === 'READY' && canServe) {
        useToastStore.getState().push('success', `Pesanan ${event.number} siap disajikan`)
      }
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onDisconnect)
    socket.on('orders:changed', onOrdersChanged)
    socket.on('tables:changed', refresh)
    socket.connect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onDisconnect)
      socket.off('orders:changed', onOrdersChanged)
      socket.off('tables:changed', refresh)
      socket.disconnect()
      setConnected(false)
    }
  }, [enabled, queryClient, setConnected])
}