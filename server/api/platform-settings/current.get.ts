import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  getPlatformSettings,
  serializePlatformSettings
} from '#server/domains/platform/settings'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.platform-settings.current',
  domain: 'administration',
  description: 'GET /api/platform-settings/current',
  rest: { method: 'GET', path: '/api/platform-settings/current' },
  input: {},
  output: 'data',
  capabilities: ['public'],
  effect: 'read'
}, async (h3Event) => {
  const settings = await getPlatformSettings(getDatabase(h3Event))

  return apiData(settings ? serializePlatformSettings(settings) : null)
})

export default defineStructuredOperationApiHandler(applicationOperation)
