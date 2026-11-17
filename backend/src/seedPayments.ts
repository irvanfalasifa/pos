import { prisma } from './lib/prisma.js'

// Nilai contoh. Ganti dengan identitas usahamu (bisa diedit di tabel Setting lewat pgAdmin).
const settings = [
  { key: 'business_name', value: 'POS Restoran' },
  { key: 'business_address', value: 'Jl. Contoh No. 1, Jakarta' },
  { key: 'receipt_footer', value: 'Terima kasih atas kunjungan Anda' },
]

async function main() {
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s })
  }
  console.log('Identitas usaha contoh dibuat')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())