import { z } from 'zod'

const photoSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  fileName: z.string().nullable(),
  isPubliclyVisible: z.boolean(),
  isHighlighted: z.boolean().optional(),
  // True for a photo that a participant added. The gallery lists it under "Photos from participants".
  isParticipantUpload: z.boolean().optional(),
  // True while the event team hides a participant photo. Only the people who manage the gallery
  // receive a hidden photo.
  isHidden: z.boolean().optional(),
  contentType: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  createdAt: z.string(),
  uploadedByUserId: z.string().nullable(),
  uploadedBy: z.object({
    id: z.string(),
    displayName: z.string()
  }).nullable(),
  previewUrl: z.string().nullable(),
  originalUrl: z.string().nullable()
})

export const accountEventGalleryPageSchema = z.object({
  photos: z.array(photoSchema),
  // True when the caller adds photos as a participant (`canAddParticipantPhotos` in
  // `shared/domains/events/photos.ts`). False for the people who manage the gallery: they add
  // photos of the event team.
  canAddParticipantPhotos: z.boolean(),
  // True when the caller adds photos as a participant as soon as they finish the check-in flow.
  // The Gallery tab then points them to their next step.
  mustFinishCheckInFlowToAddPhotos: z.boolean()
})

export type AccountEventGalleryPhoto = z.infer<typeof photoSchema>
export type AccountEventGalleryPage = z.infer<typeof accountEventGalleryPageSchema>
