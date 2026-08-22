import { eq, sql } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { events, prizeRedemptions, submissions } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { requireTeamAdminContext } from '#server/domains/teams'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'
import {
  assertSubmissionPublicVisibilityMutable,
  getSubmissionForTeamOrThrow,
  serializeSubmission,
  submissionParamsSchema,
  updateSubmissionPublicVisibilityBodySchema
} from '#server/domains/submissions'
import { refreshCompletedOutcomeCache } from '#server/domains/outcomes'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.events.by-eventId.teams.by-teamId.submission.public-visibility',
  domain: 'participation',
  description: 'PATCH /api/events/:eventId/teams/:teamId/submission/public-visibility',
  rest: { method: 'PATCH', path: '/api/events/:eventId/teams/:teamId/submission/public-visibility' },
  input: { params: submissionParamsSchema, body: updateSubmissionPublicVisibilityBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'update'
}, async (h3Event) => {
  await requirePlatformActor(h3Event)
  const { eventId, teamId } = parseValidatedParams(h3Event, submissionParamsSchema)
  const body = await parseValidatedBody(h3Event, updateSubmissionPublicVisibilityBodySchema)
  const { database, event, team } = await requireTeamAdminContext(h3Event, eventId, teamId)
  const submission = await getSubmissionForTeamOrThrow(database, team.id)
  const winningRedemption = await database.query.prizeRedemptions.findFirst({
    columns: {
      id: true
    },
    where: eq(prizeRedemptions.teamId, team.id)
  })

  assertSubmissionPublicVisibilityMutable(event, submission, {
    isWinningTeam: Boolean(winningRedemption)
  })

  const updatedAt = new Date().toISOString()

  if (submission.isPubliclyVisible !== body.isPubliclyVisible) {
    await database.batch([
      database
        .update(submissions)
        .set({
          isPubliclyVisible: body.isPubliclyVisible,
          updatedAt
        })
        .where(eq(submissions.id, submission.id)),
      database
        .update(events)
        .set({
          publicContentRevision: sql`${events.publicContentRevision} + 1`
        })
        .where(eq(events.id, eventId))
    ])
  } else {
    await database
      .update(submissions)
      .set({
        isPubliclyVisible: body.isPubliclyVisible,
        updatedAt
      })
      .where(eq(submissions.id, submission.id))
  }

  await refreshCompletedOutcomeCache(database, eventId)

  return apiData(serializeSubmission({
    ...submission,
    isPubliclyVisible: body.isPubliclyVisible,
    updatedAt
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
