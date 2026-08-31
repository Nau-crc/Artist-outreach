import { PrismaClient, ContactStatus, EmailStatus, ConsentStatus, Permission, DiscoverySourceType, ComplianceStatus } from '@prisma/client'

const prisma = new PrismaClient()

interface ContactSeed {
  slug: string
  artistName: string
  email?: string
  website?: string
  discipline?: string
  country?: string
  city?: string
  contactStatus?: ContactStatus
  emailStatus?: EmailStatus
  consentStatus?: ConsentStatus
  permission?: Permission
}

const contacts: ContactSeed[] = [
  { slug: 'ana-luz', artistName: 'Ana Luz', email: 'ana@example.com', website: 'https://analuz.example', discipline: 'música', country: 'ES', city: 'Barcelona', contactStatus: 'REVIEW_REQUIRED', emailStatus: 'FOUND' },
  { slug: 'martin-rio', artistName: 'Martín Río', email: 'martin@example.com', discipline: 'teatro', country: 'AR', city: 'Buenos Aires', contactStatus: 'REVIEWED', emailStatus: 'FOUND', permission: 'ELIGIBLE' },
  { slug: 'sofia-caldera', artistName: 'Sofía Caldera', email: 'sofia@example.com', discipline: 'danza', country: 'MX', city: 'CDMX', contactStatus: 'REVIEWED', emailStatus: 'FOUND', permission: 'ELIGIBLE', consentStatus: 'CONFIRMED' },
  { slug: 'ruben-oliveira', artistName: 'Rubén Oliveira', email: 'ruben@example.com', discipline: 'música', country: 'PT', city: 'Lisboa', contactStatus: 'REVIEW_REQUIRED', emailStatus: 'FOUND' },
  { slug: 'lucia-mena', artistName: 'Lucía Mena', discipline: 'artes visuales', country: 'ES', city: 'Madrid', contactStatus: 'DISCOVERED', emailStatus: 'NOT_FOUND' },
  { slug: 'diego-arriaga', artistName: 'Diego Arriaga', email: 'diego@example.com', discipline: 'literatura', country: 'CL', city: 'Santiago', contactStatus: 'DISCARDED', emailStatus: 'FOUND' },
  { slug: 'nadia-frank', artistName: 'Nadia Frank', email: 'nadia@example.com', discipline: 'música', country: 'DE', city: 'Berlín', contactStatus: 'REVIEWED', emailStatus: 'FOUND', permission: 'NOT_ELIGIBLE' },
  { slug: 'oriol-benet', artistName: 'Oriol Benet', email: 'oriol@example.com', discipline: 'circo', country: 'ES', city: 'Valencia', contactStatus: 'REVIEW_REQUIRED', emailStatus: 'FOUND' },
  { slug: 'paula-fresno', artistName: 'Paula Fresno', email: 'paula@example.com', discipline: 'música', country: 'ES', city: 'Sevilla', contactStatus: 'REVIEWED', emailStatus: 'FOUND', permission: 'ELIGIBLE', consentStatus: 'REQUESTED' },
  { slug: 'ivan-recio', artistName: 'Iván Recio', email: 'ivan@example.com', discipline: 'teatro', country: 'ES', city: 'Bilbao', contactStatus: 'DISCOVERED', emailStatus: 'FOUND' },
  { slug: 'carmen-mota', artistName: 'Carmen Mota', email: 'carmen@example.com', discipline: 'danza', country: 'ES', city: 'Granada', contactStatus: 'SUPPRESSED', emailStatus: 'BOUNCED', permission: 'BLOCKED' },
  { slug: 'julen-arana', artistName: 'Julen Arana', email: 'julen@example.com', discipline: 'artes visuales', country: 'ES', city: 'San Sebastián', contactStatus: 'DISCOVERED', emailStatus: 'FOUND' },
  { slug: 'noa-belmonte', artistName: 'Noa Belmonte', email: 'noa@example.com', discipline: 'música', country: 'ES', city: 'Palma', contactStatus: 'REVIEW_REQUIRED', emailStatus: 'FOUND' },
  { slug: 'inaki-goitia', artistName: 'Iñaki Goitia', discipline: 'literatura', country: 'ES', city: 'Vitoria', contactStatus: 'DISCARDED', emailStatus: 'NOT_FOUND' },
  { slug: 'talia-perez', artistName: 'Talía Pérez', email: 'talia@example.com', discipline: 'circo', country: 'UY', city: 'Montevideo', contactStatus: 'REVIEWED', emailStatus: 'FOUND', permission: 'ELIGIBLE' },
  { slug: 'noe-arruti', artistName: 'Noé Arruti', email: 'noe@example.com', discipline: 'teatro', country: 'ES', city: 'Zaragoza', contactStatus: 'REVIEW_REQUIRED', emailStatus: 'FOUND' },
  { slug: 'yulen-cabo', artistName: 'Yulen Cabo', email: 'yulen@example.com', discipline: 'música', country: 'ES', city: 'A Coruña', contactStatus: 'DISCOVERED', emailStatus: 'FOUND' },
  { slug: 'mireia-bosch', artistName: 'Mireia Bosch', email: 'mireia@example.com', discipline: 'danza', country: 'ES', city: 'Girona', contactStatus: 'REVIEWED', emailStatus: 'FOUND', permission: 'ELIGIBLE', consentStatus: 'CONFIRMED' },
  { slug: 'aitor-vidal', artistName: 'Aitor Vidal', email: 'aitor@example.com', discipline: 'artes visuales', country: 'ES', city: 'Pamplona', contactStatus: 'REVIEW_REQUIRED', emailStatus: 'INVALID' },
  { slug: 'raquel-sole', artistName: 'Raquel Solé', email: 'raquel@example.com', discipline: 'literatura', country: 'ES', city: 'Tarragona', contactStatus: 'DISCOVERED', emailStatus: 'FOUND' },
]

async function main() {
  await prisma.appConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  })

  await prisma.discoverySource.upsert({
    where: { slug: 'seed' },
    update: {},
    create: {
      slug: 'seed',
      name: 'Seed manual',
      type: DiscoverySourceType.MANUAL,
      complianceStatus: ComplianceStatus.VERIFIED,
      complianceNotes: 'Datos de prueba locales, no productivos.',
      enabled: true,
    },
  })

  const seedSource = await prisma.discoverySource.findUniqueOrThrow({ where: { slug: 'seed' } })

  for (const c of contacts) {
    const existing = await prisma.contact.findFirst({ where: { artistName: c.artistName } })
    if (existing) continue

    const contact = await prisma.contact.create({
      data: {
        artistName: c.artistName,
        email: c.email?.toLowerCase().trim(),
        website: c.website,
        discipline: c.discipline,
        country: c.country,
        city: c.city,
        contactStatus: c.contactStatus ?? ContactStatus.DISCOVERED,
        emailStatus: c.emailStatus ?? EmailStatus.NOT_FOUND,
        consentStatus: c.consentStatus ?? ConsentStatus.UNKNOWN,
        permission: c.permission ?? Permission.NOT_REVIEWED,
      },
    })

    await prisma.contactSource.create({
      data: {
        contactId: contact.id,
        sourceId: seedSource.id,
        sourceUrl: `local://seed/${c.slug}`,
        raw: { seed: true },
      },
    })
  }

  const carmen = await prisma.contact.findFirst({ where: { artistName: 'Carmen Mota' } })
  if (carmen?.email) {
    await prisma.suppression.upsert({
      where: { email: carmen.email },
      update: {},
      create: { email: carmen.email, reason: 'HARD_BOUNCE', notes: 'Seed: ejemplo de contacto suprimido.' },
    })
  }

  console.log(`Seed OK: ${contacts.length} contactos + 1 discovery_source + config singleton.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
