import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { accountStaffPageRoute } from '#server/domains/accounts/account-staff-page'
import { executeAccountPageRoute } from '#server/domains/accounts/account-page-contract'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.account.staff-workspace',
  domain: 'participation',
  description: 'GET /api/account/staff-workspace',
  rest: { method: 'GET', path: '/api/account/staff-workspace' },
  input: {},
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async event =>
  executeAccountPageRoute(event, accountStaffPageRoute)
)

export default defineStructuredOperationApiHandler(applicationOperation)
