import { z } from 'zod'

import { isHttpsCouponUrl } from '#shared/domains/credits/simplified-giveaways'

// A workshop is a program session with staff (`staffIds` in `program.ts`). It has its own page on
// the Agenda tab. Its staff and the event admins write its description and add slides, materials
// and links there. Each item is a link or a PDF that they upload.

export const workshopResourceKinds = ['slides', 'material', 'link'] as const

export type WorkshopResourceKind = typeof workshopResourceKinds[number]

/** The largest PDF that the staff of a workshop can upload. */
export const workshopPdfMaxBytes = 20 * 1024 * 1024

export const workshopResourceSchema = z.object({
  id: z.string().trim().min(1).max(100),
  kind: z.enum(workshopResourceKinds),
  title: z.string().trim()
    .min(1, 'Give every item a title.')
    .max(120, 'Use titles of 120 characters or fewer.'),
  // A link, or an uploaded PDF of this workshop by its file id and name. Never both.
  url: z.string().trim()
    .max(2000, 'Use links of 2,000 characters or fewer.')
    .refine(isHttpsCouponUrl, 'Every link needs to start with https://.')
    .optional(),
  file: z.object({
    id: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(200)
  }).optional()
}).refine(resource => Boolean(resource.url) !== Boolean(resource.file), {
  message: 'Add a link or a PDF to every item.'
})

export const workshopContentSchema = z.object({
  description: z.string().trim().max(20_000, 'Keep the description under 20,000 characters.'),
  resources: z.array(workshopResourceSchema).max(30, 'Use 30 items or fewer.')
}).refine(({ resources }) => new Set(resources.map(resource => resource.id)).size === resources.length, {
  path: ['resources'],
  message: 'Every item needs its own ID.'
})

export type WorkshopResource = z.infer<typeof workshopResourceSchema>
export type WorkshopContent = z.infer<typeof workshopContentSchema>

/** Where an uploaded PDF of a workshop opens. Only people who read the program can open it. */
export function workshopFilePath(eventId: string, sessionId: string, fileId: string) {
  return `/api/events/${encodeURIComponent(eventId)}/workshops/${encodeURIComponent(sessionId)}/files/${encodeURIComponent(fileId)}`
}

/** Where a resource opens: its link, or its uploaded PDF. */
export function workshopResourceHref(eventId: string, sessionId: string, resource: WorkshopResource) {
  return resource.file ? workshopFilePath(eventId, sessionId, resource.file.id) : resource.url!
}
