import bcrypt from 'bcryptjs'
import { prisma } from './lib/prisma.js'

// HANYA UNTUK PENGEMBANGAN. Jangan pakai password ini saat aplikasi dipakai sungguhan.
const DEV_PASSWORD = 'Pos12345!'

const users = [
  { name: 'Owner Demo', email: 'owner@pos.local', role: 'owner' },
  { name: 'Kasir Demo', email: 'kasir@pos.local', role: 'cashier' },
  { name: 'Dapur Demo', email: 'dapur@pos.local', role: 'kitchen' },
]

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10)

  for (const u of users) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: u.role } })

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, passwordHash },
    })

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    })
  }

  console.log('Akun demo dibuat')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())