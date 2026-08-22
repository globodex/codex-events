import { getTalkProposalReviewDetail, requireTalkProposalReviewContext, talkProposalParamsSchema } from '#server/domains/talk-proposals'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.talk-proposals.by-proposalId',
  domain: 'participation',
  description: 'GET /api/events/:eventId/talk-proposals/:proposalId',
  rest: { method: 'GET', path: '/api/events/:eventId/talk-proposals/:proposalId' },
  input: { params: talkProposalParamsSchema },
  output: 'data',
  capabilities: ['event_staff'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId, proposalId } = parseValidatedParams(h3Event, talkProposalParamsSchema)
  const { database } = await requireTalkProposalReviewContext(h3Event, eventId)
  return apiData(await getTalkProposalReviewDetail(database, eventId, proposalId))
})

export default defineStructuredOperationApiHandler(applicationOperation)
