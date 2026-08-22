import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { getCurrentPlatformDocuments, serializePlatformDocument } from '#server/domains/platform/documents'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.platform-documents.current',
  domain: 'administration',
  description: 'GET /api/platform-documents/current',
  rest: { method: 'GET', path: '/api/platform-documents/current' },
  input: {},
  output: 'data',
  capabilities: ['public'],
  effect: 'read'
}, async (h3Event) => {
  const currentDocuments = await getCurrentPlatformDocuments(getDatabase(h3Event))

  return apiData({
    privacy_policy: currentDocuments.privacy_policy ? serializePlatformDocument(currentDocuments.privacy_policy) : null,
    platform_terms: currentDocuments.platform_terms ? serializePlatformDocument(currentDocuments.platform_terms) : null
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
