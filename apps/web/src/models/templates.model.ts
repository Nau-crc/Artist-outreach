import type { ConsentTemplate, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { writeAudit } from './audit.model'

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface CreateTemplateInput {
  name: string
  subject: string
  bodyHtml: string
  bodyText: string
  active?: boolean
}

export interface UpdateTemplateInput {
  name?: string
  subject?: string
  bodyHtml?: string
  bodyText?: string
  active?: boolean
}

export interface ListTemplatesParams {
  active?: boolean
}

// El contenido que dispara bump de version cuando cambia.
const CONTENT_FIELDS = ['subject', 'bodyHtml', 'bodyText'] as const

// ────────────────────────────────────────────────────────────────
// Errors
// ────────────────────────────────────────────────────────────────

export class TemplateNotFoundError extends Error {
  constructor(id: string) {
    super(`Template ${id} not found`)
    this.name = 'TemplateNotFoundError'
  }
}

export class TemplateInUseError extends Error {
  constructor() {
    super('Template is in use by consent_requests and cannot be deleted')
    this.name = 'TemplateInUseError'
  }
}

// ────────────────────────────────────────────────────────────────
// Read
// ────────────────────────────────────────────────────────────────

export async function listTemplates(params: ListTemplatesParams = {}): Promise<ConsentTemplate[]> {
  return prisma.consentTemplate.findMany({
    where: params.active !== undefined ? { active: params.active } : {},
    orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
  })
}

export async function getTemplate(id: string): Promise<ConsentTemplate> {
  const template = await prisma.consentTemplate.findUnique({ where: { id } })
  if (!template) throw new TemplateNotFoundError(id)
  return template
}

// ────────────────────────────────────────────────────────────────
// Write
// ────────────────────────────────────────────────────────────────

export async function createTemplate(
  input: CreateTemplateInput,
  actorId: string,
): Promise<ConsentTemplate> {
  return prisma.$transaction(async (tx) => {
    const template = await tx.consentTemplate.create({
      data: {
        name: input.name.trim(),
        subject: input.subject.trim(),
        bodyHtml: input.bodyHtml,
        bodyText: input.bodyText,
        version: 1,
        active: input.active ?? true,
      },
    })
    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'consent_template',
        entityId: template.id,
        action: 'created',
        after: {
          name: template.name,
          subject: template.subject,
          version: template.version,
          active: template.active,
        },
      },
      tx,
    )
    return template
  })
}

export async function updateTemplate(
  id: string,
  patch: UpdateTemplateInput,
  actorId: string,
): Promise<ConsentTemplate> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.consentTemplate.findUnique({ where: { id } })
    if (!before) throw new TemplateNotFoundError(id)

    const contentChanged = CONTENT_FIELDS.some(
      (f) => patch[f] !== undefined && patch[f] !== before[f],
    )

    const data: Prisma.ConsentTemplateUpdateInput = {}
    if (patch.name !== undefined) data.name = patch.name.trim()
    if (patch.subject !== undefined) data.subject = patch.subject.trim()
    if (patch.bodyHtml !== undefined) data.bodyHtml = patch.bodyHtml
    if (patch.bodyText !== undefined) data.bodyText = patch.bodyText
    if (patch.active !== undefined) data.active = patch.active
    if (contentChanged) data.version = { increment: 1 }

    if (Object.keys(data).length === 0) return before

    const after = await tx.consentTemplate.update({ where: { id }, data })

    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'consent_template',
        entityId: id,
        action: contentChanged ? 'content_updated' : 'updated',
        before: {
          name: before.name,
          subject: before.subject,
          bodyHtmlLength: before.bodyHtml.length,
          version: before.version,
          active: before.active,
        },
        after: {
          name: after.name,
          subject: after.subject,
          bodyHtmlLength: after.bodyHtml.length,
          version: after.version,
          active: after.active,
        },
      },
      tx,
    )

    return after
  })
}

export async function deleteTemplate(id: string, actorId: string): Promise<void> {
  const usage = await prisma.consentRequest.count({ where: { templateId: id } })
  if (usage > 0) throw new TemplateInUseError()

  await prisma.$transaction(async (tx) => {
    const before = await tx.consentTemplate.findUnique({ where: { id } })
    if (!before) throw new TemplateNotFoundError(id)
    await tx.consentTemplate.delete({ where: { id } })
    await writeAudit(
      {
        actorId,
        actorKind: 'USER',
        entityType: 'consent_template',
        entityId: id,
        action: 'deleted',
        before: { name: before.name, version: before.version },
      },
      tx,
    )
  })
}

// ────────────────────────────────────────────────────────────────
// Preview — render simulado con variables básicas
// ────────────────────────────────────────────────────────────────

export interface PreviewVariables {
  artistName?: string
  confirmUrl?: string
  unsubscribeUrl?: string
}

export interface RenderedTemplate {
  subject: string
  html: string
  text: string
  version: number
}

const VARIABLE_MAP: Array<[RegExp, keyof PreviewVariables, string]> = [
  [/\{\{\s*artistName\s*\}\}/g, 'artistName', 'Nombre del artista'],
  [/\{\{\s*confirmUrl\s*\}\}/g, 'confirmUrl', 'https://example.com/confirm/TOKEN'],
  [/\{\{\s*unsubscribeUrl\s*\}\}/g, 'unsubscribeUrl', 'https://example.com/unsubscribe/TOKEN'],
]

export async function renderTemplate(
  id: string,
  vars: PreviewVariables = {},
): Promise<RenderedTemplate> {
  const template = await getTemplate(id)
  return {
    subject: applyVars(template.subject, vars),
    html: applyVars(template.bodyHtml, vars),
    text: applyVars(template.bodyText, vars),
    version: template.version,
  }
}

function applyVars(source: string, vars: PreviewVariables): string {
  let result = source
  for (const [pattern, key, placeholder] of VARIABLE_MAP) {
    const value = vars[key] ?? placeholder
    result = result.replace(pattern, value)
  }
  return result
}
