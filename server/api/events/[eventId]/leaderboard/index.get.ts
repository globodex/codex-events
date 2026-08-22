import { requirePlatformActor } from '#server/auth/actor'
import { resolveEventAuthorization } from '#server/auth/authorization'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { assertCompetitionEvent, getVisibleEventOrThrow, routeIdParamsSchema } from '#server/domains/events'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { listLeaderboardEntries, serializeLeaderboardEntry } from '#server/domains/outcomes'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.leaderboard',
  domain: 'judging',
  description: 'GET /api/events/:eventId/leaderboard',
  rest: { method: 'GET', path: '/api/events/:eventId/leaderboard' },
  input: { params: routeIdParamsSchema },
  output: 'list',
  capabilities: ['event_judge', 'event_admin'],
  effect: 'read'
}, async (h3Event) => {
  await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const database = getDatabase(h3Event)

  const event = await getVisibleEventOrThrow(h3Event, eventId)
  assertCompetitionEvent(event)
  const authorization = await resolveEventAuthorization(h3Event, eventId)
  const canViewLeaderboard = authorization.isPlatformAdmin
    || authorization.isEventAdmin
    || authorization.canReviewThroughAssignment

  assertGuard(canViewLeaderboard, {
    statusCode: 403,
    code: 'leaderboard_access_denied',
    message: 'This operation requires judge or event admin access.',
    details: { eventId }
  })

  const leaderboardEntries = await listLeaderboardEntries(database, eventId)

  return apiList(
    leaderboardEntries.map(serializeLeaderboardEntry),
    {
      total: leaderboardEntries.length
    }
  )
})

export default defineStructuredOperationApiHandler(applicationOperation)
