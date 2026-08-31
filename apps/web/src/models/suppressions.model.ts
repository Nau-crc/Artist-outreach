import type { Prisma, Suppression, SuppressionReason } from '@prisma/client'
import { Email } from '@artist-outreach/shared'
import { prisma } from '@/lib/prisma'
import { writeAudit } from './audit.model'

export interface AddSuppressionParams {
  email: string
  reason: SuppressionReason
  notes?: string
}

export async function addSuppression(
  params: AddSuppressionParams,
  actorId: string,
): Promise<Suppression> {
  const email = Email.parse(params.email).value

  return prisma.$transaction(async (tx) => {
    const existing = await tx.suppression.findUnique({ where: { email } })
    if (existing) {
      return existing
    }

    const suppression = await tx.suppression.create({
      data: {
        email,
        reason: params.reason,
        notes: params.notes ?? null,
        suppressedBy: actorId,
      },
    })

    // Cascade: cualquier contacto con este email pasa a SUPPRESSED + BLOCKED.
    const affected = await tx.contact.findMany({
      where: { email },
      select: { id: true, contactStatus: true, permission: true },
    })
    if (affected.length > 0) {
      await tx.contact.updateMany({
        where: { email },
        data: {
          contactStatus: 'SUPPRESSED',
          permission: 'BLOCKED',
          lastActionAt: new Date(),
        },
      })
      for (const contact of affected) {
        await writeAudit(
          {
            actorId,
            actorKind: 'SYSTEM',
            entityType: 'contact',
            entityId: contact.id,
            action: 'suppression_cascade',
            before: { contactStatus: contact.contactStatus, permission: contact.permission },
            after: { contactStatus: 'SUPPRESSED', permission: 'BLOCKED' },
            metadata: { suppressionId: suppression.id, reason: params.reason },
          },
          tx,
        )
      }
    }

    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'suppression',
        entityId: suppression.id,
        action: 'added',
        after: {
          email,
          reason: params.reason,
          notes: params.notes ?? null,
          cascadedContacts: affected.length,
        },
      },
      tx,
    )

    return suppression
  })
}

export async function removeSuppression(id: string, actorId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.suppression.findUnique({ where: { id } })
    if (!existing) return
    await tx.suppression.delete({ where: { id } })
    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'suppression',
        entityId: id,
        action: 'removed',
        before: {
          email: existing.email,
          reason: existing.reason,
          notes: existing.notes,
        },
        metadata: {
          note: 'Contactos suprimidos NO revierten automáticamente; requieren revisión manual.',
        },
      },
      tx,
    )
  })
}

export interface ListSuppressionsParams {
  email?: string
  reason?: SuppressionReason
  limit?: number
}

export async function listSuppressions(params: ListSuppressionsParams = {}): Promise<Suppression[]> {
  const where: Prisma.SuppressionWhereInput = {}
  if (params.email) {
    const safe = Email.safeParse(params.email)
    if (safe.success) where.email = { contains: safe.email.value }
    else where.email = { contains: params.email.trim().toLowerCase() }
  }
  if (params.reason) where.reason = params.reason
  return prisma.suppression.findMany({
    where,
    orderBy: { suppressedAt: 'desc' },
    take: Math.min(params.limit ?? 50, 200),
  })
}

export async function isSuppressed(rawEmail: string): Promise<boolean> {
  const safe = Email.safeParse(rawEmail)
  if (!safe.success) return false
  const found = await prisma.suppression.findUnique({ where: { email: safe.email.value } })
  return found !== null
}
