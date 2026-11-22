import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { isEventLumaGuestListEnabled } from '#server/domains/applications'
import { countEventLumaGuests } from '#server/domains/applications/luma-guest-list'
import { syncEventLumaGuestList } from '#server/domains/applications/luma-guest-list-sync'
import { requireEventAdmin, routeIdParamsSchema } from '#server/domains/events'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { defineApiHandler } from '#server/http/api-handler'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

// Imports or refreshes the private Luma guest list of an event.
// The response carries counts only. Guest emails and statuses must never be returned.
export default defineApiHandler(async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { event } = await requireEventAdmin(h3Event, eventId)
  const database = getDatabase(h3Event)

  assertGuard(isEventLumaGuestListEnabled(event), {
    statusCode: 409,
    code: 'luma_guest_list_disabled',
    message: 'Turn on the Luma guest list for this event before you import it.'
  })

  const applicationCounts = await syncEventLumaGuestList({
    h3Event,
    database,
    event,
    apiBaseUrl: useRuntimeConfig(h3Event).luma.apiBaseUrl
  })
  const guestCounts = await countEventLumaGuests(database, eventId)

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.luma_guest_list_synced',
    metadata: { ...guestCounts, ...applicationCounts }
  })

  return apiData({ ...guestCounts, ...applicationCounts })
})
