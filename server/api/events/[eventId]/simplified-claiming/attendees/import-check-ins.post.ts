import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { fetchLumaCheckedInAttendees } from '#server/domains/credits/luma-check-ins'
import { getSimplifiedClaimingSummary, mergeSimplifiedClaimingAttendees } from '#server/domains/credits/simplified-claiming'
import { requireEventAdmin, routeIdParamsSchema } from '#server/domains/events'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { defineApiHandler } from '#server/http/api-handler'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

export default defineApiHandler(async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { event } = await requireEventAdmin(h3Event, eventId)
  const database = getDatabase(h3Event)

  assertGuard(event.eventType === 'meetup' && event.simplifiedClaimingEnabled, {
    statusCode: 409,
    code: 'simplified_claiming_disabled',
    message: 'Enable simplified attendee claiming before importing Luma check-ins.'
  })
  assertGuard(Boolean(event.lumaEventApiId && event.lumaApiKey), {
    statusCode: 409,
    code: 'simplified_claiming_luma_not_configured',
    message: 'Save the Luma event ID and API key before importing check-ins.'
  })
  const attendees = await fetchLumaCheckedInAttendees({
    eventApiId: event.lumaEventApiId!,
    apiKey: event.lumaApiKey!,
    apiBaseUrl: useRuntimeConfig(h3Event).luma.apiBaseUrl
  })
  await mergeSimplifiedClaimingAttendees(database, eventId, attendees)
  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.simplified_claiming_check_ins_imported',
    metadata: { eligibleCount: attendees.length }
  })
  const summary = await getSimplifiedClaimingSummary(database, event)
  return apiData({ eligibleCount: attendees.length, attendeeCount: summary.attendeeCount })
})
