import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { accountPrizeRedemptionsPageRoute } from '#server/domains/prize-redemptions/account-workspace-page'
import { executeAccountPageRoute } from '#server/domains/accounts/account-page-contract'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.prize-redemptions.workspace',
  domain: 'participation',
  description: 'GET /api/prize-redemptions/workspace',
  rest: { method: 'GET', path: '/api/prize-redemptions/workspace' },
  input: {},
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async event =>
  executeAccountPageRoute(event, accountPrizeRedemptionsPageRoute)
)

export default defineStructuredOperationApiHandler(applicationOperation)
