import type { EmailPurpose, EmailMessage, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getEmailProvider } from '@/services/email/factory'
import type { SendEmailParams } from '@/services/email/email.provider'

/**
 * Envía un email a través del provider configurado y persiste una fila en
 * email_messages. La escritura se hace ANTES del provider call (estado=QUEUED)
 * y se actualiza después con el providerMessageId (estado=SENT) o con el
 * mensaje de error (estado=FAILED). Nada de sending outbound aquí — este
 * módulo es puro plumbing y sirve tanto para propósito NEWSLETTER como
 * DOUBLE_OPTIN como CONSENT_REQUEST (fase 6).
 */
export async function sendEmail(
  params: SendEmailParams,
): Promise<{ message: EmailMessage; providerMessageId: string }> {
  const provider = getEmailProvider()

  const message = await prisma.emailMessage.create({
    data: {
      contactId: params.contactId ?? null,
      purpose: params.purpose,
      relatedId: params.relatedId ?? null,
      provider: provider.name,
      providerMessageId: 'pending',
      recipient: params.to.toLowerCase().trim(),
      subject: params.subject,
      templateId: params.templateId ?? null,
      textVersion: params.textVersion ?? params.text,
      status: 'QUEUED',
    },
  })

  try {
    const result = await provider.send(params)
    const updated = await prisma.emailMessage.update({
      where: { id: message.id },
      data: {
        providerMessageId: result.providerMessageId,
        status: 'SENT',
        sentAt: new Date(),
      },
    })
    return { message: updated, providerMessageId: result.providerMessageId }
  } catch (err) {
    await prisma.emailMessage.update({
      where: { id: message.id },
      data: {
        status: 'FAILED',
        error: (err as Error).message,
      },
    })
    throw err
  }
}

export type { EmailPurpose, Prisma }
