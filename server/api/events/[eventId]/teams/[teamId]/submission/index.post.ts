import { requirePlatformActor } from '#server/auth/actor'
import { submissions } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { requireTeamAdminContext } from '#server/domains/teams'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'
import {
  assertEventAllowsSubmissionCreation,
  assertSubmissionBodyMatchesEventRequirements,
  assertNoSubmissionExists,
  buildSubmissionWritePayload,
  createSubmissionBodySchema,
  getSubmissionForTeam,
  resolveValidatedSubmissionTrackId,
  serializeSubmission,
  submissionParamsSchema
} from '#server/domains/submissions'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.teams.by-teamId.submission',
  domain: 'participation',
  description: 'POST /api/events/:eventId/teams/:teamId/submission',
  rest: { method: 'POST', path: '/api/events/:eventId/teams/:teamId/submission' },
  input: { params: submissionParamsSchema, body: createSubmissionBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'create'
}, async (h3Event) => {
  await requirePlatformActor(h3Event)
  const { eventId, teamId } = parseValidatedParams(h3Event, submissionParamsSchema)
  const body = await parseValidatedBody(h3Event, createSubmissionBodySchema)
  const { database, event } = await requireTeamAdminContext(h3Event, eventId, teamId)

  assertEventAllowsSubmissionCreation(event)
  const existingSubmission = await getSubmissionForTeam(database, teamId)
  assertNoSubmissionExists(existingSubmission, teamId)
  assertSubmissionBodyMatchesEventRequirements(event, body)
  const trackId = await resolveValidatedSubmissionTrackId(database, eventId, body.trackId)

  const now = new Date().toISOString()
  const submissionId = crypto.randomUUID()
  const patch = {
    ...buildSubmissionWritePayload(body, now),
    trackId
  }

  await database.insert(submissions).values({
    id: submissionId,
    teamId,
    status: 'draft',
    projectName: null,
    summary: null,
    repositoryUrl: null,
    demoUrl: null,
    isPubliclyVisible: false,
    submittedAt: null,
    lockedAt: null,
    withdrawnAt: null,
    disqualifiedAt: null,
    createdAt: now,
    ...patch
  })

  return apiData(serializeSubmission({
    id: submissionId,
    teamId,
    status: 'draft',
    projectName: patch.projectName ?? null,
    summary: patch.summary ?? null,
    repositoryUrl: patch.repositoryUrl ?? null,
    demoUrl: patch.demoUrl ?? null,
    isPubliclyVisible: false,
    submittedAt: null,
    lockedAt: null,
    withdrawnAt: null,
    disqualifiedAt: null,
    createdAt: now,
    updatedAt: now,
    trackId: patch.trackId ?? null
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
