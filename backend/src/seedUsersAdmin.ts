import bcrypt from 'bcryptjs'
import { prisma } from './lib/prisma.js'

// HANYA UNTUK PENGEMBANGAN. Jangan pakai password ini saat aplikasi dipakai sungguhan.
const DEV_PASSWORD = 'Pos12345!'

const permissions = [{ code: 'role.manage', label: 'Kelola role dan izin' }]

const access: Record<string, string[]> = {
  owner: ['role.manage'],
  admin: ['user.manage'],
}

const users = [
  { name: 'Admin Demo', email: 'admin@pos.local', role: 'admin' },
  { name: 'Pelayan Demo', email: 'pelayan@pos.local', role: 'waiter' },
]

async function main() {
  for (const p of permissions) {
    await prisma.permission.upsert({ where: { code: p.code }, update: { label: p.label }, create: p })
  }

  for (const [roleName, codes] of Object.entries(access)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } })
    for (const code of codes) {
      const perm = await prisma.permission.findUniqueOrThrow({ where: { code } })
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      })
    }
  }

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

  console.log('Izin dan akun demo tambahan dibuat')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())