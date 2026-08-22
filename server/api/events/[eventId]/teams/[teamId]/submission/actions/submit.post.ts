import { eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { submissions } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { requireTeamAdminContext } from '#server/domains/teams'
import { parseValidatedParams } from '#server/http/validation'
import {
  assertEventAllowsSubmissionEditing,
  assertSubmissionSubmittable,
  getSubmissionForTeamOrThrow,
  serializeSubmission,
  submissionParamsSchema
} from '#server/domains/submissions'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.teams.by-teamId.submission.actions.submit',
  domain: 'participation',
  description: 'POST /api/events/:eventId/teams/:teamId/submission/actions/submit',
  rest: { method: 'POST', path: '/api/events/:eventId/teams/:teamId/submission/actions/submit' },
  input: { params: submissionParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'action'
}, async (h3Event) => {
  await requirePlatformActor(h3Event)
  const { eventId, teamId } = parseValidatedParams(h3Event, submissionParamsSchema)
  const { database, event } = await requireTeamAdminContext(h3Event, eventId, teamId)
  const submission = await getSubmissionForTeamOrThrow(database, teamId)

  assertEventAllowsSubmissionEditing(event)
  await assertSubmissionSubmittable(database, event, submission)

  const submittedAt = new Date().toISOString()

  await database
    .update(submissions)
    .set({
      status: 'submitted',
      submittedAt,
      updatedAt: submittedAt
    })
    .where(eq(submissions.id, submission.id))

  return apiData(serializeSubmission({
    ...submission,
    status: 'submitted',
    submittedAt,
    updatedAt: submittedAt
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
