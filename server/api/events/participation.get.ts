import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { listOwnEventParticipation } from '#server/domains/events/participation'
import { requirePlatformActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.participation',
  domain: 'events',
  description: 'GET /api/events/participation',
  rest: { method: 'GET', path: '/api/events/participation' },
  input: {},
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const participation = await listOwnEventParticipation(
    getDatabase(h3Event),
    actor.platformUser.id
  )

  return apiData(participation)
})

export default defineStructuredOperationApiHandler(applicationOperation)
