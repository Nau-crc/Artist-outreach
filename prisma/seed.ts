import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Fase 1: seed vacío.
  // Fase 2: 20 contactos ficticios en estados variados para poblar el CRM en local.
  await prisma.healthPing.create({ data: {} })
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
