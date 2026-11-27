import { prisma } from './lib/prisma.js'
import { applyMovement } from './modules/inventory/stock.service.js'

const permissions = [
  { code: 'inventory.view', label: 'Lihat inventori dan resep' },
  { code: 'inventory.manage', label: 'Kelola inventori dan resep' },
]

// Owner otomatis memiliki semua izin
const access: Record<string, string[]> = {
  admin: ['inventory.view', 'inventory.manage'],
  inventory: ['inventory.view', 'inventory.manage'],
}

// Biaya per satuan BELI (mis. per kg). Dikonversi ke biaya per satuan pakai.
const ingredients = [
  { name: 'Biji kopi', unit: 'gram', purchaseUnit: 'kg', factor: 1000, stock: 5000, min: 1000, cost: 200000 },
  { name: 'Susu segar', unit: 'ml', purchaseUnit: 'liter', factor: 1000, stock: 10000, min: 2000, cost: 18000 },
  { name: 'Sirup gula aren', unit: 'ml', purchaseUnit: 'liter', factor: 1000, stock: 3000, min: 500, cost: 40000 },
  { name: 'Teh celup', unit: 'pcs', purchaseUnit: 'box', factor: 25, stock: 100, min: 20, cost: 25000 },
  { name: 'Lemon', unit: 'pcs', purchaseUnit: null, factor: null, stock: 40, min: 10, cost: 3000 },
  { name: 'Bubuk matcha', unit: 'gram', purchaseUnit: 'kg', factor: 1000, stock: 1000, min: 200, cost: 300000 },
  { name: 'Beras', unit: 'gram', purchaseUnit: 'kg', factor: 1000, stock: 8000, min: 2000, cost: 14000 },
  { name: 'Telur', unit: 'pcs', purchaseUnit: 'tray', factor: 30, stock: 60, min: 20, cost: 55000 },
  { name: 'Ayam suwir', unit: 'gram', purchaseUnit: 'kg', factor: 1000, stock: 3000, min: 500, cost: 40000 },
  { name: 'Kentang', unit: 'gram', purchaseUnit: 'kg', factor: 1000, stock: 4000, min: 1000, cost: 20000 },
  { name: 'Minyak goreng', unit: 'ml', purchaseUnit: 'liter', factor: 1000, stock: 5000, min: 1000, cost: 18000 },
  { name: 'Boba', unit: 'gram', purchaseUnit: 'kg', factor: 1000, stock: 2000, min: 500, cost: 30000 },
]

type RecipeSeed = { sku: string; variant?: string; yield?: number; items: [string, number][] }

const recipes: RecipeSeed[] = [
  { sku: 'KOP-001', items: [['Biji kopi', 18], ['Susu segar', 100], ['Sirup gula aren', 20]] },
  { sku: 'KOP-001', variant: 'Large', items: [['Biji kopi', 24], ['Susu segar', 140], ['Sirup gula aren', 28]] },
  { sku: 'KOP-002', items: [['Biji kopi', 18]] },
  { sku: 'KOP-003', items: [['Biji kopi', 18], ['Susu segar', 150]] },
  { sku: 'NKP-001', yield: 2, items: [['Teh celup', 2], ['Lemon', 1], ['Sirup gula aren', 40]] },
  { sku: 'NKP-002', items: [['Bubuk matcha', 10], ['Susu segar', 150]] },
  { sku: 'MKN-001', items: [['Beras', 150], ['Telur', 1], ['Ayam suwir', 40], ['Minyak goreng', 15]] },
  { sku: 'CMP-001', variant: 'Kecil', items: [['Kentang', 150], ['Minyak goreng', 30]] },
  { sku: 'CMP-001', variant: 'Besar', items: [['Kentang', 250], ['Minyak goreng', 50]] },
]

const modifierUsage: [string, [string, number][]][] = [
  ['Extra Shot', [['Biji kopi', 18]]],
  ['Boba', [['Boba', 50]]],
]

async function main() {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'owner@pos.local' } })

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

  // Bahan baku dan stok awal (hanya dibuat bila belum ada)
  for (const i of ingredients) {
    const existing = await prisma.ingredient.findUnique({ where: { name: i.name } })
    if (existing) continue

    const created = await prisma.ingredient.create({
      data: {
        name: i.name,
        unit: i.unit,
        purchaseUnit: i.purchaseUnit,
        purchaseFactor: i.factor,
        minimumStock: i.min,
      },
    })
    await applyMovement(prisma, {
      ingredientId: created.id,
      type: 'OPENING',
      quantityIn: i.stock,
      unitCost: i.cost / (i.factor ?? 1),
      reason: 'Stok awal contoh',
      userId: owner.id,
      allowNegative: false,
    })
  }

  // Resep
  for (const r of recipes) {
    const product = await prisma.product.findUnique({ where: { sku: r.sku }, include: { variants: true } })
    if (!product) continue

    const variant = r.variant ? product.variants.find((v) => v.name === r.variant) : undefined
    if (r.variant && !variant) continue

    const existing = await prisma.recipe.findFirst({ where: { productId: product.id, variantId: variant?.id ?? null } })
    if (existing) continue

    const items = []
    for (const [name, quantity] of r.items) {
      const ingredient = await prisma.ingredient.findUniqueOrThrow({ where: { name } })
      items.push({ ingredientId: ingredient.id, quantity })
    }

    await prisma.recipe.create({
      data: { productId: product.id, variantId: variant?.id ?? null, yieldQuantity: r.yield ?? 1, items: { create: items } },
    })
  }

  // Pemakaian bahan oleh modifier
  for (const [modifierName, usage] of modifierUsage) {
    const modifiers = await prisma.modifier.findMany({ where: { name: modifierName } })
    for (const modifier of modifiers) {
      for (const [name, quantity] of usage) {
        const ingredient = await prisma.ingredient.findUniqueOrThrow({ where: { name } })
        await prisma.modifierIngredient.upsert({
          where: { modifierId_ingredientId: { modifierId: modifier.id, ingredientId: ingredient.id } },
          update: {},
          create: { modifierId: modifier.id, ingredientId: ingredient.id, quantity },
        })
      }
    }
  }

  console.log('Izin, bahan baku, dan resep contoh dibuat')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())