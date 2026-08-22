import { asc, desc, eq } from 'drizzle-orm'

import { getDatabase } from '#server/database/client'
import { prizes } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { assertCompetitionEvent, getVisibleEventOrThrow, routeIdParamsSchema, serializePrize } from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.prizes',
  domain: 'participation',
  description: 'GET /api/events/:eventId/prizes',
  rest: { method: 'GET', path: '/api/events/:eventId/prizes' },
  input: { params: routeIdParamsSchema },
  output: 'list',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const database = getDatabase(h3Event)

  const event = await getVisibleEventOrThrow(h3Event, eventId)
  assertCompetitionEvent(event)

  const prizeList = await database.query.prizes.findMany({
    where: eq(prizes.eventId, eventId),
    orderBy: [asc(prizes.displayOrder), asc(prizes.rankEnd), desc(prizes.rankStart), asc(prizes.createdAt)]
  })

  return apiList(
    prizeList.map(serializePrize),
    {
      total: prizeList.length
    }
  )
})

export default defineStructuredOperationApiHandler(applicationOperation)
