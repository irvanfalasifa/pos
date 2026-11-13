const API_URL = 'http://localhost:4000/api'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
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
    throw new ApiError(res.status, data.message ?? 'Terjadi kesalahan')
  }

  return data as T
}