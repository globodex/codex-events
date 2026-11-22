import { and, eq } from 'drizzle-orm'

import { assertGuard } from '#server/domains/lifecycle-guard'

import { requirePlatformActor } from '#server/auth/actor'
import { submissions } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { requireTeamAdminContext } from '#server/domains/teams'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'
import {
  assertEventAllowsSubmissionEditing,
  assertSubmissionSubmittable,
  getSubmissionWriteFields,
  submissionBodySchema,
  getSubmissionForTeamOrThrow,
  serializeSubmission,
  submissionParamsSchema
} from '#server/domains/submissions'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.teams.by-teamId.submission.actions.submit',
  domain: 'participation',
  description: 'POST /api/events/:eventId/teams/:teamId/submission/actions/submit',
  rest: { method: 'POST', path: '/api/events/:eventId/teams/:teamId/submission/actions/submit' },
  input: { params: submissionParamsSchema, body: submissionBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'action'
}, async (h3Event) => {
  await requirePlatformActor(h3Event)
  const { eventId, teamId } = parseValidatedParams(h3Event, submissionParamsSchema)
  const body = await parseValidatedBody(h3Event, submissionBodySchema)
  const { database, event } = await requireTeamAdminContext(h3Event, eventId, teamId)
  const submission = await getSubmissionForTeamOrThrow(database, teamId)

  assertEventAllowsSubmissionEditing(event)
  assertSubmissionSubmittable(submission)
  const fields = await getSubmissionWriteFields(database, event, body)

  const submittedAt = new Date().toISOString()

  const [updated] = await database
    .update(submissions)
    .set({
      ...fields,
      status: 'submitted',
      submittedAt,
      updatedAt: submittedAt
    })
    .where(and(eq(submissions.id, submission.id), eq(submissions.status, 'draft')))
    .returning()

  assertGuard(updated, { code: 'submission_state_invalid', message: 'Only draft submissions can be submitted.' })
  return apiData(serializeSubmission(updated!))
})

export default defineStructuredOperationApiHandler(applicationOperation)
