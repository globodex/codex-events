import { asc, eq } from 'drizzle-orm'

import { getDatabase } from '#server/database/client'
import { evaluationCriteria } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { assertCompetitionEvent, getVisibleEventOrThrow, routeIdParamsSchema, serializeEvaluationCriterion } from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.evaluation-criteria',
  domain: 'judging',
  description: 'GET /api/events/:eventId/evaluation-criteria',
  rest: { method: 'GET', path: '/api/events/:eventId/evaluation-criteria' },
  input: { params: routeIdParamsSchema },
  output: 'list',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const database = getDatabase(h3Event)

  const event = await getVisibleEventOrThrow(h3Event, eventId)
  assertCompetitionEvent(event)

  const criteria = await database.query.evaluationCriteria.findMany({
    where: eq(evaluationCriteria.eventId, eventId),
    orderBy: [asc(evaluationCriteria.displayOrder)]
  })

  return apiList(
    criteria.map(serializeEvaluationCriterion),
    {
      total: criteria.length
    }
  )
})

export default defineStructuredOperationApiHandler(applicationOperation)
