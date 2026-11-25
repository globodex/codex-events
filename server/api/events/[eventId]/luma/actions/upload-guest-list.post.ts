import { readMultipartFormData } from 'h3'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { isEventLumaGuestListEnabled } from '#server/domains/applications'
import { lumaGuestListCsvLimits, parseLumaGuestListCsv } from '#server/domains/applications/luma-guest-list'
import { uploadEventLumaGuestList } from '#server/domains/applications/luma-guest-list-sync'
import { requireEventAdmin, routeIdParamsSchema } from '#server/domains/events'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { defineApiHandler } from '#server/http/api-handler'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

// Replaces the private Luma guest list of an event with the guest CSV that Luma exports.
// The response and the audit log carry counts only. Guest emails and statuses must never be returned.
export default defineApiHandler(async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { event } = await requireEventAdmin(h3Event, eventId)
  const database = getDatabase(h3Event)

  assertGuard(isEventLumaGuestListEnabled(event), {
    statusCode: 409,
    code: 'luma_guest_list_disabled',
    message: 'Turn on the Luma guest list for this event before you upload it.'
  })

  const multipart = await readMultipartFormData(h3Event)
  const file = multipart?.find(part => part.name === 'file')?.data

  assertGuard(Boolean(file?.byteLength), {
    statusCode: 400,
    code: 'luma_guest_list_file_missing',
    message: 'Upload the guest CSV that Luma exports.'
  })
  assertGuard(file!.byteLength <= lumaGuestListCsvLimits.maxBytes, {
    statusCode: 413,
    code: 'luma_guest_list_file_too_large',
    message: 'The Luma CSV must be 5 MB or smaller.'
  })

  const guests = parseLumaGuestListCsv(new TextDecoder().decode(file))
  const summary = await uploadEventLumaGuestList({ h3Event, database, event, guests })

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.luma_guest_list_uploaded',
    metadata: summary
  })

  return apiData(summary)
})
