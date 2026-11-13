import { prisma } from './lib/prisma.js'

const roles = [
  { name: 'owner', label: 'Owner' },
  { name: 'admin', label: 'Admin/Manager' },
  { name: 'cashier', label: 'Kasir' },
  { name: 'waiter', label: 'Pelayan' },
  { name: 'kitchen', label: 'Staf Dapur' },
  { name: 'inventory', label: 'Staf Inventori' },
]

const permissions = [
  { code: 'product.view', label: 'Lihat produk' },
  { code: 'product.create', label: 'Tambah produk' },
  { code: 'product.update', label: 'Ubah produk' },
  { code: 'order.view', label: 'Lihat pesanan' },
  { code: 'order.create', label: 'Buat pesanan' },
  { code: 'payment.create', label: 'Terima pembayaran' },
  { code: 'payment.refund', label: 'Refund pembayaran' },
  { code: 'kds.update', label: 'Ubah status dapur' },
  { code: 'report.view', label: 'Lihat laporan' },
  { code: 'user.manage', label: 'Kelola pengguna' },
]

const allCodes = permissions.map((p) => p.code)

const access: Record<string, string[]> = {
  owner: allCodes,
  admin: allCodes.filter((c) => c !== 'user.manage'),
  cashier: ['product.view', 'order.view', 'order.create', 'payment.create'],
  waiter: ['product.view', 'order.view', 'order.create'],
  kitchen: ['order.view', 'kds.update'],
  inventory: ['product.view'],
}

async function main() {
  for (const r of roles) {
    await prisma.role.upsert({ where: { name: r.name }, update: { label: r.label }, create: r })
  }
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
  console.log('Seed selesai')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())