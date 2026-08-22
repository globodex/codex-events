import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  getPlatformLegalSettings,
  serializePlatformLegalSettings
} from '#server/domains/platform/legal-settings'
import { measureRequestPhase } from '#server/http/request-timing'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.platform-legal-settings.current',
  domain: 'administration',
  description: 'GET /api/platform-legal-settings/current',
  rest: { method: 'GET', path: '/api/platform-legal-settings/current' },
  input: {},
  output: 'data',
  capabilities: ['public'],
  effect: 'read'
}, async (h3Event) => {
  const database = getDatabase(h3Event)
  const settings = await measureRequestPhase(
    h3Event,
    'd1',
    () => getPlatformLegalSettings(database)
  )

  return apiData(settings ? serializePlatformLegalSettings(settings) : null)
})

export default defineStructuredOperationApiHandler(applicationOperation)
