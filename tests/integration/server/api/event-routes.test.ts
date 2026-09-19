import { afterEach, describe, expect, test, vi } from 'vitest'

import { and, asc, eq } from 'drizzle-orm'

import accountEventsGetHandler from '../../../../server/api/account/events.get'
import eventsGetHandler from '../../../../server/api/events/index.get'
import eventParticipationGetHandler from '../../../../server/api/events/participation.get'
import ownEventRankGetHandler from '../../../../server/api/events/[eventId]/rank/me.get'
import eventsPostHandler from '../../../../server/api/events/index.post'
import eventDetailGetHandler from '../../../../server/api/events/[eventId]/index.get'
import eventCriteriaGetHandler from '../../../../server/api/events/[eventId]/evaluation-criteria/index.get'
import eventFeedbackGetHandler from '../../../../server/api/events/[eventId]/feedback/index.get'
import eventJudgesGetHandler from '../../../../server/api/events/[eventId]/judges/index.get'
import eventPrizesGetHandler from '../../../../server/api/events/[eventId]/prizes/index.get'
import eventStaffGetHandler from '../../../../server/api/events/[eventId]/staff/index.get'
import eventBySlugGetHandler from '../../../../server/api/events/slug/[slug]/index.get'
import openRegistrationPostHandler from '../../../../server/api/events/[eventId]/actions/open-registration.post'
import hideEventPostHandler from '../../../../server/api/events/[eventId]/actions/hide.post'
import unhideEventPostHandler from '../../../../server/api/events/[eventId]/actions/unhide.post'
import publicEventsGetHandler from '../../../../server/api/public/events/index.get'
import publicEventDetailGetHandler from '../../../../server/api/public/events/[slug]/index.get'
import publicEventFeedbackPostHandler from '../../../../server/api/public/events/[slug]/feedback.post'
import publicEventCriteriaGetHandler from '../../../../server/api/public/events/[slug]/evaluation-criteria/index.get'
import publicEventPrizesGetHandler from '../../../../server/api/public/events/[slug]/prizes/index.get'
import publicEventPublishedProjectsGetHandler from '../../../../server/api/public/events/[slug]/published-projects/index.get'
import publicEventPublishedProjectProfileIconGetHandler from '../../../../server/api/public/events/[slug]/published-projects/[userId]/profile-icon.get'
import publicEventPhotosGetHandler from '../../../../server/api/public/events/[slug]/photos/index.get'
import publicEventPhotoImageGetHandler from '../../../../server/api/public/events/[slug]/photos/[photoId]/image.get'
import publicEventWinnersGetHandler from '../../../../server/api/public/events/[slug]/winners/index.get'
import publicEventWinnerProfileIconGetHandler from '../../../../server/api/public/events/[slug]/winners/[userId]/profile-icon.get'
import publicEventBackgroundImageGetHandler from '../../../../server/api/public/events/[slug]/images/background.get'
import publicEventBannerImageGetHandler from '../../../../server/api/public/events/[slug]/images/banner.get'
import eventPatchHandler from '../../../../server/api/events/[eventId]/index.patch'
import eventBackgroundImageDeleteHandler from '../../../../server/api/events/[eventId]/images/background.delete'
import eventBackgroundImagePostHandler from '../../../../server/api/events/[eventId]/images/background.post'
import eventBannerImageDeleteHandler from '../../../../server/api/events/[eventId]/images/banner.delete'
import eventBannerImagePostHandler from '../../../../server/api/events/[eventId]/images/banner.post'
import eventPhotosGetHandler from '../../../../server/api/events/[eventId]/photos/index.get'
import eventPhotosPostHandler from '../../../../server/api/events/[eventId]/photos/index.post'
import eventPhotoDeleteHandler from '../../../../server/api/events/[eventId]/photos/[photoId].delete'
import eventPhotoImageGetHandler from '../../../../server/api/events/[eventId]/photos/[photoId]/image.get'
import eventPhotoHighlightPatchHandler from '../../../../server/api/events/[eventId]/photos/[photoId]/highlight.patch'
import eventPhotoPublicVisibilityPatchHandler from '../../../../server/api/events/[eventId]/photos/[photoId]/public-visibility.patch'
import openSubmissionPostHandler from '../../../../server/api/events/[eventId]/actions/open-submission.post'
import startJudgingPreparationPostHandler from '../../../../server/api/events/[eventId]/actions/start-judging-preparation.post'
import startBlindReviewPostHandler from '../../../../server/api/events/[eventId]/actions/start-blind-review.post'
import startPitchPostHandler from '../../../../server/api/events/[eventId]/actions/start-pitch.post'
import advancePitchPresentationPostHandler from '../../../../server/api/events/[eventId]/actions/advance-pitch-presentation.post'
import startPitchReviewPostHandler from '../../../../server/api/events/[eventId]/actions/start-pitch-review.post'
import {
  auditLogs,
  evaluationCriteria,
  eventFeedback,
  eventPhotos,
  eventRoleAssignments,
  eventTermsDocuments,
  eventTracks,
  events,
  judgeAssignments,
  judgeCriterionScores,
  mediaCleanupOutbox,
  platformDocuments,
  platformSettings,
  prizes,
  prizeEligibilitySnapshots,
  prizeRedemptions,
  submissions,
  teamMembers,
  teams,
  userPlatformDocumentAcceptances,
  userApplications,
  users
} from '../../../../server/database/schema'
import {
  authenticatedUploadRateLimitBindingName,
  publicEventFeedbackRateLimitBindingName
} from '../../../../server/utils/rate-limit'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { createExifJpegBytes } from '../../../support/backend/exif-image'
import { stubAuth0Session } from '../../../support/backend/runtime'
import { eventImageObjectKey } from '../../../../server/domains/events/images'

describe('TASK-3.5 event CRUD routes', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []
  const eventImagesBindingName = 'EVENT_IMAGES'
  const pngSignatureBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  function createOversizedPngBytes(size: number) {
    const data = new Uint8Array(size)
    data.set(pngSignatureBytes)
    return data
  }

  function createRateLimiter(success = true) {
    return {
      limit: vi.fn(async () => ({ success }))
    }
  }

  function createImagesBinding(options?: {
    width?: number
    height?: number
    previewBytes?: Uint8Array
    transformCalls?: Array<{
      width?: number
      height?: number
      fit?: string
    }>
  }) {
    const width = options?.width ?? 1600
    const height = options?.height ?? 900
    const previewBytes = options?.previewBytes ?? new Uint8Array([0x52, 0x49, 0x46, 0x46])

    return {
      info: vi.fn(async () => ({ width, height })),
      input: vi.fn(() => ({
        transform: vi.fn((transformOptions: {
          width?: number
          height?: number
          fit?: string
        }) => {
          options?.transformCalls?.push(transformOptions)
          return {
            output: vi.fn(async () => ({
              response: () => new Response(previewBytes, {
                status: 200
              }),
              contentType: () => 'image/webp'
            }))
          }
        })
      }))
    }
  }

  class InMemoryR2Bucket {
    private readonly objects = new Map<string, { body: Uint8Array, contentType?: string }>()

    async get(key: string) {
      const object = this.objects.get(key)

      if (!object) {
        return null
      }

      return {
        body: new Response(object.body).body!,
        async arrayBuffer() {
          return object.body.buffer.slice(
            object.body.byteOffset,
            object.body.byteOffset + object.body.byteLength
          )
        },
        httpMetadata: {
          contentType: object.contentType
        }
      }
    }

    async put(
      key: string,
      value: ArrayBuffer | ArrayBufferView,
      options?: { httpMetadata?: { contentType?: string } }
    ) {
      const body = value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)

      this.objects.set(key, {
        body: new Uint8Array(body),
        contentType: options?.httpMetadata?.contentType
      })
    }

    async delete(key: string) {
      this.objects.delete(key)
    }

    keys() {
      return [...this.objects.keys()]
    }
  }

  async function insertEventsInBatches(
    harness: ReturnType<typeof createApiRouteTestHarness>,
    rows: Array<typeof events.$inferInsert>,
    chunkSize = 3
  ) {
    for (let index = 0; index < rows.length; index += chunkSize) {
      await harness.database.insert(events).values(rows.slice(index, index + chunkSize))
    }
  }

  function enforceD1BindParameterLimit(
    harness: ReturnType<typeof createApiRouteTestHarness>,
    maxBoundParametersPerStatement = 100
  ) {
    const originalPrepare = harness.d1Database.prepare.bind(harness.d1Database)

    vi.spyOn(harness.d1Database, 'prepare').mockImplementation((sql: string) => {
      const boundParameterCount = (sql.match(/\?/g) ?? []).length

      if (boundParameterCount > maxBoundParametersPerStatement) {
        throw new Error(`D1 bind parameter limit exceeded: ${boundParameterCount}`)
      }

      return originalPrepare(sql)
    })
  }

  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()

    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  function buildOrderedTimestamp(offset: number) {
    const day = String(Math.floor(offset / 24) + 1).padStart(2, '0')
    const hour = String(offset % 24).padStart(2, '0')
    return `2026-04-${day}T${hour}:00:00.000Z`
  }

  async function seedCurrentPlatformConsent(
    harness: ReturnType<typeof createApiRouteTestHarness>,
    userId: string
  ) {
    await harness.database.insert(platformDocuments).values([
      {
        id: 'privacy_v1',
        documentType: 'privacy_policy',
        version: 1,
        title: 'Privacy Policy v1',
        content: 'Privacy',
        publishedAt: '2026-03-01T00:00:00.000Z'
      },
      {
        id: 'terms_v1',
        documentType: 'platform_terms',
        version: 1,
        title: 'Platform Terms v1',
        content: 'Terms',
        publishedAt: '2026-03-02T00:00:00.000Z'
      }
    ])
    await harness.database.insert(userPlatformDocumentAcceptances).values([
      {
        id: `acceptance_${userId}_privacy`,
        userId,
        platformDocumentId: 'privacy_v1',
        acceptedAt: '2026-03-03T00:00:00.000Z'
      },
      {
        id: `acceptance_${userId}_terms`,
        userId,
        platformDocumentId: 'terms_v1',
        acceptedAt: '2026-03-03T00:00:00.000Z'
      }
    ])
  }

  test('GET /api/events hides draft events from public callers', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events', handler: eventsGetHandler }
      ]
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'creator_1',
      auth0Subject: 'auth0|creator_1',
      email: 'creator@example.com',
      displayName: 'Creator'
    })
    await harness.database.insert(events).values([
      {
        id: 'event_public',
        eventType: 'hackathon',
        name: 'Public Event',
        slug: 'public-event',
        description: 'Public',
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z',
        state: 'registration_open',
        maxTeamMembers: 5,
        blindReviewCount: 2,
        pitchReviewEnabled: true,
        blindScoreWeightPercent: 60,
        pitchScoreWeightPercent: 40,
        createdByUserId: 'creator_1'
      },
      {
        id: 'event_draft',
        eventType: 'hackathon',
        name: 'Draft Event',
        slug: 'draft-event',
        description: 'Draft',
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z',
        state: 'draft',
        maxTeamMembers: 5,
        blindReviewCount: 1,
        pitchReviewEnabled: false,
        blindScoreWeightPercent: 70,
        pitchScoreWeightPercent: 30,
        createdByUserId: 'creator_1'
      }
    ])

    const response = await harness.request('/api/events')

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload).toMatchObject({
      data: [
        expect.objectContaining({
          id: 'event_public',
          name: 'Public Event',
          slug: 'public-event',
          state: 'registration_open',
          blindReviewCount: 2,
          pitchReviewEnabled: true,
          blindScoreWeightPercent: 60,
          pitchScoreWeightPercent: 40
        })
      ],
      meta: {
        total: 1
      }
    })
  })

  test('internal draft workspace endpoints resolve for authorized actors while public draft endpoints stay hidden', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/slug/:slug', handler: eventBySlugGetHandler },
        { method: 'get', path: '/api/events/:eventId/evaluation-criteria', handler: eventCriteriaGetHandler },
        { method: 'get', path: '/api/events/:eventId/prizes', handler: eventPrizesGetHandler },
        { method: 'get', path: '/api/public/events/:slug', handler: publicEventDetailGetHandler },
        { method: 'get', path: '/api/public/events/:slug/evaluation-criteria', handler: publicEventCriteriaGetHandler },
        { method: 'get', path: '/api/public/events/:slug/prizes', handler: publicEventPrizesGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|internal_admin',
        email: 'internal-admin@example.com',
        name: 'Internal Admin'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'internal_admin',
        auth0Subject: 'auth0|internal_admin',
        email: 'internal-admin@example.com',
        displayName: 'Internal Admin'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_draft_internal',
      eventType: 'hackathon',
      name: 'Draft Internal Event',
      slug: 'draft-internal-event',
      description: 'Draft only',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      lumaEventUrl: 'https://luma.com/a4i7qtbo',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'draft',
      maxTeamMembers: 5,
      applicationLumaEmailVisible: true,
      requireLumaEmail: true,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_draft_internal_admin',
      eventId: 'event_draft_internal',
      userId: 'internal_admin',
      role: 'event_admin',
      isInJudgePool: false,
      createdAt: '2026-03-20T12:30:00.000Z'
    })
    await harness.database.insert(evaluationCriteria).values({
      id: 'criterion_draft_internal',
      eventId: 'event_draft_internal',
      name: 'Craft',
      description: 'Quality',
      weight: 100,
      displayOrder: 1,
      createdAt: '2026-03-20T12:31:00.000Z'
    })
    await harness.database.insert(prizes).values({
      id: 'prize_draft_internal',
      eventId: 'event_draft_internal',
      name: 'Internal Prize',
      description: 'Internal only',
      rewardType: 'api_credits',
      rewardValue: '100',
      rewardCurrency: 'USD',
      awardScope: 'team',
      rankStart: 1,
      rankEnd: 1,
      createdAt: '2026-03-20T12:32:00.000Z'
    })

    const internalDetailResponse = await harness.request('/api/events/slug/draft-internal-event')
    expect(internalDetailResponse.status).toBe(200)
    expect(await internalDetailResponse.json()).toMatchObject({
      data: {
        id: 'event_draft_internal',
        slug: 'draft-internal-event',
        state: 'draft',
        lumaEventUrl: 'https://luma.com/a4i7qtbo',
        requireLumaEmail: true
      }
    })

    const internalCriteriaResponse = await harness.request('/api/events/event_draft_internal/evaluation-criteria')
    expect(internalCriteriaResponse.status).toBe(200)
    expect(await internalCriteriaResponse.json()).toMatchObject({
      data: [
        {
          id: 'criterion_draft_internal',
          name: 'Craft'
        }
      ]
    })

    const internalPrizesResponse = await harness.request('/api/events/event_draft_internal/prizes')
    expect(internalPrizesResponse.status).toBe(200)
    expect(await internalPrizesResponse.json()).toMatchObject({
      data: [
        {
          id: 'prize_draft_internal',
          name: 'Internal Prize'
        }
      ]
    })

    const publicDetailResponse = await harness.request('/api/public/events/draft-internal-event')
    expect(publicDetailResponse.status).toBe(404)

    const publicCriteriaResponse = await harness.request('/api/public/events/draft-internal-event/evaluation-criteria')
    expect(publicCriteriaResponse.status).toBe(404)

    const publicPrizesResponse = await harness.request('/api/public/events/draft-internal-event/prizes')
    expect(publicPrizesResponse.status).toBe(404)
  })

  test('authenticated Meetup detail exposes Call for talks questions without publishing them', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/slug/:slug', handler: eventBySlugGetHandler },
        { method: 'get', path: '/api/public/events/:slug', handler: publicEventDetailGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|participant',
        email: 'participant@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'participant',
        auth0Subject: 'auth0|participant',
        email: 'participant@example.com',
        displayName: 'Participant'
      }
    ])
    await seedCurrentPlatformConsent(harness, 'participant')
    await harness.database.insert(events).values({
      id: 'event_cfp_registration',
      eventType: 'meetup',
      name: 'Combined CFP registration',
      slug: 'combined-cfp-registration',
      description: 'Meetup description',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-09-23T12:00:00.000Z',
      submissionOpensAt: null,
      submissionClosesAt: null,
      state: 'registration_open',
      maxTeamMembers: 1,
      talkProposalsEnabled: true,
      talkProposalOpensAt: '2026-03-20T12:00:00.000Z',
      talkProposalClosesAt: '2026-09-23T12:00:00.000Z',
      talkProposalQuestionsJson: JSON.stringify([
        {
          id: 'audience',
          type: 'short_text',
          prompt: 'Who is this talk for?',
          required: true,
          options: []
        }
      ]),
      talkProposalQuestionsRevision: 4,
      createdByUserId: 'creator_1'
    })

    const authenticatedResponse = await harness.request('/api/events/slug/combined-cfp-registration')
    expect(authenticatedResponse.status).toBe(200)
    expect(await authenticatedResponse.json()).toMatchObject({
      data: {
        talkProposalQuestions: [
          {
            id: 'audience',
            prompt: 'Who is this talk for?'
          }
        ],
        talkProposalQuestionsRevision: 4
      }
    })

    const publicResponse = await harness.request('/api/public/events/combined-cfp-registration')
    expect(publicResponse.status).toBe(200)
    const publicPayload = await publicResponse.json()
    expect(publicPayload.data).not.toHaveProperty('talkProposalQuestions')
    expect(publicPayload.data).not.toHaveProperty('talkProposalQuestionsRevision')
  })

  test('hidden events disappear publicly while event admins can still open them', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events', handler: eventsGetHandler },
        { method: 'get', path: '/api/events/:eventId', handler: eventDetailGetHandler },
        { method: 'get', path: '/api/public/events', handler: publicEventsGetHandler },
        { method: 'get', path: '/api/public/events/:slug', handler: publicEventDetailGetHandler },
        { method: 'get', path: '/api/public/events/:slug/images/background', handler: publicEventBackgroundImageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com',
        name: 'Event Admin'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'event_admin',
        auth0Subject: 'auth0|event_admin',
        email: 'event-admin@example.com',
        displayName: 'Event Admin'
      }
    ])
    await harness.database.insert(events).values([
      {
        id: 'event_visible',
        eventType: 'hackathon',
        name: 'Visible Event',
        slug: 'visible-event',
        description: 'Visible',
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z',
        state: 'registration_open',
        maxTeamMembers: 5,
        createdByUserId: 'creator_1'
      },
      {
        id: 'event_hidden',
        eventType: 'hackathon',
        name: 'Hidden Event',
        slug: 'hidden-event',
        description: 'Hidden',
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z',
        state: 'registration_open',
        hiddenAt: '2026-03-21T12:00:00.000Z',
        hiddenByUserId: 'event_admin',
        hiddenReason: 'Incorrect registration details',
        maxTeamMembers: 5,
        createdByUserId: 'creator_1'
      }
    ])
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_hidden_admin',
      eventId: 'event_hidden',
      userId: 'event_admin',
      role: 'event_admin',
      isInJudgePool: false,
      createdAt: '2026-03-20T12:30:00.000Z'
    })

    const publicListResponse = await harness.request('/api/public/events?page=1&page_size=100')
    expect(publicListResponse.status).toBe(200)
    const publicListPayload = await publicListResponse.json() as { data: Array<{ slug: string }> }
    expect(publicListPayload.data.map(event => event.slug)).toEqual(['visible-event'])

    const publicDetailResponse = await harness.request('/api/public/events/hidden-event')
    expect(publicDetailResponse.status).toBe(404)

    const adminListResponse = await harness.request('/api/events?page=1&page_size=100')
    expect(adminListResponse.status).toBe(200)
    const adminListPayload = await adminListResponse.json() as { data: Array<{ id: string }> }
    expect(adminListPayload.data.map(event => event.id)).toContain('event_hidden')

    const adminDetailResponse = await harness.request('/api/events/event_hidden')
    expect(adminDetailResponse.status).toBe(200)
    expect(await adminDetailResponse.json()).toMatchObject({
      data: {
        id: 'event_hidden',
        state: 'registration_open',
        hiddenAt: '2026-03-21T12:00:00.000Z',
        hiddenByUserId: 'event_admin',
        hiddenReason: 'Incorrect registration details'
      }
    })

    stubAuth0Session(null)

    const publicHiddenImageResponse = await harness.request('/api/public/events/hidden-event/images/background')
    expect(publicHiddenImageResponse.status).toBe(404)
    expect(publicHiddenImageResponse.headers.get('cache-control')).toBe('private, no-store')
  })

  test('hidden events are excluded from participant account reads', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events', handler: accountEventsGetHandler },
        { method: 'get', path: '/api/events/participation', handler: eventParticipationGetHandler },
        { method: 'get', path: '/api/events/:eventId', handler: eventDetailGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|participant_1',
        email: 'participant@example.com',
        name: 'Participant One'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'participant_1',
        auth0Subject: 'auth0|participant_1',
        email: 'participant@example.com',
        displayName: 'Participant One'
      }
    ])
    await harness.database.insert(events).values([
      {
        id: 'event_visible_participant',
        eventType: 'hackathon',
        name: 'Visible Participant Event',
        slug: 'visible-participant-event',
        description: 'Visible',
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z',
        state: 'registration_open',
        maxTeamMembers: 5,
        createdByUserId: 'creator_1'
      },
      {
        id: 'event_hidden_participant',
        eventType: 'hackathon',
        name: 'Hidden Participant Event',
        slug: 'hidden-participant-event',
        description: 'Hidden',
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z',
        state: 'registration_open',
        hiddenAt: '2026-03-21T12:00:00.000Z',
        hiddenByUserId: 'creator_1',
        hiddenReason: 'Venue issue',
        maxTeamMembers: 5,
        createdByUserId: 'creator_1'
      }
    ])
    await harness.database.insert(userApplications).values([
      {
        id: 'application_visible_participant',
        eventId: 'event_visible_participant',
        userId: 'participant_1',
        status: 'approved',
        submittedAt: '2026-03-20T12:30:00.000Z'
      },
      {
        id: 'application_hidden_participant',
        eventId: 'event_hidden_participant',
        userId: 'participant_1',
        status: 'approved',
        submittedAt: '2026-03-20T12:31:00.000Z'
      }
    ])

    const accountResponse = await harness.request('/api/account/events')
    expect(accountResponse.status).toBe(200)
    const accountPayload = await accountResponse.json() as { data: { current: Array<{ id: string }> } }
    expect(accountPayload.data.current.map(event => event.id)).toEqual(['event_visible_participant'])

    const participationResponse = await harness.request('/api/events/participation')
    expect(participationResponse.status).toBe(200)
    const participationPayload = await participationResponse.json() as { data: { current: Array<{ event: { id: string } }> } }
    expect(participationPayload.data.current.map(record => record.event.id)).toEqual(['event_visible_participant'])

    const directResponse = await harness.request('/api/events/event_hidden_participant')
    expect(directResponse.status).toBe(404)
  })

  test('GET /api/events/participation requires a platform account', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/participation', handler: eventParticipationGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|identity_only',
        email: 'identity@example.com'
      }
    })
    harnesses.push(harness)

    const response = await harness.request('/api/events/participation')

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'platform_account_required'
      }
    })
  })

  test('GET /api/events/participation returns an empty payload for platform users without participation records', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/participation', handler: eventParticipationGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|participant_pending',
        email: 'participant-pending@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'participant_pending',
      auth0Subject: 'auth0|participant_pending',
      email: 'participant-pending@example.com',
      displayName: 'Participant Pending'
    })

    const response = await harness.request('/api/events/participation')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        current: [],
        past: []
      }
    })
  })

  test('GET /api/events/participation returns current and past participation from applications, teams, and submissions', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/participation', handler: eventParticipationGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|participant_1',
        email: 'participant@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'participant_1',
        auth0Subject: 'auth0|participant_1',
        email: 'participant@example.com',
        displayName: 'Participant One'
      },
      {
        id: 'participant_2',
        auth0Subject: 'auth0|participant_2',
        email: 'participant-two@example.com',
        displayName: 'Participant Two'
      }
    ])

    await harness.database.insert(events).values([
      {
        id: 'event_current',
        eventType: 'hackathon',
        name: 'Current Event',
        slug: 'current-event',
        description: 'Current program',
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z',
        state: 'submission_open',
        maxTeamMembers: 5,
        createdByUserId: 'creator_1'
      },
      {
        id: 'event_past',
        eventType: 'hackathon',
        name: 'Past Event',
        slug: 'past-event',
        description: 'Past program',
        city: 'London',
        country: 'United Kingdom',
        address: 'Address',
        registrationOpensAt: '2026-01-10T12:00:00.000Z',
        registrationClosesAt: '2026-01-13T12:00:00.000Z',
        submissionOpensAt: '2026-01-13T12:00:00.000Z',
        submissionClosesAt: '2026-01-15T12:00:00.000Z',
        state: 'completed',
        maxTeamMembers: 4,
        createdByUserId: 'creator_1'
      }
    ])

    await harness.database.insert(eventTermsDocuments).values([
      {
        id: 'terms_current',
        eventId: 'event_current',
        documentType: 'application_terms',
        version: 1,
        title: 'Current terms',
        content: 'Current terms content',
        publishedAt: '2026-03-18T00:00:00.000Z'
      },
      {
        id: 'terms_past',
        eventId: 'event_past',
        documentType: 'application_terms',
        version: 1,
        title: 'Past terms',
        content: 'Past terms content',
        publishedAt: '2026-01-08T00:00:00.000Z'
      }
    ])

    await harness.database.insert(userApplications).values([
      {
        id: 'application_current',
        eventId: 'event_current',
        userId: 'participant_1',
        status: 'approved',
        submittedAt: '2026-03-20T13:00:00.000Z',
        reviewedAt: '2026-03-20T15:00:00.000Z',
        applicationTermsDocumentId: 'terms_current',
        applicationTermsAcceptedAt: '2026-03-20T13:00:00.000Z',
        updatedAt: '2026-03-20T15:00:00.000Z'
      },
      {
        id: 'application_past',
        eventId: 'event_past',
        userId: 'participant_1',
        status: 'approved',
        submittedAt: '2026-01-10T13:00:00.000Z',
        reviewedAt: '2026-01-10T15:00:00.000Z',
        checkedInAt: '2026-01-15T18:05:00.000Z',
        applicationTermsDocumentId: 'terms_past',
        applicationTermsAcceptedAt: '2026-01-10T13:00:00.000Z',
        updatedAt: '2026-01-10T15:00:00.000Z'
      }
    ])

    await harness.database.insert(teams).values([
      {
        id: 'team_current',
        eventId: 'event_current',
        name: 'Current Team',
        slug: 'current-team',
        createdByUserId: 'participant_1'
      },
      {
        id: 'team_past',
        eventId: 'event_past',
        name: 'Past Team',
        slug: 'past-team',
        createdByUserId: 'participant_1'
      },
      {
        id: 'team_past_other',
        eventId: 'event_past',
        name: 'Other Past Team',
        slug: 'other-past-team',
        createdByUserId: 'participant_2'
      }
    ])

    await harness.database.insert(teamMembers).values([
      {
        id: 'membership_current',
        teamId: 'team_current',
        userId: 'participant_1',
        role: 'admin',
        joinedAt: '2026-03-20T16:00:00.000Z',
        leftAt: null
      },
      {
        id: 'membership_past',
        teamId: 'team_past',
        userId: 'participant_1',
        role: 'member',
        joinedAt: '2026-01-10T16:00:00.000Z',
        leftAt: '2026-01-15T18:00:00.000Z'
      },
      {
        id: 'membership_past_other',
        teamId: 'team_past_other',
        userId: 'participant_2',
        role: 'admin',
        joinedAt: '2026-01-10T16:05:00.000Z',
        leftAt: null
      }
    ])

    await harness.database.insert(submissions).values([
      {
        id: 'submission_current',
        teamId: 'team_current',
        status: 'submitted',
        projectName: 'Current Project',
        submittedAt: '2026-03-24T11:00:00.000Z',
        createdAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T11:00:00.000Z'
      },
      {
        id: 'submission_past',
        teamId: 'team_past',
        status: 'locked',
        projectName: 'Past Project',
        submittedAt: '2026-01-14T11:00:00.000Z',
        lockedAt: '2026-01-15T11:00:00.000Z',
        createdAt: '2026-01-14T10:00:00.000Z',
        updatedAt: '2026-01-15T11:00:00.000Z'
      },
      {
        id: 'submission_past_other',
        teamId: 'team_past_other',
        status: 'locked',
        projectName: 'Other Past Project',
        submittedAt: '2026-01-14T11:05:00.000Z',
        lockedAt: '2026-01-15T11:00:00.000Z',
        createdAt: '2026-01-14T10:05:00.000Z',
        updatedAt: '2026-01-15T11:00:00.000Z'
      }
    ])

    await harness.database.insert(evaluationCriteria).values({
      id: 'criterion_past',
      eventId: 'event_past',
      name: 'Execution',
      description: 'Execution quality',
      weight: 100,
      displayOrder: 1,
      createdAt: '2026-01-13T09:00:00.000Z'
    })

    await harness.database.insert(judgeAssignments).values([
      {
        id: 'assignment_past_1',
        eventId: 'event_past',
        submissionId: 'submission_past',
        judgeUserId: 'creator_1',
        reviewStage: 'blind_review',
        blindReviewSlot: 1,
        status: 'judge_completed',
        assignedAt: '2026-01-15T09:00:00.000Z',
        startedAt: '2026-01-15T09:01:00.000Z',
        completedAt: '2026-01-15T09:02:00.000Z',
        createdAt: '2026-01-15T09:00:00.000Z'
      },
      {
        id: 'assignment_past_2',
        eventId: 'event_past',
        submissionId: 'submission_past_other',
        judgeUserId: 'creator_1',
        reviewStage: 'blind_review',
        blindReviewSlot: 1,
        status: 'judge_completed',
        assignedAt: '2026-01-15T09:03:00.000Z',
        startedAt: '2026-01-15T09:04:00.000Z',
        completedAt: '2026-01-15T09:05:00.000Z',
        createdAt: '2026-01-15T09:03:00.000Z'
      }
    ])

    await harness.database.insert(judgeCriterionScores).values([
      {
        id: 'score_past_1',
        judgeAssignmentId: 'assignment_past_1',
        evaluationCriterionId: 'criterion_past',
        score: 4,
        comment: 'Solid',
        createdAt: '2026-01-15T09:02:00.000Z',
        updatedAt: '2026-01-15T09:02:00.000Z'
      },
      {
        id: 'score_past_2',
        judgeAssignmentId: 'assignment_past_2',
        evaluationCriterionId: 'criterion_past',
        score: 5,
        comment: 'Excellent',
        createdAt: '2026-01-15T09:05:00.000Z',
        updatedAt: '2026-01-15T09:05:00.000Z'
      }
    ])

    await harness.database.insert(prizes).values({
      id: 'prize_past_1',
      eventId: 'event_past',
      name: 'Grand Prize',
      description: 'Top-ranked team',
      rewardType: 'api_credits',
      rewardValue: '1000',
      rewardCurrency: 'USD',
      awardScope: 'team',
      rankStart: 1,
      rankEnd: 1,
      displayOrder: 1,
      createdAt: '2026-01-15T09:06:00.000Z'
    })

    const response = await harness.request('/api/events/participation')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        current: [
          {
            event: {
              id: 'event_current',
              eventType: 'hackathon',
              slug: 'current-event',
              state: 'submission_open',
              maxTeamMembers: 5
            },
            isPast: false,
            application: {
              id: 'application_current',
              status: 'approved'
            },
            activeTeam: {
              id: 'team_current',
              membershipRole: 'admin',
              isActiveMembership: true
            },
            latestTeam: {
              id: 'team_current'
            },
            latestSubmission: {
              id: 'submission_current',
              status: 'submitted'
            },
            outcome: null
          }
        ],
        past: [
          {
            event: {
              id: 'event_past',
              eventType: 'hackathon',
              slug: 'past-event',
              state: 'completed',
              maxTeamMembers: 4
            },
            isPast: true,
            application: {
              id: 'application_past',
              userId: 'participant_1',
              status: 'approved',
              isCheckedIn: true,
              certificateHiddenAt: null,
              certificateRevokedAt: null
            },
            activeTeam: null,
            latestTeam: {
              id: 'team_past',
              membershipRole: 'member',
              isActiveMembership: false
            },
            latestSubmission: {
              id: 'submission_past',
              status: 'locked'
            },
            outcome: {
              isShortlisted: false,
              isWinner: false,
              finalRank: 2,
              rankedTeamCount: 2,
              prizes: []
            }
          }
        ]
      }
    })
  })

  test('GET /api/events/:eventId/rank/me returns the blind-review placement for completed post-shortlist teams', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/rank/me', handler: ownEventRankGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|participant_rank_1',
        email: 'participant-rank@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_rank_1',
        auth0Subject: 'auth0|creator_rank_1',
        email: 'creator-rank@example.com',
        displayName: 'Creator Rank'
      },
      {
        id: 'participant_rank_1',
        auth0Subject: 'auth0|participant_rank_1',
        email: 'participant-rank@example.com',
        displayName: 'Participant Rank'
      },
      {
        id: 'judge_rank_1',
        auth0Subject: 'auth0|judge_rank_1',
        email: 'judge-rank@example.com',
        displayName: 'Judge Rank'
      },
      {
        id: 'active_unranked_rank_1',
        auth0Subject: 'auth0|active_unranked_rank_1',
        email: 'active-unranked-rank@example.com',
        displayName: 'Active Unranked Rank'
      },
      {
        id: 'dissolved_rank_1',
        auth0Subject: 'auth0|dissolved_rank_1',
        email: 'dissolved-rank@example.com',
        displayName: 'Dissolved Rank'
      }
    ])

    await harness.database.insert(events).values({
      id: 'event_rank_1',
      eventType: 'hackathon',
      name: 'Ranked Event',
      slug: 'ranked-event',
      description: 'Completed pitch event',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-01T09:00:00.000Z',
      registrationClosesAt: '2026-03-05T09:00:00.000Z',
      submissionOpensAt: '2026-03-05T09:00:00.000Z',
      submissionClosesAt: '2026-03-10T09:00:00.000Z',
      state: 'completed',
      maxTeamMembers: 5,
      blindReviewCount: 1,
      pitchReviewEnabled: true,
      pitchFinalistSubmissionIdsJson: JSON.stringify(['submission_rank_top', 'submission_rank_runner_up']),
      finalRankingSubmissionIdsJson: JSON.stringify(['submission_rank_top', 'submission_rank_runner_up']),
      createdByUserId: 'creator_rank_1'
    })

    await harness.database.insert(eventTermsDocuments).values({
      id: 'terms_rank_1',
      eventId: 'event_rank_1',
      documentType: 'application_terms',
      version: 1,
      title: 'Rank terms',
      content: 'Terms',
      publishedAt: '2026-02-28T09:00:00.000Z'
    })

    await harness.database.insert(userApplications).values({
      id: 'application_rank_1',
      eventId: 'event_rank_1',
      userId: 'participant_rank_1',
      status: 'approved',
      submittedAt: '2026-03-01T10:00:00.000Z',
      reviewedAt: '2026-03-01T12:00:00.000Z',
      applicationTermsDocumentId: 'terms_rank_1',
      applicationTermsAcceptedAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T12:00:00.000Z'
    })

    await harness.database.insert(teams).values([
      {
        id: 'team_rank_user',
        eventId: 'event_rank_1',
        name: 'User Team',
        slug: 'user-team',
        createdByUserId: 'participant_rank_1'
      },
      {
        id: 'team_rank_top',
        eventId: 'event_rank_1',
        name: 'Top Team',
        slug: 'top-team',
        createdByUserId: 'creator_rank_1'
      },
      {
        id: 'team_rank_runner_up',
        eventId: 'event_rank_1',
        name: 'Runner Up Team',
        slug: 'runner-up-team',
        createdByUserId: 'creator_rank_1'
      },
      {
        id: 'team_rank_active_unranked',
        eventId: 'event_rank_1',
        name: 'Active Unranked Team',
        slug: 'active-unranked-team',
        createdByUserId: 'creator_rank_1'
      },
      {
        id: 'team_rank_dissolved',
        eventId: 'event_rank_1',
        name: 'Dissolved Team',
        slug: 'dissolved-team',
        createdByUserId: 'creator_rank_1'
      }
    ])

    await harness.database.insert(teamMembers).values([
      {
        id: 'membership_rank_user',
        teamId: 'team_rank_user',
        userId: 'participant_rank_1',
        role: 'admin',
        joinedAt: '2026-03-01T12:30:00.000Z',
        leftAt: null
      },
      {
        id: 'membership_rank_top',
        teamId: 'team_rank_top',
        userId: 'creator_rank_1',
        role: 'admin',
        joinedAt: '2026-03-01T12:31:00.000Z',
        leftAt: null
      },
      {
        id: 'membership_rank_runner_up',
        teamId: 'team_rank_runner_up',
        userId: 'judge_rank_1',
        role: 'admin',
        joinedAt: '2026-03-01T12:32:00.000Z',
        leftAt: null
      },
      {
        id: 'membership_rank_active_unranked',
        teamId: 'team_rank_active_unranked',
        userId: 'active_unranked_rank_1',
        role: 'member',
        joinedAt: '2026-03-01T12:33:00.000Z',
        leftAt: null
      },
      {
        id: 'membership_rank_dissolved',
        teamId: 'team_rank_dissolved',
        userId: 'dissolved_rank_1',
        role: 'member',
        joinedAt: '2026-03-01T12:34:00.000Z',
        leftAt: '2026-03-02T12:34:00.000Z'
      }
    ])

    await harness.database.insert(submissions).values([
      {
        id: 'submission_rank_user',
        teamId: 'team_rank_user',
        status: 'locked',
        projectName: 'User Project',
        submittedAt: '2026-03-09T12:00:00.000Z',
        lockedAt: '2026-03-10T09:00:00.000Z',
        createdAt: '2026-03-09T11:00:00.000Z',
        updatedAt: '2026-03-10T09:00:00.000Z'
      },
      {
        id: 'submission_rank_top',
        teamId: 'team_rank_top',
        status: 'locked',
        projectName: 'Top Project',
        submittedAt: '2026-03-09T12:05:00.000Z',
        lockedAt: '2026-03-10T09:00:00.000Z',
        createdAt: '2026-03-09T11:05:00.000Z',
        updatedAt: '2026-03-10T09:00:00.000Z'
      },
      {
        id: 'submission_rank_runner_up',
        teamId: 'team_rank_runner_up',
        status: 'locked',
        projectName: 'Runner Up Project',
        submittedAt: '2026-03-09T12:10:00.000Z',
        lockedAt: '2026-03-10T09:00:00.000Z',
        createdAt: '2026-03-09T11:10:00.000Z',
        updatedAt: '2026-03-10T09:00:00.000Z'
      }
    ])

    await harness.database.insert(evaluationCriteria).values({
      id: 'criterion_rank_1',
      eventId: 'event_rank_1',
      name: 'Execution',
      description: 'Execution quality',
      weight: 100,
      displayOrder: 1,
      createdAt: '2026-03-08T09:00:00.000Z'
    })

    await harness.database.insert(judgeAssignments).values([
      {
        id: 'assignment_rank_user_blind',
        eventId: 'event_rank_1',
        submissionId: 'submission_rank_user',
        judgeUserId: 'judge_rank_1',
        reviewStage: 'blind_review',
        blindReviewSlot: 1,
        status: 'judge_completed',
        assignedAt: '2026-03-10T10:00:00.000Z',
        startedAt: '2026-03-10T10:01:00.000Z',
        completedAt: '2026-03-10T10:02:00.000Z',
        createdAt: '2026-03-10T10:00:00.000Z'
      },
      {
        id: 'assignment_rank_top_blind',
        eventId: 'event_rank_1',
        submissionId: 'submission_rank_top',
        judgeUserId: 'judge_rank_1',
        reviewStage: 'blind_review',
        blindReviewSlot: 1,
        status: 'judge_completed',
        assignedAt: '2026-03-10T10:03:00.000Z',
        startedAt: '2026-03-10T10:04:00.000Z',
        completedAt: '2026-03-10T10:05:00.000Z',
        createdAt: '2026-03-10T10:03:00.000Z'
      },
      {
        id: 'assignment_rank_runner_up_blind',
        eventId: 'event_rank_1',
        submissionId: 'submission_rank_runner_up',
        judgeUserId: 'judge_rank_1',
        reviewStage: 'blind_review',
        blindReviewSlot: 1,
        status: 'judge_completed',
        assignedAt: '2026-03-10T10:06:00.000Z',
        startedAt: '2026-03-10T10:07:00.000Z',
        completedAt: '2026-03-10T10:08:00.000Z',
        createdAt: '2026-03-10T10:06:00.000Z'
      },
      {
        id: 'assignment_rank_top_pitch',
        eventId: 'event_rank_1',
        submissionId: 'submission_rank_top',
        judgeUserId: 'judge_rank_1',
        reviewStage: 'pitch_review',
        blindReviewSlot: null,
        status: 'judge_completed',
        pitchScore: 5,
        pitchComment: 'Strong pitch',
        assignedAt: '2026-03-10T11:00:00.000Z',
        startedAt: '2026-03-10T11:01:00.000Z',
        completedAt: '2026-03-10T11:02:00.000Z',
        createdAt: '2026-03-10T11:00:00.000Z'
      },
      {
        id: 'assignment_rank_runner_up_pitch',
        eventId: 'event_rank_1',
        submissionId: 'submission_rank_runner_up',
        judgeUserId: 'judge_rank_1',
        reviewStage: 'pitch_review',
        blindReviewSlot: null,
        status: 'judge_completed',
        pitchScore: 4,
        pitchComment: 'Good pitch',
        assignedAt: '2026-03-10T11:03:00.000Z',
        startedAt: '2026-03-10T11:04:00.000Z',
        completedAt: '2026-03-10T11:05:00.000Z',
        createdAt: '2026-03-10T11:03:00.000Z'
      }
    ])

    await harness.database.insert(judgeCriterionScores).values([
      {
        id: 'score_rank_user',
        judgeAssignmentId: 'assignment_rank_user_blind',
        evaluationCriterionId: 'criterion_rank_1',
        score: 3,
        comment: 'Solid',
        createdAt: '2026-03-10T10:02:00.000Z',
        updatedAt: '2026-03-10T10:02:00.000Z'
      },
      {
        id: 'score_rank_top',
        judgeAssignmentId: 'assignment_rank_top_blind',
        evaluationCriterionId: 'criterion_rank_1',
        score: 5,
        comment: 'Excellent',
        createdAt: '2026-03-10T10:05:00.000Z',
        updatedAt: '2026-03-10T10:05:00.000Z'
      },
      {
        id: 'score_rank_runner_up',
        judgeAssignmentId: 'assignment_rank_runner_up_blind',
        evaluationCriterionId: 'criterion_rank_1',
        score: 4,
        comment: 'Great',
        createdAt: '2026-03-10T10:08:00.000Z',
        updatedAt: '2026-03-10T10:08:00.000Z'
      }
    ])

    const response = await harness.request('/api/events/event_rank_1/rank/me')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        basis: 'blind_review',
        rank: 3,
        rankedTeamCount: 3,
        totalTeamCount: 4
      }
    })
  })

  test('workspace users can read published judge and staff rosters without admin-only fields', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/judges', handler: eventJudgesGetHandler },
        { method: 'get', path: '/api/events/:eventId/staff', handler: eventStaffGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|participant_viewer',
        email: 'participant-viewer@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'participant_viewer',
        auth0Subject: 'auth0|participant_viewer',
        email: 'participant-viewer@example.com',
        displayName: 'Participant Viewer',
        firstName: 'Participant',
        familyName: 'Viewer'
      },
      {
        id: 'judge_user',
        auth0Subject: 'auth0|judge_user',
        email: 'judge@example.com',
        displayName: 'Judge User',
        firstName: 'Judge',
        familyName: 'User',
        company: 'Codex Labs',
        bio: 'Reviews technical execution.',
        xProfileUrl: 'https://x.com/judge-user',
        profileIconUpdatedAt: '2026-03-15T10:00:00.000Z'
      },
      {
        id: 'staff_user',
        auth0Subject: 'auth0|staff_user',
        email: 'staff@example.com',
        displayName: 'Staff User',
        firstName: 'Staff',
        familyName: 'User',
        company: 'Community Ops',
        bio: 'Keeps the event moving.',
        linkedinProfileUrl: 'https://linkedin.com/in/staff-user'
      },
      {
        id: 'admin_user',
        auth0Subject: 'auth0|admin_user',
        email: 'admin@example.com',
        displayName: 'Admin User',
        firstName: 'Admin',
        familyName: 'User',
        company: 'Codex Community',
        bio: 'Supports operations and judging.',
        githubProfileUrl: 'https://github.com/admin-user'
      }
    ])
    await seedCurrentPlatformConsent(harness, 'participant_viewer')
    await harness.database.insert(events).values({
      id: 'event_1',
      eventType: 'hackathon',
      name: 'Fixture Event',
      slug: 'fixture-event',
      description: 'Fixture event',
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'admin_user'
    })
    await harness.database.insert(eventTermsDocuments).values({
      id: 'terms_app_1',
      eventId: 'event_1',
      documentType: 'application_terms',
      version: 1,
      title: 'Application Terms v1',
      content: 'Terms',
      publishedAt: '2026-03-03T00:00:00.000Z'
    })
    await harness.database.insert(eventTracks).values({
      id: 'track_ai',
      eventId: 'event_1',
      name: 'AI Track',
      shortDescription: 'AI projects',
      fullDescription: 'Internal AI track guidance.',
      staffInstructions: 'Help AI track participants find review support.',
      displayOrder: 1,
      createdAt: '2026-03-10T08:00:00.000Z'
    })
    await harness.database.insert(userApplications).values({
      id: 'application_viewer',
      eventId: 'event_1',
      userId: 'participant_viewer',
      status: 'submitted',
      applicationTermsDocumentId: 'terms_app_1',
      applicationTermsAcceptedAt: '2026-03-03T00:00:00.000Z'
    })
    await harness.database.insert(eventRoleAssignments).values([
      {
        id: 'assignment_judge_user',
        eventId: 'event_1',
        userId: 'judge_user',
        role: 'judge',
        isInJudgePool: true,
        isStaff: false,
        createdAt: '2026-03-10T09:00:00.000Z'
      },
      {
        id: 'assignment_staff_user',
        eventId: 'event_1',
        userId: 'staff_user',
        role: 'staff',
        isInJudgePool: false,
        isStaff: true,
        staffTrackId: 'track_ai',
        createdAt: '2026-03-10T09:05:00.000Z'
      },
      {
        id: 'assignment_admin_user',
        eventId: 'event_1',
        userId: 'admin_user',
        role: 'event_admin',
        isInJudgePool: true,
        isStaff: true,
        createdAt: '2026-03-10T09:10:00.000Z'
      }
    ])

    const judgesResponse = await harness.request('/api/events/event_1/judges')
    expect(judgesResponse.status).toBe(200)
    const judgesPayload = await judgesResponse.json()
    expect(judgesPayload).toMatchObject({
      meta: {
        total: 2
      }
    })
    expect(judgesPayload.data).toEqual([
      {
        id: 'admin_user',
        fullName: 'Admin User',
        company: 'Codex Community',
        bio: 'Supports operations and judging.',
        xProfileUrl: null,
        linkedinProfileUrl: null,
        githubProfileUrl: 'https://github.com/admin-user',
        profileIconUpdatedAt: null,
        profileIconRevision: null
      },
      {
        id: 'judge_user',
        fullName: 'Judge User',
        company: 'Codex Labs',
        bio: 'Reviews technical execution.',
        xProfileUrl: 'https://x.com/judge-user',
        linkedinProfileUrl: null,
        githubProfileUrl: null,
        profileIconUpdatedAt: '2026-03-15T10:00:00.000Z',
        profileIconRevision: null
      }
    ])
    expect(judgesPayload.data[0]).not.toHaveProperty('email')
    expect(judgesPayload.data[0]).not.toHaveProperty('isPlatformAdmin')
    expect(judgesPayload.data[0]).not.toHaveProperty('chatgptEmail')
    expect(judgesPayload.data[0]).not.toHaveProperty('openaiOrgId')
    expect(judgesPayload.data[0]).not.toHaveProperty('lumaEmail')

    const staffResponse = await harness.request('/api/events/event_1/staff')
    expect(staffResponse.status).toBe(200)
    expect(await staffResponse.json()).toMatchObject({
      data: [
        {
          id: 'admin_user',
          fullName: 'Admin User',
          githubProfileUrl: 'https://github.com/admin-user'
        },
        {
          id: 'staff_user',
          fullName: 'Staff User',
          staffTrack: {
            id: 'track_ai',
            name: 'AI Track',
            shortDescription: 'AI projects',
            displayOrder: 1
          },
          linkedinProfileUrl: 'https://linkedin.com/in/staff-user'
        }
      ],
      meta: {
        total: 2
      }
    })
  })

  test('published roster reads require workspace access for the event', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/judges', handler: eventJudgesGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|unrelated_user',
        email: 'unrelated@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'unrelated_user',
        auth0Subject: 'auth0|unrelated_user',
        email: 'unrelated@example.com',
        displayName: 'Unrelated User'
      },
      {
        id: 'admin_user',
        auth0Subject: 'auth0|admin_user',
        email: 'admin@example.com',
        displayName: 'Admin User'
      }
    ])
    await seedCurrentPlatformConsent(harness, 'unrelated_user')
    await harness.database.insert(events).values({
      id: 'event_1',
      eventType: 'hackathon',
      name: 'Fixture Event',
      slug: 'fixture-event',
      description: 'Fixture event',
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'admin_user'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'assignment_admin_user',
      eventId: 'event_1',
      userId: 'admin_user',
      role: 'event_admin',
      isInJudgePool: true,
      isStaff: true,
      createdAt: '2026-03-10T09:10:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/judges')
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'event_workspace_access_required'
      }
    })
  })

  test('GET /api/public/events stays public-safe and complete for authenticated admins when drafts fill page slots', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/public/events', handler: publicEventsGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'platform_admin',
        auth0Subject: 'auth0|platform_admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        isPlatformAdmin: true
      },
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      }
    ])

    await insertEventsInBatches(harness, [
      ...Array.from({ length: 100 }, (_, index) => ({
        id: `event_draft_${index + 1}`,
        eventType: 'hackathon' as const,
        name: `Draft Event ${index + 1}`,
        slug: `draft-event-${index + 1}`,
        description: 'Draft',
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z',
        state: 'draft' as const,
        maxTeamMembers: 5,
        createdByUserId: 'platform_admin',
        createdAt: buildOrderedTimestamp(index),
        updatedAt: buildOrderedTimestamp(index)
      })),
      {
        id: 'event_public',
        eventType: 'hackathon',
        name: 'Public Event',
        slug: 'public-event',
        description: 'Public',
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z',
        state: 'registration_open',
        maxTeamMembers: 5,
        createdByUserId: 'creator_1',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z'
      }
    ])

    const response = await harness.request('/api/public/events?page=1&page_size=100')

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(response.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]+"$/)
    expect(response.headers.get('vary')).toBe('Accept-Encoding')
    const payload = await response.json()

    expect(payload).toMatchObject({
      data: [
        expect.objectContaining({
          name: 'Public Event',
          slug: 'public-event'
        })
      ],
      meta: {
        total: 1
      }
    })

    expect(payload.data[0]).not.toHaveProperty('id')
    expect(payload.data[0]).not.toHaveProperty('currentApplicationTermsDocumentId')
    expect(payload.data[0]).not.toHaveProperty('currentWinnerTermsDocumentId')
    expect(payload.data[0]).not.toHaveProperty('createdByUserId')
    expect(payload.data[0]).not.toHaveProperty('createdAt')
    expect(payload.data[0]).not.toHaveProperty('updatedAt')
  })

  test('GET /api/public/events/:slug resolves the exact public event without paginated lookup', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/public/events/:slug', handler: publicEventDetailGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'platform_admin',
        auth0Subject: 'auth0|platform_admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        isPlatformAdmin: true
      },
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      }
    ])

    await insertEventsInBatches(harness, [
      ...Array.from({ length: 120 }, (_, index) => ({
        id: `event_public_${index + 1}`,
        eventType: 'hackathon' as const,
        name: `Public Event ${index + 1}`,
        slug: `public-event-${index + 1}`,
        description: 'Public',
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z',
        state: 'registration_open' as const,
        maxTeamMembers: 5,
        createdByUserId: 'creator_1',
        createdAt: buildOrderedTimestamp(index),
        updatedAt: buildOrderedTimestamp(index)
      })),
      {
        id: 'event_target',
        eventType: 'hackathon',
        name: 'Target Public Event',
        slug: 'public-event',
        description: 'Target public detail',
        discordServerUrl: 'https://discord.gg/private-codex',
        slidesUrl: 'https://example.com/private-slides',
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z',
        state: 'registration_open',
        maxTeamMembers: 5,
        createdByUserId: 'creator_1',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z'
      }
    ])
    await harness.database.insert(eventTermsDocuments).values([
      {
        id: 'terms_public_app_1',
        eventId: 'event_target',
        documentType: 'application_terms',
        version: 2,
        title: 'Public Application Terms',
        content: 'Public application content',
        publishedAt: '2026-03-01T00:00:00.000Z'
      },
      {
        id: 'terms_public_win_1',
        eventId: 'event_target',
        documentType: 'winner_terms',
        version: 1,
        title: 'Public Winner Terms',
        content: 'Public winner content',
        publishedAt: '2026-03-02T00:00:00.000Z'
      }
    ])
    await harness.database
      .update(events)
      .set({
        currentApplicationTermsDocumentId: 'terms_public_app_1',
        currentWinnerTermsDocumentId: 'terms_public_win_1'
      })
      .where(eq(events.id, 'event_target'))
    await harness.database.insert(eventTracks).values({
      id: 'track_public_agents',
      eventId: 'event_target',
      name: 'Agents',
      shortDescription: 'Build with agents.',
      fullDescription: 'Internal participant guidelines.',
      staffInstructions: 'Internal staff notes.',
      resourcesJson: JSON.stringify([{
        id: 'resource_public_agents',
        title: 'Starter guide',
        url: 'https://example.com/agents',
        description: 'Private until selected.',
        displayOrder: 1
      }]),
      displayOrder: 1,
      createdAt: '2026-03-01T00:00:00.000Z'
    })

    const response = await harness.request('/api/public/events/public-event')

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(response.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(response.headers.get('etag')).toMatch(/^"[0-9a-f]+"$/)
    expect(response.headers.get('vary')).toBe('Accept-Encoding')
    const payload = await response.json()

    expect(payload).toMatchObject({
      data: {
        slug: 'public-event',
        name: 'Target Public Event',
        currentTerms: {
          applicationTerms: {
            documentType: 'application_terms',
            version: 2,
            title: 'Public Application Terms'
          },
          winnerTerms: {
            documentType: 'winner_terms',
            version: 1,
            title: 'Public Winner Terms'
          }
        }
      }
    })

    expect(payload.data).not.toHaveProperty('id')
    expect(payload.data).not.toHaveProperty('currentApplicationTermsDocumentId')
    expect(payload.data).not.toHaveProperty('currentWinnerTermsDocumentId')
    expect(payload.data).not.toHaveProperty('createdByUserId')
    expect(payload.data).not.toHaveProperty('createdAt')
    expect(payload.data).not.toHaveProperty('updatedAt')
    expect(payload.data.address).toBe('')
    expect(payload.data).not.toHaveProperty('discordServerUrl')
    expect(payload.data).not.toHaveProperty('slidesUrl')
    expect(payload.data.currentTerms.applicationTerms).not.toHaveProperty('id')
    expect(payload.data.currentTerms.winnerTerms).not.toHaveProperty('id')
    expect(payload.data.tracks).toEqual([
      {
        name: 'Agents',
        shortDescription: 'Build with agents.',
        displayOrder: 1
      }
    ])
    expect(payload.data.tracks[0]).not.toHaveProperty('id')
    expect(payload.data.tracks[0]).not.toHaveProperty('fullDescription')
    expect(payload.data.tracks[0]).not.toHaveProperty('staffInstructions')
    expect(payload.data.tracks[0]).not.toHaveProperty('resources')

    const fullTracksResponse = await harness.request('/api/public/events/public-event?tracks=full')
    expect(fullTracksResponse.status).toBe(200)
    expect(fullTracksResponse.headers.get('cache-control')).toBe('public, max-age=30, stale-if-error=0')
    const fullTracksPayload = await fullTracksResponse.json()

    expect(fullTracksPayload.data.address).toBe('')
    expect(fullTracksPayload.data).not.toHaveProperty('discordServerUrl')
    expect(fullTracksPayload.data).not.toHaveProperty('slidesUrl')
    expect(fullTracksPayload.data.tracks).toEqual([
      {
        name: 'Agents',
        shortDescription: 'Build with agents.',
        fullDescription: 'Internal participant guidelines.',
        resources: [{
          title: 'Starter guide',
          url: 'https://example.com/agents',
          description: 'Private until selected.',
          displayOrder: 1
        }],
        displayOrder: 1
      }
    ])
    expect(fullTracksPayload.data.tracks[0]).not.toHaveProperty('id')
    expect(fullTracksPayload.data.tracks[0]).not.toHaveProperty('eventId')
    expect(fullTracksPayload.data.tracks[0]).not.toHaveProperty('staffInstructions')
    expect(fullTracksPayload.data.tracks[0].resources[0]).not.toHaveProperty('id')
  })

  test('GET /api/events/:eventId gates track staff instructions by event role', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId', handler: eventDetailGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|participant',
        email: 'participant@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'platform_admin',
        auth0Subject: 'auth0|platform_admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        isPlatformAdmin: true
      },
      {
        id: 'event_admin',
        auth0Subject: 'auth0|event_admin',
        email: 'event-admin@example.com',
        displayName: 'Event Admin'
      },
      {
        id: 'general_staff',
        auth0Subject: 'auth0|general_staff',
        email: 'general-staff@example.com',
        displayName: 'General Staff'
      },
      {
        id: 'track_staff',
        auth0Subject: 'auth0|track_staff',
        email: 'track-staff@example.com',
        displayName: 'Track Staff'
      },
      {
        id: 'participant',
        auth0Subject: 'auth0|participant',
        email: 'participant@example.com',
        displayName: 'Participant'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_track_visibility',
      eventType: 'build',
      name: 'Track Visibility Event',
      slug: 'track-visibility-event',
      description: 'Track visibility fixture',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 1,
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'platform_admin'
    })
    await harness.database.insert(eventTracks).values([
      {
        id: 'track_agents',
        eventId: 'event_track_visibility',
        name: 'Agents',
        shortDescription: 'Build agent projects.',
        fullDescription: 'Follow agent track guidelines.',
        staffInstructions: 'Agent staff instructions.',
        displayOrder: 1,
        createdAt: '2026-03-22T12:00:00.000Z'
      },
      {
        id: 'track_tools',
        eventId: 'event_track_visibility',
        name: 'Tools',
        shortDescription: 'Build developer tools.',
        fullDescription: 'Follow tools track guidelines.',
        staffInstructions: 'Tools staff instructions.',
        displayOrder: 2,
        createdAt: '2026-03-22T12:01:00.000Z'
      }
    ])
    await harness.database.insert(eventRoleAssignments).values([
      {
        id: 'role_event_admin_visibility',
        eventId: 'event_track_visibility',
        userId: 'event_admin',
        role: 'event_admin',
        isInJudgePool: false,
        isStaff: false,
        createdAt: '2026-03-22T12:02:00.000Z'
      },
      {
        id: 'role_general_staff_visibility',
        eventId: 'event_track_visibility',
        userId: 'general_staff',
        role: 'staff',
        isInJudgePool: false,
        isStaff: true,
        staffTrackId: null,
        createdAt: '2026-03-22T12:03:00.000Z'
      },
      {
        id: 'role_track_staff_visibility',
        eventId: 'event_track_visibility',
        userId: 'track_staff',
        role: 'staff',
        isInJudgePool: false,
        isStaff: true,
        staffTrackId: 'track_agents',
        createdAt: '2026-03-22T12:04:00.000Z'
      }
    ])
    await harness.database.insert(userApplications).values({
      id: 'application_visibility_participant',
      eventId: 'event_track_visibility',
      userId: 'participant',
      status: 'approved',
      submittedAt: '2026-03-22T12:05:00.000Z',
      createdAt: '2026-03-22T12:05:00.000Z',
      updatedAt: '2026-03-22T12:05:00.000Z'
    })

    async function requestTracksFor(sessionUser: { sub: string, email: string }) {
      stubAuth0Session(sessionUser)
      const response = await harness.request('/api/events/event_track_visibility')
      expect(response.status).toBe(200)
      const payload = await response.json()
      return payload.data.tracks as Array<{ id: string, staffInstructions?: string }>
    }

    const platformAdminTracks = await requestTracksFor({
      sub: 'auth0|platform_admin',
      email: 'platform-admin@example.com'
    })
    expect(platformAdminTracks.map(track => track.staffInstructions)).toEqual([
      'Agent staff instructions.',
      'Tools staff instructions.'
    ])

    const eventAdminTracks = await requestTracksFor({
      sub: 'auth0|event_admin',
      email: 'event-admin@example.com'
    })
    expect(eventAdminTracks.map(track => track.staffInstructions)).toEqual([
      'Agent staff instructions.',
      'Tools staff instructions.'
    ])

    const generalStaffTracks = await requestTracksFor({
      sub: 'auth0|general_staff',
      email: 'general-staff@example.com'
    })
    expect(generalStaffTracks.map(track => track.staffInstructions)).toEqual([
      'Agent staff instructions.',
      'Tools staff instructions.'
    ])

    const trackStaffTracks = await requestTracksFor({
      sub: 'auth0|track_staff',
      email: 'track-staff@example.com'
    })
    expect(trackStaffTracks).toEqual([
      expect.objectContaining({
        id: 'track_agents',
        staffInstructions: 'Agent staff instructions.'
      }),
      expect.not.objectContaining({
        staffInstructions: expect.any(String)
      })
    ])

    const participantTracks = await requestTracksFor({
      sub: 'auth0|participant',
      email: 'participant@example.com'
    })
    expect(participantTracks).toEqual([
      expect.not.objectContaining({
        staffInstructions: expect.any(String)
      }),
      expect.not.objectContaining({
        staffInstructions: expect.any(String)
      })
    ])
  })

  test('event payloads expose platform default display backgrounds without replacing event backgrounds', async () => {
    const defaultBackgroundUrl = 'http://localhost/api/public/platform/event-default-background-image'
    const defaultBackgroundVersion = '1'
    const publicDefaultBackgroundUrl = `${defaultBackgroundUrl}?variant=background&v=${encodeURIComponent(defaultBackgroundVersion)}`
    const bannerImageUrl = 'http://localhost/api/public/events/banner-only-event/images/banner'
    const publicBannerImageUrl = `${bannerImageUrl}?variant=banner&v=1`
    const eventBackgroundUrl = 'http://localhost/api/public/events/own-background-event/images/background'
    const publicEventBackgroundUrl = `${eventBackgroundUrl}?variant=background&v=1`
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/public/events', handler: publicEventsGetHandler },
        { method: 'get', path: '/api/public/events/:slug', handler: publicEventDetailGetHandler },
        { method: 'get', path: '/api/events/:eventId', handler: eventDetailGetHandler },
        { method: 'get', path: '/api/public/events/:slug/images/background', handler: publicEventBackgroundImageGetHandler }
      ]
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'creator_1',
      auth0Subject: 'auth0|creator_1',
      email: 'creator@example.com',
      displayName: 'Creator'
    })
    await harness.database.insert(platformSettings).values({
      id: 'default',
      defaultEventBackgroundImageUrl: defaultBackgroundUrl,
      defaultEventBackgroundImageObjectKey: 'platform/default-event-background/fixture-1',
      defaultEventBackgroundImageRevision: 1,
      updatedAt: defaultBackgroundVersion
    })
    await harness.database.insert(events).values([
      {
        id: 'event_banner_only',
        eventType: 'meetup',
        name: 'Banner Only Event',
        slug: 'banner-only-event',
        description: 'Event with a banner and platform default background',
        bannerImageUrl,
        bannerImageObjectKey: 'events/event_banner_only/banner/fixture-1',
        bannerImageRevision: 1,
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        state: 'registration_open',
        maxTeamMembers: 5,
        createdByUserId: 'creator_1',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z'
      },
      {
        id: 'event_own_background',
        eventType: 'hackathon',
        name: 'Own Background Event',
        slug: 'own-background-event',
        description: 'Event with an uploaded background',
        backgroundImageUrl: eventBackgroundUrl,
        backgroundImageObjectKey: 'events/event_own_background/background/fixture-1',
        backgroundImageRevision: 1,
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-21T12:00:00.000Z',
        registrationClosesAt: '2026-03-24T12:00:00.000Z',
        submissionOpensAt: '2026-03-24T12:00:00.000Z',
        submissionClosesAt: '2026-03-26T12:00:00.000Z',
        state: 'registration_open',
        maxTeamMembers: 5,
        createdByUserId: 'creator_1',
        createdAt: '2026-03-02T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:00.000Z'
      }
    ])

    const publicListResponse = await harness.request('/api/public/events?page=1&page_size=100')
    const publicListPayload = await publicListResponse.json() as {
      data: Array<{
        slug: string
        backgroundImageUrl: string | null
        bannerImageUrl: string | null
        displayBackgroundImageUrl: string | null
      }>
    }
    const bannerOnlyListEvent = publicListPayload.data.find(event => event.slug === 'banner-only-event')
    const ownBackgroundListEvent = publicListPayload.data.find(event => event.slug === 'own-background-event')

    expect(publicListResponse.status).toBe(200)
    expect(bannerOnlyListEvent).toMatchObject({
      backgroundImageUrl: null,
      bannerImageUrl: publicBannerImageUrl,
      displayBackgroundImageUrl: publicDefaultBackgroundUrl
    })
    expect(ownBackgroundListEvent).toMatchObject({
      backgroundImageUrl: publicEventBackgroundUrl,
      displayBackgroundImageUrl: publicEventBackgroundUrl
    })

    const publicDetailResponse = await harness.request('/api/public/events/banner-only-event')
    const callerDetailResponse = await harness.request('/api/events/event_banner_only')
    const ownBackgroundDetailResponse = await harness.request('/api/public/events/own-background-event')

    expect(publicDetailResponse.status).toBe(200)
    expect(await publicDetailResponse.json()).toMatchObject({
      data: {
        slug: 'banner-only-event',
        backgroundImageUrl: null,
        bannerImageUrl: publicBannerImageUrl,
        displayBackgroundImageUrl: publicDefaultBackgroundUrl
      }
    })
    expect(callerDetailResponse.status).toBe(200)
    expect(await callerDetailResponse.json()).toMatchObject({
      data: {
        id: 'event_banner_only',
        backgroundImageUrl: null,
        bannerImageUrl: publicBannerImageUrl,
        displayBackgroundImageUrl: publicDefaultBackgroundUrl
      }
    })
    expect(ownBackgroundDetailResponse.status).toBe(200)
    expect(await ownBackgroundDetailResponse.json()).toMatchObject({
      data: {
        slug: 'own-background-event',
        backgroundImageUrl: publicEventBackgroundUrl,
        displayBackgroundImageUrl: publicEventBackgroundUrl
      }
    })

    const backgroundImageResponse = await harness.request('/api/public/events/banner-only-event/images/background')

    expect(backgroundImageResponse.status).toBe(404)
    expect(await backgroundImageResponse.json()).toMatchObject({
      error: {
        code: 'event_background_image_not_found'
      }
    })
  })

  test('POST /api/public/events/:slug/feedback stores anonymous completed-event feedback', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/public/events/:slug/feedback', handler: publicEventFeedbackPostHandler }
      ],
      cloudflareEnv: {
        [publicEventFeedbackRateLimitBindingName]: createRateLimiter()
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'creator_1',
      auth0Subject: 'auth0|creator_1',
      email: 'creator@example.com',
      displayName: 'Creator'
    })
    await harness.database.insert(events).values({
      id: 'event_feedback_public',
      eventType: 'hackathon',
      name: 'Feedback Event',
      slug: 'feedback-event',
      description: 'Public feedback collection',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'completed',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })

    const response = await harness.request('/api/public/events/feedback-event/feedback', {
      method: 'POST',
      headers: {
        'cf-connecting-ip': '203.0.113.10'
      },
      body: JSON.stringify({
        foodRating: 5,
        staffRating: 4,
        organizationRating: 4,
        platformRating: null,
        judgesRating: 4,
        venueRating: 5,
        participantsCommunityRating: 5,
        communicationBeforeRating: 4,
        communicationDuringRating: 4,
        rulesFairnessRating: 5,
        overallExperienceRating: 5,
        schedulePacingRating: 4,
        technicalSetupRating: 3,
        safetyAccessibilityInclusionRating: 5,
        outcomesRating: 4,
        comment: '  Great event overall.  '
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        status: 'submitted'
      }
    })

    const savedFeedback = await harness.database.query.eventFeedback.findMany({
      where: eq(eventFeedback.eventId, 'event_feedback_public')
    })

    expect(savedFeedback).toHaveLength(1)
    expect(savedFeedback[0]).toMatchObject({
      eventId: 'event_feedback_public',
      platformRating: null,
      overallExperienceRating: 5,
      comment: 'Great event overall.'
    })
  })

  test('POST /api/public/events/:slug/feedback rejects submissions before the event is completed', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/public/events/:slug/feedback', handler: publicEventFeedbackPostHandler }
      ]
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'creator_1',
      auth0Subject: 'auth0|creator_1',
      email: 'creator@example.com',
      displayName: 'Creator'
    })
    await harness.database.insert(events).values({
      id: 'event_feedback_unavailable',
      eventType: 'hackathon',
      name: 'Unavailable Feedback Event',
      slug: 'unavailable-feedback-event',
      description: 'Feedback unavailable',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'winners_announced',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })

    const response = await harness.request('/api/public/events/unavailable-feedback-event/feedback', {
      method: 'POST',
      body: JSON.stringify({
        foodRating: 5,
        staffRating: 4,
        organizationRating: 4,
        platformRating: 3,
        judgesRating: 4,
        venueRating: 5,
        participantsCommunityRating: 5,
        communicationBeforeRating: 4,
        communicationDuringRating: 4,
        rulesFairnessRating: 5,
        overallExperienceRating: 5,
        schedulePacingRating: 4,
        technicalSetupRating: 3,
        safetyAccessibilityInclusionRating: 5,
        outcomesRating: 4
      })
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: {
        code: 'event_feedback_unavailable',
        message: 'Event feedback is only available after the event is completed.',
        details: {
          currentState: 'winners_announced',
          allowedStates: ['completed'],
          eventId: 'event_feedback_unavailable'
        }
      }
    })
  })

  test('POST /api/public/events/:slug/feedback returns 429 when the public feedback rate limit is exceeded', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/public/events/:slug/feedback', handler: publicEventFeedbackPostHandler }
      ],
      cloudflareEnv: {
        [publicEventFeedbackRateLimitBindingName]: createRateLimiter(false)
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'creator_1',
      auth0Subject: 'auth0|creator_1',
      email: 'creator@example.com',
      displayName: 'Creator'
    })
    await harness.database.insert(events).values({
      id: 'event_feedback_limited',
      eventType: 'hackathon',
      name: 'Limited Feedback Event',
      slug: 'limited-feedback-event',
      description: 'Feedback rate limited',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'completed',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })

    const response = await harness.request('/api/public/events/limited-feedback-event/feedback', {
      method: 'POST',
      headers: {
        'cf-connecting-ip': '203.0.113.10'
      },
      body: JSON.stringify({
        foodRating: 5,
        staffRating: 4,
        organizationRating: 4,
        platformRating: 3,
        judgesRating: 4,
        venueRating: 5,
        participantsCommunityRating: 5,
        communicationBeforeRating: 4,
        communicationDuringRating: 4,
        rulesFairnessRating: 5,
        overallExperienceRating: 5,
        schedulePacingRating: 4,
        technicalSetupRating: 3,
        safetyAccessibilityInclusionRating: 5,
        outcomesRating: 4
      })
    })

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({
      error: {
        code: 'event_feedback_rate_limited',
        message: 'Too many feedback submissions were sent. Please wait before trying again.'
      }
    })

    const savedFeedback = await harness.database.query.eventFeedback.findMany({
      where: eq(eventFeedback.eventId, 'event_feedback_limited')
    })

    expect(savedFeedback).toHaveLength(0)
  })

  test('GET /api/events/:eventId/feedback returns aggregate results to judges, staff, and admins', async () => {
    const scenarios = [
      {
        userId: 'judge_user',
        email: 'judge@example.com',
        roleAssignment: {
          role: 'judge' as const,
          isInJudgePool: true,
          isStaff: false
        }
      },
      {
        userId: 'staff_user',
        email: 'staff@example.com',
        roleAssignment: {
          role: 'staff' as const,
          isInJudgePool: false,
          isStaff: true
        }
      },
      {
        userId: 'admin_user',
        email: 'admin@example.com',
        roleAssignment: {
          role: 'event_admin' as const,
          isInJudgePool: false,
          isStaff: false
        }
      }
    ] as const

    for (const scenario of scenarios) {
      const harness = createApiRouteTestHarness({
        routes: [
          { method: 'get', path: '/api/events/:eventId/feedback', handler: eventFeedbackGetHandler }
        ],
        sessionUser: {
          sub: `auth0|${scenario.userId}`,
          email: scenario.email
        }
      })
      harnesses.push(harness)

      await harness.database.insert(users).values([
        {
          id: 'creator_1',
          auth0Subject: 'auth0|creator_1',
          email: 'creator@example.com',
          displayName: 'Creator'
        },
        {
          id: scenario.userId,
          auth0Subject: `auth0|${scenario.userId}`,
          email: scenario.email,
          displayName: scenario.userId
        }
      ])
      await harness.database.insert(events).values({
        id: 'event_feedback_results',
        eventType: 'hackathon',
        name: 'Feedback Results Event',
        slug: 'feedback-results-event',
        description: 'Internal feedback reporting',
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z',
        state: 'completed',
        maxTeamMembers: 5,
        createdByUserId: 'creator_1'
      })
      await harness.database.insert(eventRoleAssignments).values({
        id: `assignment_${scenario.userId}`,
        eventId: 'event_feedback_results',
        userId: scenario.userId,
        createdAt: '2026-03-10T09:10:00.000Z',
        ...scenario.roleAssignment
      })
      await harness.database.insert(eventFeedback).values([
        {
          id: 'feedback_1',
          eventId: 'event_feedback_results',
          foodRating: 5,
          staffRating: 4,
          organizationRating: 5,
          platformRating: null,
          judgesRating: 4,
          venueRating: 5,
          participantsCommunityRating: 5,
          communicationBeforeRating: 4,
          communicationDuringRating: 5,
          rulesFairnessRating: 4,
          overallExperienceRating: 5,
          schedulePacingRating: 4,
          technicalSetupRating: 4,
          safetyAccessibilityInclusionRating: 5,
          outcomesRating: 5,
          comment: 'Loved the energy.',
          createdAt: '2026-03-25T10:00:00.000Z'
        },
        {
          id: 'feedback_2',
          eventId: 'event_feedback_results',
          foodRating: 5,
          staffRating: 3,
          organizationRating: 4,
          platformRating: 1,
          judgesRating: 5,
          venueRating: 4,
          participantsCommunityRating: 4,
          communicationBeforeRating: 3,
          communicationDuringRating: 4,
          rulesFairnessRating: 5,
          overallExperienceRating: 4,
          schedulePacingRating: 3,
          technicalSetupRating: 2,
          safetyAccessibilityInclusionRating: 4,
          outcomesRating: 4,
          comment: 'Could use more outlets.',
          createdAt: '2026-03-25T11:00:00.000Z'
        }
      ])

      const response = await harness.request('/api/events/event_feedback_results/feedback')

      expect(response.status).toBe(200)
      const payload = await response.json()

      expect(payload).toMatchObject({
        data: {
          responseCount: 2,
          questionSummaries: expect.arrayContaining([
            expect.objectContaining({
              id: 'foodRating',
              averageRating: 5,
              responseCount: 2,
              ratedResponseCount: 2,
              notApplicableCount: 0,
              ratingCounts: {
                1: 0,
                2: 0,
                3: 0,
                4: 0,
                5: 2
              }
            }),
            expect.objectContaining({
              id: 'platformRating',
              averageRating: 1,
              responseCount: 2,
              ratedResponseCount: 1,
              notApplicableCount: 1,
              ratingCounts: {
                1: 1,
                2: 0,
                3: 0,
                4: 0,
                5: 0
              }
            })
          ])
        }
      })
      expect(payload.data.comments.map((entry: { comment: string }) => entry.comment)).toEqual([
        'Could use more outlets.',
        'Loved the energy.'
      ])
    }
  })

  test('GET /api/events/:eventId/feedback uses build-event question wording in summaries', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/feedback', handler: eventFeedbackGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|staff_user',
        email: 'staff@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'staff_user',
        auth0Subject: 'auth0|staff_user',
        email: 'staff@example.com',
        displayName: 'Staff User'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_feedback_build_results',
      eventType: 'build',
      name: 'Build Feedback Results Event',
      slug: 'build-feedback-results-event',
      description: 'Build feedback reporting',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      state: 'completed',
      maxTeamMembers: 1,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'assignment_build_staff',
      eventId: 'event_feedback_build_results',
      userId: 'staff_user',
      role: 'staff',
      isInJudgePool: false,
      isStaff: true,
      createdAt: '2026-03-10T09:10:00.000Z'
    })
    await harness.database.insert(eventFeedback).values({
      id: 'feedback_build_1',
      eventId: 'event_feedback_build_results',
      foodRating: 5,
      staffRating: 4,
      organizationRating: 4,
      platformRating: 3,
      judgesRating: 5,
      venueRating: 5,
      participantsCommunityRating: 5,
      communicationBeforeRating: 4,
      communicationDuringRating: 4,
      rulesFairnessRating: 5,
      overallExperienceRating: 5,
      schedulePacingRating: 4,
      technicalSetupRating: 3,
      safetyAccessibilityInclusionRating: 5,
      outcomesRating: 4,
      createdAt: '2026-03-25T10:00:00.000Z'
    })

    const response = await harness.request('/api/events/event_feedback_build_results/feedback')

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload.data.questionSummaries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'judgesRating',
        label: 'Mentor And Expert Support',
        prompt: 'How useful was any mentor, expert, or review support you received?',
        averageRating: 5
      })
    ]))
  })

  test('GET /api/events/:eventId/feedback rejects platform users without judge, staff, or admin access', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/feedback', handler: eventFeedbackGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|participant_user',
        email: 'participant@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'participant_user',
        auth0Subject: 'auth0|participant_user',
        email: 'participant@example.com',
        displayName: 'Participant User'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_feedback_results',
      eventType: 'hackathon',
      name: 'Feedback Results Event',
      slug: 'feedback-results-event',
      description: 'Internal feedback reporting',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'completed',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })

    const response = await harness.request('/api/events/event_feedback_results/feedback')

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: {
        code: 'event_feedback_results_access_denied',
        message: 'This operation requires judge, staff, or event admin access.',
        details: {
          eventId: 'event_feedback_results'
        }
      }
    })
  })

  test('GET /api/public/events/:slug/criteria and prizes omit internal identifiers and timestamps', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/public/events/:slug/evaluation-criteria', handler: publicEventCriteriaGetHandler },
        { method: 'get', path: '/api/public/events/:slug/prizes', handler: publicEventPrizesGetHandler }
      ]
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'creator_1',
      auth0Subject: 'auth0|creator_1',
      email: 'creator@example.com',
      displayName: 'Creator'
    })
    await harness.database.insert(events).values({
      id: 'event_public',
      eventType: 'hackathon',
      name: 'Public Event',
      slug: 'public-event',
      description: 'Public',
      discordServerUrl: 'https://discord.gg/private-codex',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(evaluationCriteria).values({
      id: 'criterion_public',
      eventId: 'event_public',
      name: 'Community Impact',
      description: 'Measures external value.',
      weight: 40,
      displayOrder: 1
    })
    await harness.database.insert(prizes).values([
      {
        id: 'prize_public_1',
        eventId: 'event_public',
        name: 'Launch Award',
        description: 'Launch support.',
        rewardType: 'api_credits',
        rewardValue: '5000',
        rewardCurrency: null,
        awardScope: 'team',
        rankStart: 1,
        rankEnd: 1
      },
      {
        id: 'prize_public_2',
        eventId: 'event_public',
        name: 'Top 3 Teams Benefit',
        description: 'Shared finalist benefit.',
        rewardType: 'other',
        rewardValue: 'Mentorship',
        rewardCurrency: null,
        awardScope: 'team',
        rankStart: 1,
        rankEnd: 3
      },
      {
        id: 'prize_public_3',
        eventId: 'event_public',
        name: 'Second Place Award',
        description: 'Runner-up support.',
        rewardType: 'api_credits',
        rewardValue: '3000',
        rewardCurrency: null,
        awardScope: 'team',
        rankStart: 2,
        rankEnd: 2
      },
      {
        id: 'prize_public_4',
        eventId: 'event_public',
        name: 'Third Place Award',
        description: 'Third-place support.',
        rewardType: 'api_credits',
        rewardValue: '1500',
        rewardCurrency: null,
        awardScope: 'team',
        rankStart: 3,
        rankEnd: 3
      }
    ])

    const criteriaResponse = await harness.request('/api/public/events/public-event/evaluation-criteria')
    const prizeResponse = await harness.request('/api/public/events/public-event/prizes')

    expect(criteriaResponse.status).toBe(200)
    expect(prizeResponse.status).toBe(200)

    const criteriaPayload = await criteriaResponse.json()
    const prizePayload = await prizeResponse.json()

    expect(criteriaPayload).toMatchObject({
      data: [
        {
          name: 'Community Impact',
          description: 'Measures external value.',
          weight: 40,
          displayOrder: 1
        }
      ]
    })
    expect(criteriaPayload.data[0]).not.toHaveProperty('id')
    expect(criteriaPayload.data[0]).not.toHaveProperty('eventId')
    expect(criteriaPayload.data[0]).not.toHaveProperty('createdAt')

    expect(prizePayload).toMatchObject({
      data: [
        {
          name: 'Launch Award',
          description: 'Launch support.',
          rewardType: 'api_credits',
          rewardValue: '5000',
          rewardCurrency: null,
          awardScope: 'team',
          rankStart: 1,
          rankEnd: 1
        },
        {
          name: 'Second Place Award',
          description: 'Runner-up support.',
          rewardType: 'api_credits',
          rewardValue: '3000',
          rewardCurrency: null,
          awardScope: 'team',
          rankStart: 2,
          rankEnd: 2
        },
        {
          name: 'Third Place Award',
          description: 'Third-place support.',
          rewardType: 'api_credits',
          rewardValue: '1500',
          rewardCurrency: null,
          awardScope: 'team',
          rankStart: 3,
          rankEnd: 3
        },
        {
          name: 'Top 3 Teams Benefit',
          description: 'Shared finalist benefit.',
          rewardType: 'other',
          rewardValue: 'Mentorship',
          rewardCurrency: null,
          awardScope: 'team',
          rankStart: 1,
          rankEnd: 3
        }
      ]
    })
    expect(prizePayload.data[0]).not.toHaveProperty('id')
    expect(prizePayload.data[0]).not.toHaveProperty('eventId')
    expect(prizePayload.data[0]).not.toHaveProperty('createdAt')
    expect(prizePayload.data.map((prize: { name: string }) => prize.name)).toEqual([
      'Launch Award',
      'Second Place Award',
      'Third Place Award',
      'Top 3 Teams Benefit'
    ])
  })

  test('GET /api/public/events/:slug/winners and winner profile icons stay hidden until completion', async () => {
    const profileIconsBucket = new InMemoryR2Bucket()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/public/events/:slug/winners', handler: publicEventWinnersGetHandler },
        { method: 'get', path: '/api/public/events/:slug/winners/:userId/profile-icon', handler: publicEventWinnerProfileIconGetHandler },
        { method: 'get', path: '/api/public/events/:slug/published-projects', handler: publicEventPublishedProjectsGetHandler },
        { method: 'get', path: '/api/public/events/:slug/published-projects/:userId/profile-icon', handler: publicEventPublishedProjectProfileIconGetHandler }
      ],
      cloudflareEnv: {
        PROFILE_ICONS: profileIconsBucket
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'judge_1',
        auth0Subject: 'auth0|judge_1',
        email: 'judge@example.com',
        displayName: 'Judge One'
      },
      {
        id: 'winner_user',
        auth0Subject: 'auth0|winner_user',
        email: 'winner@example.com',
        displayName: 'Winner User',
        firstName: 'Winner',
        familyName: 'User',
        bio: 'Builds thoughtful AI prototypes.',
        xProfileUrl: 'https://x.com/winner-user',
        linkedinProfileUrl: 'https://linkedin.com/in/winner-user',
        githubProfileUrl: 'https://github.com/winner-user',
        profileIconUpdatedAt: '2026-03-18T15:00:00.000Z',
        profileIconObjectKey: 'users/winner_user/profile-icon/fixture-1',
        profileIconRevision: 1
      },
      {
        id: 'published_user',
        auth0Subject: 'auth0|published_user',
        email: 'published@example.com',
        displayName: 'Published User',
        firstName: 'Published',
        familyName: 'User',
        bio: 'Shares finished event projects.',
        xProfileUrl: 'https://x.com/published-user',
        linkedinProfileUrl: 'https://linkedin.com/in/published-user',
        githubProfileUrl: 'https://github.com/published-user',
        profileIconUpdatedAt: '2026-03-18T16:00:00.000Z',
        profileIconObjectKey: 'users/published_user/profile-icon/fixture-1',
        profileIconRevision: 1
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_completed_public',
      eventType: 'hackathon',
      name: 'Public Winners Event',
      slug: 'public-winners-event',
      description: 'Public winners showcase',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'winners_announced',
      blindReviewCount: 0,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 0,
      pitchScoreWeightPercent: 100,
      finalRankingSubmissionIdsJson: JSON.stringify(['submission_public_winner']),
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(teams).values([{
      id: 'team_public_winner',
      eventId: 'event_completed_public',
      name: 'Public Winners',
      slug: 'public-winners',
      isOpenToJoinRequests: false,
      createdByUserId: 'winner_user',
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T10:00:00.000Z'
    }, {
      id: 'team_public_showcase',
      eventId: 'event_completed_public',
      name: 'Published Builders',
      slug: 'published-builders',
      isOpenToJoinRequests: false,
      createdByUserId: 'published_user',
      createdAt: '2026-03-24T10:30:00.000Z',
      updatedAt: '2026-03-24T10:30:00.000Z'
    }])
    await harness.database.insert(teamMembers).values([{
      id: 'membership_public_winner',
      teamId: 'team_public_winner',
      userId: 'winner_user',
      role: 'admin',
      joinedAt: '2026-03-24T10:00:00.000Z',
      createdAt: '2026-03-24T10:00:00.000Z'
    }, {
      id: 'membership_public_showcase',
      teamId: 'team_public_showcase',
      userId: 'published_user',
      role: 'admin',
      joinedAt: '2026-03-24T10:30:00.000Z',
      createdAt: '2026-03-24T10:30:00.000Z'
    }])
    await harness.database.insert(submissions).values([{
      id: 'submission_public_winner',
      teamId: 'team_public_winner',
      status: 'locked',
      projectName: 'Public Winner Project',
      summary: 'Public winner summary',
      repositoryUrl: 'https://example.com/public-winner-repo',
      demoUrl: 'https://example.com/public-winner-demo',
      isPubliclyVisible: false,
      submittedAt: '2026-03-24T12:00:00.000Z',
      lockedAt: '2026-03-25T12:00:00.000Z',
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-25T12:00:00.000Z'
    }, {
      id: 'submission_public_showcase',
      teamId: 'team_public_showcase',
      status: 'locked',
      projectName: 'Published Showcase Project',
      summary: 'Published showcase summary',
      repositoryUrl: 'https://example.com/published-showcase-repo',
      demoUrl: 'https://example.com/published-showcase-demo',
      isPubliclyVisible: true,
      submittedAt: '2026-03-24T12:10:00.000Z',
      lockedAt: '2026-03-25T12:10:00.000Z',
      createdAt: '2026-03-24T12:10:00.000Z',
      updatedAt: '2026-03-25T12:10:00.000Z'
    }])
    await harness.database.insert(judgeAssignments).values({
      id: 'pitch_public_winner_assignment',
      eventId: 'event_completed_public',
      submissionId: 'submission_public_winner',
      judgeUserId: 'judge_1',
      reviewStage: 'pitch_review',
      blindReviewSlot: null,
      status: 'judge_completed',
      pitchScore: 5,
      assignedAt: '2026-03-25T13:00:00.000Z',
      startedAt: '2026-03-25T13:01:00.000Z',
      completedAt: '2026-03-25T13:02:00.000Z',
      ineligibilityStatus: 'eligible',
      createdAt: '2026-03-25T13:00:00.000Z'
    })
    await harness.database.insert(prizes).values({
      id: 'prize_public_winner',
      eventId: 'event_completed_public',
      name: 'Public Grand Prize',
      description: 'Public prize description',
      rewardType: 'api_credits',
      rewardValue: '5000',
      rewardCurrency: 'USD',
      awardScope: 'team',
      rankStart: 1,
      rankEnd: 1
    })
    await harness.database.insert(prizeEligibilitySnapshots).values([{
      id: 'snapshot_public_winner',
      eventId: 'event_completed_public',
      teamId: 'team_public_winner',
      userId: 'winner_user',
      snapshotAt: '2026-03-25T13:05:00.000Z',
      createdAt: '2026-03-25T13:05:00.000Z'
    }, {
      id: 'snapshot_public_showcase',
      eventId: 'event_completed_public',
      teamId: 'team_public_showcase',
      userId: 'published_user',
      snapshotAt: '2026-03-25T13:06:00.000Z',
      createdAt: '2026-03-25T13:06:00.000Z'
    }])
    await harness.database.insert(prizeRedemptions).values({
      id: 'redemption_public_winner',
      prizeId: 'prize_public_winner',
      userId: null,
      teamId: 'team_public_winner',
      status: 'pending',
      createdAt: '2026-03-25T13:10:00.000Z',
      updatedAt: '2026-03-25T13:10:00.000Z'
    })
    await profileIconsBucket.put(
      'users/winner_user/profile-icon/fixture-1',
      pngSignatureBytes,
      {
        httpMetadata: {
          contentType: 'image/png'
        }
      }
    )
    await profileIconsBucket.put(
      'users/published_user/profile-icon/fixture-1',
      pngSignatureBytes,
      {
        httpMetadata: {
          contentType: 'image/png'
        }
      }
    )

    const preCompletionResponse = await harness.request('/api/public/events/public-winners-event/winners')
    const preCompletionPublishedProjectsResponse = await harness.request('/api/public/events/public-winners-event/published-projects')

    expect(preCompletionResponse.status).toBe(409)
    expect(preCompletionPublishedProjectsResponse.status).toBe(409)

    await harness.database
      .update(events)
      .set({
        state: 'completed'
      })
      .where(eq(events.id, 'event_completed_public'))

    const winnersResponse = await harness.request('/api/public/events/public-winners-event/winners')

    expect(winnersResponse.status).toBe(200)
    expect(await winnersResponse.json()).toMatchObject({
      data: [
        {
          teamId: 'team_public_winner',
          teamName: 'Public Winners',
          submissionId: 'submission_public_winner',
          projectName: 'Public Winner Project',
          summary: 'Public winner summary',
          repositoryUrl: 'https://example.com/public-winner-repo',
          demoUrl: 'https://example.com/public-winner-demo',
          finalRank: 1,
          prizes: [
            expect.objectContaining({
              id: 'prize_public_winner',
              name: 'Public Grand Prize'
            })
          ],
          teamMembers: [
            expect.objectContaining({
              id: 'winner_user',
              fullName: 'Winner User',
              bio: 'Builds thoughtful AI prototypes.',
              xProfileUrl: 'https://x.com/winner-user',
              linkedinProfileUrl: 'https://linkedin.com/in/winner-user',
              githubProfileUrl: 'https://github.com/winner-user',
              profileIconUrl: '/api/public/events/public-winners-event/winners/winner_user/profile-icon?v=1'
            })
          ]
        }
      ]
    })

    const publishedProjectsResponse = await harness.request('/api/public/events/public-winners-event/published-projects')

    expect(publishedProjectsResponse.status).toBe(200)
    expect(await publishedProjectsResponse.json()).toMatchObject({
      data: [
        {
          teamId: 'team_public_showcase',
          teamName: 'Published Builders',
          submissionId: 'submission_public_showcase',
          projectName: 'Published Showcase Project',
          summary: 'Published showcase summary',
          repositoryUrl: 'https://example.com/published-showcase-repo',
          demoUrl: 'https://example.com/published-showcase-demo',
          teamMembers: [
            expect.objectContaining({
              id: 'published_user',
              fullName: 'Published User',
              bio: 'Shares finished event projects.',
              xProfileUrl: 'https://x.com/published-user',
              linkedinProfileUrl: 'https://linkedin.com/in/published-user',
              githubProfileUrl: 'https://github.com/published-user',
              profileIconUrl: '/api/public/events/public-winners-event/published-projects/published_user/profile-icon?v=1'
            })
          ]
        }
      ]
    })

    const iconResponse = await harness.request(
      '/api/public/events/public-winners-event/winners/winner_user/profile-icon?v=1'
    )

    expect(iconResponse.status).toBe(200)
    expect(iconResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(iconResponse.headers.get('cloudflare-cdn-cache-control')).toBeNull()
    expect(iconResponse.headers.get('content-type')).toBe('image/png')

    const missingIconResponse = await harness.request(
      '/api/public/events/public-winners-event/winners/unknown_user/profile-icon?v=1'
    )

    expect(missingIconResponse.status).toBe(404)

    const publishedIconResponse = await harness.request(
      '/api/public/events/public-winners-event/published-projects/published_user/profile-icon?v=1'
    )

    expect(publishedIconResponse.status).toBe(200)
    expect(publishedIconResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(publishedIconResponse.headers.get('cloudflare-cdn-cache-control')).toBeNull()
    expect(publishedIconResponse.headers.get('content-type')).toBe('image/png')
  })

  test('GET /api/events/:eventId returns current term references for visible events', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId', handler: eventDetailGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|viewer',
        email: 'viewer@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'creator_1',
      auth0Subject: 'auth0|creator_1',
      email: 'creator@example.com',
      displayName: 'Creator'
    })
    await harness.database.insert(events).values({
      id: 'event_public',
      eventType: 'hackathon',
      name: 'Public Event',
      slug: 'public-event',
      description: 'Public',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      blindReviewCount: 2,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 60,
      pitchScoreWeightPercent: 40,
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventTermsDocuments).values([
      {
        id: 'terms_app_1',
        eventId: 'event_public',
        documentType: 'application_terms',
        version: 2,
        title: 'Application Terms',
        content: 'Application content',
        publishedAt: '2026-03-01T00:00:00.000Z'
      },
      {
        id: 'terms_win_1',
        eventId: 'event_public',
        documentType: 'winner_terms',
        version: 3,
        title: 'Winner Terms',
        content: 'Winner content',
        publishedAt: '2026-03-02T00:00:00.000Z'
      }
    ])

    await harness.database
      .update(events)
      .set({
        currentApplicationTermsDocumentId: 'terms_app_1',
        currentWinnerTermsDocumentId: 'terms_win_1'
      })
      .where(eq(events.id, 'event_public'))

    const response = await harness.request('/api/events/event_public')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'event_public',
        slug: 'public-event',
        address: '',
        state: 'registration_open',
        discordServerUrl: null,
        slidesUrl: null,
        blindReviewCount: 2,
        pitchReviewEnabled: true,
        blindScoreWeightPercent: 60,
        pitchScoreWeightPercent: 40,
        currentTerms: {
          applicationTerms: {
            id: 'terms_app_1',
            version: 2
          },
          winnerTerms: {
            id: 'terms_win_1',
            version: 3
          }
        }
      }
    })
  })

  test('GET /api/events/slug/:slug exposes discordServerUrl to approved participants only', async () => {
    const approvedHarness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/slug/:slug', handler: eventBySlugGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|approved_participant',
        email: 'approved@example.com'
      }
    })
    harnesses.push(approvedHarness)

    await approvedHarness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'approved_participant',
        auth0Subject: 'auth0|approved_participant',
        email: 'approved@example.com',
        displayName: 'Approved Participant'
      }
    ])
    await seedCurrentPlatformConsent(approvedHarness, 'approved_participant')
    await approvedHarness.database.insert(events).values({
      id: 'event_private_discord',
      eventType: 'hackathon',
      name: 'Private Discord Event',
      slug: 'private-discord-event',
      description: 'Private Discord Event',
      discordServerUrl: 'https://discord.gg/private-codex',
      slidesUrl: 'https://example.com/participant-slides',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await approvedHarness.database.insert(eventTermsDocuments).values({
      id: 'terms_1',
      eventId: 'event_private_discord',
      documentType: 'application_terms',
      version: 1,
      title: 'Application Terms',
      content: 'Application terms',
      publishedAt: '2026-03-20T00:00:00.000Z'
    })
    await approvedHarness.database.insert(userApplications).values({
      id: 'application_approved',
      eventId: 'event_private_discord',
      userId: 'approved_participant',
      status: 'approved',
      submittedAt: '2026-03-21T12:00:00.000Z',
      withdrawnAt: null,
      reviewedAt: '2026-03-22T12:00:00.000Z',
      reviewedByUserId: 'creator_1',
      applicationTermsDocumentId: 'terms_1',
      applicationTermsAcceptedAt: '2026-03-21T12:00:00.000Z',
      registrationDetailsJson: '{}',
      createdAt: '2026-03-21T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z'
    })

    const approvedResponse = await approvedHarness.request('/api/events/slug/private-discord-event')
    expect(approvedResponse.status).toBe(200)
    expect(await approvedResponse.json()).toMatchObject({
      data: {
        address: 'Address',
        discordServerUrl: 'https://discord.gg/private-codex',
        slidesUrl: 'https://example.com/participant-slides',
        hasGallery: false
      }
    })

    const submittedHarness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/slug/:slug', handler: eventBySlugGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|submitted_participant',
        email: 'submitted@example.com'
      }
    })
    harnesses.push(submittedHarness)

    await submittedHarness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'submitted_participant',
        auth0Subject: 'auth0|submitted_participant',
        email: 'submitted@example.com',
        displayName: 'Submitted Participant'
      }
    ])
    await seedCurrentPlatformConsent(submittedHarness, 'submitted_participant')
    await submittedHarness.database.insert(events).values({
      id: 'event_private_discord',
      eventType: 'hackathon',
      name: 'Private Discord Event',
      slug: 'private-discord-event',
      description: 'Private Discord Event',
      discordServerUrl: 'https://discord.gg/private-codex',
      slidesUrl: 'https://example.com/participant-slides',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await submittedHarness.database.insert(eventTermsDocuments).values({
      id: 'terms_1',
      eventId: 'event_private_discord',
      documentType: 'application_terms',
      version: 1,
      title: 'Application Terms',
      content: 'Application terms',
      publishedAt: '2026-03-20T00:00:00.000Z'
    })
    await submittedHarness.database.insert(userApplications).values({
      id: 'application_submitted',
      eventId: 'event_private_discord',
      userId: 'submitted_participant',
      status: 'submitted',
      submittedAt: '2026-03-21T12:00:00.000Z',
      withdrawnAt: null,
      reviewedAt: null,
      reviewedByUserId: null,
      applicationTermsDocumentId: 'terms_1',
      applicationTermsAcceptedAt: '2026-03-21T12:00:00.000Z',
      registrationDetailsJson: '{}',
      createdAt: '2026-03-21T12:00:00.000Z',
      updatedAt: '2026-03-21T12:00:00.000Z'
    })

    const submittedResponse = await submittedHarness.request('/api/events/slug/private-discord-event')
    expect(submittedResponse.status).toBe(200)
    const submittedPayload = await submittedResponse.json()
    expect(submittedPayload).toMatchObject({
      data: {
        address: '',
        discordServerUrl: null,
        slidesUrl: null
      }
    })
    expect(submittedPayload.data).not.toHaveProperty('hasGallery')
  })

  test('GET /api/events/slug/:slug exposes discordServerUrl to judges', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/slug/:slug', handler: eventBySlugGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|judge_user',
        email: 'judge@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'judge_user',
        auth0Subject: 'auth0|judge_user',
        email: 'judge@example.com',
        displayName: 'Judge User'
      }
    ])
    await seedCurrentPlatformConsent(harness, 'judge_user')
    await harness.database.insert(events).values({
      id: 'event_private_discord',
      eventType: 'hackathon',
      name: 'Private Discord Event',
      slug: 'private-discord-event',
      description: 'Private Discord Event',
      discordServerUrl: 'https://discord.gg/private-codex',
      slidesUrl: 'https://example.com/judge-slides',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_judge',
      eventId: 'event_private_discord',
      userId: 'judge_user',
      role: 'judge',
      isInJudgePool: true,
      isStaff: false,
      createdAt: '2026-03-21T12:00:00.000Z'
    })

    const response = await harness.request('/api/events/slug/private-discord-event')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        address: 'Address',
        discordServerUrl: 'https://discord.gg/private-codex',
        slidesUrl: 'https://example.com/judge-slides',
        hasGallery: false
      }
    })
  })

  test('GET /api/events/slug/:slug exposes hasGallery to approved participants when gallery images exist', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/slug/:slug', handler: eventBySlugGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|approved_participant',
        email: 'approved@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'approved_participant',
        auth0Subject: 'auth0|approved_participant',
        email: 'approved@example.com',
        displayName: 'Approved Participant'
      }
    ])
    await seedCurrentPlatformConsent(harness, 'approved_participant')
    await harness.database.insert(events).values({
      id: 'event_private_photos',
      eventType: 'hackathon',
      name: 'Private Photos Event',
      slug: 'private-photos-event',
      description: 'Private Photos Event',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventTermsDocuments).values({
      id: 'terms_photos',
      eventId: 'event_private_photos',
      documentType: 'application_terms',
      version: 1,
      title: 'Application Terms',
      content: 'Application terms',
      publishedAt: '2026-03-20T00:00:00.000Z'
    })
    await harness.database.insert(userApplications).values({
      id: 'application_approved_photos',
      eventId: 'event_private_photos',
      userId: 'approved_participant',
      status: 'approved',
      submittedAt: '2026-03-21T12:00:00.000Z',
      reviewedAt: '2026-03-22T12:00:00.000Z',
      reviewedByUserId: 'creator_1',
      applicationTermsDocumentId: 'terms_photos',
      applicationTermsAcceptedAt: '2026-03-21T12:00:00.000Z',
      registrationDetailsJson: '{}',
      createdAt: '2026-03-21T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z'
    })
    await harness.database.insert(eventPhotos).values({
      id: 'photo_approved_visibility',
      eventId: 'event_private_photos',
      uploadedByUserId: 'creator_1',
      fileName: 'gallery-photo.png',
      contentType: 'image/png',
      width: 1600,
      height: 900,
      createdAt: '2026-04-01T12:00:00.000Z'
    })

    const response = await harness.request('/api/events/slug/private-photos-event')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        hasGallery: true
      }
    })
  })

  test('POST /api/events creates draft events for platform admins and writes audit', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events', handler: eventsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'platform_admin',
      auth0Subject: 'auth0|platform_admin',
      email: 'platform-admin@example.com',
      displayName: 'Platform Admin',
      isPlatformAdmin: true
    })

    const response = await harness.request('/api/events', {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'hackathon',
        name: 'New Event',
        slug: 'new-event',
        discordServerUrl: 'https://discord.gg/new-event',
        lumaEventUrl: 'https://lu.ma/new-event',
        slidesUrl: 'https://example.com/new-event-slides',
        lumaEventApiId: 'evt-newevent123',
        description: 'New event',
        agendaItems: [
          {
            id: 'agenda_item_1',
            startsAt: '2026-03-20T12:00:00.000Z',
            endsAt: '2026-03-20T12:30:00.000Z',
            title: 'Opening',
            details: 'Kickoff and orientation.',
            displayOrder: 1
          }
        ],
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z',
        maxTeamMembers: 5,
        autoApproveApplications: true,
        blindReviewCount: 2,
        pitchReviewEnabled: true,
        blindScoreWeightPercent: 60,
        pitchScoreWeightPercent: 40,
        inPersonEvent: true,
        applicationAiKnowledgeVisible: true,
        applicationLumaEmailVisible: true,
        requireXProfile: true,
        requireLinkedinProfile: false,
        requireGithubProfile: true,
        requireChatgptEmail: true,
        requireOpenaiOrgId: true,
        requireLumaEmail: true,
        requireWhyThisEvent: true,
        requireProofOfExecution: true,
        requireAiKnowledge: true,
        requireSubmissionSummary: true,
        requireSubmissionRepositoryUrl: true,
        requireSubmissionDemoUrl: true
      })
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      data: {
        eventType: 'hackathon',
        name: 'New Event',
        slug: 'new-event',
        lumaEventUrl: 'https://lu.ma/new-event',
        slidesUrl: 'https://example.com/new-event-slides',
        lumaEventApiId: 'evt-newevent123',
        state: 'draft',
        autoApproveApplications: true,
        blindReviewCount: 2,
        pitchReviewEnabled: true,
        blindScoreWeightPercent: 60,
        pitchScoreWeightPercent: 40,
        createdByUserId: 'platform_admin',
        agendaItems: [
          expect.objectContaining({
            id: 'agenda_item_1',
            title: 'Opening'
          })
        ],
        inPersonEvent: true,
        applicationAiKnowledgeVisible: true,
        applicationLumaEmailVisible: true,
        requireChatgptEmail: true,
        requireOpenaiOrgId: true,
        requireLumaEmail: true,
        requireWhyThisEvent: true,
        requireProofOfExecution: true,
        requireAiKnowledge: true,
        requireSubmissionSummary: true,
        requireSubmissionRepositoryUrl: true,
        requireSubmissionDemoUrl: true
      }
    })

    const createdEvent = await harness.database.query.events.findFirst({
      where: eq(events.slug, 'new-event')
    })

    expect(createdEvent).toMatchObject({
      eventType: 'hackathon',
      discordServerUrl: 'https://discord.gg/new-event',
      lumaEventUrl: 'https://lu.ma/new-event',
      slidesUrl: 'https://example.com/new-event-slides',
      lumaEventApiId: 'evt-newevent123',
      autoApproveApplications: true,
      blindReviewCount: 2,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 60,
      pitchScoreWeightPercent: 40,
      applicationAiKnowledgeVisible: true,
      requireAiKnowledge: true
    })

    const creatorAssignment = await harness.database.query.eventRoleAssignments.findFirst({
      where: eq(eventRoleAssignments.userId, 'platform_admin')
    })
    expect(creatorAssignment).toMatchObject({
      eventId: createdEvent?.id,
      role: 'event_admin',
      isInJudgePool: false,
      isStaff: false
    })

    const auditEntries = await harness.database.select().from(auditLogs)
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorUserId: 'platform_admin',
        entityType: 'event',
        action: 'event.created'
      })
    ])
  })

  test('POST /api/events lets event organizers create only their own manageable events', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events', handler: eventsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|event_organizer',
        email: 'organizer@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'platform_admin',
        auth0Subject: 'auth0|platform_admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        isPlatformAdmin: true
      },
      {
        id: 'event_organizer',
        auth0Subject: 'auth0|event_organizer',
        email: 'organizer@example.com',
        displayName: 'Event Organizer',
        isEventOrganizer: true
      }
    ])

    const response = await harness.request('/api/events', {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'build',
        name: 'Organizer Event',
        slug: 'organizer-event',
        description: 'Organizer-owned event',
        agendaItems: [],
        tracks: [{
          id: 'track_build_agents',
          name: 'Agents',
          shortDescription: 'Build with agents.',
          fullDescription: 'Use the agent track guidelines.',
          staffInstructions: 'Route agent questions to the mentor desk.',
          resources: [{
            id: 'resource_agent_guide',
            title: 'Starter guide',
            url: 'https://example.com/agents',
            description: 'Read before the event.',
            displayOrder: 1
          }],
          displayOrder: 1
        }],
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        eventType: 'build',
        slug: 'organizer-event',
        tracks: [{
          id: 'track_build_agents',
          name: 'Agents',
          resources: [{
            id: 'resource_agent_guide',
            title: 'Starter guide',
            url: 'https://example.com/agents',
            description: 'Read before the event.'
          }]
        }],
        createdByUserId: 'event_organizer'
      }
    })

    const createdEvent = await harness.database.query.events.findFirst({
      where: eq(events.slug, 'organizer-event')
    })
    expect(createdEvent).toMatchObject({
      eventType: 'build',
      submissionOpensAt: null,
      submissionClosesAt: null,
      createdByUserId: 'event_organizer'
    })
    const createdTrack = await harness.database.query.eventTracks.findFirst({
      where: eq(eventTracks.eventId, createdEvent!.id)
    })
    expect(createdTrack).toMatchObject({
      id: 'track_build_agents',
      resourcesJson: JSON.stringify([{
        id: 'resource_agent_guide',
        title: 'Starter guide',
        url: 'https://example.com/agents',
        description: 'Read before the event.',
        displayOrder: 1
      }])
    })

    const assignments = await harness.database.query.eventRoleAssignments.findMany({
      where: eq(eventRoleAssignments.eventId, createdEvent!.id),
      orderBy: [asc(eventRoleAssignments.userId)]
    })
    expect(assignments).toMatchObject([
      {
        userId: 'event_organizer',
        role: 'event_admin',
        isInJudgePool: false,
        isStaff: false
      },
      {
        userId: 'platform_admin',
        role: 'event_admin',
        isInJudgePool: false,
        isStaff: false
      }
    ])
  })

  test('POST /api/events creates meetup events without competition fields', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events', handler: eventsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'platform_admin',
      auth0Subject: 'auth0|platform_admin',
      email: 'platform-admin@example.com',
      displayName: 'Platform Admin',
      isPlatformAdmin: true
    })

    const response = await harness.request('/api/events', {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'meetup',
        name: 'Community Meetup',
        slug: 'community-meetup',
        description: 'A registration-only meetup.',
        agendaItems: [],
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        participantsLimit: 80,
        autoApproveApplications: true,
        inPersonEvent: true,
        applicationChatgptEmailVisible: true,
        applicationOpenaiOrgIdVisible: true,
        applicationLumaEmailVisible: true,
        applicationWhyThisEventVisible: true,
        applicationProofOfExecutionVisible: true,
        applicationAiKnowledgeVisible: true,
        requireChatgptEmail: true,
        requireOpenaiOrgId: true,
        requireLumaEmail: true,
        requireWhyThisEvent: true,
        requireProofOfExecution: true,
        requireAiKnowledge: true
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        eventType: 'meetup',
        slug: 'community-meetup',
        maxTeamMembers: 1,
        autoApproveApplications: true,
        inPersonEvent: true,
        applicationChatgptEmailVisible: true,
        applicationOpenaiOrgIdVisible: true,
        applicationLumaEmailVisible: true,
        applicationWhyThisEventVisible: true,
        applicationProofOfExecutionVisible: true,
        applicationAiKnowledgeVisible: true,
        requireChatgptEmail: true,
        requireOpenaiOrgId: true,
        requireLumaEmail: true,
        requireWhyThisEvent: true,
        requireProofOfExecution: true,
        requireAiKnowledge: true,
        blindReviewCount: 0,
        pitchReviewEnabled: false,
        requireSubmissionSummary: false,
        requireSubmissionRepositoryUrl: false,
        requireSubmissionDemoUrl: false
      }
    })

    const createdEvent = await harness.database.query.events.findFirst({
      where: eq(events.slug, 'community-meetup')
    })

    expect(createdEvent).toMatchObject({
      eventType: 'meetup',
      submissionOpensAt: null,
      submissionClosesAt: null,
      maxTeamMembers: 1,
      autoApproveApplications: true,
      inPersonEvent: true,
      applicationChatgptEmailVisible: true,
      applicationOpenaiOrgIdVisible: true,
      applicationLumaEmailVisible: true,
      applicationWhyThisEventVisible: true,
      applicationProofOfExecutionVisible: true,
      applicationAiKnowledgeVisible: true,
      requireChatgptEmail: true,
      requireOpenaiOrgId: true,
      requireLumaEmail: true,
      requireWhyThisEvent: true,
      requireProofOfExecution: true,
      requireAiKnowledge: true,
      blindReviewCount: 1,
      pitchReviewEnabled: false
    })
  })

  test('POST /api/events rejects regular platform users', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events', handler: eventsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'regular_user',
      auth0Subject: 'auth0|regular_user',
      email: 'regular@example.com',
      displayName: 'Regular User'
    })

    const response = await harness.request('/api/events', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Blocked Event',
        slug: 'blocked-event',
        description: 'Blocked event',
        city: 'Vienna',
        country: 'Austria',
        address: 'Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z'
      })
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'event_creator_required'
      }
    })
  })

  test('PATCH /api/events/:eventId updates configuration for event admins', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'patch', path: '/api/events/:eventId', handler: eventPatchHandler }
      ],
      sessionUser: {
        sub: 'auth0|admin',
        email: 'admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'event_admin',
        auth0Subject: 'auth0|admin',
        email: 'admin@example.com',
        displayName: 'Event Admin'
      },
      {
        id: 'participant_user',
        auth0Subject: 'auth0|participant',
        email: 'participant@example.com',
        displayName: 'Participant User'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_patch',
      eventType: 'hackathon',
      name: 'Patch Event',
      slug: 'patch-event',
      description: 'Old description',
      city: 'Vienna',
      country: 'Austria',
      address: 'Old Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_admin',
      eventId: 'event_patch',
      userId: 'event_admin',
      role: 'event_admin',
      isInJudgePool: false,
      createdAt: '2026-03-22T12:00:00.000Z'
    })
    await harness.database.insert(eventTermsDocuments).values({
      id: 'terms_patch',
      eventId: 'event_patch',
      documentType: 'application_terms',
      version: 1,
      title: 'Patch Application Terms',
      content: 'Patch terms',
      publishedAt: '2026-03-20T12:00:00.000Z'
    })
    await harness.database.insert(userApplications).values({
      id: 'application_pending_patch',
      eventId: 'event_patch',
      userId: 'participant_user',
      status: 'submitted',
      submittedAt: '2026-03-22T12:10:00.000Z',
      applicationTermsDocumentId: 'terms_patch',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:10:00.000Z'
    })

    const response = await harness.request('/api/events/event_patch', {
      method: 'PATCH',
      body: JSON.stringify({
        description: 'Updated description',
        discordServerUrl: 'https://discord.gg/patch-event',
        lumaEventUrl: 'https://lu.ma/patch-event',
        slidesUrl: 'https://example.com/patch-event-slides',
        lumaEventApiId: 'evt-patchevent123',
        agendaItems: [
          {
            id: 'agenda_item_2',
            startsAt: '2026-03-24T09:00:00.000Z',
            endsAt: null,
            title: 'Updated item',
            details: null,
            displayOrder: 1
          }
        ],
        city: 'Berlin',
        country: 'Germany',
        maxTeamMembers: 7,
        autoApproveApplications: true,
        blindReviewCount: 0,
        pitchReviewEnabled: true,
        blindScoreWeightPercent: 0,
        pitchScoreWeightPercent: 100,
        inPersonEvent: true,
        applicationAiKnowledgeVisible: true,
        applicationChatgptEmailVisible: true,
        applicationOpenaiOrgIdVisible: true,
        applicationLumaEmailVisible: true,
        requireChatgptEmail: true,
        requireOpenaiOrgId: true,
        requireLumaEmail: true,
        requireWhyThisEvent: true,
        requireProofOfExecution: true,
        requireAiKnowledge: true,
        requireSubmissionSummary: true,
        requireSubmissionRepositoryUrl: true,
        requireSubmissionDemoUrl: true
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'event_patch',
        state: 'registration_open',
        description: 'Updated description',
        lumaEventUrl: 'https://lu.ma/patch-event',
        slidesUrl: 'https://example.com/patch-event-slides',
        lumaEventApiId: 'evt-patchevent123',
        agendaItems: [
          expect.objectContaining({
            id: 'agenda_item_2',
            title: 'Updated item'
          })
        ],
        city: 'Berlin',
        country: 'Germany',
        maxTeamMembers: 7,
        autoApproveApplications: true,
        blindReviewCount: 0,
        pitchReviewEnabled: true,
        blindScoreWeightPercent: 0,
        pitchScoreWeightPercent: 100,
        inPersonEvent: true,
        applicationAiKnowledgeVisible: true,
        requireChatgptEmail: true,
        requireOpenaiOrgId: true,
        requireLumaEmail: true,
        requireWhyThisEvent: true,
        requireProofOfExecution: true,
        requireAiKnowledge: true
      }
    })

    const updatedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_patch')
    })

    expect(updatedEvent).toMatchObject({
      discordServerUrl: 'https://discord.gg/patch-event',
      lumaEventUrl: 'https://lu.ma/patch-event',
      slidesUrl: 'https://example.com/patch-event-slides',
      lumaEventApiId: 'evt-patchevent123',
      autoApproveApplications: true,
      blindReviewCount: 0,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 0,
      pitchScoreWeightPercent: 100,
      applicationAiKnowledgeVisible: true,
      requireAiKnowledge: true
    })

    const pendingApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_pending_patch')
    })

    expect(pendingApplication).toMatchObject({
      status: 'submitted',
      reviewedAt: null,
      reviewedByUserId: null
    })
  })

  test('PATCH /api/events/:eventId saves participant limits for registration-only events with hidden defaults', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'patch', path: '/api/events/:eventId', handler: eventPatchHandler },
        { method: 'get', path: '/api/events/slug/:slug', handler: eventBySlugGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|admin',
        email: 'admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'event_admin',
        auth0Subject: 'auth0|admin',
        email: 'admin@example.com',
        displayName: 'Event Admin'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_meetup_patch',
      eventType: 'meetup',
      name: 'Patch Meetup',
      slug: 'patch-meetup',
      description: 'Registration-only event',
      city: 'Vienna',
      country: 'Austria',
      address: 'Old Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      participantsLimit: null,
      blindReviewCount: 1,
      pitchReviewEnabled: false,
      blindScoreWeightPercent: 70,
      pitchScoreWeightPercent: 30,
      shortlistFinalistCount: 10,
      requireSubmissionSummary: false,
      requireSubmissionRepositoryUrl: false,
      requireSubmissionDemoUrl: false,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventTracks).values({
      id: 'meetup_track_should_remain',
      eventId: 'event_meetup_patch',
      name: 'Hidden Track',
      shortDescription: 'Legacy hidden track',
      fullDescription: '',
      staffInstructions: '',
      displayOrder: 1,
      createdAt: '2026-03-22T12:00:00.000Z'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_admin_meetup_patch',
      eventId: 'event_meetup_patch',
      userId: 'event_admin',
      role: 'event_admin',
      isInJudgePool: false,
      createdAt: '2026-03-22T12:00:00.000Z'
    })

    const response = await harness.request('/api/events/event_meetup_patch', {
      method: 'PATCH',
      body: JSON.stringify({
        participantsLimit: 80,
        tracks: [],
        submissionOpensAt: '2026-03-24T12:00:00.000Z',
        submissionClosesAt: '2026-03-24T12:00:01.000Z',
        maxTeamMembers: 1,
        blindReviewCount: 1,
        pitchReviewEnabled: false,
        blindScoreWeightPercent: 100,
        pitchScoreWeightPercent: 0,
        shortlistFinalistCount: 1,
        requireSubmissionSummary: false,
        requireSubmissionRepositoryUrl: false,
        requireSubmissionDemoUrl: false
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        eventType: 'meetup',
        participantsLimit: 80,
        maxTeamMembers: 5
      }
    })

    const updatedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_meetup_patch')
    })
    const tracks = await harness.database.query.eventTracks.findMany({
      where: eq(eventTracks.eventId, 'event_meetup_patch')
    })

    expect(updatedEvent).toMatchObject({
      participantsLimit: 80,
      submissionOpensAt: null,
      submissionClosesAt: null,
      maxTeamMembers: 5,
      blindScoreWeightPercent: 70,
      pitchScoreWeightPercent: 30,
      shortlistFinalistCount: 10
    })
    expect(tracks).toHaveLength(1)

    const detailsResponse = await harness.request('/api/events/event_meetup_patch', {
      method: 'PATCH',
      body: JSON.stringify({
        address: 'Updated Address'
      })
    })

    expect(detailsResponse.status).toBe(200)
    expect(await detailsResponse.json()).toMatchObject({
      data: {
        participantsLimit: 80,
        address: 'Updated Address'
      }
    })

    const detailsUpdatedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_meetup_patch')
    })

    expect(detailsUpdatedEvent).toMatchObject({
      participantsLimit: 80,
      autoApproveApplications: false,
      inPersonEvent: false,
      requireChatgptEmail: false,
      address: 'Updated Address'
    })

    const scheduleResponse = await harness.request('/api/events/event_meetup_patch', {
      method: 'PATCH',
      body: JSON.stringify({
        registrationOpensAt: '2026-06-27T16:05:00.000Z',
        registrationClosesAt: '2026-06-28T16:05:00.000Z'
      })
    })

    expect(scheduleResponse.status).toBe(200)

    const scheduleUpdatedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_meetup_patch')
    })

    expect(scheduleUpdatedEvent).toMatchObject({
      registrationOpensAt: '2026-06-27T16:05:00.000Z',
      registrationClosesAt: '2026-06-28T16:05:00.000Z',
      submissionOpensAt: null,
      submissionClosesAt: null
    })

    const refreshedResponse = await harness.request('/api/events/slug/patch-meetup')

    expect(refreshedResponse.status).toBe(200)
    expect(await refreshedResponse.json()).toMatchObject({
      data: {
        eventType: 'meetup',
        participantsLimit: 80,
        address: 'Updated Address'
      }
    })
  })

  test('PATCH /api/events/:eventId does not mutate managed image fields', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'patch', path: '/api/events/:eventId', handler: eventPatchHandler }
      ],
      sessionUser: {
        sub: 'auth0|admin',
        email: 'admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'event_admin',
        auth0Subject: 'auth0|admin',
        email: 'admin@example.com',
        displayName: 'Event Admin'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_patch_slug',
      eventType: 'hackathon',
      name: 'Patch Event',
      slug: 'patch-event',
      description: 'Old description',
      backgroundImageUrl: 'http://localhost/api/public/events/patch-event/images/background',
      backgroundImageObjectKey: 'events/event_patch_slug/background/object_1',
      backgroundImageRevision: 2,
      bannerImageUrl: 'http://localhost/api/public/events/patch-event/images/banner',
      bannerImageObjectKey: 'events/event_patch_slug/banner/object_1',
      bannerImageRevision: 3,
      city: 'Vienna',
      country: 'Austria',
      address: 'Old Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_admin_slug',
      eventId: 'event_patch_slug',
      userId: 'event_admin',
      role: 'event_admin',
      isInJudgePool: false,
      createdAt: '2026-03-22T12:00:00.000Z'
    })

    const response = await harness.request('/api/events/event_patch_slug', {
      method: 'PATCH',
      body: JSON.stringify({
        slug: 'patch-event-2026',
        backgroundImageUrl: 'http://localhost/api/public/events/another-event/images/background',
        bannerImageUrl: 'http://localhost/api/public/events/another-event/images/banner'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        slug: 'patch-event-2026',
        backgroundImageUrl: 'http://localhost/api/public/events/patch-event-2026/images/background?variant=background&v=2',
        bannerImageUrl: 'http://localhost/api/public/events/patch-event-2026/images/banner?variant=banner&v=3'
      }
    })
    expect(await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_patch_slug')
    })).toMatchObject({
      slug: 'patch-event-2026',
      backgroundImageUrl: 'http://localhost/api/public/events/patch-event/images/background',
      backgroundImageObjectKey: 'events/event_patch_slug/background/object_1',
      backgroundImageRevision: 2,
      bannerImageUrl: 'http://localhost/api/public/events/patch-event/images/banner',
      bannerImageObjectKey: 'events/event_patch_slug/banner/object_1',
      bannerImageRevision: 3
    })
  })

  test('event image routes upload, read, and remove event background and banner images', async () => {
    const eventImagesBucket = new InMemoryR2Bucket()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/images/background', handler: eventBackgroundImagePostHandler },
        { method: 'delete', path: '/api/events/:eventId/images/background', handler: eventBackgroundImageDeleteHandler },
        { method: 'post', path: '/api/events/:eventId/images/banner', handler: eventBannerImagePostHandler },
        { method: 'delete', path: '/api/events/:eventId/images/banner', handler: eventBannerImageDeleteHandler },
        { method: 'get', path: '/api/public/events/:slug', handler: publicEventDetailGetHandler },
        { method: 'get', path: '/api/public/events/:slug/images/background', handler: publicEventBackgroundImageGetHandler },
        { method: 'get', path: '/api/public/events/:slug/images/banner', handler: publicEventBannerImageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      },
      cloudflareEnv: {
        [eventImagesBindingName]: eventImagesBucket,
        IMAGES: createImagesBinding(),
        [authenticatedUploadRateLimitBindingName]: createRateLimiter()
      },
      runtimeConfig: {
        eventImages: {
          binding: eventImagesBindingName
        }
      }
    })
    harnesses.push(harness)

    const expectCleanupRecorded = async (objectKey: string) => {
      const rows = await harness.database.select().from(mediaCleanupOutbox).where(and(
        eq(mediaCleanupOutbox.kind, 'event_image'),
        eq(mediaCleanupOutbox.objectKey, objectKey)
      ))

      expect(rows).toHaveLength(1)
    }

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'event_admin',
        auth0Subject: 'auth0|event_admin',
        email: 'event-admin@example.com',
        displayName: 'Event Admin'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_images',
      eventType: 'hackathon',
      name: 'Image Event',
      slug: 'image-event',
      description: 'Event with managed images',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_admin',
      eventId: 'event_images',
      userId: 'event_admin',
      role: 'event_admin',
      isInJudgePool: false,
      createdAt: '2026-03-22T12:00:00.000Z'
    })

    const backgroundUploadForm = new FormData()
    backgroundUploadForm.append(
      'file',
      new Blob([pngSignatureBytes], { type: 'image/png' }),
      'background.png'
    )

    const backgroundUploadResponse = await harness.request('/api/events/event_images/images/background', {
      method: 'POST',
      body: backgroundUploadForm
    })

    expect(backgroundUploadResponse.status).toBe(200)
    expect(await backgroundUploadResponse.json()).toMatchObject({
      data: {
        id: 'event_images',
        backgroundImageUrl: 'http://localhost/api/public/events/image-event/images/background?variant=background&v=1'
      }
    })

    const backgroundResponse = await harness.request('/api/public/events/image-event/images/background')

    expect(backgroundResponse.status).toBe(404)

    const backgroundEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_images')
    })
    const backgroundDetailResponse = await harness.request('/api/public/events/image-event')
    const backgroundDetailPayload = await backgroundDetailResponse.json() as {
      data: { backgroundImageUrl: string }
    }

    expect(backgroundDetailPayload.data.backgroundImageUrl).toBe(
      `http://localhost/api/public/events/image-event/images/background?variant=background&v=${backgroundEvent!.backgroundImageRevision}`
    )
    const versionedBackgroundResponse = await harness.request(
      `/api/public/events/image-event/images/background?variant=background&v=${backgroundEvent!.backgroundImageRevision}`,
      {
        headers: {
          accept: 'image/avif,image/webp;q=0.8'
        }
      }
    )

    expect(versionedBackgroundResponse.status).toBe(200)
    expect(versionedBackgroundResponse.headers.get('cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(versionedBackgroundResponse.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(versionedBackgroundResponse.headers.get('content-type')).toBe('image/webp')
    expect(versionedBackgroundResponse.headers.get('vary')).toBe('Accept')

    const replacedBackgroundUploadForm = new FormData()
    replacedBackgroundUploadForm.append(
      'file',
      new Blob([pngSignatureBytes], { type: 'image/png' }),
      'background-replacement.png'
    )

    const replacedBackgroundUploadResponse = await harness.request('/api/events/event_images/images/background', {
      method: 'POST',
      body: replacedBackgroundUploadForm
    })

    expect(replacedBackgroundUploadResponse.status).toBe(200)
    const replacedBackgroundEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_images')
    })
    expect(replacedBackgroundEvent?.backgroundImageRevision).toBe(backgroundEvent!.backgroundImageRevision + 1)
    expect(replacedBackgroundEvent?.backgroundImageObjectKey).not.toBe(backgroundEvent!.backgroundImageObjectKey)
    expect(await eventImagesBucket.get(backgroundEvent!.backgroundImageObjectKey!)).not.toBeNull()
    await expectCleanupRecorded(backgroundEvent!.backgroundImageObjectKey!)

    const concurrentBackgroundUploads = await Promise.all([1, 2].map(async (index) => {
      const form = new FormData()
      form.append(
        'file',
        new Blob([pngSignatureBytes], { type: 'image/png' }),
        `background-concurrent-${index}.png`
      )

      return await harness.request('/api/events/event_images/images/background', {
        method: 'POST',
        body: form
      })
    }))

    expect(concurrentBackgroundUploads.every(response => response.status === 200 || response.status === 409)).toBe(true)
    expect(concurrentBackgroundUploads.some(response => response.status === 200)).toBe(true)
    const concurrentlyReplacedBackgroundEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_images')
    })
    expect(concurrentlyReplacedBackgroundEvent?.backgroundImageRevision).toBeGreaterThanOrEqual(
      replacedBackgroundEvent!.backgroundImageRevision + 1
    )
    const backgroundObjectKeys = eventImagesBucket
      .keys()
      .filter(key => key.startsWith('events/event_images/background/'))
    expect(backgroundObjectKeys).toContain(concurrentlyReplacedBackgroundEvent!.backgroundImageObjectKey)
    expect(new Set(backgroundObjectKeys).size).toBe(backgroundObjectKeys.length)

    const staleReplacedBackgroundResponse = await harness.request(
      `/api/public/events/image-event/images/background?variant=background&v=${backgroundEvent!.backgroundImageRevision}`
    )
    expect(staleReplacedBackgroundResponse.status).toBe(404)

    const bannerUploadForm = new FormData()
    bannerUploadForm.append(
      'file',
      new Blob([pngSignatureBytes], { type: 'image/png' }),
      'banner.png'
    )

    const bannerUploadResponse = await harness.request('/api/events/event_images/images/banner', {
      method: 'POST',
      body: bannerUploadForm
    })

    expect(bannerUploadResponse.status).toBe(200)
    expect(await bannerUploadResponse.json()).toMatchObject({
      data: {
        id: 'event_images',
        bannerImageUrl: 'http://localhost/api/public/events/image-event/images/banner?variant=banner&v=1'
      }
    })

    const bannerResponse = await harness.request('/api/public/events/image-event/images/banner')

    expect(bannerResponse.status).toBe(404)

    const bannerEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_images')
    })
    const bannerDetailResponse = await harness.request('/api/public/events/image-event')
    const bannerDetailPayload = await bannerDetailResponse.json() as {
      data: { bannerImageUrl: string }
    }

    expect(bannerDetailPayload.data.bannerImageUrl).toBe(
      `http://localhost/api/public/events/image-event/images/banner?variant=banner&v=${bannerEvent!.bannerImageRevision}`
    )
    const versionedBannerResponse = await harness.request(
      `/api/public/events/image-event/images/banner?variant=banner&v=${bannerEvent!.bannerImageRevision}`,
      {
        headers: {
          accept: 'image/avif,image/webp;q=0.8'
        }
      }
    )

    expect(versionedBannerResponse.status).toBe(200)
    expect(versionedBannerResponse.headers.get('cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(versionedBannerResponse.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(versionedBannerResponse.headers.get('content-type')).toBe('image/webp')
    expect(versionedBannerResponse.headers.get('vary')).toBe('Accept')

    const bannerObjectKey = bannerEvent!.bannerImageObjectKey!
    const backgroundDeleteResponse = await harness.request('/api/events/event_images/images/background', {
      method: 'DELETE'
    })

    expect(backgroundDeleteResponse.status).toBe(200)
    expect(await backgroundDeleteResponse.json()).toMatchObject({
      data: {
        id: 'event_images',
        backgroundImageUrl: null
      }
    })

    const missingBackgroundResponse = await harness.request('/api/public/events/image-event/images/background')

    expect(missingBackgroundResponse.status).toBe(404)
    expect(await missingBackgroundResponse.json()).toMatchObject({
      error: {
        code: 'event_background_image_not_found'
      }
    })
    const staleBackgroundResponse = await harness.request(
      `/api/public/events/image-event/images/background?variant=background&v=${backgroundEvent!.backgroundImageRevision}`
    )

    expect(staleBackgroundResponse.status).toBe(404)
    expect(await eventImagesBucket.get(concurrentlyReplacedBackgroundEvent!.backgroundImageObjectKey!)).not.toBeNull()
    await expectCleanupRecorded(concurrentlyReplacedBackgroundEvent!.backgroundImageObjectKey!)

    const beforeFailedUpload = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_images')
    })
    vi.spyOn(eventImagesBucket, 'put').mockRejectedValueOnce(new Error('R2 write failed'))
    const failedUploadForm = new FormData()
    failedUploadForm.append(
      'file',
      new Blob([pngSignatureBytes], { type: 'image/png' }),
      'background-failed.png'
    )
    const failedUploadResponse = await harness.request('/api/events/event_images/images/background', {
      method: 'POST',
      body: failedUploadForm
    })
    const afterFailedUpload = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_images')
    })

    expect(failedUploadResponse.status).toBe(500)
    expect(afterFailedUpload).toMatchObject({
      backgroundImageObjectKey: beforeFailedUpload!.backgroundImageObjectKey,
      backgroundImageRevision: beforeFailedUpload!.backgroundImageRevision,
      publicContentRevision: beforeFailedUpload!.publicContentRevision
    })

    vi.restoreAllMocks()
    const objectKeysBeforeD1Failure = eventImagesBucket.keys()
    const beforeD1Failure = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_images')
    })
    const originalWithSession = harness.d1Database.withSession.bind(harness.d1Database)
    let failEventUpdate = true
    vi.spyOn(harness.d1Database, 'withSession').mockImplementation((constraintOrBookmark?: string) => {
      const session = originalWithSession(constraintOrBookmark)
      const originalPrepare = session.prepare.bind(session)

      session.prepare = (query: string) => {
        if (failEventUpdate && /^\s*update\b/i.test(query) && query.toLowerCase().includes('events')) {
          failEventUpdate = false
          throw new Error('D1 pointer update failed')
        }

        return originalPrepare(query)
      }

      return session
    })
    const d1FailureForm = new FormData()
    d1FailureForm.append(
      'file',
      new Blob([pngSignatureBytes], { type: 'image/png' }),
      'background-d1-failed.png'
    )
    const d1FailureResponse = await harness.request('/api/events/event_images/images/background', {
      method: 'POST',
      body: d1FailureForm
    })
    const afterD1Failure = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_images')
    })
    const orphanedObjectKeys = eventImagesBucket.keys().filter(key => !objectKeysBeforeD1Failure.includes(key))

    expect(d1FailureResponse.status).toBe(500)
    expect(orphanedObjectKeys).toHaveLength(1)
    expect(await eventImagesBucket.get(orphanedObjectKeys[0]!)).not.toBeNull()
    expect(afterD1Failure).toMatchObject({
      backgroundImageObjectKey: beforeD1Failure!.backgroundImageObjectKey,
      backgroundImageRevision: beforeD1Failure!.backgroundImageRevision,
      publicContentRevision: beforeD1Failure!.publicContentRevision
    })

    const bannerDeleteResponse = await harness.request('/api/events/event_images/images/banner', {
      method: 'DELETE'
    })

    expect(bannerDeleteResponse.status).toBe(200)
    expect(await bannerDeleteResponse.json()).toMatchObject({
      data: {
        id: 'event_images',
        bannerImageUrl: null
      }
    })
    expect(await eventImagesBucket.get(bannerObjectKey)).not.toBeNull()
    await expectCleanupRecorded(bannerObjectKey)

    const missingBannerResponse = await harness.request('/api/public/events/image-event/images/banner')

    expect(missingBannerResponse.status).toBe(404)
    expect(await missingBannerResponse.json()).toMatchObject({
      error: {
        code: 'event_banner_image_not_found'
      }
    })
  })

  test('GET /api/public/events/:slug/images/banner rejects draft and unversioned banners', async () => {
    const eventImagesBucket = new InMemoryR2Bucket()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/public/events/:slug/images/banner', handler: publicEventBannerImageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      },
      cloudflareEnv: {
        [eventImagesBindingName]: eventImagesBucket
      },
      runtimeConfig: {
        eventImages: {
          binding: eventImagesBindingName
        }
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'event_admin',
        auth0Subject: 'auth0|event_admin',
        email: 'event-admin@example.com',
        displayName: 'Event Admin'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_draft_banner',
      eventType: 'build',
      name: 'Draft Banner Event',
      slug: 'draft-banner-event',
      description: 'Draft event with a banner',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      state: 'draft',
      maxTeamMembers: 1,
      bannerImageUrl: 'http://localhost/api/public/events/draft-banner-event/images/banner',
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_admin_draft_banner',
      eventId: 'event_draft_banner',
      userId: 'event_admin',
      role: 'event_admin',
      isInJudgePool: false,
      createdAt: '2026-03-22T12:00:00.000Z'
    })
    await eventImagesBucket.put(
      eventImageObjectKey('event_draft_banner', 'banner'),
      pngSignatureBytes,
      {
        httpMetadata: {
          contentType: 'image/png'
        }
      }
    )

    const adminResponse = await harness.request('/api/public/events/draft-banner-event/images/banner')

    expect(adminResponse.status).toBe(404)

    const draftEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_draft_banner')
    })
    const draftVersionedResponse = await harness.request(
      `/api/public/events/draft-banner-event/images/banner?variant=banner&v=${draftEvent!.bannerImageRevision}`
    )

    expect(draftVersionedResponse.status).toBe(404)

    stubAuth0Session(null)

    const publicResponse = await harness.request('/api/public/events/draft-banner-event/images/banner')

    expect(publicResponse.status).toBe(404)
    expect(await publicResponse.json()).toMatchObject({
      error: {
        code: 'event_not_found'
      }
    })
  })

  test('event photo routes let approved participants read but not manage the protected gallery', async () => {
    const eventImagesBucket = new InMemoryR2Bucket()
    const previewBytes = new Uint8Array([1, 2, 3, 4])
    const transformCalls: Array<{
      width?: number
      height?: number
      fit?: string
    }> = []
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/photos', handler: eventPhotosGetHandler },
        { method: 'post', path: '/api/events/:eventId/photos', handler: eventPhotosPostHandler },
        { method: 'delete', path: '/api/events/:eventId/photos/:photoId', handler: eventPhotoDeleteHandler },
        { method: 'patch', path: '/api/events/:eventId/photos/:photoId/highlight', handler: eventPhotoHighlightPatchHandler },
        { method: 'patch', path: '/api/events/:eventId/photos/:photoId/public-visibility', handler: eventPhotoPublicVisibilityPatchHandler },
        { method: 'get', path: '/api/events/:eventId/photos/:photoId/image', handler: eventPhotoImageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|participant_user',
        email: 'participant@example.com'
      },
      cloudflareEnv: {
        [eventImagesBindingName]: eventImagesBucket,
        IMAGES: createImagesBinding({
          previewBytes,
          transformCalls
        }),
        [authenticatedUploadRateLimitBindingName]: createRateLimiter()
      },
      runtimeConfig: {
        eventImages: {
          binding: eventImagesBindingName
        }
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'participant_user',
        auth0Subject: 'auth0|participant_user',
        email: 'participant@example.com',
        displayName: 'Participant User'
      }
    ])
    await seedCurrentPlatformConsent(harness, 'participant_user')
    await harness.database.insert(events).values({
      id: 'event_photos_read',
      eventType: 'hackathon',
      name: 'Photo Read Event',
      slug: 'photo-read-event',
      description: 'Event with protected photos',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventTermsDocuments).values({
      id: 'application_terms_photo_read',
      eventId: 'event_photos_read',
      documentType: 'application_terms',
      version: 1,
      title: 'Photo Read Application Terms',
      content: 'Terms',
      publishedAt: '2026-03-01T00:00:00.000Z'
    })
    await harness.database.insert(userApplications).values({
      id: 'application_participant_photo_read',
      eventId: 'event_photos_read',
      userId: 'participant_user',
      status: 'approved',
      applicationTermsDocumentId: 'application_terms_photo_read',
      applicationTermsAcceptedAt: '2026-03-02T00:00:00.000Z'
    })
    await eventImagesBucket.put('events/event_photos_read/photos/photo_1/fixture-1', pngSignatureBytes, {
      httpMetadata: {
        contentType: 'image/png'
      }
    })
    await harness.database.insert(eventPhotos).values({
      id: 'photo_1',
      eventId: 'event_photos_read',
      uploadedByUserId: 'creator_1',
      fileName: 'gallery-photo.png',
      contentType: 'image/png',
      width: 1600,
      height: 900,
      objectKey: 'events/event_photos_read/photos/photo_1/fixture-1',
      imageRevision: 1,
      createdAt: '2026-04-01T12:00:00.000Z'
    })

    const listResponse = await harness.request('/api/events/event_photos_read/photos')

    expect(listResponse.status).toBe(200)
    expect(await listResponse.json()).toMatchObject({
      data: [
        expect.objectContaining({
          id: 'photo_1',
          fileName: 'gallery-photo.png',
          isPubliclyVisible: false,
          isHighlighted: false,
          previewUrl: '/api/events/event_photos_read/photos/photo_1/image?variant=preview&v=1',
          originalUrl: '/api/events/event_photos_read/photos/photo_1/image?variant=original&v=1'
        })
      ]
    })

    const previewResponse = await harness.request('/api/events/event_photos_read/photos/photo_1/image?variant=preview')

    expect(previewResponse.status).toBe(200)
    expect(previewResponse.headers.get('content-type')).toBe('image/webp')
    expect(previewResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(previewResponse.headers.get('cloudflare-cdn-cache-control')).toBeNull()
    expect(new Uint8Array(await previewResponse.arrayBuffer())).toEqual(previewBytes)

    const originalResponse = await harness.request('/api/events/event_photos_read/photos/photo_1/image?variant=original')

    expect(originalResponse.status).toBe(200)
    expect(originalResponse.headers.get('content-type')).toBe('image/webp')
    expect(originalResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(originalResponse.headers.get('cloudflare-cdn-cache-control')).toBeNull()
    expect(new Uint8Array(await originalResponse.arrayBuffer())).toEqual(previewBytes)
    expect(transformCalls).toEqual([
      {
        width: 720,
        height: 720,
        fit: 'scale-down'
      },
      {
        width: 2400,
        height: 2400,
        fit: 'scale-down'
      }
    ])

    const downloadUrl = '/api/events/event_photos_read/photos/photo_1/image?variant=original&v=1&download=1'
    const downloadResponse = await harness.request(downloadUrl)
    expect(downloadResponse.status).toBe(200)
    expect(downloadResponse.headers.get('content-type')).toBe('image/png')
    expect(downloadResponse.headers.get('content-disposition')).toContain('filename*=UTF-8\'\'gallery-photo.png')
    expect(downloadResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(downloadResponse.headers.get('cloudflare-cdn-cache-control')).toBe('private, no-store')
    expect(new Uint8Array(await downloadResponse.arrayBuffer())).toEqual(pngSignatureBytes)
    expect(transformCalls).toHaveLength(2)
    expect((await harness.request(downloadUrl.replace('v=1', 'v=2'))).status).toBe(404)

    const uploadForm = new FormData()
    uploadForm.append('file', new Blob([pngSignatureBytes], { type: 'image/png' }), 'blocked-upload.png')

    const uploadResponse = await harness.request('/api/events/event_photos_read/photos', {
      method: 'POST',
      body: uploadForm
    })

    expect(uploadResponse.status).toBe(403)
    expect(await uploadResponse.json()).toMatchObject({
      error: {
        code: 'event_photo_manage_required'
      }
    })

    const deleteResponse = await harness.request('/api/events/event_photos_read/photos/photo_1', {
      method: 'DELETE'
    })

    expect(deleteResponse.status).toBe(403)
    expect(await deleteResponse.json()).toMatchObject({
      error: {
        code: 'event_photo_manage_required'
      }
    })

    const publicVisibilityResponse = await harness.request('/api/events/event_photos_read/photos/photo_1/public-visibility', {
      method: 'PATCH',
      body: JSON.stringify({
        isPubliclyVisible: true
      }),
      headers: {
        'content-type': 'application/json'
      }
    })

    expect(publicVisibilityResponse.status).toBe(403)
    expect(await publicVisibilityResponse.json()).toMatchObject({
      error: {
        code: 'event_photo_manage_required'
      }
    })

    const highlightResponse = await harness.request('/api/events/event_photos_read/photos/photo_1/highlight', {
      method: 'PATCH',
      body: JSON.stringify({
        isHighlighted: true
      }),
      headers: {
        'content-type': 'application/json'
      }
    })

    expect(highlightResponse.status).toBe(403)
    expect(await highlightResponse.json()).toMatchObject({
      error: {
        code: 'event_photo_manage_required'
      }
    })
    await harness.database.update(userApplications)
      .set({ status: 'rejected' })
      .where(eq(userApplications.id, 'application_participant_photo_read'))
    expect((await harness.request(downloadUrl)).status).toBe(403)
    stubAuth0Session(null)
    expect((await harness.request(downloadUrl)).status).toBe(401)
  })

  test('event photo routes let judges upload and delete gallery photos', async () => {
    const eventImagesBucket = new InMemoryR2Bucket()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/photos', handler: eventPhotosGetHandler },
        { method: 'post', path: '/api/events/:eventId/photos', handler: eventPhotosPostHandler },
        { method: 'delete', path: '/api/events/:eventId/photos/:photoId', handler: eventPhotoDeleteHandler },
        { method: 'patch', path: '/api/events/:eventId/photos/:photoId/highlight', handler: eventPhotoHighlightPatchHandler },
        { method: 'patch', path: '/api/events/:eventId/photos/:photoId/public-visibility', handler: eventPhotoPublicVisibilityPatchHandler }
      ],
      sessionUser: {
        sub: 'auth0|judge_user',
        email: 'judge@example.com'
      },
      cloudflareEnv: {
        [eventImagesBindingName]: eventImagesBucket,
        IMAGES: createImagesBinding(),
        [authenticatedUploadRateLimitBindingName]: createRateLimiter()
      },
      runtimeConfig: {
        eventImages: {
          binding: eventImagesBindingName
        }
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'judge_user',
        auth0Subject: 'auth0|judge_user',
        email: 'judge@example.com',
        displayName: 'Judge User'
      }
    ])
    await seedCurrentPlatformConsent(harness, 'judge_user')
    await harness.database.insert(events).values({
      id: 'event_photos_judge',
      eventType: 'hackathon',
      name: 'Photo Judge Event',
      slug: 'photo-judge-event',
      description: 'Event with judge-managed photos',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_judge_photo_gallery',
      eventId: 'event_photos_judge',
      userId: 'judge_user',
      role: 'judge',
      isInJudgePool: true,
      isStaff: false,
      createdAt: '2026-03-22T12:00:00.000Z'
    })

    const uploadForm = new FormData()
    uploadForm.append('file', new Blob([pngSignatureBytes], { type: 'image/png' }), 'judge-upload.png')

    const uploadResponse = await harness.request('/api/events/event_photos_judge/photos', {
      method: 'POST',
      body: uploadForm
    })

    expect(uploadResponse.status).toBe(200)
    const uploadPayload = await uploadResponse.json()
    expect(uploadPayload).toMatchObject({
      data: [
        expect.objectContaining({
          fileName: 'judge-upload.png',
          contentType: 'image/png',
          width: 1600,
          height: 900,
          isPubliclyVisible: false,
          isHighlighted: false,
          uploadedByUserId: 'judge_user'
        })
      ]
    })

    const createdPhotoId = uploadPayload.data[0].id as string
    const storedPhoto = await harness.database.query.eventPhotos.findFirst({
      where: eq(eventPhotos.id, createdPhotoId)
    })
    const storedPhotoObject = await eventImagesBucket.get(storedPhoto!.objectKey!)

    expect(storedPhotoObject).not.toBeNull()
    expect(new Uint8Array(await storedPhotoObject!.arrayBuffer())).toEqual(pngSignatureBytes)

    const highlightResponse = await harness.request(
      `/api/events/event_photos_judge/photos/${createdPhotoId}/highlight`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          isHighlighted: true
        }),
        headers: {
          'content-type': 'application/json'
        }
      }
    )

    expect(highlightResponse.status).toBe(200)
    expect(await highlightResponse.json()).toMatchObject({
      data: {
        id: createdPhotoId,
        isHighlighted: true,
        isPubliclyVisible: false
      }
    })

    const publicVisibilityResponse = await harness.request(
      `/api/events/event_photos_judge/photos/${createdPhotoId}/public-visibility`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          isPubliclyVisible: true
        }),
        headers: {
          'content-type': 'application/json'
        }
      }
    )

    expect(publicVisibilityResponse.status).toBe(200)
    expect(await publicVisibilityResponse.json()).toMatchObject({
      data: {
        id: createdPhotoId,
        isPubliclyVisible: true
      }
    })

    const deleteResponse = await harness.request(
      `/api/events/event_photos_judge/photos/${createdPhotoId}`,
      {
        method: 'DELETE'
      }
    )

    expect(deleteResponse.status).toBe(200)
    expect(await deleteResponse.json()).toMatchObject({
      data: {
        id: createdPhotoId
      }
    })

    const remainingPhotos = await harness.database.select().from(eventPhotos)
    expect(remainingPhotos).toEqual([])
    expect(await eventImagesBucket.get(storedPhoto!.objectKey!)).not.toBeNull()
    const cleanupRows = await harness.database.select().from(mediaCleanupOutbox).where(and(
      eq(mediaCleanupOutbox.kind, 'event_photo'),
      eq(mediaCleanupOutbox.objectKey, storedPhoto!.objectKey!)
    ))
    expect(cleanupRows).toHaveLength(1)

    const auditEntries = await harness.database.select().from(auditLogs)
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorUserId: 'judge_user',
        entityType: 'event_photo',
        action: 'event_photo.created'
      }),
      expect.objectContaining({
        actorUserId: 'judge_user',
        entityType: 'event_photo',
        action: 'event_photo.updated_highlight'
      }),
      expect.objectContaining({
        actorUserId: 'judge_user',
        entityType: 'event_photo',
        action: 'event_photo.updated_public_visibility'
      }),
      expect.objectContaining({
        actorUserId: 'judge_user',
        entityType: 'event_photo',
        action: 'event_photo.deleted'
      })
    ])
  })

  test('event photo routes let staff upload gallery photos with EXIF capture time', async () => {
    const eventImagesBucket = new InMemoryR2Bucket()
    const capturedAt = '2026-06-20T09:51:20.000Z'
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/photos', handler: eventPhotosPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|staff_user',
        email: 'staff@example.com'
      },
      cloudflareEnv: {
        [eventImagesBindingName]: eventImagesBucket,
        IMAGES: createImagesBinding(),
        [authenticatedUploadRateLimitBindingName]: createRateLimiter()
      },
      runtimeConfig: {
        eventImages: {
          binding: eventImagesBindingName
        }
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'staff_user',
        auth0Subject: 'auth0|staff_user',
        email: 'staff@example.com',
        displayName: 'Staff User'
      }
    ])
    await seedCurrentPlatformConsent(harness, 'staff_user')
    await harness.database.insert(events).values({
      id: 'event_photos_staff',
      eventType: 'hackathon',
      name: 'Photo Staff Event',
      slug: 'photo-staff-event',
      description: 'Event with staff-managed photos',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_staff_photo_gallery',
      eventId: 'event_photos_staff',
      userId: 'staff_user',
      role: 'staff',
      isInJudgePool: false,
      isStaff: true,
      createdAt: '2026-03-22T12:00:00.000Z'
    })

    const uploadForm = new FormData()
    uploadForm.append('file', new Blob([
      createExifJpegBytes({
        dateTimeOriginal: '2026:06:20 11:51:20',
        offsetTimeOriginal: '+02:00'
      })
    ], { type: 'image/jpeg' }), 'staff-upload.jpeg')

    const uploadResponse = await harness.request('/api/events/event_photos_staff/photos', {
      method: 'POST',
      body: uploadForm
    })

    expect(uploadResponse.status).toBe(200)
    expect(await uploadResponse.json()).toMatchObject({
      data: [
        expect.objectContaining({
          fileName: 'staff-upload.jpeg',
          contentType: 'image/jpeg',
          createdAt: capturedAt,
          isPubliclyVisible: false,
          isHighlighted: false,
          uploadedByUserId: 'staff_user',
          previewUrl: expect.stringContaining('v=1')
        })
      ]
    })

    await expect(harness.database.select().from(eventPhotos).where(eq(eventPhotos.eventId, 'event_photos_staff')))
      .resolves.toEqual([
        expect.objectContaining({
          fileName: 'staff-upload.jpeg',
          contentType: 'image/jpeg',
          createdAt: capturedAt,
          isHighlighted: false
        })
      ])
  })

  test('event photo uploads persist metadata in batches below D1 parameter limits', async () => {
    const eventImagesBucket = new InMemoryR2Bucket()
    const uploadRateLimiter = createRateLimiter()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/photos', handler: eventPhotosPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|gallery_admin',
        email: 'gallery-admin@example.com'
      },
      cloudflareEnv: {
        [eventImagesBindingName]: eventImagesBucket,
        IMAGES: createImagesBinding(),
        [authenticatedUploadRateLimitBindingName]: uploadRateLimiter
      },
      runtimeConfig: {
        eventImages: {
          binding: eventImagesBindingName
        }
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'gallery_admin',
        auth0Subject: 'auth0|gallery_admin',
        email: 'gallery-admin@example.com',
        displayName: 'Gallery Admin'
      }
    ])
    await seedCurrentPlatformConsent(harness, 'gallery_admin')
    await harness.database.insert(events).values({
      id: 'event_photos_bulk',
      eventType: 'hackathon',
      name: 'Photo Bulk Event',
      slug: 'photo-bulk-event',
      description: 'Event with bulk photo uploads',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_gallery_admin',
      eventId: 'event_photos_bulk',
      userId: 'gallery_admin',
      role: 'event_admin',
      isInJudgePool: false,
      isStaff: false,
      createdAt: '2026-03-22T12:00:00.000Z'
    })

    const uploadForm = new FormData()

    for (let index = 0; index < 13; index += 1) {
      uploadForm.append(
        'file',
        new Blob([pngSignatureBytes], { type: 'image/png' }),
        `bulk-upload-${index + 1}.png`
      )
    }

    const uploadResponse = await harness.request('/api/events/event_photos_bulk/photos', {
      method: 'POST',
      body: uploadForm
    })

    expect(uploadResponse.status).toBe(200)
    const uploadPayload = await uploadResponse.json()
    expect(uploadPayload.data).toHaveLength(13)
    expect(uploadPayload.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fileName: 'bulk-upload-1.png',
        isPubliclyVisible: false,
        isHighlighted: false,
        uploadedByUserId: 'gallery_admin'
      }),
      expect.objectContaining({
        fileName: 'bulk-upload-13.png',
        isPubliclyVisible: false,
        isHighlighted: false,
        uploadedByUserId: 'gallery_admin'
      })
    ]))

    const storedPhotos = await harness.database
      .select()
      .from(eventPhotos)
      .where(eq(eventPhotos.eventId, 'event_photos_bulk'))

    expect(storedPhotos).toHaveLength(13)
    expect(storedPhotos.every(photo => photo.isPubliclyVisible === false)).toBe(true)
    expect(storedPhotos.every(photo => photo.isHighlighted === false)).toBe(true)
    expect(uploadRateLimiter.limit).toHaveBeenCalledTimes(1)
  })

  test('public event photo routes expose only publicly visible gallery images', async () => {
    const eventImagesBucket = new InMemoryR2Bucket()
    const previewBytes = new Uint8Array([7, 8, 9, 10])
    const transformCalls: Array<{
      width?: number
      height?: number
      fit?: string
    }> = []
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/public/events/:slug/photos', handler: publicEventPhotosGetHandler },
        { method: 'get', path: '/api/public/events/:slug/photos/:photoId/image', handler: publicEventPhotoImageGetHandler },
        { method: 'patch', path: '/api/events/:eventId/photos/:photoId/public-visibility', handler: eventPhotoPublicVisibilityPatchHandler },
        { method: 'delete', path: '/api/events/:eventId/photos/:photoId', handler: eventPhotoDeleteHandler }
      ],
      sessionUser: {
        sub: 'auth0|gallery_admin',
        email: 'gallery-admin@example.com'
      },
      cloudflareEnv: {
        [eventImagesBindingName]: eventImagesBucket,
        IMAGES: createImagesBinding({
          previewBytes,
          transformCalls
        })
      },
      runtimeConfig: {
        eventImages: {
          binding: eventImagesBindingName
        }
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'gallery_admin',
        auth0Subject: 'auth0|gallery_admin',
        email: 'gallery-admin@example.com',
        displayName: 'Gallery Admin'
      }
    ])
    await seedCurrentPlatformConsent(harness, 'gallery_admin')
    await harness.database.insert(events).values({
      id: 'event_public_gallery',
      eventType: 'hackathon',
      name: 'Public Gallery Event',
      slug: 'public-gallery-event',
      description: 'Event with a public gallery',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_public_gallery_admin',
      eventId: 'event_public_gallery',
      userId: 'gallery_admin',
      role: 'event_admin',
      isInJudgePool: false,
      isStaff: false,
      createdAt: '2026-04-01T12:00:00.000Z'
    })

    await eventImagesBucket.put('events/event_public_gallery/photos/photo_public/fixture-1', pngSignatureBytes, {
      httpMetadata: {
        contentType: 'image/png'
      }
    })
    await eventImagesBucket.put('events/event_public_gallery/photos/photo_private/fixture-1', pngSignatureBytes, {
      httpMetadata: {
        contentType: 'image/png'
      }
    })

    await harness.database.insert(eventPhotos).values([
      {
        id: 'photo_public',
        eventId: 'event_public_gallery',
        uploadedByUserId: 'creator_1',
        fileName: 'public-gallery-photo.png',
        isPubliclyVisible: true,
        isHighlighted: true,
        contentType: 'image/png',
        width: 1600,
        height: 900,
        objectKey: 'events/event_public_gallery/photos/photo_public/fixture-1',
        imageRevision: 1,
        createdAt: '2026-04-01T12:00:00.000Z'
      },
      {
        id: 'photo_private',
        eventId: 'event_public_gallery',
        uploadedByUserId: 'creator_1',
        fileName: 'private-gallery-photo.png',
        isPubliclyVisible: false,
        isHighlighted: false,
        contentType: 'image/png',
        width: 1600,
        height: 900,
        objectKey: 'events/event_public_gallery/photos/photo_private/fixture-1',
        imageRevision: 1,
        createdAt: '2026-04-01T12:05:00.000Z'
      }
    ])

    const listResponse = await harness.request('/api/public/events/public-gallery-event/photos')

    expect(listResponse.status).toBe(200)
    const listPayload = await listResponse.json()
    expect(listPayload).toMatchObject({
      data: [
        {
          id: 'photo_public',
          eventId: 'event_public_gallery',
          fileName: 'public-gallery-photo.png',
          isPubliclyVisible: true,
          uploadedByUserId: null,
          uploadedBy: null,
          previewUrl: '/api/public/events/public-gallery-event/photos/photo_public/image?variant=preview&v=1',
          originalUrl: '/api/public/events/public-gallery-event/photos/photo_public/image?variant=original&v=1'
        }
      ]
    })
    expect(listPayload.data[0]).not.toHaveProperty('isHighlighted')

    const missingVariantResponse = await harness.request('/api/public/events/public-gallery-event/photos/photo_public/image?v=1')

    expect(missingVariantResponse.status).toBe(400)

    const previewResponse = await harness.request('/api/public/events/public-gallery-event/photos/photo_public/image?variant=preview&v=1')

    expect(previewResponse.status).toBe(200)
    expect(previewResponse.headers.get('content-type')).toBe('image/webp')
    expect(previewResponse.headers.get('cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(previewResponse.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(previewResponse.headers.get('vary')).toBeNull()
    expect(new Uint8Array(await previewResponse.arrayBuffer())).toEqual(previewBytes)

    const originalResponse = await harness.request('/api/public/events/public-gallery-event/photos/photo_public/image?variant=original&v=1')

    expect(originalResponse.status).toBe(200)
    expect(originalResponse.headers.get('content-type')).toBe('image/webp')
    expect(originalResponse.headers.get('cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(new Uint8Array(await originalResponse.arrayBuffer())).toEqual(previewBytes)

    expect(transformCalls).toEqual([
      {
        width: 720,
        height: 720,
        fit: 'scale-down'
      },
      {
        width: 2400,
        height: 2400,
        fit: 'scale-down'
      }
    ])

    const downloadUrl = '/api/public/events/public-gallery-event/photos/photo_public/image?variant=original&v=1&download=1'
    stubAuth0Session(null)
    const downloadResponse = await harness.request(downloadUrl)
    expect(downloadResponse.status).toBe(200)
    expect(downloadResponse.headers.get('content-type')).toBe('image/png')
    expect(downloadResponse.headers.get('content-disposition')).toContain('filename*=UTF-8\'\'public-gallery-photo.png')
    expect(downloadResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(downloadResponse.headers.get('cloudflare-cdn-cache-control')).toBe('private, no-store')
    expect(new Uint8Array(await downloadResponse.arrayBuffer())).toEqual(pngSignatureBytes)
    expect(transformCalls).toHaveLength(2)
    expect((await harness.request(downloadUrl.replace('v=1', 'v=2'))).status).toBe(404)
    expect((await harness.request(downloadUrl.replace('photo_public/', 'photo_private/'))).status).toBe(404)
    await harness.database.update(events).set({ hiddenAt: '2026-04-02T00:00:00.000Z' }).where(eq(events.id, 'event_public_gallery'))
    expect((await harness.request(downloadUrl)).status).toBe(404)
    await harness.database.update(events).set({ hiddenAt: null }).where(eq(events.id, 'event_public_gallery'))
    stubAuth0Session({ sub: 'auth0|gallery_admin', email: 'gallery-admin@example.com' })

    const hideResponse = await harness.request('/api/events/event_public_gallery/photos/photo_public/public-visibility', {
      method: 'PATCH',
      body: JSON.stringify({
        isPubliclyVisible: false
      }),
      headers: {
        'content-type': 'application/json'
      }
    })

    expect(hideResponse.status).toBe(200)
    const hiddenEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_public_gallery')
    })
    expect(hiddenEvent?.publicContentRevision).toBe(1)

    const staleVisibilityResponse = await harness.request('/api/public/events/public-gallery-event/photos/photo_public/image?variant=preview&v=1')

    expect(staleVisibilityResponse.status).toBe(404)
    expect((await harness.request(downloadUrl)).status).toBe(404)

    const restoreResponse = await harness.request('/api/events/event_public_gallery/photos/photo_public/public-visibility', {
      method: 'PATCH',
      body: JSON.stringify({
        isPubliclyVisible: true
      }),
      headers: {
        'content-type': 'application/json'
      }
    })

    expect(restoreResponse.status).toBe(200)
    const restoredEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_public_gallery')
    })
    expect(restoredEvent?.publicContentRevision).toBe(2)

    const staleRestoredUrl = '/api/public/events/public-gallery-event/photos/photo_public/image?variant=preview&v=1'
    expect((await harness.request(staleRestoredUrl)).status).toBe(404)
    const currentRestoredUrl = '/api/public/events/public-gallery-event/photos/photo_public/image?variant=preview&v=3'
    expect((await harness.request(currentRestoredUrl)).status).toBe(200)
    expect((await harness.request(downloadUrl)).status).toBe(404)
    const restoredDownloadUrl = downloadUrl.replace('v=1', 'v=3')
    expect((await harness.request(restoredDownloadUrl)).status).toBe(200)

    const deleteResponse = await harness.request('/api/events/event_public_gallery/photos/photo_public', {
      method: 'DELETE'
    })

    expect(deleteResponse.status).toBe(200)
    expect((await harness.request(currentRestoredUrl)).status).toBe(404)
    expect((await harness.request(restoredDownloadUrl)).status).toBe(404)

    const hiddenPhotoResponse = await harness.request('/api/public/events/public-gallery-event/photos/photo_private/image?variant=original&v=1')

    expect(hiddenPhotoResponse.status).toBe(404)
  })

  test('POST /api/events/:eventId/images/background rejects invalid image files', async () => {
    const eventImagesBucket = new InMemoryR2Bucket()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/images/background', handler: eventBackgroundImagePostHandler }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      },
      cloudflareEnv: {
        [eventImagesBindingName]: eventImagesBucket,
        [authenticatedUploadRateLimitBindingName]: createRateLimiter()
      },
      runtimeConfig: {
        eventImages: {
          binding: eventImagesBindingName
        }
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'event_admin',
        auth0Subject: 'auth0|event_admin',
        email: 'event-admin@example.com',
        displayName: 'Event Admin'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_images',
      eventType: 'hackathon',
      name: 'Image Event',
      slug: 'image-event',
      description: 'Event with managed images',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_admin',
      eventId: 'event_images',
      userId: 'event_admin',
      role: 'event_admin',
      isInJudgePool: false,
      createdAt: '2026-03-22T12:00:00.000Z'
    })

    const invalidImageForm = new FormData()
    invalidImageForm.append(
      'file',
      new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }),
      'background.png'
    )

    const invalidTypeResponse = await harness.request('/api/events/event_images/images/background', {
      method: 'POST',
      body: invalidImageForm
    })

    expect(invalidTypeResponse.status).toBe(400)
    expect(await invalidTypeResponse.json()).toMatchObject({
      error: {
        code: 'event_image_content_type_invalid'
      }
    })

    const oversizedForm = new FormData()
    oversizedForm.append(
      'file',
      new Blob([createOversizedPngBytes((5 * 1024 * 1024) + 1)], { type: 'image/png' }),
      'background.png'
    )

    const oversizedResponse = await harness.request('/api/events/event_images/images/background', {
      method: 'POST',
      body: oversizedForm
    })

    expect(oversizedResponse.status).toBe(400)
    expect(await oversizedResponse.json()).toMatchObject({
      error: {
        code: 'event_image_file_too_large'
      }
    })
  })

  test('POST /api/events/:eventId/images/background returns 429 when the authenticated upload rate limit is exceeded', async () => {
    const eventImagesBucket = new InMemoryR2Bucket()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/images/background', handler: eventBackgroundImagePostHandler }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      },
      cloudflareEnv: {
        [eventImagesBindingName]: eventImagesBucket,
        [authenticatedUploadRateLimitBindingName]: createRateLimiter(false)
      },
      runtimeConfig: {
        eventImages: {
          binding: eventImagesBindingName
        }
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'event_admin',
        auth0Subject: 'auth0|event_admin',
        email: 'event-admin@example.com',
        displayName: 'Event Admin'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_images',
      eventType: 'hackathon',
      name: 'Image Event',
      slug: 'image-event',
      description: 'Event with managed images',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_admin',
      eventId: 'event_images',
      userId: 'event_admin',
      role: 'event_admin',
      isInJudgePool: false,
      createdAt: '2026-03-22T12:00:00.000Z'
    })

    const uploadForm = new FormData()
    uploadForm.append(
      'file',
      new Blob([pngSignatureBytes], { type: 'image/png' }),
      'background.png'
    )

    const response = await harness.request('/api/events/event_images/images/background', {
      method: 'POST',
      body: uploadForm
    })

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({
      error: {
        code: 'upload_rate_limited',
        message: 'Too many uploads were submitted. Please wait before trying again.'
      }
    })
  })

  test('POST /api/events/:eventId/actions/open-submission opens submission and audits the state change', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/open-submission',
          handler: openSubmissionPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'platform_admin',
      auth0Subject: 'auth0|platform_admin',
      email: 'platform-admin@example.com',
      displayName: 'Platform Admin',
      isPlatformAdmin: true
    })

    const now = Date.now()
    await harness.database.insert(events).values({
      id: 'event_open_submission',
      eventType: 'hackathon',
      name: 'Open Submission Event',
      slug: 'open-submission-event',
      description: 'Open submission',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: new Date(now - 86_400_000).toISOString(),
      registrationClosesAt: new Date(now - 60_000).toISOString(),
      submissionOpensAt: new Date(now - 60_000).toISOString(),
      submissionClosesAt: new Date(now + 86_400_000).toISOString(),
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'platform_admin'
    })

    const response = await harness.request('/api/events/event_open_submission/actions/open-submission', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'event_open_submission',
        state: 'submission_open'
      }
    })

    const updatedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_open_submission')
    })
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(updatedEvent?.state).toBe('submission_open')
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorUserId: 'platform_admin',
        entityType: 'event',
        entityId: 'event_open_submission',
        action: 'event.open_submission'
      })
    ])
  })

  test('POST /api/events/:eventId/actions/open-registration opens registration and audits the state change', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/open-registration',
          handler: openRegistrationPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'platform_admin',
      auth0Subject: 'auth0|platform_admin',
      email: 'platform-admin@example.com',
      displayName: 'Platform Admin',
      isPlatformAdmin: true
    })

    const now = Date.now()
    await harness.database.insert(events).values({
      id: 'event_open_registration',
      eventType: 'hackathon',
      name: 'Open Registration Event',
      slug: 'open-registration-event',
      description: 'Open registration',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: new Date(now - 86_400_000).toISOString(),
      registrationClosesAt: new Date(now + 86_400_000).toISOString(),
      submissionOpensAt: new Date(now + 86_400_000).toISOString(),
      submissionClosesAt: new Date(now + 172_800_000).toISOString(),
      state: 'draft',
      maxTeamMembers: 5,
      createdByUserId: 'platform_admin'
    })

    const response = await harness.request('/api/events/event_open_registration/actions/open-registration', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'event_open_registration',
        state: 'registration_open'
      }
    })

    const updatedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_open_registration')
    })
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(updatedEvent?.state).toBe('registration_open')
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorUserId: 'platform_admin',
        entityType: 'event',
        entityId: 'event_open_registration',
        action: 'event.open_registration'
      })
    ])
  })

  test('POST /api/events/:eventId/actions/hide and unhide preserve lifecycle state and audit the change', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/hide',
          handler: hideEventPostHandler
        },
        {
          method: 'post',
          path: '/api/events/:eventId/actions/unhide',
          handler: unhideEventPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'event_admin',
        auth0Subject: 'auth0|event_admin',
        email: 'event-admin@example.com',
        displayName: 'Event Admin'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_hide_action',
      eventType: 'hackathon',
      name: 'Hide Action Event',
      slug: 'hide-action-event',
      description: 'Hide action',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_hide_action_admin',
      eventId: 'event_hide_action',
      userId: 'event_admin',
      role: 'event_admin',
      isInJudgePool: false,
      createdAt: '2026-03-20T12:30:00.000Z'
    })

    const missingReasonResponse = await harness.request('/api/events/event_hide_action/actions/hide', {
      method: 'POST',
      body: JSON.stringify({ reason: '   ' })
    })
    expect(missingReasonResponse.status).toBe(400)

    const hideResponse = await harness.request('/api/events/event_hide_action/actions/hide', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Incorrect public details' })
    })

    expect(hideResponse.status).toBe(200)
    expect(await hideResponse.json()).toMatchObject({
      data: {
        id: 'event_hide_action',
        state: 'registration_open',
        hiddenByUserId: 'event_admin',
        hiddenReason: 'Incorrect public details'
      }
    })

    const hiddenEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_hide_action')
    })
    expect(hiddenEvent?.state).toBe('registration_open')
    expect(hiddenEvent?.hiddenAt).toEqual(expect.any(String))
    expect(hiddenEvent?.hiddenByUserId).toBe('event_admin')
    expect(hiddenEvent?.hiddenReason).toBe('Incorrect public details')
    expect(hiddenEvent?.publicContentRevision).toBe(1)

    const unhideResponse = await harness.request('/api/events/event_hide_action/actions/unhide', {
      method: 'POST'
    })

    expect(unhideResponse.status).toBe(200)
    expect(await unhideResponse.json()).toMatchObject({
      data: {
        id: 'event_hide_action',
        state: 'registration_open',
        hiddenAt: null,
        hiddenByUserId: null,
        hiddenReason: null
      }
    })

    const restoredEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_hide_action')
    })
    const auditEntries = (await harness.database.select().from(auditLogs))
      .sort((left, right) => left.action.localeCompare(right.action))

    expect(restoredEvent?.state).toBe('registration_open')
    expect(restoredEvent?.hiddenAt).toBeNull()
    expect(restoredEvent?.hiddenByUserId).toBeNull()
    expect(restoredEvent?.hiddenReason).toBeNull()
    expect(restoredEvent?.publicContentRevision).toBe(2)
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorUserId: 'event_admin',
        entityType: 'event',
        entityId: 'event_hide_action',
        action: 'event.hidden',
        metadata: expect.objectContaining({
          state: 'registration_open',
          reason: 'Incorrect public details'
        })
      }),
      expect.objectContaining({
        actorUserId: 'event_admin',
        entityType: 'event',
        entityId: 'event_hide_action',
        action: 'event.unhidden',
        metadata: expect.objectContaining({
          state: 'registration_open',
          hiddenByUserId: 'event_admin',
          hiddenReason: 'Incorrect public details'
        })
      })
    ])
  })

  test('POST /api/events/:eventId/actions/hide requires event admin access', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/hide',
          handler: hideEventPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|participant_user',
        email: 'participant@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator_1',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'participant_user',
        auth0Subject: 'auth0|participant_user',
        email: 'participant@example.com',
        displayName: 'Participant'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_hide_forbidden',
      eventType: 'hackathon',
      name: 'Forbidden Hide Event',
      slug: 'forbidden-hide-event',
      description: 'Forbidden hide',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      createdByUserId: 'creator_1'
    })

    const response = await harness.request('/api/events/event_hide_forbidden/actions/hide', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Incorrect public details' })
    })

    expect(response.status).toBe(403)
  })

  test('POST /api/events/:eventId/actions/open-registration rejects hidden events', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/open-registration',
          handler: openRegistrationPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values({
      id: 'platform_admin',
      auth0Subject: 'auth0|platform_admin',
      email: 'platform-admin@example.com',
      displayName: 'Platform Admin',
      isPlatformAdmin: true
    })

    const now = Date.now()
    await harness.database.insert(events).values({
      id: 'event_hidden_lifecycle',
      eventType: 'hackathon',
      name: 'Hidden Lifecycle Event',
      slug: 'hidden-lifecycle-event',
      description: 'Hidden lifecycle',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: new Date(now - 86_400_000).toISOString(),
      registrationClosesAt: new Date(now + 86_400_000).toISOString(),
      submissionOpensAt: new Date(now + 86_400_000).toISOString(),
      submissionClosesAt: new Date(now + 172_800_000).toISOString(),
      state: 'draft',
      hiddenAt: new Date(now - 3_600_000).toISOString(),
      hiddenByUserId: 'platform_admin',
      hiddenReason: 'Serious issue',
      maxTeamMembers: 5,
      createdByUserId: 'platform_admin'
    })

    const response = await harness.request('/api/events/event_hidden_lifecycle/actions/open-registration', {
      method: 'POST'
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'event_hidden'
      }
    })

    const event = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_hidden_lifecycle')
    })
    expect(event?.state).toBe('draft')
  })

  test('POST /api/events/:eventId/actions/start-judging-preparation transitions to judging preparation without locking submissions and audits', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/start-judging-preparation',
          handler: startJudgingPreparationPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'platform_admin',
        auth0Subject: 'auth0|platform_admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        isPlatformAdmin: true
      },
      {
        id: 'judge_a',
        auth0Subject: 'auth0|judge_a',
        email: 'judge-a@example.com',
        displayName: 'Judge A'
      },
      {
        id: 'judge_b',
        auth0Subject: 'auth0|judge_b',
        email: 'judge-b@example.com',
        displayName: 'Judge B'
      },
      {
        id: 'team_admin',
        auth0Subject: 'auth0|team_admin',
        email: 'team-admin@example.com',
        displayName: 'Team Admin'
      },
      {
        id: 'team_member',
        auth0Subject: 'auth0|team_member',
        email: 'team-member@example.com',
        displayName: 'Team Member'
      },
      {
        id: 'other_team_admin',
        auth0Subject: 'auth0|other_team_admin',
        email: 'other-team-admin@example.com',
        displayName: 'Other Team Admin'
      }
    ])

    await harness.database.insert(events).values({
      id: 'event_judging_prep',
      eventType: 'hackathon',
      name: 'Judging Prep Event',
      slug: 'judging-prep-event',
      description: 'Judging preparation',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-18T12:00:00.000Z',
      registrationClosesAt: '2026-03-19T12:00:00.000Z',
      submissionOpensAt: '2026-03-19T12:00:00.000Z',
      submissionClosesAt: '2026-03-21T12:00:00.000Z',
      state: 'submission_open',
      maxTeamMembers: 5,
      createdByUserId: 'platform_admin'
    })

    await harness.database.insert(eventRoleAssignments).values([
      {
        id: 'role_judge_a',
        eventId: 'event_judging_prep',
        userId: 'judge_a',
        role: 'judge',
        isInJudgePool: true,
        createdAt: '2026-03-22T12:00:00.000Z'
      },
      {
        id: 'role_judge_b',
        eventId: 'event_judging_prep',
        userId: 'judge_b',
        role: 'judge',
        isInJudgePool: true,
        createdAt: '2026-03-22T12:01:00.000Z'
      }
    ])

    await harness.database.insert(teams).values([
      {
        id: 'team_1',
        eventId: 'event_judging_prep',
        name: 'Alpha Team',
        slug: 'alpha-team',
        isOpenToJoinRequests: false,
        createdByUserId: 'team_admin',
        createdAt: '2026-03-22T12:00:00.000Z',
        updatedAt: '2026-03-22T12:00:00.000Z'
      },
      {
        id: 'team_2',
        eventId: 'event_judging_prep',
        name: 'Beta Team',
        slug: 'beta-team',
        isOpenToJoinRequests: false,
        createdByUserId: 'other_team_admin',
        createdAt: '2026-03-22T12:05:00.000Z',
        updatedAt: '2026-03-22T12:05:00.000Z'
      }
    ])

    await harness.database.insert(teamMembers).values([
      {
        id: 'membership_admin',
        teamId: 'team_1',
        userId: 'team_admin',
        role: 'admin',
        joinedAt: '2026-03-22T12:00:00.000Z',
        createdAt: '2026-03-22T12:00:00.000Z'
      },
      {
        id: 'membership_member',
        teamId: 'team_1',
        userId: 'team_member',
        role: 'member',
        joinedAt: '2026-03-22T12:01:00.000Z',
        createdAt: '2026-03-22T12:01:00.000Z'
      },
      {
        id: 'membership_other_admin',
        teamId: 'team_2',
        userId: 'other_team_admin',
        role: 'admin',
        joinedAt: '2026-03-22T12:05:00.000Z',
        createdAt: '2026-03-22T12:05:00.000Z'
      }
    ])

    await harness.database.insert(submissions).values([
      {
        id: 'submission_1',
        teamId: 'team_1',
        status: 'submitted',
        projectName: 'Project One',
        submittedAt: '2026-03-24T12:00:00.000Z',
        createdAt: '2026-03-24T12:00:00.000Z',
        updatedAt: '2026-03-24T12:00:00.000Z'
      },
      {
        id: 'submission_2',
        teamId: 'team_2',
        status: 'submitted',
        projectName: 'Project Two',
        submittedAt: '2026-03-24T12:05:00.000Z',
        createdAt: '2026-03-24T12:05:00.000Z',
        updatedAt: '2026-03-24T12:05:00.000Z'
      }
    ])

    const response = await harness.request('/api/events/event_judging_prep/actions/start-judging-preparation', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'event_judging_prep',
        state: 'judging_preparation'
      }
    })

    const updatedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_judging_prep')
    })
    const storedSubmissions = await harness.database.select().from(submissions)
    const snapshotRows = await harness.database.select().from(prizeEligibilitySnapshots)
    const assignmentRows = await harness.database.select().from(judgeAssignments)
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(updatedEvent?.state).toBe('judging_preparation')
    expect(storedSubmissions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'submission_1',
        status: 'submitted'
      }),
      expect.objectContaining({
        id: 'submission_2',
        status: 'submitted'
      })
    ]))
    expect(snapshotRows).toHaveLength(0)
    expect(assignmentRows).toHaveLength(0)
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorUserId: 'platform_admin',
        entityType: 'event',
        entityId: 'event_judging_prep',
        action: 'event.start_judging_preparation'
      })
    ])
  })

  test('POST /api/events/:eventId/actions/start-blind-review rejects two blind reviews when the judge pool lacks distinct judges', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/start-blind-review',
          handler: startBlindReviewPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'platform_admin',
        auth0Subject: 'auth0|platform_admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        isPlatformAdmin: true
      },
      {
        id: 'judge_a',
        auth0Subject: 'auth0|judge_a',
        email: 'judge-a@example.com',
        displayName: 'Judge A'
      },
      {
        id: 'team_admin',
        auth0Subject: 'auth0|team_admin',
        email: 'team-admin@example.com',
        displayName: 'Team Admin'
      }
    ])

    await harness.database.insert(events).values({
      id: 'event_insufficient_judges',
      eventType: 'hackathon',
      name: 'Insufficient Judges Event',
      slug: 'insufficient-judges-event',
      description: 'Judging preparation',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-18T12:00:00.000Z',
      registrationClosesAt: '2026-03-19T12:00:00.000Z',
      submissionOpensAt: '2026-03-19T12:00:00.000Z',
      submissionClosesAt: '2026-03-21T12:00:00.000Z',
      state: 'judging_preparation',
      blindReviewCount: 2,
      pitchReviewEnabled: false,
      blindScoreWeightPercent: 100,
      pitchScoreWeightPercent: 0,
      maxTeamMembers: 5,
      createdByUserId: 'platform_admin'
    })

    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_judge_a',
      eventId: 'event_insufficient_judges',
      userId: 'judge_a',
      role: 'judge',
      isInJudgePool: true,
      createdAt: '2026-03-22T12:00:00.000Z'
    })

    await harness.database.insert(teams).values({
      id: 'team_1',
      eventId: 'event_insufficient_judges',
      name: 'Alpha Team',
      slug: 'alpha-team',
      isOpenToJoinRequests: false,
      createdByUserId: 'team_admin',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z'
    })

    await harness.database.insert(teamMembers).values({
      id: 'membership_admin',
      teamId: 'team_1',
      userId: 'team_admin',
      role: 'admin',
      joinedAt: '2026-03-22T12:00:00.000Z',
      createdAt: '2026-03-22T12:00:00.000Z'
    })

    await harness.database.insert(submissions).values({
      id: 'submission_1',
      teamId: 'team_1',
      status: 'submitted',
      projectName: 'Project One',
      submittedAt: '2026-03-24T12:00:00.000Z',
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-24T12:00:00.000Z'
    })

    const response = await harness.request('/api/events/event_insufficient_judges/actions/start-blind-review', {
      method: 'POST'
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'distinct_blind_review_judges_required'
      }
    })

    const storedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_insufficient_judges')
    })
    const storedSubmission = await harness.database.query.submissions.findFirst({
      where: eq(submissions.id, 'submission_1')
    })
    const assignmentRows = await harness.database.select().from(judgeAssignments)

    expect(storedEvent?.state).toBe('judging_preparation')
    expect(storedSubmission?.status).toBe('submitted')
    expect(assignmentRows).toHaveLength(0)
  })

  test('POST /api/events/:eventId/actions/start-blind-review locks submissions, snapshots members, creates assignments, and audits', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/start-blind-review',
          handler: startBlindReviewPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'platform_admin',
        auth0Subject: 'auth0|platform_admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        isPlatformAdmin: true
      },
      {
        id: 'judge_a',
        auth0Subject: 'auth0|judge_a',
        email: 'judge-a@example.com',
        displayName: 'Judge A'
      },
      {
        id: 'team_admin',
        auth0Subject: 'auth0|team_admin',
        email: 'team-admin@example.com',
        displayName: 'Team Admin'
      }
    ])

    await harness.database.insert(events).values({
      id: 'event_blind_review',
      eventType: 'hackathon',
      name: 'Blind Review Event',
      slug: 'blind-review-event',
      description: 'Blind review',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'judging_preparation',
      blindReviewCount: 1,
      maxTeamMembers: 5,
      createdByUserId: 'platform_admin'
    })

    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_judge_a',
      eventId: 'event_blind_review',
      userId: 'judge_a',
      role: 'judge',
      isInJudgePool: true,
      createdAt: '2026-03-25T12:15:00.000Z'
    })

    await harness.database.insert(teams).values({
      id: 'team_1',
      eventId: 'event_blind_review',
      name: 'Alpha Team',
      slug: 'alpha-team',
      isOpenToJoinRequests: false,
      createdByUserId: 'team_admin',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z'
    })

    await harness.database.insert(teamMembers).values({
      id: 'membership_admin',
      teamId: 'team_1',
      userId: 'team_admin',
      role: 'admin',
      joinedAt: '2026-03-22T12:00:00.000Z',
      createdAt: '2026-03-22T12:00:00.000Z'
    })

    await harness.database.insert(submissions).values({
      id: 'submission_1',
      teamId: 'team_1',
      status: 'submitted',
      projectName: 'Project One',
      submittedAt: '2026-03-24T12:00:00.000Z',
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-24T12:00:00.000Z'
    })

    const response = await harness.request('/api/events/event_blind_review/actions/start-blind-review', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'event_blind_review',
        state: 'blind_review'
      }
    })

    const updatedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_blind_review')
    })
    const storedSubmission = await harness.database.query.submissions.findFirst({
      where: eq(submissions.id, 'submission_1')
    })
    const snapshotRows = await harness.database.select().from(prizeEligibilitySnapshots)
    const assignmentRows = await harness.database.select().from(judgeAssignments)
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(updatedEvent?.state).toBe('blind_review')
    expect(storedSubmission?.status).toBe('locked')
    expect(storedSubmission?.lockedAt).toBeTruthy()
    expect(snapshotRows).toHaveLength(1)
    expect(assignmentRows).toEqual([
      expect.objectContaining({
        submissionId: 'submission_1',
        judgeUserId: 'judge_a',
        reviewStage: 'blind_review',
        blindReviewSlot: 1,
        status: 'assigned'
      })
    ])
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorUserId: 'platform_admin',
        entityType: 'event',
        entityId: 'event_blind_review',
        action: 'event.start_blind_review'
      })
    ])
  })

  test('POST /api/events/:eventId/actions/start-blind-review chunks bulk inserts to stay within D1 bind limits', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/start-blind-review',
          handler: startBlindReviewPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    const participantCount = 17

    await harness.database.insert(users).values([
      {
        id: 'platform_admin',
        auth0Subject: 'auth0|platform_admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        isPlatformAdmin: true
      },
      {
        id: 'judge_a',
        auth0Subject: 'auth0|judge_a',
        email: 'judge-a@example.com',
        displayName: 'Judge A'
      },
      ...Array.from({ length: participantCount }, (_, index) => ({
        id: `team_admin_${index + 1}`,
        auth0Subject: `auth0|team_admin_${index + 1}`,
        email: `team-admin-${index + 1}@example.com`,
        displayName: `Team Admin ${index + 1}`
      }))
    ])

    await harness.database.insert(events).values({
      id: 'event_blind_review_large',
      eventType: 'hackathon',
      name: 'Blind Review Large Event',
      slug: 'blind-review-large-event',
      description: 'Blind review',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'judging_preparation',
      blindReviewCount: 1,
      maxTeamMembers: 5,
      createdByUserId: 'platform_admin'
    })

    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_judge_a',
      eventId: 'event_blind_review_large',
      userId: 'judge_a',
      role: 'judge',
      isInJudgePool: true,
      createdAt: '2026-03-25T12:15:00.000Z'
    })

    await harness.database.insert(teams).values(
      Array.from({ length: participantCount }, (_, index) => ({
        id: `team_${index + 1}`,
        eventId: 'event_blind_review_large',
        name: `Team ${index + 1}`,
        slug: `team-${index + 1}`,
        isOpenToJoinRequests: false,
        createdByUserId: `team_admin_${index + 1}`,
        createdAt: `2026-03-22T${String(index).padStart(2, '0')}:00:00.000Z`,
        updatedAt: `2026-03-22T${String(index).padStart(2, '0')}:00:00.000Z`
      }))
    )

    await harness.database.insert(teamMembers).values(
      Array.from({ length: participantCount }, (_, index) => ({
        id: `membership_${index + 1}`,
        teamId: `team_${index + 1}`,
        userId: `team_admin_${index + 1}`,
        role: 'admin' as const,
        joinedAt: `2026-03-22T${String(index).padStart(2, '0')}:00:00.000Z`,
        createdAt: `2026-03-22T${String(index).padStart(2, '0')}:00:00.000Z`
      }))
    )

    await harness.database.insert(submissions).values(
      Array.from({ length: participantCount }, (_, index) => ({
        id: `submission_${index + 1}`,
        teamId: `team_${index + 1}`,
        status: 'submitted' as const,
        projectName: `Project ${index + 1}`,
        submittedAt: `2026-03-24T${String(index).padStart(2, '0')}:00:00.000Z`,
        createdAt: `2026-03-24T${String(index).padStart(2, '0')}:00:00.000Z`,
        updatedAt: `2026-03-24T${String(index).padStart(2, '0')}:00:00.000Z`
      }))
    )

    enforceD1BindParameterLimit(harness)

    const response = await harness.request('/api/events/event_blind_review_large/actions/start-blind-review', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'event_blind_review_large',
        state: 'blind_review'
      }
    })

    const updatedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_blind_review_large')
    })
    const storedSubmissions = await harness.database.select().from(submissions)
    const snapshotRows = await harness.database.select().from(prizeEligibilitySnapshots)
    const assignmentRows = await harness.database.select().from(judgeAssignments)
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(updatedEvent?.state).toBe('blind_review')
    expect(storedSubmissions.every(submission => submission.status === 'locked')).toBe(true)
    expect(snapshotRows).toHaveLength(participantCount)
    expect(assignmentRows).toHaveLength(participantCount)
    expect(assignmentRows.every(row => row.reviewStage === 'blind_review')).toBe(true)
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorUserId: 'platform_admin',
        entityType: 'event',
        entityId: 'event_blind_review_large',
        action: 'event.start_blind_review'
      })
    ])
  })

  test('POST /api/events/:eventId/actions/start-pitch opens the live pitch stage, locks submitted work, and avoids judge assignments in pitch-only events', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/start-pitch',
          handler: startPitchPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'platform_admin',
        auth0Subject: 'auth0|platform_admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        isPlatformAdmin: true
      },
      {
        id: 'judge_a',
        auth0Subject: 'auth0|judge_a',
        email: 'judge-a@example.com',
        displayName: 'Judge A'
      },
      {
        id: 'judge_b',
        auth0Subject: 'auth0|judge_b',
        email: 'judge-b@example.com',
        displayName: 'Judge B'
      },
      {
        id: 'team_admin_one',
        auth0Subject: 'auth0|team_admin_one',
        email: 'team-admin-one@example.com',
        displayName: 'Team Admin One'
      },
      {
        id: 'team_admin_two',
        auth0Subject: 'auth0|team_admin_two',
        email: 'team-admin-two@example.com',
        displayName: 'Team Admin Two'
      }
    ])

    await harness.database.insert(events).values({
      id: 'event_pitch_only',
      eventType: 'hackathon',
      name: 'Pitch Only Event',
      slug: 'pitch-only-event',
      description: 'Pitch only',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'judging_preparation',
      blindReviewCount: 0,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 0,
      pitchScoreWeightPercent: 100,
      maxTeamMembers: 5,
      createdByUserId: 'platform_admin'
    })

    await harness.database.insert(eventRoleAssignments).values([
      {
        id: 'role_judge_a',
        eventId: 'event_pitch_only',
        userId: 'judge_a',
        role: 'judge',
        isInJudgePool: true,
        createdAt: '2026-03-22T12:00:00.000Z'
      },
      {
        id: 'role_judge_b',
        eventId: 'event_pitch_only',
        userId: 'judge_b',
        role: 'judge',
        isInJudgePool: true,
        createdAt: '2026-03-22T12:01:00.000Z'
      }
    ])

    await harness.database.insert(teams).values([
      {
        id: 'team_pitch_1',
        eventId: 'event_pitch_only',
        name: 'Alpha Team',
        slug: 'alpha-team',
        isOpenToJoinRequests: false,
        createdByUserId: 'team_admin_one',
        createdAt: '2026-03-22T12:00:00.000Z',
        updatedAt: '2026-03-22T12:00:00.000Z'
      },
      {
        id: 'team_pitch_2',
        eventId: 'event_pitch_only',
        name: 'Beta Team',
        slug: 'beta-team',
        isOpenToJoinRequests: false,
        createdByUserId: 'team_admin_two',
        createdAt: '2026-03-22T12:01:00.000Z',
        updatedAt: '2026-03-22T12:01:00.000Z'
      }
    ])

    await harness.database.insert(teamMembers).values([
      {
        id: 'membership_pitch_1',
        teamId: 'team_pitch_1',
        userId: 'team_admin_one',
        role: 'admin',
        joinedAt: '2026-03-22T12:00:00.000Z',
        createdAt: '2026-03-22T12:00:00.000Z'
      },
      {
        id: 'membership_pitch_2',
        teamId: 'team_pitch_2',
        userId: 'team_admin_two',
        role: 'admin',
        joinedAt: '2026-03-22T12:01:00.000Z',
        createdAt: '2026-03-22T12:01:00.000Z'
      }
    ])

    await harness.database.insert(submissions).values([
      {
        id: 'submission_pitch_1',
        teamId: 'team_pitch_1',
        status: 'submitted',
        projectName: 'Project One',
        submittedAt: '2026-03-24T12:00:00.000Z',
        createdAt: '2026-03-24T12:00:00.000Z',
        updatedAt: '2026-03-24T12:00:00.000Z'
      },
      {
        id: 'submission_pitch_2',
        teamId: 'team_pitch_2',
        status: 'submitted',
        projectName: 'Project Two',
        submittedAt: '2026-03-24T12:05:00.000Z',
        createdAt: '2026-03-24T12:05:00.000Z',
        updatedAt: '2026-03-24T12:05:00.000Z'
      }
    ])

    const response = await harness.request('/api/events/event_pitch_only/actions/start-pitch', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'event_pitch_only',
        state: 'pitch',
        pitchPresentationSubmissionIds: ['submission_pitch_1', 'submission_pitch_2'],
        activePitchPresentationSubmissionId: null,
        pitchPresentationsCompletedAt: null
      }
    })

    const updatedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_pitch_only')
    })
    const storedSubmissions = await harness.database.select().from(submissions)
    const snapshotRows = await harness.database.select().from(prizeEligibilitySnapshots)
    const assignmentRows = await harness.database.select().from(judgeAssignments)
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(updatedEvent?.state).toBe('pitch')
    expect(updatedEvent?.pitchFinalistSubmissionIdsJson).toBe(JSON.stringify(['submission_pitch_1', 'submission_pitch_2']))
    expect(updatedEvent?.activePitchPresentationSubmissionId).toBeNull()
    expect(updatedEvent?.pitchPresentationsCompletedAt).toBeNull()
    expect(storedSubmissions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'submission_pitch_1',
        status: 'locked'
      }),
      expect.objectContaining({
        id: 'submission_pitch_2',
        status: 'locked'
      })
    ]))
    expect(snapshotRows).toHaveLength(2)
    expect(assignmentRows).toHaveLength(0)
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorUserId: 'platform_admin',
        entityType: 'event',
        entityId: 'event_pitch_only',
        action: 'event.start_pitch'
      })
    ])
  })

  test('POST /api/events/:eventId/actions/advance-pitch-presentation steps through the live pitch lineup and completes it after the last team', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/advance-pitch-presentation',
          handler: advancePitchPresentationPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'platform_admin',
        auth0Subject: 'auth0|platform_admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        isPlatformAdmin: true
      },
      {
        id: 'team_admin_one',
        auth0Subject: 'auth0|team_admin_one',
        email: 'team-admin-one@example.com',
        displayName: 'Team Admin One'
      },
      {
        id: 'team_admin_two',
        auth0Subject: 'auth0|team_admin_two',
        email: 'team-admin-two@example.com',
        displayName: 'Team Admin Two'
      }
    ])

    await harness.database.insert(events).values({
      id: 'event_pitch_only',
      eventType: 'hackathon',
      name: 'Pitch Only Event',
      slug: 'pitch-only-event',
      description: 'Pitch only',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'pitch',
      blindReviewCount: 0,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 0,
      pitchScoreWeightPercent: 100,
      pitchFinalistSubmissionIdsJson: JSON.stringify(['submission_pitch_1', 'submission_pitch_2']),
      maxTeamMembers: 5,
      createdByUserId: 'platform_admin'
    })

    await harness.database.insert(teams).values([
      {
        id: 'team_pitch_1',
        eventId: 'event_pitch_only',
        name: 'Alpha Team',
        slug: 'alpha-team',
        isOpenToJoinRequests: false,
        createdByUserId: 'team_admin_one',
        createdAt: '2026-03-22T12:00:00.000Z',
        updatedAt: '2026-03-22T12:00:00.000Z'
      },
      {
        id: 'team_pitch_2',
        eventId: 'event_pitch_only',
        name: 'Beta Team',
        slug: 'beta-team',
        isOpenToJoinRequests: false,
        createdByUserId: 'team_admin_two',
        createdAt: '2026-03-22T12:01:00.000Z',
        updatedAt: '2026-03-22T12:01:00.000Z'
      }
    ])

    await harness.database.insert(submissions).values([
      {
        id: 'submission_pitch_1',
        teamId: 'team_pitch_1',
        status: 'locked',
        projectName: 'Project One',
        submittedAt: '2026-03-24T12:00:00.000Z',
        lockedAt: '2026-03-25T12:30:00.000Z',
        createdAt: '2026-03-24T12:00:00.000Z',
        updatedAt: '2026-03-25T12:30:00.000Z'
      },
      {
        id: 'submission_pitch_2',
        teamId: 'team_pitch_2',
        status: 'locked',
        projectName: 'Project Two',
        submittedAt: '2026-03-24T12:05:00.000Z',
        lockedAt: '2026-03-25T12:30:00.000Z',
        createdAt: '2026-03-24T12:05:00.000Z',
        updatedAt: '2026-03-25T12:30:00.000Z'
      }
    ])

    const firstResponse = await harness.request('/api/events/event_pitch_only/actions/advance-pitch-presentation', {
      method: 'POST'
    })

    expect(firstResponse.status).toBe(200)
    expect(await firstResponse.json()).toMatchObject({
      data: {
        activePitchPresentationSubmissionId: 'submission_pitch_1',
        pitchPresentationsCompletedAt: null
      }
    })

    const secondResponse = await harness.request('/api/events/event_pitch_only/actions/advance-pitch-presentation', {
      method: 'POST'
    })

    expect(secondResponse.status).toBe(200)
    expect(await secondResponse.json()).toMatchObject({
      data: {
        activePitchPresentationSubmissionId: 'submission_pitch_2',
        pitchPresentationsCompletedAt: null
      }
    })

    const finalResponse = await harness.request('/api/events/event_pitch_only/actions/advance-pitch-presentation', {
      method: 'POST'
    })

    expect(finalResponse.status).toBe(200)
    const finalPayload = await finalResponse.json()
    expect(finalPayload).toMatchObject({
      data: {
        activePitchPresentationSubmissionId: null
      }
    })
    expect(finalPayload.data.pitchPresentationsCompletedAt).toMatch(/2026-/)

    const updatedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_pitch_only')
    })
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(updatedEvent?.activePitchPresentationSubmissionId).toBeNull()
    expect(updatedEvent?.pitchPresentationsCompletedAt).toBeTruthy()
    expect(auditEntries.filter(entry => entry.action === 'event.advance_pitch_presentation')).toHaveLength(3)
  })

  test('POST /api/events/:eventId/actions/start-pitch-review rejects pitch-only events until the live lineup is completed', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/start-pitch-review',
          handler: startPitchReviewPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'platform_admin',
        auth0Subject: 'auth0|platform_admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        isPlatformAdmin: true
      },
      {
        id: 'judge_a',
        auth0Subject: 'auth0|judge_a',
        email: 'judge-a@example.com',
        displayName: 'Judge A'
      },
      {
        id: 'team_admin_one',
        auth0Subject: 'auth0|team_admin_one',
        email: 'team-admin-one@example.com',
        displayName: 'Team Admin One'
      }
    ])

    await harness.database.insert(events).values({
      id: 'event_pitch_only',
      eventType: 'hackathon',
      name: 'Pitch Only Event',
      slug: 'pitch-only-event',
      description: 'Pitch only',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'pitch',
      blindReviewCount: 0,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 0,
      pitchScoreWeightPercent: 100,
      pitchFinalistSubmissionIdsJson: JSON.stringify(['submission_pitch_1']),
      activePitchPresentationSubmissionId: 'submission_pitch_1',
      maxTeamMembers: 5,
      createdByUserId: 'platform_admin'
    })

    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_judge_a',
      eventId: 'event_pitch_only',
      userId: 'judge_a',
      role: 'judge',
      isInJudgePool: true,
      createdAt: '2026-03-22T12:00:00.000Z'
    })

    await harness.database.insert(teams).values({
      id: 'team_pitch_1',
      eventId: 'event_pitch_only',
      name: 'Alpha Team',
      slug: 'alpha-team',
      isOpenToJoinRequests: false,
      createdByUserId: 'team_admin_one',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z'
    })

    await harness.database.insert(submissions).values({
      id: 'submission_pitch_1',
      teamId: 'team_pitch_1',
      status: 'locked',
      projectName: 'Project One',
      submittedAt: '2026-03-24T12:00:00.000Z',
      lockedAt: '2026-03-25T12:30:00.000Z',
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-25T12:30:00.000Z'
    })

    const response = await harness.request('/api/events/event_pitch_only/actions/start-pitch-review', {
      method: 'POST'
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'pitch_presentations_incomplete'
      }
    })
  })

  test('POST /api/events/:eventId/actions/start-pitch-review creates pitch-panel assignments for every locked submission in pitch-only events after the live lineup is completed', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/start-pitch-review',
          handler: startPitchReviewPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'platform_admin',
        auth0Subject: 'auth0|platform_admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        isPlatformAdmin: true
      },
      {
        id: 'judge_a',
        auth0Subject: 'auth0|judge_a',
        email: 'judge-a@example.com',
        displayName: 'Judge A'
      },
      {
        id: 'judge_b',
        auth0Subject: 'auth0|judge_b',
        email: 'judge-b@example.com',
        displayName: 'Judge B'
      },
      {
        id: 'team_admin_one',
        auth0Subject: 'auth0|team_admin_one',
        email: 'team-admin-one@example.com',
        displayName: 'Team Admin One'
      },
      {
        id: 'team_admin_two',
        auth0Subject: 'auth0|team_admin_two',
        email: 'team-admin-two@example.com',
        displayName: 'Team Admin Two'
      }
    ])

    await harness.database.insert(events).values({
      id: 'event_pitch_only',
      eventType: 'hackathon',
      name: 'Pitch Only Event',
      slug: 'pitch-only-event',
      description: 'Pitch only',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'pitch',
      blindReviewCount: 0,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 0,
      pitchScoreWeightPercent: 100,
      pitchFinalistSubmissionIdsJson: JSON.stringify(['submission_pitch_1', 'submission_pitch_2']),
      pitchPresentationsCompletedAt: '2026-03-26T12:20:00.000Z',
      maxTeamMembers: 5,
      createdByUserId: 'platform_admin'
    })

    await harness.database.insert(eventRoleAssignments).values([
      {
        id: 'role_judge_a',
        eventId: 'event_pitch_only',
        userId: 'judge_a',
        role: 'judge',
        isInJudgePool: true,
        createdAt: '2026-03-22T12:00:00.000Z'
      },
      {
        id: 'role_judge_b',
        eventId: 'event_pitch_only',
        userId: 'judge_b',
        role: 'judge',
        isInJudgePool: true,
        createdAt: '2026-03-22T12:01:00.000Z'
      }
    ])

    await harness.database.insert(teams).values([
      {
        id: 'team_pitch_1',
        eventId: 'event_pitch_only',
        name: 'Alpha Team',
        slug: 'alpha-team',
        isOpenToJoinRequests: false,
        createdByUserId: 'team_admin_one',
        createdAt: '2026-03-22T12:00:00.000Z',
        updatedAt: '2026-03-22T12:00:00.000Z'
      },
      {
        id: 'team_pitch_2',
        eventId: 'event_pitch_only',
        name: 'Beta Team',
        slug: 'beta-team',
        isOpenToJoinRequests: false,
        createdByUserId: 'team_admin_two',
        createdAt: '2026-03-22T12:01:00.000Z',
        updatedAt: '2026-03-22T12:01:00.000Z'
      }
    ])

    await harness.database.insert(submissions).values([
      {
        id: 'submission_pitch_1',
        teamId: 'team_pitch_1',
        status: 'locked',
        projectName: 'Project One',
        submittedAt: '2026-03-24T12:00:00.000Z',
        lockedAt: '2026-03-25T12:30:00.000Z',
        createdAt: '2026-03-24T12:00:00.000Z',
        updatedAt: '2026-03-25T12:30:00.000Z'
      },
      {
        id: 'submission_pitch_2',
        teamId: 'team_pitch_2',
        status: 'locked',
        projectName: 'Project Two',
        submittedAt: '2026-03-24T12:05:00.000Z',
        lockedAt: '2026-03-25T12:30:00.000Z',
        createdAt: '2026-03-24T12:05:00.000Z',
        updatedAt: '2026-03-25T12:30:00.000Z'
      }
    ])

    const response = await harness.request('/api/events/event_pitch_only/actions/start-pitch-review', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'event_pitch_only',
        state: 'pitch_review'
      }
    })

    const updatedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_pitch_only')
    })
    const assignmentRows = await harness.database.select().from(judgeAssignments)
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(updatedEvent?.state).toBe('pitch_review')
    expect(assignmentRows).toHaveLength(4)
    expect(assignmentRows.every(row => row.reviewStage === 'pitch_review')).toBe(true)
    expect(assignmentRows.every(row => row.blindReviewSlot === null)).toBe(true)
    expect(new Set(assignmentRows.map(row => row.submissionId))).toEqual(new Set(['submission_pitch_1', 'submission_pitch_2']))
    expect(new Set(assignmentRows.map(row => row.judgeUserId))).toEqual(new Set(['judge_a', 'judge_b']))
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorUserId: 'platform_admin',
        entityType: 'event',
        entityId: 'event_pitch_only',
        action: 'event.start_pitch_review'
      })
    ])
  })

  test('POST /api/events/:eventId/actions/start-pitch-review chunks bulk inserts to stay within D1 bind limits', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/start-pitch-review',
          handler: startPitchReviewPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    const finalistCount = 12
    const finalistSubmissionIds = Array.from({ length: finalistCount }, (_, index) => `submission_pitch_${index + 1}`)

    await harness.database.insert(users).values([
      {
        id: 'platform_admin',
        auth0Subject: 'auth0|platform_admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        isPlatformAdmin: true
      },
      {
        id: 'judge_a',
        auth0Subject: 'auth0|judge_a',
        email: 'judge-a@example.com',
        displayName: 'Judge A'
      },
      ...Array.from({ length: finalistCount }, (_, index) => ({
        id: `team_admin_pitch_${index + 1}`,
        auth0Subject: `auth0|team_admin_pitch_${index + 1}`,
        email: `team-admin-pitch-${index + 1}@example.com`,
        displayName: `Pitch Team Admin ${index + 1}`
      }))
    ])

    await harness.database.insert(events).values({
      id: 'event_pitch_review_large',
      eventType: 'hackathon',
      name: 'Pitch Review Large Event',
      slug: 'pitch-review-large-event',
      description: 'Pitch review',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'pitch',
      blindReviewCount: 0,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 0,
      pitchScoreWeightPercent: 100,
      pitchFinalistSubmissionIdsJson: JSON.stringify(finalistSubmissionIds),
      pitchPresentationsCompletedAt: '2026-03-26T12:20:00.000Z',
      maxTeamMembers: 5,
      createdByUserId: 'platform_admin'
    })

    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_judge_a',
      eventId: 'event_pitch_review_large',
      userId: 'judge_a',
      role: 'judge',
      isInJudgePool: true,
      createdAt: '2026-03-22T12:00:00.000Z'
    })

    await harness.database.insert(teams).values(
      Array.from({ length: finalistCount }, (_, index) => ({
        id: `team_pitch_${index + 1}`,
        eventId: 'event_pitch_review_large',
        name: `Pitch Team ${index + 1}`,
        slug: `pitch-team-${index + 1}`,
        isOpenToJoinRequests: false,
        createdByUserId: `team_admin_pitch_${index + 1}`,
        createdAt: `2026-03-22T${String(index).padStart(2, '0')}:00:00.000Z`,
        updatedAt: `2026-03-22T${String(index).padStart(2, '0')}:00:00.000Z`
      }))
    )

    await harness.database.insert(submissions).values(
      Array.from({ length: finalistCount }, (_, index) => ({
        id: finalistSubmissionIds[index]!,
        teamId: `team_pitch_${index + 1}`,
        status: 'locked' as const,
        projectName: `Pitch Project ${index + 1}`,
        submittedAt: `2026-03-24T${String(index).padStart(2, '0')}:00:00.000Z`,
        lockedAt: '2026-03-25T12:30:00.000Z',
        createdAt: `2026-03-24T${String(index).padStart(2, '0')}:00:00.000Z`,
        updatedAt: '2026-03-25T12:30:00.000Z'
      }))
    )

    enforceD1BindParameterLimit(harness)

    const response = await harness.request('/api/events/event_pitch_review_large/actions/start-pitch-review', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'event_pitch_review_large',
        state: 'pitch_review'
      }
    })

    const updatedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_pitch_review_large')
    })
    const assignmentRows = await harness.database.select().from(judgeAssignments)
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(updatedEvent?.state).toBe('pitch_review')
    expect(assignmentRows).toHaveLength(finalistCount)
    expect(assignmentRows.every(row => row.reviewStage === 'pitch_review')).toBe(true)
    expect(new Set(assignmentRows.map(row => row.submissionId))).toEqual(new Set(finalistSubmissionIds))
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorUserId: 'platform_admin',
        entityType: 'event',
        entityId: 'event_pitch_review_large',
        action: 'event.start_pitch_review'
      })
    ])
  })

  test('POST /api/events/:eventId/actions/start-pitch-review uses the persisted shortlist finalists for blind-plus-pitch events after pitch starts', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/actions/start-pitch-review',
          handler: startPitchReviewPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'platform_admin',
        auth0Subject: 'auth0|platform_admin',
        email: 'platform-admin@example.com',
        displayName: 'Platform Admin',
        isPlatformAdmin: true
      },
      {
        id: 'judge_a',
        auth0Subject: 'auth0|judge_a',
        email: 'judge-a@example.com',
        displayName: 'Judge A'
      },
      {
        id: 'judge_b',
        auth0Subject: 'auth0|judge_b',
        email: 'judge-b@example.com',
        displayName: 'Judge B'
      },
      {
        id: 'team_admin_one',
        auth0Subject: 'auth0|team_admin_one',
        email: 'team-admin-one@example.com',
        displayName: 'Team Admin One'
      },
      {
        id: 'team_admin_two',
        auth0Subject: 'auth0|team_admin_two',
        email: 'team-admin-two@example.com',
        displayName: 'Team Admin Two'
      },
      {
        id: 'team_admin_three',
        auth0Subject: 'auth0|team_admin_three',
        email: 'team-admin-three@example.com',
        displayName: 'Team Admin Three'
      }
    ])

    await harness.database.insert(events).values({
      id: 'event_blind_pitch',
      eventType: 'hackathon',
      name: 'Blind Plus Pitch Event',
      slug: 'blind-plus-pitch-event',
      description: 'Blind plus pitch',
      city: 'Vienna',
      country: 'Austria',
      address: 'Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'pitch',
      blindReviewCount: 1,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 70,
      pitchScoreWeightPercent: 30,
      pitchFinalistSubmissionIdsJson: JSON.stringify(['submission_pitch_finalist_2', 'submission_pitch_finalist_1']),
      pitchPresentationsCompletedAt: '2026-03-26T12:20:00.000Z',
      maxTeamMembers: 5,
      createdByUserId: 'platform_admin'
    })

    await harness.database.insert(eventRoleAssignments).values([
      {
        id: 'role_judge_a',
        eventId: 'event_blind_pitch',
        userId: 'judge_a',
        role: 'judge',
        isInJudgePool: true,
        createdAt: '2026-03-22T12:00:00.000Z'
      },
      {
        id: 'role_judge_b',
        eventId: 'event_blind_pitch',
        userId: 'judge_b',
        role: 'judge',
        isInJudgePool: true,
        createdAt: '2026-03-22T12:01:00.000Z'
      }
    ])

    await harness.database.insert(teams).values([
      {
        id: 'team_pitch_finalist_1',
        eventId: 'event_blind_pitch',
        name: 'Alpha Team',
        slug: 'alpha-team',
        isOpenToJoinRequests: false,
        createdByUserId: 'team_admin_one',
        createdAt: '2026-03-22T12:00:00.000Z',
        updatedAt: '2026-03-22T12:00:00.000Z'
      },
      {
        id: 'team_pitch_finalist_2',
        eventId: 'event_blind_pitch',
        name: 'Beta Team',
        slug: 'beta-team',
        isOpenToJoinRequests: false,
        createdByUserId: 'team_admin_two',
        createdAt: '2026-03-22T12:01:00.000Z',
        updatedAt: '2026-03-22T12:01:00.000Z'
      },
      {
        id: 'team_pitch_non_finalist',
        eventId: 'event_blind_pitch',
        name: 'Gamma Team',
        slug: 'gamma-team',
        isOpenToJoinRequests: false,
        createdByUserId: 'team_admin_three',
        createdAt: '2026-03-22T12:02:00.000Z',
        updatedAt: '2026-03-22T12:02:00.000Z'
      }
    ])

    await harness.database.insert(submissions).values([
      {
        id: 'submission_pitch_finalist_1',
        teamId: 'team_pitch_finalist_1',
        status: 'locked',
        projectName: 'Project One',
        submittedAt: '2026-03-24T12:00:00.000Z',
        lockedAt: '2026-03-25T12:30:00.000Z',
        createdAt: '2026-03-24T12:00:00.000Z',
        updatedAt: '2026-03-25T12:30:00.000Z'
      },
      {
        id: 'submission_pitch_finalist_2',
        teamId: 'team_pitch_finalist_2',
        status: 'locked',
        projectName: 'Project Two',
        submittedAt: '2026-03-24T12:05:00.000Z',
        lockedAt: '2026-03-25T12:30:00.000Z',
        createdAt: '2026-03-24T12:05:00.000Z',
        updatedAt: '2026-03-25T12:30:00.000Z'
      },
      {
        id: 'submission_pitch_non_finalist',
        teamId: 'team_pitch_non_finalist',
        status: 'locked',
        projectName: 'Project Three',
        submittedAt: '2026-03-24T12:10:00.000Z',
        lockedAt: '2026-03-25T12:30:00.000Z',
        createdAt: '2026-03-24T12:10:00.000Z',
        updatedAt: '2026-03-25T12:30:00.000Z'
      }
    ])

    const response = await harness.request('/api/events/event_blind_pitch/actions/start-pitch-review', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'event_blind_pitch',
        state: 'pitch_review'
      }
    })

    const assignmentRows = await harness.database.select().from(judgeAssignments)

    expect(assignmentRows).toHaveLength(4)
    expect(new Set(assignmentRows.map(row => row.submissionId))).toEqual(
      new Set(['submission_pitch_finalist_1', 'submission_pitch_finalist_2'])
    )
    expect(assignmentRows.some(row => row.submissionId === 'submission_pitch_non_finalist')).toBe(false)
    expect(assignmentRows.every(row => row.reviewStage === 'pitch_review')).toBe(true)
  })
})
