import { eq, sql } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { events, submissions } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { ApiError } from '#server/http/api-error'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'
import {
  parseStoredPitchFinalistSubmissionIds,
  prunePitchPresentationProgress
} from '#server/domains/judging'
import {
  assertSubmissionDisqualifiable,
  disqualifySubmissionBodySchema,
  getSubmissionForTeamOrThrow,
  requireAdminSubmissionContext,
  serializeSubmission,
  submissionParamsSchema
} from '#server/domains/submissions'

function pruneStoredSubmissionIdsJson(
  storedSubmissionIdsJson: string,
  submissionId: string,
  error: {
    code: string
    message: string
    eventId: string
  }
) {
  let parsedValue: unknown

  try {
    parsedValue = JSON.parse(storedSubmissionIdsJson)
  } catch {
    throw new ApiError({
      statusCode: 500,
      code: error.code,
      message: error.message,
      details: {
        eventId: error.eventId
      }
    })
  }

  const parsedSubmissionIds = Array.isArray(parsedValue)
    ? parsedValue
    : null
  const isValidStoredSubmissionIds = parsedSubmissionIds !== null
    && parsedSubmissionIds.every((value): value is string => typeof value === 'string' && value.trim().length > 0)

  if (!isValidStoredSubmissionIds) {
    throw new ApiError({
      statusCode: 500,
      code: error.code,
      message: error.message,
      details: {
        eventId: error.eventId
      }
    })
  }

  return JSON.stringify(parsedSubmissionIds.filter(value => value !== submissionId))
}

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.teams.by-teamId.submission.actions.disqualify',
  domain: 'participation',
  description: 'POST /api/events/:eventId/teams/:teamId/submission/actions/disqualify',
  rest: { method: 'POST', path: '/api/events/:eventId/teams/:teamId/submission/actions/disqualify' },
  input: { params: submissionParamsSchema, body: disqualifySubmissionBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId, teamId } = parseValidatedParams(h3Event, submissionParamsSchema)
  const body = await parseValidatedBody(h3Event, disqualifySubmissionBodySchema)
  const { database, event } = await requireAdminSubmissionContext(h3Event, eventId, teamId)
  const submission = await getSubmissionForTeamOrThrow(database, teamId)

  assertSubmissionDisqualifiable(event, submission)

  const disqualifiedAt = new Date().toISOString()
  const previousPitchFinalistSubmissionIds = parseStoredPitchFinalistSubmissionIds(event)
  const nextPitchFinalistSubmissionIds = previousPitchFinalistSubmissionIds.filter(
    finalistSubmissionId => finalistSubmissionId !== submission.id
  )
  const pitchPresentationProgress = prunePitchPresentationProgress(
    event,
    previousPitchFinalistSubmissionIds,
    nextPitchFinalistSubmissionIds,
    submission.id,
    disqualifiedAt
  )
  const pitchFinalistSubmissionIdsJson = JSON.stringify(nextPitchFinalistSubmissionIds)
  const finalRankingSubmissionIdsJson = pruneStoredSubmissionIdsJson(
    event.finalRankingSubmissionIdsJson,
    submission.id,
    {
      code: 'final_ranking_invalid',
      message: 'The stored final ranking override is invalid.',
      eventId
    }
  )

  await database.batch([
    database
      .update(submissions)
      .set({
        status: 'disqualified',
        disqualifiedAt,
        updatedAt: disqualifiedAt
      })
      .where(eq(submissions.id, submission.id)),
    database
      .update(events)
      .set({
        pitchFinalistSubmissionIdsJson,
        activePitchPresentationSubmissionId: pitchPresentationProgress.activePitchPresentationSubmissionId,
        pitchPresentationsCompletedAt: pitchPresentationProgress.pitchPresentationsCompletedAt,
        finalRankingSubmissionIdsJson,
        publicContentRevision: sql`${events.publicContentRevision} + 1`,
        updatedAt: disqualifiedAt
      })
      .where(eq(events.id, eventId))
  ])

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'submission',
    entityId: submission.id,
    action: 'submission.disqualified',
    metadata: {
      eventId,
      teamId,
      reason: body.reason ?? null,
      previousStatus: submission.status,
      nextStatus: 'disqualified'
    }
  })

  return apiData(serializeSubmission({
    ...submission,
    status: 'disqualified',
    disqualifiedAt,
    updatedAt: disqualifiedAt
  }, {
    disqualificationReason: body.reason ?? null
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
