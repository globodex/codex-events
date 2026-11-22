export const eventPhotoImageVariantValues = [
  'preview',
  'original'
] as const

export type EventPhotoImageVariant = typeof eventPhotoImageVariantValues[number]

export interface EventPhotoRecord {
  id: string
  eventId: string
  fileName: string | null
  isPubliclyVisible: boolean
  // The three fields below are part of the protected gallery only. The public gallery leaves
  // them out.
  isHighlighted?: boolean
  /** True for a photo that a participant added. The gallery lists it under "Uploaded by participants". */
  isParticipantUpload?: boolean
  /** True while the event team hides a participant photo. Only the people who manage the gallery receive a hidden photo. */
  isHidden?: boolean
  contentType: string
  width: number
  height: number
  createdAt: string
  /** The uploader. Null in the public gallery, and null for a participant photo unless the reader manages the gallery. */
  uploadedByUserId: string | null
  uploadedBy: {
    id: string
    displayName: string
  } | null
  previewUrl: string | null
  originalUrl: string | null
}

// Participant photos are the photos that participants add to the gallery of an event.

/** How many photos one participant can add to one event. Hidden photos count. */
export const maxParticipantPhotosPerEvent = 20

/**
 * Who adds participant photos to the gallery of an event. This is the only owner of that rule.
 *
 * A participant adds photos with a confirmed registration, after finishing the check-in flow,
 * in an event that allows participant photos. Credits and challenges play no role.
 *
 * The people who manage the gallery never add participant photos: what they upload is a photo
 * of the event team, also when they have a registration.
 */
export function canAddParticipantPhotos(person: {
  /** Event staff, a judge, an event admin, or a platform admin. */
  managesGallery: boolean
  /** The event allows participant photos (`events.participant_photos_enabled`). */
  participantPhotosEnabled: boolean
  /** The person has a confirmed (approved) registration of the event. */
  isApprovedParticipant: boolean
  /** What the check-in flow rule says about this person (`hasParticipantFinishedCheckInFlow`). */
  hasFinishedCheckInFlow: boolean
}) {
  return !person.managesGallery
    && person.participantPhotosEnabled
    && person.isApprovedParticipant
    && person.hasFinishedCheckInFlow
}
