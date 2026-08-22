import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { accountOverviewPageRoute } from '#server/domains/accounts/account-overview-page'
import { executeAccountPageRoute } from '#server/domains/accounts/account-page-contract'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.overview',
  domain: 'participation',
  description: 'GET /api/account/overview',
  rest: { method: 'GET', path: '/api/account/overview' },
  input: {},
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async event =>
  executeAccountPageRoute(event, accountOverviewPageRoute)
)

export default defineStructuredOperationApiHandler(applicationOperation)
