import { z } from 'zod'

import { requirePlatformAccountActor } from '#server/auth/actor'
import { assertPlatformAdminAccess } from '#server/auth/authorization'
import { getDatabase } from '#server/database/client'
import {
  createPlatformDocumentVersion,
  createPlatformDocumentVersionBodySchema,
  platformDocumentTypeSchema,
  serializePlatformDocument
} from '#server/domains/platform/documents'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

const paramsSchema = z.object({
  documentType: platformDocumentTypeSchema
})

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.platform-documents.by-documentType.versions',
  domain: 'administration',
  description: 'POST /api/platform-documents/:documentType/versions',
  rest: { method: 'POST', path: '/api/platform-documents/:documentType/versions' },
  input: { params: paramsSchema, body: createPlatformDocumentVersionBodySchema },
  output: 'data',
  capabilities: ['platform_admin'],
  effect: 'create'
}, async (h3Event) => {
  const actor = await requirePlatformAccountActor(h3Event)
  assertPlatformAdminAccess(actor)

  const { documentType } = parseValidatedParams(h3Event, paramsSchema)
  const body = await parseValidatedBody(h3Event, createPlatformDocumentVersionBodySchema)
  const document = await createPlatformDocumentVersion(getDatabase(h3Event), {
    documentType,
    title: body.title,
    content: body.content,
    publishedAt: body.publishedAt,
    actorUserId: actor.platformUser.id
  })

  return apiData(serializePlatformDocument(document))
})

export default defineStructuredOperationApiHandler(applicationOperation)
