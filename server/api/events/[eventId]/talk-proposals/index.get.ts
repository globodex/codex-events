import { listTalkProposals, listTalkProposalsQuerySchema, requireTalkProposalReviewContext, talkProposalEventParamsSchema } from '#server/domains/talk-proposals'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { parseValidatedParams, parseValidatedQuery } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.talk-proposals',
  domain: 'participation',
  description: 'GET /api/events/:eventId/talk-proposals',
  rest: { method: 'GET', path: '/api/events/:eventId/talk-proposals' },
  input: { params: talkProposalEventParamsSchema, query: listTalkProposalsQuerySchema },
  output: 'list',
  capabilities: ['event_staff'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, talkProposalEventParamsSchema)
  const query = parseValidatedQuery(h3Event, listTalkProposalsQuerySchema)
  const { database } = await requireTalkProposalReviewContext(h3Event, eventId)
  const result = await listTalkProposals(database, eventId, query)
  return apiList(result.items, result.pagination)
})

export default defineStructuredOperationApiHandler(applicationOperation)
