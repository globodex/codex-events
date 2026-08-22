import { asc, eq } from 'drizzle-orm'

import { getDatabase } from '#server/database/client'
import { evaluationCriteria } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import {
  assertCompetitionEvent,
  getPublicEventBySlugOrThrow,
  routeSlugParamsSchema,
  serializePublicEvaluationCriterion
} from '#server/domains/events'
import {
  setPrivatePublicEventCacheHeaders,
  setPublicEventCacheHeaders
} from '#server/domains/events/public-cache'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.public.events.by-slug.evaluation-criteria',
  domain: 'judging',
  description: 'GET /api/public/events/:slug/evaluation-criteria',
  rest: { method: 'GET', path: '/api/public/events/:slug/evaluation-criteria' },
  input: { params: routeSlugParamsSchema },
  output: 'list',
  capabilities: ['public'],
  effect: 'read'
}, async (h3Event) => {
  setPrivatePublicEventCacheHeaders(h3Event)

  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)
  const database = getDatabase(h3Event)
  const event = await getPublicEventBySlugOrThrow(database, slug)
  assertCompetitionEvent(event)

  const criteria = await database.query.evaluationCriteria.findMany({
    where: eq(evaluationCriteria.eventId, event.id),
    orderBy: [asc(evaluationCriteria.displayOrder)]
  })

  const response = apiList(
    criteria.map(serializePublicEvaluationCriterion),
    {
      total: criteria.length
    }
  )

  setPublicEventCacheHeaders(h3Event, 'public-event-evaluation-criteria', response)

  return response
})

export default defineStructuredOperationApiHandler(applicationOperation)
