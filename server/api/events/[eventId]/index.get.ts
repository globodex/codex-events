import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { resolveEventAuthorization } from '#server/auth/authorization'
import {
  getVisibleEventOrThrow,
  getCurrentEventTerms,
  listEventTracks,
  resolveEventTrackStaffInstructionIds,
  resolveVisibleEventRestrictedFields,
  routeIdParamsSchema,
  serializeAdminEvent,
  serializeEvent
} from '#server/domains/events'
import { parseValidatedParams } from '#server/http/validation'
import { getDatabase } from '#server/database/client'
import { getEventDisplayImageOptions } from '#server/domains/platform/settings'

async function resolveCurrentActorEventAuthorization(h3Event: Parameters<typeof resolveEventAuthorization>[0], eventId: string) {
  try {
    return await resolveEventAuthorization(h3Event, eventId)
  } catch {
    return null
  }
}

function serializeTermsReference(document: NonNullable<Awaited<ReturnType<typeof getCurrentEventTerms>>['applicationTerms']>) {
  return {
    id: document.id,
    documentType: document.documentType,
    version: document.version,
    title: document.title,
    publishedAt: document.publishedAt
  }
}

type EventDetailCurrentTerms = {
  applicationTerms: ReturnType<typeof serializeTermsReference> | null
  winnerTerms: ReturnType<typeof serializeTermsReference> | null
}

type EventDetailResponse = {
  data:
    | (Omit<ReturnType<typeof serializeAdminEvent>, 'currentTerms'> & Awaited<ReturnType<typeof resolveVisibleEventRestrictedFields>> & {
      currentTerms: EventDetailCurrentTerms
    })
    | (Omit<ReturnType<typeof serializeEvent>, 'currentTerms'> & Awaited<ReturnType<typeof resolveVisibleEventRestrictedFields>> & {
      currentTerms: EventDetailCurrentTerms
    })
}

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId',
  domain: 'events',
  description: 'GET /api/events/:eventId',
  rest: { method: 'GET', path: '/api/events/:eventId' },
  input: { params: routeIdParamsSchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'read'
}, async (h3Event): Promise<EventDetailResponse> => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const event = await getVisibleEventOrThrow(h3Event, eventId)
  const database = getDatabase(h3Event)
  const [
    currentTerms,
    tracks,
    restrictedFields,
    authorization,
    imageOptions
  ] = await Promise.all([
    getCurrentEventTerms(database, event),
    listEventTracks(database, eventId),
    resolveVisibleEventRestrictedFields(h3Event, event),
    resolveCurrentActorEventAuthorization(h3Event, eventId),
    getEventDisplayImageOptions(database)
  ])
  const serializedTerms = {
    applicationTerms: currentTerms.applicationTerms ? serializeTermsReference(currentTerms.applicationTerms) : null,
    winnerTerms: currentTerms.winnerTerms ? serializeTermsReference(currentTerms.winnerTerms) : null
  }

  if (authorization?.isEventAdmin) {
    return apiData({
      ...serializeAdminEvent(event, undefined, tracks, {
        appBaseUrl: useRuntimeConfig(h3Event).auth0.appBaseUrl,
        ...imageOptions
      }),
      ...restrictedFields,
      currentTerms: serializedTerms
    })
  }

  return apiData({
    ...serializeEvent(event, undefined, tracks, {
      ...imageOptions,
      trackStaffInstructionIds: authorization
        ? resolveEventTrackStaffInstructionIds(authorization)
        : undefined
    }),
    ...restrictedFields,
    currentTerms: serializedTerms
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
