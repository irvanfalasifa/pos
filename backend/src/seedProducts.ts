import { prisma } from './lib/prisma.js'

const categories = ['Kopi', 'Non-Kopi', 'Makanan Berat', 'Camilan', 'Dessert']

const regularLarge = (extra: number) => [
  { name: 'Regular', priceDelta: 0 },
  { name: 'Large', priceDelta: extra },
]

const products = [
  { sku: 'KOP-001', name: 'Kopi Susu Gula Aren', category: 'Kopi', price: 22000, variants: regularLarge(6000) },
  { sku: 'KOP-002', name: 'Americano', category: 'Kopi', price: 18000, variants: regularLarge(5000) },
  { sku: 'KOP-003', name: 'Cappuccino', category: 'Kopi', price: 24000, variants: regularLarge(6000) },
  { sku: 'NKP-001', name: 'Es Teh Lemon', category: 'Non-Kopi', price: 14000, variants: regularLarge(4000) },
  { sku: 'NKP-002', name: 'Matcha Latte', category: 'Non-Kopi', price: 26000, variants: regularLarge(6000) },
  { sku: 'MKN-001', name: 'Nasi Goreng Spesial', category: 'Makanan Berat', price: 32000, variants: [] },
  { sku: 'MKN-002', name: 'Mie Goreng Ayam', category: 'Makanan Berat', price: 28000, variants: [] },
  {
    sku: 'CMP-001',
    name: 'Kentang Goreng',
    category: 'Camilan',
    price: 20000,
    variants: [
      { name: 'Kecil', priceDelta: 0 },
      { name: 'Besar', priceDelta: 8000 },
    ],
  },
  { sku: 'CMP-002', name: 'Pisang Goreng Keju', category: 'Camilan', price: 17000, variants: [] },
  { sku: 'DST-001', name: 'Roti Bakar Cokelat', category: 'Dessert', price: 18000, variants: [] },
]

async function main() {
  for (const [index, name] of categories.entries()) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, sortOrder: index + 1 },
    })
  }

  for (const p of products) {
    const category = await prisma.category.findUniqueOrThrow({ where: { name: p.category } })
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku,
        name: p.name,
        price: p.price,
        categoryId: category.id,
        variants: { create: p.variants },
      },
    })
  }

  console.log('Data menu contoh dibuat')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())