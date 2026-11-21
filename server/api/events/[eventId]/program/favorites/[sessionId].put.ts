import { z } from 'zod'

import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { routeIdParamsSchema } from '#server/domains/events'
import { writeEventProgramFavorite } from '#server/domains/events/program'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

const paramsSchema = routeIdParamsSchema.extend({ sessionId: z.string().trim().min(1).max(100) })
const bodySchema = z.object({ saved: z.boolean() }).strict()

export const applicationOperation = defineStructuredRouteOperation({
  id: 'put.events.by-eventId.program.favorites.by-sessionId',
  domain: 'participation',
  description: 'PUT /api/events/:eventId/program/favorites/:sessionId',
  rest: { method: 'PUT', path: '/api/events/:eventId/program/favorites/:sessionId' },
  input: { params: paramsSchema, body: bodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'update'
}, async (h3Event) => {
  const { eventId, sessionId } = parseValidatedParams(h3Event, paramsSchema)
  const { saved } = await parseValidatedBody(h3Event, bodySchema)
  return apiData(await writeEventProgramFavorite(h3Event, eventId, sessionId, saved))
})

export default defineStructuredOperationApiHandler(applicationOperation)
