import { prisma } from '@/lib/prisma'

const TABLES = [
  'email_events',
  'email_messages',
  'newsletter_subscriptions',
  'consents',
  'consent_requests',
  'consent_templates',
  'campaigns',
  'contact_tags',
  'tags',
  'contact_sources',
  'discovery_runs',
  'discovery_sources',
  'suppressions',
  'audit_logs',
  'contacts',
  'app_config',
] as const

export async function truncateAll(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"public"."${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  )
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect()
}
