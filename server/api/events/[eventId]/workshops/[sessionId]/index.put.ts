import { z } from 'zod'

import { workshopContentSchema } from '#shared/domains/events/workshops'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { routeIdParamsSchema } from '#server/domains/events'
import { saveWorkshopContent } from '#server/domains/events/workshops'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

const workshopParamsSchema = routeIdParamsSchema.extend({ sessionId: z.string().trim().min(1).max(100) })

export const applicationOperation = defineStructuredRouteOperation({
  id: 'put.events.by-eventId.workshops.by-sessionId',
  domain: 'administration',
  description: 'PUT /api/events/:eventId/workshops/:sessionId',
  rest: { method: 'PUT', path: '/api/events/:eventId/workshops/:sessionId' },
  input: { params: workshopParamsSchema, body: workshopContentSchema },
  output: 'data',
  capabilities: ['event_admin', 'event_staff'],
  effect: 'update'
}, async (event) => {
  const { eventId, sessionId } = parseValidatedParams(event, workshopParamsSchema)
  const content = await parseValidatedBody(event, workshopContentSchema)
  return apiData(await saveWorkshopContent(event, eventId, sessionId, content))
})

export default defineStructuredOperationApiHandler(applicationOperation)
