import { decideTalkProposalAndEnqueue } from '#server/domains/talk-proposals/email-queue'
import { requireTalkProposalDecisionContext, talkProposalDecisionBodySchema, talkProposalParamsSchema } from '#server/domains/talk-proposals'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.talk-proposals.by-proposalId.actions.reject',
  domain: 'participation',
  description: 'POST /api/events/:eventId/talk-proposals/:proposalId/actions/reject',
  rest: { method: 'POST', path: '/api/events/:eventId/talk-proposals/:proposalId/actions/reject' },
  input: { params: talkProposalParamsSchema, body: talkProposalDecisionBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'destructive'
}, async (h3Event) => {
  const { eventId, proposalId } = parseValidatedParams(h3Event, talkProposalParamsSchema)
  const body = await parseValidatedBody(h3Event, talkProposalDecisionBodySchema)
  const { actor, database } = await requireTalkProposalDecisionContext(h3Event, eventId)
  return apiData(await decideTalkProposalAndEnqueue(h3Event, {
    database, eventId, proposalId, reviewerUserId: actor.platformUser.id, decision: 'rejected', message: body.message
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
