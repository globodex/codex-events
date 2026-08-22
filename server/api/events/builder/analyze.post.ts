import { requirePlatformActor } from '#server/auth/actor'
import { assertEventCreatorAccess } from '#server/auth/authorization'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody } from '#server/http/validation'
import {
  analyzeEventBuilderDraft,
  eventBuilderAnalyzeInputSchema
} from '#shared/domains/events/builder-api'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.builder.analyze',
  domain: 'events',
  description: 'Use this when an event organizer wants the current builder score and recommendations for an unsaved event agenda.',
  rest: { method: 'POST', path: '/api/events/builder/analyze' },
  input: { body: eventBuilderAnalyzeInputSchema },
  output: 'data',
  capabilities: ['event_organizer', 'platform_admin'],
  effect: 'read'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  assertEventCreatorAccess(actor)
  const input = await parseValidatedBody(h3Event, eventBuilderAnalyzeInputSchema)

  return apiData({ analysis: analyzeEventBuilderDraft(input) })
})

export default defineStructuredOperationApiHandler(applicationOperation)
