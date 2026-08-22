import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { parseValidatedParams } from '#server/http/validation'
import {
  executeAccountJudgeAssignmentPageRoute,
  accountJudgeAssignmentParamsSchema
} from '#server/domains/events/account-event-page-contract'
import { accountJudgeAssignmentWorkspacePageRoute } from '#server/domains/events/account-event-judging-page'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.events.by-slug.judging.assignments.by-assignmentId',
  domain: 'judging',
  description: 'GET /api/account/events/:slug/judging/assignments/:assignmentId',
  rest: { method: 'GET', path: '/api/account/events/:slug/judging/assignments/:assignmentId' },
  input: { params: accountJudgeAssignmentParamsSchema },
  output: 'data',
  capabilities: ['event_judge'],
  effect: 'read'
}, async (h3Event) => {
  const { slug, assignmentId } = parseValidatedParams(h3Event, accountJudgeAssignmentParamsSchema)

  return await executeAccountJudgeAssignmentPageRoute(
    h3Event,
    slug,
    assignmentId,
    accountJudgeAssignmentWorkspacePageRoute
  )
})

export default defineStructuredOperationApiHandler(applicationOperation)
