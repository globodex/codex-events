import { requirePlatformActor } from '#server/auth/actor'
import { assertEventCreatorAccess } from '#server/auth/authorization'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { getEventBuilderCatalog } from '#shared/domains/events/builder-api'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.builder.catalog',
  domain: 'events',
  description: 'Use this when an event organizer wants to inspect the current event-builder blocks, paytable, and templates before drafting an event.',
  rest: { method: 'GET', path: '/api/events/builder/catalog' },
  input: {},
  output: 'data',
  capabilities: ['event_organizer', 'platform_admin'],
  effect: 'read'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  assertEventCreatorAccess(actor)

  return apiData(getEventBuilderCatalog())
})

export default defineStructuredOperationApiHandler(applicationOperation)
