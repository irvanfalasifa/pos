const API_URL = 'http://localhost:4000/api'

export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    // Sesi berakhir: beri tahu aplikasi agar kembali ke halaman login
    if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/me')) {
      window.dispatchEvent(new Event('auth:expired'))
    }
    throw new ApiError(res.status, data.message ?? 'Terjadi kesalahan', data.code)
  }

  return data as T
}