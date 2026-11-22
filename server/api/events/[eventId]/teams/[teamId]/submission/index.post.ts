import { requirePlatformActor } from '#server/auth/actor'
import { submissions } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { requireTeamAdminContext } from '#server/domains/teams'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'
import {
  assertEventAllowsSubmissionCreation,
  assertNoSubmissionExists,
  getSubmissionWriteFields,
  submissionBodySchema,
  getSubmissionForTeam,
  serializeSubmission,
  submissionParamsSchema
} from '#server/domains/submissions'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.teams.by-teamId.submission',
  domain: 'participation',
  description: 'POST /api/events/:eventId/teams/:teamId/submission',
  rest: { method: 'POST', path: '/api/events/:eventId/teams/:teamId/submission' },
  input: { params: submissionParamsSchema, body: submissionBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'create'
}, async (h3Event) => {
  await requirePlatformActor(h3Event)
  const { eventId, teamId } = parseValidatedParams(h3Event, submissionParamsSchema)
  const body = await parseValidatedBody(h3Event, submissionBodySchema)
  const { database, event } = await requireTeamAdminContext(h3Event, eventId, teamId)

  assertEventAllowsSubmissionCreation(event)
  const existingSubmission = await getSubmissionForTeam(database, teamId)
  assertNoSubmissionExists(existingSubmission, teamId)
  const fields = await getSubmissionWriteFields(database, event, body)
  const now = new Date().toISOString()
  const [created] = await database.insert(submissions).values({
    ...fields,
    id: crypto.randomUUID(),
    teamId,
    status: 'draft',
    createdAt: now,
    updatedAt: now
  }).returning()

  return apiData(serializeSubmission(created!))
})

export default defineStructuredOperationApiHandler(applicationOperation)
