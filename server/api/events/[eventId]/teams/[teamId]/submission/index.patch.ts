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
  assertSubmissionMutable,
  getSubmissionWriteFields,
  getSubmissionForTeamOrThrow,
  serializeSubmission,
  submissionParamsSchema,
  submissionBodySchema
} from '#server/domains/submissions'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.events.by-eventId.teams.by-teamId.submission',
  domain: 'participation',
  description: 'PATCH /api/events/:eventId/teams/:teamId/submission',
  rest: { method: 'PATCH', path: '/api/events/:eventId/teams/:teamId/submission' },
  input: { params: submissionParamsSchema, body: submissionBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'update'
}, async (h3Event) => {
  await requirePlatformActor(h3Event)
  const { eventId, teamId } = parseValidatedParams(h3Event, submissionParamsSchema)
  const body = await parseValidatedBody(h3Event, submissionBodySchema)
  const { database, event } = await requireTeamAdminContext(h3Event, eventId, teamId)
  const submission = await getSubmissionForTeamOrThrow(database, teamId)

  assertEventAllowsSubmissionEditing(event)
  assertSubmissionMutable(submission)
  const fields = await getSubmissionWriteFields(database, event, body)
  const [updated] = await database.update(submissions)
    .set({ ...fields, updatedAt: new Date().toISOString() })
    .where(and(eq(submissions.id, submission.id), eq(submissions.status, submission.status)))
    .returning()

  assertGuard(updated, { code: 'submission_state_invalid', message: 'The submission status changed. Open the project again.' })
  return apiData(serializeSubmission(updated!))
})

export default defineStructuredOperationApiHandler(applicationOperation)
