import { getDatabase } from '#server/database/client'
import { resolveEventAuthorization } from '#server/auth/authorization'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { hasEventPhotos } from '#server/domains/events/photos'
import {
  canViewRestrictedEventDetails,
  getCurrentEventTerms,
  getVisibleEventBySlugOrThrow,
  listEventTracks,
  resolveEventTrackStaffInstructionIds,
  resolveVisibleEventRestrictedFields,
  routeSlugParamsSchema,
  serializeEvent
} from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'
import { getEventDisplayImageOptions } from '#server/domains/platform/settings'
import { parseTalkProposalQuestionsJson } from '#shared/domains/talk-proposals/questions'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.slug.by-slug',
  domain: 'events',
  description: 'GET /api/events/slug/:slug',
  rest: { method: 'GET', path: '/api/events/slug/:slug' },
  input: { params: routeSlugParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event) => {
  const { slug } = parseValidatedParams(h3Event, routeSlugParamsSchema)
  const event = await getVisibleEventBySlugOrThrow(h3Event, slug)
  const database = getDatabase(h3Event)
  const [
    currentTerms,
    tracks,
    canViewPhotos,
    restrictedFields,
    imageOptions,
    authorization
  ] = await Promise.all([
    getCurrentEventTerms(database, event),
    listEventTracks(database, event.id),
    canViewRestrictedEventDetails(h3Event, event.id),
    resolveVisibleEventRestrictedFields(h3Event, event),
    getEventDisplayImageOptions(database),
    resolveEventAuthorization(h3Event, event.id).catch(() => null)
  ])

  return apiData({
    ...serializeEvent(event, currentTerms, tracks, {
      ...imageOptions,
      trackStaffInstructionIds: authorization
        ? resolveEventTrackStaffInstructionIds(authorization)
        : undefined
    }),
    ...restrictedFields,
    ...(event.eventType === 'meetup' && event.talkProposalsEnabled
      ? {
          talkProposalQuestions: parseTalkProposalQuestionsJson(event.talkProposalQuestionsJson),
          talkProposalQuestionsRevision: event.talkProposalQuestionsRevision
        }
      : {}),
    ...(authorization?.isEventAdmin
      ? { simplifiedClaimingEnabled: event.simplifiedClaimingEnabled }
      : {}),
    ...(canViewPhotos
      ? {
          hasGallery: await hasEventPhotos(database, event.id)
        }
      : {})
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
