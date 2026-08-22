import { eq, sql } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { events } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { ApiError } from '#server/http/api-error'
import { apiData } from '#server/http/api-response'
import {
  assertCompetitionEvent,
  getEventTermsDocumentOrThrow,
  requireEventAdmin,
  serializeEvent,
  setCurrentTermsBodySchema,
  termsDocumentParamsSchema
} from '#server/domains/events'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.terms.by-documentType.actions.set-current',
  domain: 'administration',
  description: 'POST /api/events/:eventId/terms/:documentType/actions/set-current',
  rest: { method: 'POST', path: '/api/events/:eventId/terms/:documentType/actions/set-current' },
  input: { params: termsDocumentParamsSchema, body: setCurrentTermsBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, documentType } = parseValidatedParams(h3Event, termsDocumentParamsSchema)
  const body = await parseValidatedBody(h3Event, setCurrentTermsBodySchema)
  const database = getDatabase(h3Event)

  const { event } = await requireEventAdmin(h3Event, eventId)
  if (documentType === 'winner_terms') {
    assertCompetitionEvent(event)
  }
  const document = await getEventTermsDocumentOrThrow(database, eventId, body.eventTermsDocumentId)

  if (document.documentType !== documentType) {
    throw new ApiError({
      statusCode: 409,
      code: 'event_terms_document_type_mismatch',
      message: 'The selected event terms document does not match the requested document type.',
      details: {
        eventId,
        documentType,
        actualDocumentType: document.documentType,
        eventTermsDocumentId: document.id
      }
    })
  }

  const updatedAt = new Date().toISOString()
  const patch = documentType === 'application_terms'
    ? {
        currentApplicationTermsDocumentId: document.id,
        publicContentRevision: sql`${events.publicContentRevision} + 1`,
        updatedAt
      }
    : {
        currentWinnerTermsDocumentId: document.id,
        publicContentRevision: sql`${events.publicContentRevision} + 1`,
        updatedAt
      }

  await database
    .update(events)
    .set(patch)
    .where(eq(events.id, eventId))

  const updatedEvent = await database.query.events.findFirst({
    where: eq(events.id, eventId)
  })

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event_terms_document.set_current',
    metadata: {
      documentType,
      eventTermsDocumentId: document.id
    }
  })

  return apiData(serializeEvent(updatedEvent!))
})

export default defineStructuredOperationApiHandler(applicationOperation)
