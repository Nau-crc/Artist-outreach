import type { AuditActorKind, Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface AuditEntry {
  actorId?: string | null
  actorKind: AuditActorKind
  entityType: string
  entityId?: string | null
  action: string
  before?: unknown
  after?: unknown
  metadata?: Record<string, unknown>
}

export interface ListAuditParams {
  entityType?: string
  entityId?: string
  limit?: number
  cursor?: string
}

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Escribe una entrada de auditoría. Debe llamarse desde dentro de la
 * misma transacción que la operación auditada. Si no se pasa `tx`, usa el
 * cliente principal — solo válido para acciones que no cambian estado
 * (p.ej. logs de acceso o consultas), NO para cambios auditables.
 */
export async function writeAudit(entry: AuditEntry, tx: Tx = prisma): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      actorKind: entry.actorKind,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      action: entry.action,
      before: (entry.before ?? null) as Prisma.InputJsonValue,
      after: (entry.after ?? null) as Prisma.InputJsonValue,
      metadata: (entry.metadata ?? null) as Prisma.InputJsonValue,
    },
  })
}

export async function listAudit(params: ListAuditParams = {}) {
  const limit = Math.min(params.limit ?? 50, 200)
  return prisma.auditLog.findMany({
    where: {
      ...(params.entityType ? { entityType: params.entityType } : {}),
      ...(params.entityId ? { entityId: params.entityId } : {}),
    },
    orderBy: { at: 'desc' },
    take: limit,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  })
}
