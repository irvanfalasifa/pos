import { prisma } from './lib/prisma.js'

const groups = [
  {
    name: 'Level Gula',
    minSelect: 1,
    maxSelect: 1,
    options: [
      { name: 'Normal', price: 0 },
      { name: 'Kurang Manis', price: 0 },
      { name: 'Tanpa Gula', price: 0 },
    ],
  },
  {
    name: 'Topping',
    minSelect: 0,
    maxSelect: 3,
    options: [
      { name: 'Boba', price: 5000 },
      { name: 'Extra Shot', price: 6000 },
      { name: 'Cheese Foam', price: 7000 },
    ],
  },
  {
    name: 'Level Pedas',
    minSelect: 1,
    maxSelect: 1,
    options: [
      { name: 'Tidak Pedas', price: 0 },
      { name: 'Sedang', price: 0 },
      { name: 'Pedas', price: 0 },
    ],
  },
]

// SKU produk -> grup modifier yang dipasang
const attachments: Record<string, string[]> = {
  'KOP-001': ['Level Gula', 'Topping'],
  'KOP-002': ['Level Gula'],
  'KOP-003': ['Level Gula', 'Topping'],
  'NKP-001': ['Level Gula'],
  'NKP-002': ['Level Gula', 'Topping'],
  'MKN-001': ['Level Pedas'],
  'MKN-002': ['Level Pedas'],
}

async function main() {
  for (const g of groups) {
    await prisma.modifierGroup.upsert({
      where: { name: g.name },
      update: {},
      create: {
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        options: { create: g.options },
      },
    })
  }

  for (const [sku, groupNames] of Object.entries(attachments)) {
    const product = await prisma.product.findUnique({ where: { sku } })
    if (!product) continue

    for (const name of groupNames) {
      const group = await prisma.modifierGroup.findUniqueOrThrow({ where: { name } })
      await prisma.productModifierGroup.upsert({
        where: { productId_groupId: { productId: product.id, groupId: group.id } },
        update: {},
        create: { productId: product.id, groupId: group.id },
      })
    }
  }

  console.log('Data modifier contoh dibuat')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())