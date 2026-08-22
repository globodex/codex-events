import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedParams } from '#server/http/validation'
import {
  submissionParamsSchema,
  getSubmissionDisqualificationReason,
  getSubmissionForTeam,
  requireSubmissionVisibilityContext,
  serializeSubmission
} from '#server/domains/submissions'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.teams.by-teamId.submission',
  domain: 'participation',
  description: 'GET /api/events/:eventId/teams/:teamId/submission',
  rest: { method: 'GET', path: '/api/events/:eventId/teams/:teamId/submission' },
  input: { params: submissionParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId, teamId } = parseValidatedParams(h3Event, submissionParamsSchema)
  const { database, eventAuthorization } = await requireSubmissionVisibilityContext(h3Event, eventId, teamId)
  const submission = await getSubmissionForTeam(database, teamId)
  const disqualificationReason = submission?.status === 'disqualified' && eventAuthorization.isEventAdmin
    ? await getSubmissionDisqualificationReason(database, submission.id)
    : null

  return apiData(submission ? serializeSubmission(submission, { disqualificationReason }) : null)
})

export default defineStructuredOperationApiHandler(applicationOperation)
