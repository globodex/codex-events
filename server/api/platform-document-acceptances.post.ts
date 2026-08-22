import { z } from 'zod'

import { requirePlatformAccountActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { recordPlatformDocumentAcceptance, serializePlatformDocument } from '#server/domains/platform/documents'
import { parseValidatedBody } from '#server/http/validation'

const bodySchema = z.object({
  platformDocumentId: z.string().trim().min(1)
})

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.platform-document-acceptances',
  domain: 'administration',
  description: 'POST /api/platform-document-acceptances',
  rest: { method: 'POST', path: '/api/platform-document-acceptances' },
  input: { body: bodySchema },
  output: 'data',
  capabilities: ['platform_account'],
  effect: 'action'
}, async (h3Event) => {
  const actor = await requirePlatformAccountActor(h3Event)
  const body = await parseValidatedBody(h3Event, bodySchema)

  const { acceptance, document } = await recordPlatformDocumentAcceptance(
    getDatabase(h3Event),
    actor.platformUser.id,
    {
      platformDocumentId: body.platformDocumentId
    }
  )

  return apiData({
    acceptance: {
      id: acceptance.id,
      userId: acceptance.userId,
      platformDocumentId: acceptance.platformDocumentId,
      acceptedAt: acceptance.acceptedAt
    },
    document: serializePlatformDocument(document)
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
