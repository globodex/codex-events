import {
  getEventPhotoViewer,
  listEventPhotoRecords,
  mayAddParticipantPhotos,
  mustFinishCheckInFlowToAddPhotos
} from '#server/domains/events/photos'
import type { AccountEventGalleryPage } from '#shared/domains/events/account-event-gallery-page'
import { accountEventGalleryPageSchema } from '#shared/domains/events/account-event-gallery-page'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { defineAccountEventPageRoute } from './account-event-page-contract'
import { getAccountEventPageAccess } from './account-event-page-context'

export const accountEventGalleryPageRoute = defineAccountEventPageRoute({
  page: 'gallery',
  schema: accountEventGalleryPageSchema,
  authorize: async (context) => {
    if (getEventPhotoViewer(context.authorization).canManage) {
      return
    }

    const access = await getAccountEventPageAccess(context)
    assertGuard(access.application?.status === 'approved', {
      statusCode: 403,
      code: 'event_photo_access_required',
      message: 'This operation requires approved participant access or an explicit event role.',
      details: { eventId: context.event.id }
    })
  },
  load: async (context): Promise<AccountEventGalleryPage> => {
    const person = {
      event: context.event,
      viewer: getEventPhotoViewer(context.authorization),
      // `context.access` holds the registration of every caller without a role in the event.
      // A caller with a role manages the gallery and never adds participant photos, so their
      // registration is not read here.
      application: context.access?.application
    }

    return {
      photos: await listEventPhotoRecords(context.database, context.event.id, person.viewer),
      canAddParticipantPhotos: mayAddParticipantPhotos(person),
      mustFinishCheckInFlowToAddPhotos: mustFinishCheckInFlowToAddPhotos(person)
    }
  }
})
