import 'dotenv/config'

const secret = process.env.JWT_SECRET

if (!secret || secret.length < 32) {
  throw new Error('JWT_SECRET belum diatur atau terlalu pendek (minimal 32 karakter) di file .env')
}

export const JWT_SECRET: string = secret