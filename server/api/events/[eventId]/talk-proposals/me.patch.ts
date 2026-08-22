import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { getVisibleEventOrThrow } from '#server/domains/events'
import { serializeTalkProposal, talkProposalContentBodySchema, talkProposalEventParamsSchema, updateTalkProposalDraft } from '#server/domains/talk-proposals'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.events.by-eventId.talk-proposals.me',
  domain: 'participation',
  description: 'PATCH /api/events/:eventId/talk-proposals/me',
  rest: { method: 'PATCH', path: '/api/events/:eventId/talk-proposals/me' },
  input: { params: talkProposalEventParamsSchema, body: talkProposalContentBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, talkProposalEventParamsSchema)
  const body = await parseValidatedBody(h3Event, talkProposalContentBodySchema)
  await getVisibleEventOrThrow(h3Event, eventId)
  const database = getDatabase(h3Event)
  const proposal = await updateTalkProposalDraft(database, { eventId, userId: actor.platformUser.id, ...body })
  await writeAuditLog(database, { actorUserId: actor.platformUser.id, entityType: 'talk_proposal', entityId: proposal.id, action: 'talk_proposal.updated', metadata: { eventId } })
  return apiData(serializeTalkProposal(proposal))
})

export default defineStructuredOperationApiHandler(applicationOperation)
