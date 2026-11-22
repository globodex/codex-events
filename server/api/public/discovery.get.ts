import { z } from 'zod'

import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { getDatabase } from '#server/database/client'
import { setPublicEventCacheHeaders } from '#server/domains/events/public-cache'
import { getPublicDiscoveryPage } from '#server/domains/events/public-discovery'
import { apiData } from '#server/http/api-response'
import { measureRequestPhase } from '#server/http/request-timing'
import { parseValidatedQuery } from '#server/http/validation'

const discoveryQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  tab: z.enum(['active', 'past']).optional()
})

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.public.discovery',
  domain: 'events',
  description: 'Get a page of public event cards and counts for the active and past tabs.',
  rest: { method: 'GET', path: '/api/public/discovery' },
  input: { query: discoveryQuery },
  output: 'data',
  capabilities: ['public'],
  effect: 'read'
}, async (event) => {
  const query = parseValidatedQuery(event, discoveryQuery)
  const database = getDatabase(event)
  const response = apiData(await measureRequestPhase(event, 'd1', () => getPublicDiscoveryPage(database, query)))
  setPublicEventCacheHeaders(event, 'public-discovery', response)
  return response
})

export default defineStructuredOperationApiHandler(applicationOperation)
