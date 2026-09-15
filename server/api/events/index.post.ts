import { eq, sql } from 'drizzle-orm'

import { requirePlatformActor } from '#server/auth/actor'
import { assertEventCreatorAccess } from '#server/auth/authorization'
import { buildAuditLogInsert } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { events, eventCreditOffers, eventCreditCodes } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  assertEventApplicationFieldConfiguration,
  assertEventSchedule,
  assertTalkProposalConfiguration,
  assertEventSlugAvailable,
  computeEventBalanceColumns,
  buildCreateEventAdminAssignmentQueries,
  buildCreateEventTrackQueries,
  createEventBodySchema,
  listEventTracks,
  serializeEventAgendaItems,
  serializeAdminEvent
} from '#server/domains/events'
import { reconcileEventLumaWebhook } from '#server/domains/events/luma-webhook-registration'
import { getEventDisplayImageOptions } from '#server/domains/platform/settings'
import { parseValidatedBody } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events',
  domain: 'events',
  description: 'POST /api/events',
  rest: { method: 'POST', path: '/api/events' },
  input: { body: createEventBodySchema },
  output: 'data',
  capabilities: ['event_organizer', 'platform_admin'],
  effect: 'create'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  assertEventCreatorAccess(actor)

  const body = await parseValidatedBody(h3Event, createEventBodySchema)
  const database = getDatabase(h3Event)

  assertEventSchedule(body)
  assertEventApplicationFieldConfiguration(body as Record<string, unknown>)
  assertTalkProposalConfiguration(body as Record<string, unknown>)
  await assertEventSlugAvailable(database, body.slug)

  const eventId = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const isHackathon = body.eventType === 'hackathon'
  const supportsTracks = isHackathon || body.eventType === 'build'

  const eventValues = {
    id: eventId,
    eventType: body.eventType,
    creationFlow: body.creationFlow,
    name: body.name,
    slug: body.slug,
    description: body.description,
    agendaItemsJson: serializeEventAgendaItems(body.agendaItems),
    backgroundImageUrl: body.backgroundImageUrl ?? null,
    backgroundImageObjectKey: null,
    backgroundImageRevision: 0,
    bannerImageUrl: body.bannerImageUrl ?? null,
    bannerImageObjectKey: null,
    bannerImageRevision: 0,
    publicContentRevision: 0,
    discordServerUrl: body.discordServerUrl ?? null,
    lumaEventUrl: body.lumaEventUrl ?? null,
    slidesUrl: body.slidesUrl ?? null,
    lumaEventApiId: body.lumaEventApiId ?? null,
    lumaApiKey: body.lumaApiKey ?? null,
    city: body.city,
    country: body.country,
    address: body.address,
    registrationOpensAt: body.registrationOpensAt,
    registrationClosesAt: body.registrationClosesAt,
    submissionOpensAt: isHackathon ? body.submissionOpensAt! : null,
    submissionClosesAt: isHackathon ? body.submissionClosesAt! : null,
    talkProposalsEnabled: body.eventType === 'meetup' ? body.talkProposalsEnabled : false,
    talkProposalOpensAt: body.eventType === 'meetup' ? body.talkProposalOpensAt : null,
    talkProposalClosesAt: body.eventType === 'meetup' ? body.talkProposalClosesAt : null,
    talkProposalQuestionsJson: JSON.stringify(body.eventType === 'meetup' ? body.talkProposalQuestions : []),
    talkProposalQuestionsRevision: 0,
    maxTeamMembers: isHackathon ? body.maxTeamMembers : 1,
    participantsLimit: body.participantsLimit,
    autoApproveApplications: body.autoApproveApplications,
    simplifiedClaimingEnabled: body.simplifiedClaimingEnabled,
    blindReviewCount: isHackathon ? body.blindReviewCount : 1,
    pitchReviewEnabled: isHackathon ? body.pitchReviewEnabled : false,
    blindScoreWeightPercent: isHackathon ? body.blindScoreWeightPercent : 100,
    pitchScoreWeightPercent: isHackathon ? body.pitchScoreWeightPercent : 0,
    shortlistFinalistCount: isHackathon ? body.shortlistFinalistCount : 1,
    inPersonEvent: body.inPersonEvent,
    applicationXProfileVisible: body.applicationXProfileVisible,
    applicationLinkedinProfileVisible: body.applicationLinkedinProfileVisible,
    applicationGithubProfileVisible: body.applicationGithubProfileVisible,
    applicationChatgptEmailVisible: body.applicationChatgptEmailVisible,
    applicationOpenaiOrgIdVisible: body.applicationOpenaiOrgIdVisible,
    applicationLumaEmailVisible: body.applicationLumaEmailVisible,
    applicationWhyThisEventVisible: body.applicationWhyThisEventVisible,
    applicationProofOfExecutionVisible: body.applicationProofOfExecutionVisible,
    applicationTeamIntentVisible: body.applicationTeamIntentVisible,
    applicationAiKnowledgeVisible: body.applicationAiKnowledgeVisible,
    requireXProfile: body.requireXProfile,
    requireLinkedinProfile: body.requireLinkedinProfile,
    requireGithubProfile: body.requireGithubProfile,
    requireChatgptEmail: body.requireChatgptEmail,
    requireOpenaiOrgId: body.requireOpenaiOrgId,
    requireLumaEmail: body.requireLumaEmail,
    requireWhyThisEvent: body.requireWhyThisEvent,
    requireProofOfExecution: body.requireProofOfExecution,
    requireTeamIntent: body.requireTeamIntent,
    requireAiKnowledge: body.requireAiKnowledge,
    requireSubmissionSummary: isHackathon ? body.requireSubmissionSummary : false,
    requireSubmissionRepositoryUrl: isHackathon ? body.requireSubmissionRepositoryUrl : false,
    requireSubmissionDemoUrl: isHackathon ? body.requireSubmissionDemoUrl : false,
    state: 'draft' as const,
    createdByUserId: actor.platformUser.id,
    createdAt,
    updatedAt: createdAt
  }

  type Statement = Parameters<typeof database.batch>[0][number]
  const statements: [Statement, ...Statement[]] = [
    database.insert(events).values({ ...eventValues, ...computeEventBalanceColumns(eventValues) }),
    ...await buildCreateEventAdminAssignmentQueries(database, { eventId, creatorUserId: actor.platformUser.id, createdAt }),
    ...buildCreateEventTrackQueries(database, eventId, supportsTracks ? body.tracks : []),
    buildAuditLogInsert(database, {
      actorUserId: actor.platformUser.id, entityType: 'event', entityId: eventId,
      action: 'event.created', metadata: { slug: body.slug }, createdAt
    }).query
  ]
  for (const [displayOrder, offer] of body.credits.entries()) {
    const offerId = crypto.randomUUID()
    const values = [...new Set(offer.values)]
    statements.push(database.insert(eventCreditOffers).values({
      id: offerId, eventId, name: offer.name, description: offer.description,
      simplifiedClaimingOnly: body.simplifiedClaimingEnabled, redirectOnClaim: offer.redirectOnClaim,
      displayOrder, createdAt, updatedAt: createdAt
    }))
    statements.push(database.insert(eventCreditCodes).select(database.select({
      id: sql<string>`lower(hex(randomblob(16)))`.as('id'),
      creditOfferId: sql<string>`${offerId}`.as('creditOfferId'),
      value: sql<string>`inventory.value`.as('value'),
      claimedByUserId: sql<null>`null`.as('claimedByUserId'),
      claimedAttendeeEligibilityId: sql<null>`null`.as('claimedAttendeeEligibilityId'),
      claimedAt: sql<null>`null`.as('claimedAt'),
      createdAt: sql<string>`strftime('%Y-%m-%dT%H:%M:%fZ', (${Date.parse(createdAt)} + cast(inventory.key as integer)) / 1000.0, 'unixepoch')`.as('createdAt')
    }).from(sql`json_each(${JSON.stringify(values)}) as inventory`).getSQL()))
    statements.push(buildAuditLogInsert(database, {
      actorUserId: actor.platformUser.id, entityType: 'event_credit_offer', entityId: offerId,
      action: 'event_credit_offer.created', metadata: { eventId, importedCount: values.length }, createdAt
    }).query)
  }
  await database.batch(statements)

  const createdEvent = await database.query.events.findFirst({
    where: eq(events.id, eventId)
  })
  await reconcileEventLumaWebhook({
    database,
    event: createdEvent!,
    runtimeConfig: useRuntimeConfig(h3Event)
  })

  const configuredEvent = await database.query.events.findFirst({
    where: eq(events.id, eventId)
  })
  const [createdTracks, imageOptions] = await Promise.all([
    listEventTracks(database, eventId),
    getEventDisplayImageOptions(database)
  ])

  return apiData(serializeAdminEvent(configuredEvent!, undefined, createdTracks, {
    appBaseUrl: useRuntimeConfig(h3Event).auth0.appBaseUrl,
    ...imageOptions
  }))
})

export default defineStructuredOperationApiHandler(applicationOperation)
