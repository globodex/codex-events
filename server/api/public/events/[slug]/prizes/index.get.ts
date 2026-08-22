import { asc, desc, eq } from 'drizzle-orm'

import { getDatabase } from '#server/database/client'
import { prizes } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { assertCompetitionEvent, getPublicEventBySlugOrThrow, routeSlugParamsSchema, serializePublicPrize } from '#server/domains/events'
import {
  setPrivatePublicEventCacheHeaders,
  setPublicEventCacheHeaders
} from '#server/domains/events/public-cache'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.public.events.by-slug.prizes',
  domain: 'participation',
  description: 'GET /api/public/events/:slug/prizes',
  rest: { method: 'GET', path: '/api/public/events/:slug/prizes' },
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

  const prizeList = await database.query.prizes.findMany({
    where: eq(prizes.eventId, event.id),
    orderBy: [asc(prizes.displayOrder), asc(prizes.rankEnd), desc(prizes.rankStart), asc(prizes.createdAt)]
  })

  const response = apiList(
    prizeList.map(serializePublicPrize),
    {
      total: prizeList.length
    }
  )

  setPublicEventCacheHeaders(h3Event, 'public-event-prizes', response)

  return response
})

export default defineStructuredOperationApiHandler(applicationOperation)
