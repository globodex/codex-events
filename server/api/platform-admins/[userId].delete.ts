import { requirePlatformActor } from '#server/auth/actor'
import { assertPlatformAdminAccess } from '#server/auth/authorization'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  platformAdminUserParamsSchema,
  revokePlatformAdminAccess
} from '#server/domains/platform/admins'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'delete.platform-admins.by-userId',
  domain: 'administration',
  description: 'DELETE /api/platform-admins/:userId',
  rest: { method: 'DELETE', path: '/api/platform-admins/:userId' },
  input: { params: platformAdminUserParamsSchema },
  output: 'data',
  capabilities: ['platform_admin'],
  effect: 'delete'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  assertPlatformAdminAccess(actor)

  const { userId } = parseValidatedParams(h3Event, platformAdminUserParamsSchema)
  const result = await revokePlatformAdminAccess(getDatabase(h3Event), {
    actorUserId: actor.platformUser.id,
    userId
  })

  return apiData(result)
})

export default defineStructuredOperationApiHandler(applicationOperation)
