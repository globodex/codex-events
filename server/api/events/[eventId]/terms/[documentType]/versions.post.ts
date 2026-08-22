import { eq, sql } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { eventTermsDocuments, events } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertCompetitionEvent,
  createTermsVersionBodySchema,
  getNextEventTermsVersion,
  requireEventAdmin,
  serializeEventTermsDocument,
  termsDocumentParamsSchema
} from '#server/domains/events'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.terms.by-documentType.versions',
  domain: 'administration',
  description: 'POST /api/events/:eventId/terms/:documentType/versions',
  rest: { method: 'POST', path: '/api/events/:eventId/terms/:documentType/versions' },
  input: { params: termsDocumentParamsSchema, body: createTermsVersionBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'create'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, documentType } = parseValidatedParams(h3Event, termsDocumentParamsSchema)
  const body = await parseValidatedBody(h3Event, createTermsVersionBodySchema)
  const database = getDatabase(h3Event)

  const { event } = await requireEventAdmin(h3Event, eventId)
  if (documentType === 'winner_terms') {
    assertCompetitionEvent(event)
  }

  const documentId = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const version = await getNextEventTermsVersion(database, eventId, documentType)

  await database.insert(eventTermsDocuments).values({
    id: documentId,
    eventId,
    documentType,
    version,
    title: body.title,
    content: body.content,
    publishedAt: body.publishedAt ?? createdAt,
    createdAt
  })

  if (version === 1) {
    await database
      .update(events)
      .set(documentType === 'application_terms'
        ? {
            currentApplicationTermsDocumentId: documentId,
            publicContentRevision: sql`${events.publicContentRevision} + 1`,
            updatedAt: createdAt
          }
        : {
            currentWinnerTermsDocumentId: documentId,
            publicContentRevision: sql`${events.publicContentRevision} + 1`,
            updatedAt: createdAt
          })
      .where(eq(events.id, eventId))
  }

  const document = await database.query.eventTermsDocuments.findFirst({
    where: eq(eventTermsDocuments.id, documentId)
  })

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event_terms_document',
    entityId: documentId,
    action: 'event_terms_document.created',
    metadata: {
      eventId,
      documentType,
      version
    }
  })

  return apiData(serializeEventTermsDocument(document!))
})

export default defineStructuredOperationApiHandler(applicationOperation)
