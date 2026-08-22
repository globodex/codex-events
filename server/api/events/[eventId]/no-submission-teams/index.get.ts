import { requirePlatformActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { assertCompetitionEvent, requireEventAdmin, routeIdParamsSchema } from '#server/domains/events'
import { listNoSubmissionTeams } from '#server/domains/submissions'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.no-submission-teams',
  domain: 'participation',
  description: 'GET /api/events/:eventId/no-submission-teams',
  rest: { method: 'GET', path: '/api/events/:eventId/no-submission-teams' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'read'
}, async (h3Event) => {
  await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { event } = await requireEventAdmin(h3Event, eventId)
  assertCompetitionEvent(event)
  const data = await listNoSubmissionTeams(getDatabase(h3Event), event.id)

  return apiData(data)
})

export default defineStructuredOperationApiHandler(applicationOperation)
