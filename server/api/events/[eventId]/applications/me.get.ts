import { requirePlatformActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  getOwnUserApplication,
  serializeUserApplication
} from '#server/domains/applications'
import {
  getEventTermsDocumentOrThrow,
  getVisibleEventOrThrow,
  routeIdParamsSchema
} from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.applications.me',
  domain: 'participation',
  description: 'GET /api/events/:eventId/applications/me',
  rest: { method: 'GET', path: '/api/events/:eventId/applications/me' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const database = getDatabase(h3Event)

  await getVisibleEventOrThrow(h3Event, eventId)

  const application = await getOwnUserApplication(database, eventId, actor.platformUser.id)

  if (!application) {
    return apiData(null)
  }

  const applicationTermsDocument = application.applicationTermsDocumentId
    ? await getEventTermsDocumentOrThrow(
        database,
        eventId,
        application.applicationTermsDocumentId
      )
    : null

  return apiData(serializeUserApplication(application, {
    applicationTermsDocument
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
