import { z } from 'zod'

import { requireAuthenticatedActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import {
  listPlatformDocumentVersions,
  platformDocumentTypeSchema,
  serializePlatformDocument
} from '#server/domains/platform/documents'
import { parseValidatedParams } from '#server/http/validation'

const paramsSchema = z.object({
  documentType: platformDocumentTypeSchema
})

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.platform-documents.by-documentType.versions',
  domain: 'administration',
  description: 'GET /api/platform-documents/:documentType/versions',
  rest: { method: 'GET', path: '/api/platform-documents/:documentType/versions' },
  input: { params: paramsSchema },
  output: 'list',
  capabilities: ['platform_account'],
  effect: 'read'
}, async (h3Event) => {
  await requireAuthenticatedActor(h3Event)

  const { documentType } = parseValidatedParams(h3Event, paramsSchema)
  const documents = await listPlatformDocumentVersions(getDatabase(h3Event), documentType)

  return apiList(
    documents.map(serializePlatformDocument),
    {
      total: documents.length
    }
  )
})

export default defineStructuredOperationApiHandler(applicationOperation)
