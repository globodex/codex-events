import { requirePlatformActor } from '#server/auth/actor'
import { assertPlatformAdminAccess } from '#server/auth/authorization'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  eventOrganizerUserParamsSchema,
  grantEventOrganizerAccess
} from '#server/domains/platform/event-organizers'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'put.event-organizers.by-userId',
  domain: 'administration',
  description: 'PUT /api/event-organizers/:userId',
  rest: { method: 'PUT', path: '/api/event-organizers/:userId' },
  input: { params: eventOrganizerUserParamsSchema },
  output: 'data',
  capabilities: ['platform_admin'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  assertPlatformAdminAccess(actor)

  const { userId } = parseValidatedParams(h3Event, eventOrganizerUserParamsSchema)
  const result = await grantEventOrganizerAccess(getDatabase(h3Event), {
    actorUserId: actor.platformUser.id,
    userId
  })

  return apiData(result)
})

export default defineStructuredOperationApiHandler(applicationOperation)
