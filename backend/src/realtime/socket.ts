import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config/env.js'
import { COOKIE_NAME, loadUser } from '../middleware/auth.js'

let io: Server | null = null
const ROOM = 'ops'

export type OrderEvent = {
  id: number
  number: string
  status: string
  reason: 'created' | 'status' | 'paid' | 'cancelled' | 'refunded'
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: 'http://localhost:5173', credentials: true },
  })

  // Hanya pengguna yang sudah login dan berhak melihat pesanan boleh tersambung
  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, COOKIE_NAME)
      if (!token) return next(new Error('Belum login'))

      const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload
      const user = await loadUser(Number(payload.sub))
      if (user && payload.tv !== user.tokenVersion) return next(new Error('Sesi berakhir'))
      if (!user || !user.permissions.includes('order.view')) {
        return next(new Error('Tidak punya izin'))
      }

      socket.data.user = user
      next()
    } catch {
      next(new Error('Sesi tidak valid'))
    }
  })

  io.on('connection', (socket) => {
    socket.join(ROOM)
  })
}

// Sinyal ringan: klien mengambil ulang data dari API, bukan menerima data lengkap lewat socket.
export function emitOrdersChanged(event: OrderEvent) {
  io?.to(ROOM).emit('orders:changed', event)
}

export function emitTablesChanged() {
  io?.to(ROOM).emit('tables:changed')
}