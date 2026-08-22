import { eq } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { submissions } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { requireTeamAdminContext } from '#server/domains/teams'
import { parseValidatedParams } from '#server/http/validation'
import {
  assertSubmissionWithdrawable,
  getSubmissionForTeamOrThrow,
  serializeSubmission,
  submissionParamsSchema
} from '#server/domains/submissions'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.teams.by-teamId.submission.actions.withdraw',
  domain: 'participation',
  description: 'POST /api/events/:eventId/teams/:teamId/submission/actions/withdraw',
  rest: { method: 'POST', path: '/api/events/:eventId/teams/:teamId/submission/actions/withdraw' },
  input: { params: submissionParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, teamId } = parseValidatedParams(h3Event, submissionParamsSchema)
  const { database, event } = await requireTeamAdminContext(h3Event, eventId, teamId)
  const submission = await getSubmissionForTeamOrThrow(database, teamId)

  assertSubmissionWithdrawable(event, submission)

  const withdrawnAt = new Date().toISOString()

  await database
    .update(submissions)
    .set({
      status: 'withdrawn',
      withdrawnAt,
      updatedAt: withdrawnAt
    })
    .where(eq(submissions.id, submission.id))

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'submission',
    entityId: submission.id,
    action: 'submission.withdrawn',
    metadata: {
      eventId,
      teamId,
      previousStatus: submission.status,
      nextStatus: 'withdrawn'
    }
  })

  return apiData(serializeSubmission({
    ...submission,
    status: 'withdrawn',
    withdrawnAt,
    updatedAt: withdrawnAt
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
