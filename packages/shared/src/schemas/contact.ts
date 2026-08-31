import { z } from 'zod'
import { CONTACT_STATUS_VALUES } from '../enums/contact-status'
import { EMAIL_STATUS_VALUES } from '../enums/email-status'
import { CONSENT_STATUS_VALUES } from '../enums/consent-status'
import { PERMISSION_VALUES } from '../enums/permission'

export const ContactCreateSchema = z.object({
  artistName: z.string().min(1).max(200),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  discipline: z.string().max(100).optional(),
  country: z.string().length(2).optional(),
  city: z.string().max(100).optional(),
  language: z.string().max(10).optional(),
  notes: z.string().max(2000).optional(),
})
export type ContactCreateInput = z.infer<typeof ContactCreateSchema>

export const ContactUpdateSchema = ContactCreateSchema.partial()
export type ContactUpdateInput = z.infer<typeof ContactUpdateSchema>

export const ContactStatusSchema = z.enum(CONTACT_STATUS_VALUES as [string, ...string[]])
export const EmailStatusSchema = z.enum(EMAIL_STATUS_VALUES as [string, ...string[]])
export const ConsentStatusSchema = z.enum(CONSENT_STATUS_VALUES as [string, ...string[]])
export const PermissionSchema = z.enum(PERMISSION_VALUES as [string, ...string[]])
