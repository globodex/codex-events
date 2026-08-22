import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiList } from '#server/http/api-response'
import { listOwnPendingPrizeRedemptions } from '#server/domains/prize-redemptions'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.prize-redemptions.me',
  domain: 'participation',
  description: 'GET /api/prize-redemptions/me',
  rest: { method: 'GET', path: '/api/prize-redemptions/me' },
  input: {},
  output: 'list',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const redemptions = await listOwnPendingPrizeRedemptions(h3Event)

  return apiList(redemptions, {
    total: redemptions.length
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
