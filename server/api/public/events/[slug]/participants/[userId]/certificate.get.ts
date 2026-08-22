import { getDatabase } from '#server/database/client'
import {
  certificatePreviewQuerySchema,
  certificateRouteParamsSchema,
  getEventCertificateOrThrow,
  getEventCertificatePreview
} from '#server/domains/events/certificates'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams, parseValidatedQuery } from '#server/http/validation'
import { eventCertificatePreviewUserId } from '#shared/domains/events/certificates'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.public.events.by-slug.participants.by-userId.certificate',
  domain: 'participation',
  description: 'GET /api/public/events/:slug/participants/:userId/certificate',
  rest: { method: 'GET', path: '/api/public/events/:slug/participants/:userId/certificate' },
  input: { params: certificateRouteParamsSchema, query: certificatePreviewQuerySchema },
  output: 'data',
  capabilities: ['public'],
  effect: 'read'
}, async (h3Event) => {
  const { slug, userId } = parseValidatedParams(h3Event, certificateRouteParamsSchema)
  const database = getDatabase(h3Event)
  const certificate = userId === eventCertificatePreviewUserId
    ? await getEventCertificatePreview(database, slug, parseValidatedQuery(h3Event, certificatePreviewQuerySchema))
    : await getEventCertificateOrThrow(database, slug, userId)

  return apiData(certificate)
})

export default defineStructuredOperationApiHandler(applicationOperation)
