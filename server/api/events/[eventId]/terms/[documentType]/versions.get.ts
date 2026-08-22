import { and, desc, eq } from 'drizzle-orm'

import { getDatabase } from '#server/database/client'
import { eventTermsDocuments } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import {
  assertCompetitionEvent,
  requireEventAdmin,
  serializeEventTermsDocument,
  termsDocumentParamsSchema
} from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.terms.by-documentType.versions',
  domain: 'administration',
  description: 'GET /api/events/:eventId/terms/:documentType/versions',
  rest: { method: 'GET', path: '/api/events/:eventId/terms/:documentType/versions' },
  input: { params: termsDocumentParamsSchema },
  output: 'list',
  capabilities: ['event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId, documentType } = parseValidatedParams(h3Event, termsDocumentParamsSchema)
  const database = getDatabase(h3Event)

  const { event } = await requireEventAdmin(h3Event, eventId)
  if (documentType === 'winner_terms') {
    assertCompetitionEvent(event)
  }

  const documents = await database.query.eventTermsDocuments.findMany({
    where: and(
      eq(eventTermsDocuments.eventId, eventId),
      eq(eventTermsDocuments.documentType, documentType)
    ),
    orderBy: [desc(eventTermsDocuments.version)]
  })

  return apiList(
    documents.map(serializeEventTermsDocument),
    {
      total: documents.length
    }
  )
})

export default defineStructuredOperationApiHandler(applicationOperation)
