import { requirePlatformActor } from '#server/auth/actor'
import { resolveEventAuthorization } from '#server/auth/authorization'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { getVisibleEventOrThrow, routeIdParamsSchema } from '#server/domains/events'
import { assertGuard } from '#server/domains/lifecycle-guard'
import {
  getShortlistView,
  assertShortlistViewAllowed
} from '#server/domains/outcomes'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.shortlist',
  domain: 'judging',
  description: 'GET /api/events/:eventId/shortlist',
  rest: { method: 'GET', path: '/api/events/:eventId/shortlist' },
  input: { params: routeIdParamsSchema },
  output: 'list',
  capabilities: ['event_judge', 'event_admin'],
  effect: 'read'
}, async (h3Event) => {
  await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const database = getDatabase(h3Event)
  const event = await getVisibleEventOrThrow(h3Event, eventId)
  const authorization = await resolveEventAuthorization(h3Event, eventId)
  const canViewShortlist = authorization.isPlatformAdmin
    || authorization.isEventAdmin
    || authorization.canReviewThroughAssignment

  assertGuard(canViewShortlist, {
    statusCode: 403,
    code: 'shortlist_access_denied',
    message: 'This operation requires judge or event admin access.',
    details: { eventId }
  })
  assertShortlistViewAllowed(event)

  const shortlistView = await getShortlistView(database, eventId)

  return apiList(shortlistView.entries, {
    total: shortlistView.entries.length,
    hasSavedShortlistSelection: shortlistView.hasSavedShortlistSelection
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
