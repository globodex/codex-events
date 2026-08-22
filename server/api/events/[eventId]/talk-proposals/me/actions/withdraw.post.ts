import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { getVisibleEventOrThrow } from '#server/domains/events'
import { serializeTalkProposal, talkProposalEventParamsSchema, withdrawOwnTalkProposal } from '#server/domains/talk-proposals'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.talk-proposals.me.actions.withdraw',
  domain: 'participation',
  description: 'POST /api/events/:eventId/talk-proposals/me/actions/withdraw',
  rest: { method: 'POST', path: '/api/events/:eventId/talk-proposals/me/actions/withdraw' },
  input: { params: talkProposalEventParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, talkProposalEventParamsSchema)
  await getVisibleEventOrThrow(h3Event, eventId)
  const database = getDatabase(h3Event)
  const proposal = await withdrawOwnTalkProposal(database, { eventId, userId: actor.platformUser.id })
  await writeAuditLog(database, { actorUserId: actor.platformUser.id, entityType: 'talk_proposal', entityId: proposal.id, action: 'talk_proposal.withdrawn', metadata: { eventId } })
  return apiData(serializeTalkProposal(proposal))
})

export default defineStructuredOperationApiHandler(applicationOperation)
