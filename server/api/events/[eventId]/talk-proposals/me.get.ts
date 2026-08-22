import { requirePlatformActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { getVisibleEventOrThrow } from '#server/domains/events'
import { getOwnTalkProposal, serializeTalkProposal, talkProposalEventParamsSchema } from '#server/domains/talk-proposals'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.talk-proposals.me',
  domain: 'participation',
  description: 'GET /api/events/:eventId/talk-proposals/me',
  rest: { method: 'GET', path: '/api/events/:eventId/talk-proposals/me' },
  input: { params: talkProposalEventParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, talkProposalEventParamsSchema)
  await getVisibleEventOrThrow(h3Event, eventId)
  const proposal = await getOwnTalkProposal(getDatabase(h3Event), eventId, actor.platformUser.id)
  return apiData(proposal ? serializeTalkProposal(proposal) : null)
})

export default defineStructuredOperationApiHandler(applicationOperation)
