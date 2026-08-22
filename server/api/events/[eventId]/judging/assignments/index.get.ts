import { and, eq, or } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { resolveEventAuthorization } from '#server/auth/authorization'
import { getDatabase } from '#server/database/client'
import { judgeAssignments } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { getVisibleEventOrThrow, routeIdParamsSchema } from '#server/domains/events'
import {
  getJudgeAssignmentDetails,
  listActiveJudgeAssignmentSummaries,
  listJudgeAssignmentsQuerySchema
} from '#server/domains/judging'
import { parseValidatedParams, parseValidatedQuery } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.judging.assignments',
  domain: 'judging',
  description: 'GET /api/events/:eventId/judging/assignments',
  rest: { method: 'GET', path: '/api/events/:eventId/judging/assignments' },
  input: { params: routeIdParamsSchema, query: listJudgeAssignmentsQuerySchema },
  output: 'list',
  capabilities: ['event_judge', 'event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const query = parseValidatedQuery(h3Event, listJudgeAssignmentsQuerySchema)
  const database = getDatabase(h3Event)

  await getVisibleEventOrThrow(h3Event, eventId)
  const authorization = await resolveEventAuthorization(h3Event, eventId)
  const canViewAssignments = authorization.isPlatformAdmin
    || authorization.isEventAdmin
    || authorization.canReviewThroughAssignment

  assertGuard(canViewAssignments, {
    statusCode: 403,
    code: 'judge_assignment_access_denied',
    message: 'This operation requires judge assignment access.',
    details: {
      eventId
    }
  })

  if (authorization.isPlatformAdmin || authorization.isEventAdmin) {
    const result = await listActiveJudgeAssignmentSummaries(database, eventId, query)

    return apiList(result.data, {
      page: query.page,
      pageSize: query.page_size,
      total: result.total
    })
  }

  const assignments: Array<typeof judgeAssignments.$inferSelect> = await database.query.judgeAssignments.findMany({
    where: and(
      eq(judgeAssignments.eventId, eventId),
      eq(judgeAssignments.judgeUserId, actor.platformUser.id),
      or(
        eq(judgeAssignments.status, 'assigned'),
        eq(judgeAssignments.status, 'judge_started')
      )
    )
  })

  const data = await getJudgeAssignmentDetails(database, assignments)

  return apiList(data, {
    total: data.length
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
