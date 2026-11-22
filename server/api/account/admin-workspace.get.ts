import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { accountAdminPageRoute } from '#server/domains/accounts/account-event-dashboards'
import { executeAccountPageRoute } from '#server/domains/accounts/account-page-contract'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.admin-workspace',
  domain: 'participation',
  description: 'GET /api/account/admin-workspace',
  rest: { method: 'GET', path: '/api/account/admin-workspace' },
  input: {},
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async event =>
  executeAccountPageRoute(event, accountAdminPageRoute)
)

export default defineStructuredOperationApiHandler(applicationOperation)
