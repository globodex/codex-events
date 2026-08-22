import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { executeAccountPageRoute } from '#server/domains/accounts/account-page-contract'
import { accountJudgeInboxPageRoute } from '#server/domains/judging/account-judge-inbox-page'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.judging',
  domain: 'judging',
  description: 'GET /api/account/judging',
  rest: { method: 'GET', path: '/api/account/judging' },
  input: {},
  output: 'data',
  capabilities: ['event_judge'],
  effect: 'read'
}, async h3Event =>
  executeAccountPageRoute(h3Event, accountJudgeInboxPageRoute)
)

export default defineStructuredOperationApiHandler(applicationOperation)
