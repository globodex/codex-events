import { requirePlatformAccountActor } from '#server/auth/actor'
import { assertPlatformAdminAccess } from '#server/auth/authorization'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  platformLegalSettingsBodySchema,
  serializePlatformLegalSettings,
  upsertPlatformLegalSettings
} from '#server/domains/platform/legal-settings'
import { parseValidatedBody } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.platform-legal-settings.current',
  domain: 'administration',
  description: 'PATCH /api/platform-legal-settings/current',
  rest: { method: 'PATCH', path: '/api/platform-legal-settings/current' },
  input: { body: platformLegalSettingsBodySchema },
  output: 'data',
  capabilities: ['platform_admin'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformAccountActor(h3Event)
  assertPlatformAdminAccess(actor)

  const body = await parseValidatedBody(h3Event, platformLegalSettingsBodySchema)
  const settings = await upsertPlatformLegalSettings(
    getDatabase(h3Event),
    body,
    actor.platformUser.id
  )

  return apiData(serializePlatformLegalSettings(settings))
})

export default defineStructuredOperationApiHandler(applicationOperation)
