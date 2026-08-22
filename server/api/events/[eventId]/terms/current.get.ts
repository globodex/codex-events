import { requireAuthenticatedActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { getCurrentEventTerms, getVisibleEventOrThrow, routeIdParamsSchema, serializeEventTermsDocument } from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.terms.current',
  domain: 'administration',
  description: 'GET /api/events/:eventId/terms/current',
  rest: { method: 'GET', path: '/api/events/:eventId/terms/current' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['platform_account'],
  effect: 'read'
}, async (h3Event) => {
  await requireAuthenticatedActor(h3Event)

  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const event = await getVisibleEventOrThrow(h3Event, eventId)
  const currentTerms = await getCurrentEventTerms(getDatabase(h3Event), event)

  return apiData({
    application_terms: currentTerms.applicationTerms ? serializeEventTermsDocument(currentTerms.applicationTerms) : null,
    winner_terms: currentTerms.winnerTerms ? serializeEventTermsDocument(currentTerms.winnerTerms) : null
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
