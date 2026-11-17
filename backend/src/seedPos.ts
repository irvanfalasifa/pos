import { prisma } from './lib/prisma.js'

const areas = [
  {
    name: 'Indoor',
    tables: [
      ['I-01', 2],
      ['I-02', 2],
      ['I-03', 4],
      ['I-04', 4],
      ['I-05', 4],
      ['I-06', 6],
    ],
  },
  {
    name: 'Outdoor',
    tables: [
      ['O-01', 4],
      ['O-02', 4],
      ['O-03', 4],
      ['O-04', 2],
    ],
  },
] as const

async function main() {
  // Nilai contoh. Sesuaikan dengan ketentuan usahamu (1000 = 10%, 500 = 5%).
  await prisma.setting.upsert({ where: { key: 'tax_bp' }, update: {}, create: { key: 'tax_bp', value: '1000' } })
  await prisma.setting.upsert({ where: { key: 'service_bp' }, update: {}, create: { key: 'service_bp', value: '500' } })

  for (const a of areas) {
    const area = await prisma.area.upsert({ where: { name: a.name }, update: {}, create: { name: a.name } })

    for (const [name, capacity] of a.tables) {
      await prisma.restaurantTable.upsert({
        where: { areaId_name: { areaId: area.id, name } },
        update: {},
        create: { areaId: area.id, name, capacity },
      })
    }
  }

  console.log('Data meja dan tarif contoh dibuat')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())