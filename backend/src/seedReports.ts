import { prisma } from './lib/prisma.js'

const permissions = [{ code: 'report.staff', label: 'Lihat laporan kinerja staf' }]

// Owner otomatis memiliki semua izin
const access: Record<string, string[]> = {
  admin: ['report.staff'],
}

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

  console.log('Izin laporan dibuat')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())