import { afterEach, describe, expect, test, vi } from 'vitest'

import { and, eq } from 'drizzle-orm'

import applicationsListHandler from '../../../../server/api/events/[eventId]/applications/index.get'
import applicationsPostHandler from '../../../../server/api/events/[eventId]/applications/index.post'
import ownApplicationHandler from '../../../../server/api/events/[eventId]/applications/me.get'
import selectOwnApplicationTrackHandler from '../../../../server/api/events/[eventId]/applications/me/actions/select-track.post'
import withdrawOwnApplicationHandler from '../../../../server/api/events/[eventId]/applications/me/actions/withdraw.post'
import verifyOwnApplicationLumaEmailHandler from '../../../../server/api/events/[eventId]/applications/me/actions/verify-luma-email.post'
import approveApplicationHandler from '../../../../server/api/events/[eventId]/applications/[applicationId]/actions/approve.post'
import adminWithdrawApplicationHandler from '../../../../server/api/events/[eventId]/applications/[applicationId]/actions/withdraw.post'
import undoApplicationWithdrawalHandler from '../../../../server/api/events/[eventId]/applications/[applicationId]/actions/undo-withdrawal.post'
import applyStagedDecisionsHandler from '../../../../server/api/events/[eventId]/applications/actions/apply-staged-decisions.post'
import rejectApplicationHandler from '../../../../server/api/events/[eventId]/applications/[applicationId]/actions/reject.post'
import {
  auditLogs,
  eventRoleAssignments,
  eventTermsDocuments,
  eventTracks,
  events,
  submissions,
  talkProposals,
  teamJoinRequests,
  teamMembers,
  teams,
  userApplications,
  users
} from '../../../../server/database/schema'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

const fixtureRegistrationOpensAt = '2020-03-20T12:00:00.000Z'
const fixtureRegistrationClosesAt = '2099-03-23T12:00:00.000Z'
const fixtureSubmissionOpensAt = '2099-03-23T12:00:00.000Z'
const fixtureSubmissionClosesAt = '2099-03-25T12:00:00.000Z'

function createQueueProducerStub(options?: {
  failSend?: boolean
}) {
  const send = vi.fn(async () => {
    if (options?.failSend) {
      throw new Error('queue unavailable')
    }
  })

  return {
    send
  }
}

async function seedApplicationContext(
  harness: ReturnType<typeof createApiRouteTestHarness>,
  options?: {
    requireGithubProfile?: boolean
    applicationChatgptEmailVisible?: boolean
    requireChatgptEmail?: boolean
    applicationOpenaiOrgIdVisible?: boolean
    requireOpenaiOrgId?: boolean
    applicationLumaEmailVisible?: boolean
    requireLumaEmail?: boolean
    applicationWhyThisEventVisible?: boolean
    requireWhyThisEvent?: boolean
    applicationProofOfExecutionVisible?: boolean
    requireProofOfExecution?: boolean
    applicationTeamIntentVisible?: boolean
    requireTeamIntent?: boolean
    applicationAiKnowledgeVisible?: boolean
    requireAiKnowledge?: boolean
    lumaEventUrl?: string | null
    lumaEventApiId?: string | null
    lumaApiKey?: string | null
    inPersonEvent?: boolean
    participantsLimit?: number | null
    autoApproveApplications?: boolean
    currentApplicationTerms?: boolean
  }
) {
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
      id: 'staff_user',
      auth0Subject: 'auth0|staff',
      email: 'staff@example.com',
      displayName: 'Staff User'
    },
    {
      id: 'regular_user',
      auth0Subject: 'auth0|regular_user',
      email: 'regular@example.com',
      displayName: 'Regular User',
      xProfileUrl: 'https://x.example/regular',
      githubProfileUrl: 'https://github.com/regular',
      chatgptEmail: 'regular@chatgpt.example',
      openaiOrgId: 'org_regular',
      lumaEmail: 'regular@luma.example',
      lumaUsername: 'bpirvu'
    },
    {
      id: 'missing_profile_user',
      auth0Subject: 'auth0|missing_profile',
      email: 'missing-profile@example.com',
      displayName: 'Missing Profile User'
    }
  ])

  await harness.database.insert(events).values({
    id: 'event_1',
    eventType: 'hackathon',
    name: 'Fixture Event',
    slug: 'fixture-event',
    description: 'Fixture event',
    city: 'Vienna',
    country: 'Austria',
    address: 'Fixture Address',
    registrationOpensAt: fixtureRegistrationOpensAt,
    registrationClosesAt: fixtureRegistrationClosesAt,
    submissionOpensAt: fixtureSubmissionOpensAt,
    submissionClosesAt: fixtureSubmissionClosesAt,
    state: 'registration_open',
    maxTeamMembers: 5,
    participantsLimit: options?.participantsLimit ?? null,
    autoApproveApplications: options?.autoApproveApplications ?? false,
    inPersonEvent: options?.inPersonEvent ?? false,
    applicationChatgptEmailVisible: options?.applicationChatgptEmailVisible ?? Boolean(options?.requireChatgptEmail),
    applicationOpenaiOrgIdVisible: options?.applicationOpenaiOrgIdVisible ?? Boolean(options?.requireOpenaiOrgId),
    applicationLumaEmailVisible: options?.applicationLumaEmailVisible ?? Boolean(options?.requireLumaEmail),
    applicationWhyThisEventVisible: options?.applicationWhyThisEventVisible ?? true,
    applicationProofOfExecutionVisible: options?.applicationProofOfExecutionVisible ?? true,
    applicationTeamIntentVisible: options?.applicationTeamIntentVisible ?? true,
    applicationAiKnowledgeVisible: options?.applicationAiKnowledgeVisible ?? Boolean(options?.requireAiKnowledge),
    requireGithubProfile: options?.requireGithubProfile ?? false,
    requireChatgptEmail: options?.requireChatgptEmail ?? false,
    requireOpenaiOrgId: options?.requireOpenaiOrgId ?? false,
    requireLumaEmail: options?.requireLumaEmail ?? false,
    requireWhyThisEvent: options?.requireWhyThisEvent ?? false,
    requireProofOfExecution: options?.requireProofOfExecution ?? false,
    requireTeamIntent: options?.requireTeamIntent ?? false,
    requireAiKnowledge: options?.requireAiKnowledge ?? false,
    lumaEventUrl: options?.lumaEventUrl ?? null,
    lumaEventApiId: options?.lumaEventApiId ?? null,
    lumaApiKey: options?.lumaEventApiId ? options?.lumaApiKey ?? 'luma_test_key' : null,
    lumaWebhookSecret: options?.lumaEventApiId ? 'whsec_test' : null,
    lumaWebhookStatus: options?.lumaEventApiId ? 'configured' : 'not_configured',
    currentApplicationTermsDocumentId: null,
    currentWinnerTermsDocumentId: null,
    createdByUserId: 'platform_admin'
  })

  await harness.database.insert(eventRoleAssignments).values([
    {
      id: 'role_event_admin',
      eventId: 'event_1',
      userId: 'event_admin',
      role: 'event_admin',
      isInJudgePool: false,
      isStaff: false,
      createdAt: '2026-03-22T12:00:00.000Z'
    },
    {
      id: 'role_staff',
      eventId: 'event_1',
      userId: 'staff_user',
      role: 'staff',
      isInJudgePool: false,
      isStaff: true,
      createdAt: '2026-03-22T12:01:00.000Z'
    }
  ])

  if (options?.currentApplicationTerms !== false) {
    await harness.database.insert(eventTermsDocuments).values([
      {
        id: 'terms_app_1',
        eventId: 'event_1',
        documentType: 'application_terms',
        version: 1,
        title: 'Application Terms v1',
        content: 'Application terms one',
        publishedAt: '2026-03-01T00:00:00.000Z'
      },
      {
        id: 'terms_app_2',
        eventId: 'event_1',
        documentType: 'application_terms',
        version: 2,
        title: 'Application Terms v2',
        content: 'Application terms two',
        publishedAt: '2026-03-02T00:00:00.000Z'
      }
    ])

    await harness.database
      .update(events)
      .set({
        currentApplicationTermsDocumentId: 'terms_app_2'
      })
      .where(eq(events.id, 'event_1'))
  }
}

async function insertWithdrawnApplication(
  harness: ReturnType<typeof createApiRouteTestHarness>,
  overrides: Partial<typeof userApplications.$inferInsert> = {}
) {
  await harness.database.insert(userApplications).values({
    id: 'application_1',
    eventId: 'event_1',
    userId: 'regular_user',
    status: 'withdrawn',
    preApprovalStatus: 'approved',
    lumaSyncStatus: 'reject_synced',
    submittedAt: '2026-03-22T12:10:00.000Z',
    withdrawnAt: '2026-03-23T12:00:00.000Z',
    checkedInAt: '2026-03-22T18:00:00.000Z',
    reviewedAt: '2026-03-22T12:20:00.000Z',
    reviewedByUserId: 'event_admin',
    applicationTermsDocumentId: 'terms_app_2',
    applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
    createdAt: '2026-03-22T12:10:00.000Z',
    updatedAt: '2026-03-23T12:00:00.000Z',
    ...overrides
  })
}

describe('TASK-3.6 application routes', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    vi.unstubAllGlobals()

    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  test('POST /api/events/:eventId/applications enforces current terms and records the submission', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    const missingTermsResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({})
    })

    expect(missingTermsResponse.status).toBe(409)
    expect(await missingTermsResponse.json()).toMatchObject({
      error: {
        code: 'application_terms_acceptance_required'
      }
    })

    const outdatedResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_1'
      })
    })

    expect(outdatedResponse.status).toBe(409)
    expect(await outdatedResponse.json()).toMatchObject({
      error: {
        code: 'application_terms_document_outdated'
      }
    })

    const successResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2',
        registrationTeamIntent: 'team',
        registrationTeamMembers: [
          {
            fullName: 'Ada Lovelace',
            email: 'ada@example.com'
          },
          {
            fullName: 'Grace Hopper',
            email: null
          }
        ],
        whyThisEvent: 'I want to build a practical project with other builders.',
        proofOfExecutionUrl: 'https://github.com/regular/previous-project, https://demo.example.com/regular/project'
      })
    })

    expect(successResponse.status).toBe(200)
    expect(await successResponse.json()).toMatchObject({
      data: {
        userId: 'regular_user',
        status: 'submitted',
        preApprovalStatus: null,
        applicationTermsDocumentId: 'terms_app_2',
        registrationDetailsJson: expect.any(String)
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: and(
        eq(userApplications.eventId, 'event_1'),
        eq(userApplications.userId, 'regular_user')
      )
    })

    expect(storedApplication).toMatchObject({
      status: 'submitted',
      applicationTermsDocumentId: 'terms_app_2',
      registrationDetailsJson: JSON.stringify({
        teamIntent: 'team',
        teamMembers: [
          {
            fullName: 'Ada Lovelace',
            email: 'ada@example.com'
          },
          {
            fullName: 'Grace Hopper'
          }
        ],
        inPersonAttendanceCommitment: false,
        whyThisEvent: 'I want to build a practical project with other builders.',
        proofOfExecutionUrl: 'https://github.com/regular/previous-project, https://demo.example.com/regular/project',
        aiKnowledgeLevel: ''
      })
    })
  })

  test('POST /api/events/:eventId/applications allows submission without event application terms', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      currentApplicationTerms: false
    })

    const successResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        registrationTeamIntent: 'solo'
      })
    })

    expect(successResponse.status).toBe(200)
    expect(await successResponse.json()).toMatchObject({
      data: {
        userId: 'regular_user',
        status: 'submitted',
        applicationTermsDocumentId: null,
        applicationTermsAcceptedAt: null
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: and(
        eq(userApplications.eventId, 'event_1'),
        eq(userApplications.userId, 'regular_user')
      )
    })

    expect(storedApplication).toMatchObject({
      status: 'submitted',
      applicationTermsDocumentId: null,
      applicationTermsAcceptedAt: null
    })
  })

  test('POST /api/events/:eventId/applications atomically submits registration and a Talk proposal', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      currentApplicationTerms: false
    })
    await harness.database.update(events).set({
      eventType: 'meetup',
      submissionOpensAt: null,
      submissionClosesAt: null,
      talkProposalsEnabled: true,
      talkProposalOpensAt: fixtureRegistrationOpensAt,
      talkProposalClosesAt: fixtureRegistrationClosesAt,
      talkProposalQuestionsJson: JSON.stringify([
        {
          id: 'audience',
          type: 'short_text',
          prompt: 'Who is this talk for?',
          required: true,
          options: []
        },
        {
          id: 'recording',
          type: 'acknowledgement',
          prompt: 'I agree to recording.',
          required: true,
          options: []
        }
      ]),
      talkProposalQuestionsRevision: 3
    }).where(eq(events.id, 'event_1'))

    const invalidResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        registrationTeamIntent: 'solo',
        talkProposal: {
          title: 'Reliable agent demos',
          abstract: 'How to build a demo that survives a live audience.',
          demoOrSlidesUrl: '',
          questionSetRevision: 3,
          answers: [
            { questionId: 'audience', value: '' },
            { questionId: 'recording', value: false }
          ]
        }
      })
    })

    expect(invalidResponse.status).toBe(422)
    expect(await invalidResponse.json()).toMatchObject({
      error: {
        code: 'talk_proposal_answers_invalid'
      }
    })
    expect(await harness.database.select().from(userApplications)).toEqual([])
    expect(await harness.database.select().from(talkProposals)).toEqual([])

    const successResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        registrationTeamIntent: 'solo',
        talkProposal: {
          title: 'Reliable agent demos',
          abstract: 'How to build a demo that survives a live audience.',
          demoOrSlidesUrl: 'https://example.com/slides',
          questionSetRevision: 3,
          answers: [
            { questionId: 'audience', value: 'Agent builders' },
            { questionId: 'recording', value: true }
          ]
        }
      })
    })

    const successPayload = await successResponse.json()
    expect({ status: successResponse.status, payload: successPayload }).toMatchObject({
      status: 200,
      payload: {
        data: {
          userId: 'regular_user',
          status: 'submitted'
        }
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: and(
        eq(userApplications.eventId, 'event_1'),
        eq(userApplications.userId, 'regular_user')
      )
    })
    const storedProposal = await harness.database.query.talkProposals.findFirst({
      where: and(
        eq(talkProposals.eventId, 'event_1'),
        eq(talkProposals.userId, 'regular_user')
      )
    })

    expect(storedApplication).toMatchObject({ status: 'submitted' })
    expect(storedProposal).toMatchObject({
      status: 'submitted',
      title: 'Reliable agent demos',
      abstract: 'How to build a demo that survives a live audience.',
      demoOrSlidesUrl: 'https://example.com/slides',
      questionSetRevision: 3,
      answersJson: JSON.stringify([
        { questionId: 'audience', value: 'Agent builders' },
        { questionId: 'recording', value: true }
      ]),
      submittedAt: expect.any(String)
    })

    const proposalAuditActions = (await harness.database.select().from(auditLogs))
      .filter(row => row.entityId === storedProposal?.id)
      .map(row => row.action)
    expect(proposalAuditActions).toEqual(expect.arrayContaining([
      'talk_proposal.created',
      'talk_proposal.submitted'
    ]))
  })

  test('event organizers with admin access elsewhere can apply to unrelated events as participants', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/applications', handler: applicationsListHandler },
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|event_organizer',
        email: 'organizer@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(users).values({
      id: 'event_organizer',
      auth0Subject: 'auth0|event_organizer',
      email: 'organizer@example.com',
      displayName: 'Event Organizer',
      isEventOrganizer: true
    })
    await harness.database.insert(events).values({
      id: 'managed_event',
      eventType: 'build',
      name: 'Managed Event',
      slug: 'managed-event',
      description: 'Managed by the organizer',
      city: 'Vienna',
      country: 'Austria',
      address: 'Managed Address',
      registrationOpensAt: fixtureRegistrationOpensAt,
      registrationClosesAt: fixtureRegistrationClosesAt,
      submissionOpensAt: null,
      submissionClosesAt: null,
      state: 'draft',
      maxTeamMembers: 1,
      createdByUserId: 'event_organizer'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_event_organizer_managed_event',
      eventId: 'managed_event',
      userId: 'event_organizer',
      role: 'event_admin',
      isInJudgePool: false,
      isStaff: false,
      createdAt: '2026-03-22T12:02:00.000Z'
    })

    const adminListResponse = await harness.request('/api/events/event_1/applications')
    expect(adminListResponse.status).toBe(403)
    expect(await adminListResponse.json()).toMatchObject({
      error: {
        code: 'event_participant_visibility_required'
      }
    })

    const applicationResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })
    expect(applicationResponse.status).toBe(200)
    expect(await applicationResponse.json()).toMatchObject({
      data: {
        eventId: 'event_1',
        userId: 'event_organizer',
        status: 'submitted'
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: and(
        eq(userApplications.eventId, 'event_1'),
        eq(userApplications.userId, 'event_organizer')
      )
    })

    expect(storedApplication).toMatchObject({
      eventId: 'event_1',
      userId: 'event_organizer',
      status: 'submitted'
    })
  })

  test('POST /api/events/:eventId/applications auto-approves when configured and enqueues approval side effects', async () => {
    const reviewEmailQueueProducer = createQueueProducerStub()
    const lumaQueueProducer = createQueueProducerStub()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      },
      cloudflareEnv: {
        APPLICATION_REVIEW_EMAIL_QUEUE: reviewEmailQueueProducer,
        APPLICATION_LUMA_SYNC_QUEUE: lumaQueueProducer
      },
      runtimeConfig: {
        applicationReviewEmails: {
          queueBinding: 'APPLICATION_REVIEW_EMAIL_QUEUE'
        },
        luma: {
          queueBinding: 'APPLICATION_LUMA_SYNC_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      autoApproveApplications: true,
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123'
    })

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/v1/event/get-guest') {
        return new Response(JSON.stringify({
          guest: {
            id: 'gst-123',
            user_email: 'regular@luma.example'
          }
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        })
      }

      throw new Error(`Unexpected fetch URL: ${url.toString()}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      data: {
        userId: 'regular_user',
        status: 'approved',
        preApprovalStatus: null,
        reviewedAt: expect.any(String),
        reviewedByUserId: null,
        lumaSyncStatus: 'not_synced'
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: and(
        eq(userApplications.eventId, 'event_1'),
        eq(userApplications.userId, 'regular_user')
      )
    })

    expect(storedApplication).toMatchObject({
      status: 'approved',
      preApprovalStatus: null,
      reviewedAt: storedApplication?.submittedAt,
      reviewedByUserId: null,
      lumaSyncStatus: 'not_synced'
    })

    expect(reviewEmailQueueProducer.send).toHaveBeenCalledTimes(1)
    expect(reviewEmailQueueProducer.send).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: storedApplication?.id,
      decision: 'approved',
      recipientEmail: 'regular@example.com',
      eventName: 'Fixture Event',
      eventSlug: 'fixture-event'
    }), {
      contentType: 'json'
    })
    expect(lumaQueueProducer.send).toHaveBeenCalledTimes(1)
    expect(lumaQueueProducer.send).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: storedApplication?.id,
      decision: 'approved'
    }), {
      contentType: 'json'
    })

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorUserId: null,
        entityType: 'user_application',
        entityId: storedApplication?.id,
        action: 'user_application.approved',
        metadata: expect.objectContaining({
          reviewSource: 'auto_approval'
        })
      }),
      expect.objectContaining({
        actorUserId: null,
        entityType: 'user_application',
        entityId: storedApplication?.id,
        action: 'user_application.review_email_enqueued',
        metadata: expect.objectContaining({
          decision: 'approved',
          reviewSource: 'auto_approval',
          enqueue: expect.objectContaining({
            status: 'enqueued'
          })
        })
      }),
      expect.objectContaining({
        actorUserId: null,
        entityType: 'user_application',
        entityId: storedApplication?.id,
        action: 'user_application.luma_sync_enqueued',
        metadata: expect.objectContaining({
          decision: 'approved',
          reviewSource: 'auto_approval',
          enqueue: expect.objectContaining({
            status: 'enqueued'
          })
        })
      })
    ]))
  })

  test('POST /api/events/:eventId/applications auto-approves while the participant limit still has capacity', async () => {
    const queueProducer = createQueueProducerStub()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      },
      cloudflareEnv: {
        APPLICATION_REVIEW_EMAIL_QUEUE: queueProducer
      },
      runtimeConfig: {
        applicationReviewEmails: {
          queueBinding: 'APPLICATION_REVIEW_EMAIL_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      autoApproveApplications: true,
      participantsLimit: 2
    })
    await harness.database.insert(userApplications).values({
      id: 'application_existing_approved',
      eventId: 'event_1',
      userId: 'staff_user',
      status: 'approved',
      submittedAt: '2026-03-22T12:00:00.000Z',
      reviewedAt: '2026-03-22T12:00:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:00:00.000Z',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        userId: 'regular_user',
        status: 'approved',
        preApprovalStatus: null,
        reviewedAt: expect.any(String),
        reviewedByUserId: null
      }
    })

    expect(queueProducer.send).toHaveBeenCalledTimes(1)
  })

  test('POST /api/events/:eventId/applications leaves applicants submitted after auto approval reaches the participant limit', async () => {
    const queueProducer = createQueueProducerStub()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      },
      cloudflareEnv: {
        APPLICATION_REVIEW_EMAIL_QUEUE: queueProducer
      },
      runtimeConfig: {
        applicationReviewEmails: {
          queueBinding: 'APPLICATION_REVIEW_EMAIL_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      autoApproveApplications: true,
      participantsLimit: 1
    })
    await harness.database.insert(userApplications).values({
      id: 'application_existing_approved',
      eventId: 'event_1',
      userId: 'staff_user',
      status: 'approved',
      submittedAt: '2026-03-22T12:00:00.000Z',
      reviewedAt: '2026-03-22T12:00:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:00:00.000Z',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        userId: 'regular_user',
        status: 'submitted',
        preApprovalStatus: null,
        reviewedAt: null,
        reviewedByUserId: null
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: and(
        eq(userApplications.eventId, 'event_1'),
        eq(userApplications.userId, 'regular_user')
      )
    })

    expect(storedApplication).toMatchObject({
      status: 'submitted',
      reviewedAt: null,
      reviewedByUserId: null
    })
    expect(queueProducer.send).toHaveBeenCalledTimes(0)
  })

  test('POST /api/events/:eventId/applications requires in-person attendance commitment when configured', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      inPersonEvent: true
    })

    const missingCommitmentResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })

    expect(missingCommitmentResponse.status).toBe(409)
    expect(await missingCommitmentResponse.json()).toMatchObject({
      error: {
        code: 'in_person_attendance_commitment_required'
      }
    })

    const committedResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2',
        inPersonAttendanceCommitment: true
      })
    })

    expect(committedResponse.status).toBe(200)

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: and(
        eq(userApplications.eventId, 'event_1'),
        eq(userApplications.userId, 'regular_user')
      )
    })

    expect(storedApplication?.registrationDetailsJson).toBe(JSON.stringify({
      teamIntent: 'unknown',
      teamMembers: [],
      inPersonAttendanceCommitment: true,
      whyThisEvent: '',
      proofOfExecutionUrl: '',
      aiKnowledgeLevel: ''
    }))
  })

  test('POST /api/events/:eventId/applications enforces why-this-event and proof-of-execution requirements when configured', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireWhyThisEvent: true,
      requireProofOfExecution: true
    })

    const missingResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })

    expect(missingResponse.status).toBe(409)
    expect(await missingResponse.json()).toMatchObject({
      error: {
        code: 'why_this_event_required'
      }
    })

    const missingProofResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2',
        whyThisEvent: 'I want to collaborate and build.'
      })
    })

    expect(missingProofResponse.status).toBe(409)
    expect(await missingProofResponse.json()).toMatchObject({
      error: {
        code: 'proof_of_execution_required'
      }
    })

    const successResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2',
        whyThisEvent: 'I want to collaborate and build.',
        proofOfExecutionUrl: 'https://github.com/regular/shipped-work, https://demo.example.com/regular/work'
      })
    })

    expect(successResponse.status).toBe(200)

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: and(
        eq(userApplications.eventId, 'event_1'),
        eq(userApplications.userId, 'regular_user')
      )
    })

    expect(storedApplication?.registrationDetailsJson).toBe(JSON.stringify({
      teamIntent: 'unknown',
      teamMembers: [],
      inPersonAttendanceCommitment: false,
      whyThisEvent: 'I want to collaborate and build.',
      proofOfExecutionUrl: 'https://github.com/regular/shipped-work, https://demo.example.com/regular/work',
      aiKnowledgeLevel: ''
    }))
  })

  test('POST /api/events/:eventId/applications rejects invalid proof-of-execution links', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    const response = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2',
        proofOfExecutionUrl: 'https://github.com/regular/work, ftp://example.com/work'
      })
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'proof_of_execution_url_invalid'
      }
    })
  })

  test('POST /api/events/:eventId/applications enforces required AI Knowledge when configured', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireAiKnowledge: true
    })

    const missingResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })

    expect(missingResponse.status).toBe(409)
    expect(await missingResponse.json()).toMatchObject({
      error: {
        code: 'ai_knowledge_level_required'
      }
    })

    const successResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2',
        aiKnowledgeLevel: 'beginner'
      })
    })

    expect(successResponse.status).toBe(200)

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: and(
        eq(userApplications.eventId, 'event_1'),
        eq(userApplications.userId, 'regular_user')
      )
    })

    expect(JSON.parse(storedApplication?.registrationDetailsJson ?? '{}')).toMatchObject({
      aiKnowledgeLevel: 'beginner'
    })
  })

  test('POST /api/events/:eventId/applications refuses a track in a Build registration', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)
    await harness.database
      .update(events)
      .set({
        eventType: 'build',
        maxTeamMembers: 1,
        submissionOpensAt: null,
        submissionClosesAt: null
      })
      .where(eq(events.id, 'event_1'))

    // Only Hackathons have tracks. A Build participant chooses an open track or challenge later.
    const response = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2',
        selectedTrackId: 'track_agents'
      })
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: { code: 'event_track_invalid' } })
    expect(await harness.database.query.userApplications.findFirst({
      where: and(eq(userApplications.eventId, 'event_1'), eq(userApplications.userId, 'regular_user'))
    })).toBeUndefined()
  })

  test('POST /api/events/:eventId/applications asks the AI Knowledge in a Build registration', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireAiKnowledge: true
    })
    await harness.database
      .update(events)
      .set({
        eventType: 'build',
        maxTeamMembers: 1,
        submissionOpensAt: null,
        submissionClosesAt: null
      })
      .where(eq(events.id, 'event_1'))

    const missingAiKnowledgeResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })
    expect(missingAiKnowledgeResponse.status).toBe(409)
    expect(await missingAiKnowledgeResponse.json()).toMatchObject({
      error: {
        code: 'ai_knowledge_level_required'
      }
    })

    const successResponse = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2',
        aiKnowledgeLevel: 'advanced'
      })
    })
    expect(successResponse.status).toBe(200)

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: and(
        eq(userApplications.eventId, 'event_1'),
        eq(userApplications.userId, 'regular_user')
      )
    })
    expect(storedApplication).toMatchObject({
      selectedTrackId: null
    })
    expect(JSON.parse(storedApplication?.registrationDetailsJson ?? '{}')).toMatchObject({
      aiKnowledgeLevel: 'advanced'
    })
  })

  test('POST /api/events/:eventId/applications rejects users missing required profile fields', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|missing_profile',
        email: 'missing-profile@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireGithubProfile: true
    })

    const response = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'required_profile_fields_missing',
        details: {
          missingFields: ['githubProfileUrl']
        }
      }
    })
  })

  test('POST /api/events/:eventId/applications rejects registration team-member hints beyond max team members', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    const response = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2',
        registrationTeamIntent: 'team',
        registrationTeamMembers: Array.from({ length: 6 }, (_, index) => ({
          fullName: `Member ${index + 1}`,
          email: null
        }))
      })
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'registration_team_members_invalid'
      }
    })
  })

  test('POST /api/events/:eventId/applications rejects users missing a required luma email', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|missing_profile',
        email: 'missing-profile@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireLumaEmail: true
    })

    const response = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'required_profile_fields_missing',
        details: {
          missingFields: ['lumaEmail']
        }
      }
    })
  })

  test('POST /api/events/:eventId/applications rejects Luma emails that are not registered for the event', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      },
      runtimeConfig: {}
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123'
    })

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/v1/event/get-guest') {
        return new Response(JSON.stringify({
          guest: null
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        })
      }

      throw new Error(`Unexpected fetch URL: ${url.toString()}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'luma_registration_required',
        message: 'Luma registration is mandatory for this event, and we could not find any guest with the Luma email you entered.'
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: and(
        eq(userApplications.eventId, 'event_1'),
        eq(userApplications.userId, 'regular_user')
      )
    })

    expect(storedApplication).toBeUndefined()
  })

  test('POST /api/events/:eventId/applications does not arm Luma sync when no Luma event API id is configured', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: null
    })

    const response = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        userId: 'regular_user',
        lumaSyncStatus: null
      }
    })
  })

  test('POST /api/events/:eventId/applications stores not_synced for Luma-enabled events', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      },
      runtimeConfig: {}
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123'
    })

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/v1/event/get-guest') {
        return new Response(JSON.stringify({
          guest: {
            id: 'gst-123',
            user_email: 'regular@luma.example'
          }
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        })
      }

      throw new Error(`Unexpected fetch URL: ${url.toString()}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        userId: 'regular_user',
        lumaSyncStatus: 'not_synced'
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: and(
        eq(userApplications.eventId, 'event_1'),
        eq(userApplications.userId, 'regular_user')
      )
    })

    expect(storedApplication?.lumaSyncStatus).toBe('not_synced')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('POST /api/events/:eventId/applications/me/actions/verify-luma-email updates the Luma email and completes approval sync', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/me/actions/verify-luma-email',
          handler: verifyOwnApplicationLumaEmailHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      },
      runtimeConfig: {}
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123'
    })

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'approved',
      lumaSyncStatus: 'approve_failed',
      submittedAt: '2026-03-22T12:10:00.000Z',
      reviewedAt: '2026-03-22T12:20:00.000Z',
      reviewedByUserId: 'event_admin',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:20:00.000Z'
    })

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/v1/event/get-guest') {
        expect(url.searchParams.get('event_id')).toBe('evt-123')
        expect(url.searchParams.get('id')).toBe('correct@luma.example')

        return new Response(JSON.stringify({
          guest: {
            id: 'gst-verified',
            user_email: 'correct@luma.example'
          }
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        })
      }

      if (url.pathname === '/v1/event/update-guest-status') {
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body))).toMatchObject({
          guest: {
            type: 'api_id',
            api_id: 'gst-verified'
          },
          event_api_id: 'evt-123',
          status: 'approved'
        })

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        })
      }

      throw new Error(`Unexpected fetch URL: ${url.toString()}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await harness.request('/api/events/event_1/applications/me/actions/verify-luma-email', {
      method: 'POST',
      body: JSON.stringify({
        lumaEmail: 'correct@luma.example'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        lumaEmail: 'correct@luma.example',
        verificationStatus: 'synced',
        application: {
          id: 'application_1',
          lumaSyncStatus: 'approve_synced'
        }
      }
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)

    const storedUser = await harness.database.query.users.findFirst({
      where: eq(users.id, 'regular_user')
    })
    expect(storedUser?.lumaEmail).toBe('correct@luma.example')

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication?.lumaSyncStatus).toBe('approve_synced')

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user',
        entityId: 'regular_user',
        action: 'account.updated',
        metadata: expect.objectContaining({
          source: 'participant_luma_verification'
        })
      }),
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.luma_sync_completed',
        metadata: expect.objectContaining({
          decision: 'approved',
          guestId: 'gst-verified',
          lumaEmail: 'correct@luma.example'
        })
      })
    ]))
  })

  test('POST /api/events/:eventId/applications/me/actions/verify-luma-email rejects a Luma email used by another participant', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/me/actions/verify-luma-email',
          handler: verifyOwnApplicationLumaEmailHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      },
      runtimeConfig: {}
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123'
    })

    await harness.database.insert(users).values({
      id: 'other_user',
      auth0Subject: 'auth0|other_user',
      email: 'other@example.com',
      displayName: 'Other User',
      lumaEmail: 'duplicate@luma.example'
    })

    await harness.database.insert(userApplications).values([
      {
        id: 'application_1',
        eventId: 'event_1',
        userId: 'regular_user',
        status: 'approved',
        lumaSyncStatus: 'approve_failed',
        submittedAt: '2026-03-22T12:10:00.000Z',
        reviewedAt: '2026-03-22T12:20:00.000Z',
        reviewedByUserId: 'event_admin',
        applicationTermsDocumentId: 'terms_app_2',
        applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
        createdAt: '2026-03-22T12:10:00.000Z',
        updatedAt: '2026-03-22T12:20:00.000Z'
      },
      {
        id: 'application_2',
        eventId: 'event_1',
        userId: 'other_user',
        status: 'approved',
        lumaSyncStatus: 'approve_synced',
        submittedAt: '2026-03-22T12:11:00.000Z',
        reviewedAt: '2026-03-22T12:21:00.000Z',
        reviewedByUserId: 'event_admin',
        applicationTermsDocumentId: 'terms_app_2',
        applicationTermsAcceptedAt: '2026-03-22T12:11:00.000Z',
        createdAt: '2026-03-22T12:11:00.000Z',
        updatedAt: '2026-03-22T12:21:00.000Z'
      }
    ])

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await harness.request('/api/events/event_1/applications/me/actions/verify-luma-email', {
      method: 'POST',
      body: JSON.stringify({
        lumaEmail: 'Duplicate@Luma.example'
      })
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'luma_email_already_used',
        message: 'This Luma email is already connected to another participant of an event you are registered for.',
        details: {
          eventId: 'event_1'
        }
      }
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('POST /api/events/:eventId/applications/me/actions/verify-luma-email keeps failed sync state when the Luma email is not found', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/me/actions/verify-luma-email',
          handler: verifyOwnApplicationLumaEmailHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      },
      runtimeConfig: {}
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123'
    })

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'approved',
      lumaSyncStatus: 'approve_failed',
      submittedAt: '2026-03-22T12:10:00.000Z',
      reviewedAt: '2026-03-22T12:20:00.000Z',
      reviewedByUserId: 'event_admin',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:20:00.000Z'
    })

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/v1/event/get-guest') {
        return new Response(JSON.stringify({
          guest: null
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        })
      }

      throw new Error(`Unexpected fetch URL: ${url.toString()}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await harness.request('/api/events/event_1/applications/me/actions/verify-luma-email', {
      method: 'POST',
      body: JSON.stringify({
        lumaEmail: 'missing@luma.example'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        lumaEmail: 'regular@luma.example',
        verificationStatus: 'not_found',
        application: {
          id: 'application_1',
          lumaSyncStatus: 'approve_failed'
        }
      }
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const storedUser = await harness.database.query.users.findFirst({
      where: eq(users.id, 'regular_user')
    })
    expect(storedUser?.lumaEmail).toBe('regular@luma.example')

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication?.lumaSyncStatus).toBe('approve_failed')
  })

  test('POST /api/events/:eventId/applications allows submission when the Luma lookup temporarily fails', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123'
    })

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchMock = vi.fn(async () => new Response('rate limit', { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        userId: 'regular_user',
        lumaSyncStatus: 'not_synced'
      }
    })

    expect(consoleError).toHaveBeenCalledWith('Luma registration validation skipped after lookup failure.', {
      eventId: 'event_1',
      userId: 'regular_user',
      reason: 'luma_request_retryable_status'
    })
    consoleError.mockRestore()
  })

  test('POST /api/events/:eventId/applications rejects users missing a required ChatGPT email and OpenAI org ID', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/events/:eventId/applications', handler: applicationsPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|missing_profile',
        email: 'missing-profile@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireChatgptEmail: true,
      requireOpenaiOrgId: true
    })

    const response = await harness.request('/api/events/event_1/applications', {
      method: 'POST',
      body: JSON.stringify({
        applicationTermsDocumentId: 'terms_app_2'
      })
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'required_profile_fields_missing',
        details: {
          missingFields: ['chatgptEmail', 'openaiOrgId']
        }
      }
    })
  })

  test('GET /api/events/:eventId/applications/me returns the caller application or null', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/applications/me', handler: ownApplicationHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    const emptyResponse = await harness.request('/api/events/event_1/applications/me')
    expect(emptyResponse.status).toBe(200)
    expect(await emptyResponse.json()).toMatchObject({
      data: null
    })

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'submitted',
      submittedAt: '2026-03-22T12:10:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:10:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/applications/me')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'application_1',
        userId: 'regular_user',
        applicationTermsDocument: {
          id: 'terms_app_2'
        }
      }
    })
  })

  test.each(['submitted', 'approved'] as const)(
    'POST /api/events/:eventId/applications/me/actions/select-track stores the selected track for %s applicants',
    async (status) => {
      const harness = createApiRouteTestHarness({
        routes: [
          {
            method: 'post',
            path: '/api/events/:eventId/applications/me/actions/select-track',
            handler: selectOwnApplicationTrackHandler
          }
        ],
        sessionUser: {
          sub: 'auth0|regular_user',
          email: 'regular@example.com'
        }
      })
      harnesses.push(harness)
      await seedApplicationContext(harness)

      await harness.database.insert(eventTracks).values({
        id: 'track_agents',
        eventId: 'event_1',
        name: 'Agents',
        shortDescription: 'Build agent projects.',
        fullDescription: 'Follow the agent track guidelines.',
        staffInstructions: 'Route agent questions to the mentor desk.',
        displayOrder: 1,
        createdAt: '2026-03-22T12:08:00.000Z'
      })
      await harness.database.insert(userApplications).values({
        id: 'application_1',
        eventId: 'event_1',
        userId: 'regular_user',
        status,
        submittedAt: '2026-03-22T12:10:00.000Z',
        applicationTermsDocumentId: 'terms_app_2',
        applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
        createdAt: '2026-03-22T12:10:00.000Z',
        updatedAt: '2026-03-22T12:10:00.000Z'
      })

      const response = await harness.request('/api/events/event_1/applications/me/actions/select-track', {
        method: 'POST',
        body: JSON.stringify({
          trackId: 'track_agents'
        })
      })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        data: {
          id: 'application_1',
          status,
          selectedTrackId: 'track_agents'
        }
      })

      const storedApplication = await harness.database.query.userApplications.findFirst({
        where: eq(userApplications.id, 'application_1')
      })
      expect(storedApplication).toMatchObject({
        selectedTrackId: 'track_agents'
      })

      const auditRecords = await harness.database.query.auditLogs.findMany({
        where: eq(auditLogs.entityId, 'application_1')
      })
      expect(auditRecords).toEqual(expect.arrayContaining([
        expect.objectContaining({
          entityType: 'user_application',
          action: 'user_application.track_selected',
          metadata: expect.objectContaining({
            selectedTrackId: 'track_agents'
          })
        })
      ]))
    }
  )

  test('POST /api/events/:eventId/applications/me/actions/select-track rejects changes in a completed Hackathon', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/me/actions/select-track',
          handler: selectOwnApplicationTrackHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(eventTracks).values([
      {
        id: 'track_agents',
        eventId: 'event_1',
        name: 'Agents',
        shortDescription: 'Build agent projects.',
        fullDescription: '',
        staffInstructions: '',
        displayOrder: 1,
        createdAt: '2026-03-22T12:08:00.000Z'
      },
      {
        id: 'track_tools',
        eventId: 'event_1',
        name: 'Tools',
        shortDescription: 'Build tool projects.',
        fullDescription: '',
        staffInstructions: '',
        displayOrder: 2,
        createdAt: '2026-03-22T12:08:00.000Z'
      }
    ])
    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'approved',
      submittedAt: '2026-03-22T12:10:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:10:00.000Z'
    })

    const activeEventResponse = await harness.request('/api/events/event_1/applications/me/actions/select-track', {
      method: 'POST',
      body: JSON.stringify({
        trackId: 'track_agents'
      })
    })
    expect(activeEventResponse.status).toBe(200)

    await harness.database
      .update(events)
      .set({ state: 'completed' })
      .where(eq(events.id, 'event_1'))

    const completedEventResponse = await harness.request('/api/events/event_1/applications/me/actions/select-track', {
      method: 'POST',
      body: JSON.stringify({
        trackId: 'track_tools'
      })
    })

    expect(completedEventResponse.status).toBe(409)
    expect(await completedEventResponse.json()).toMatchObject({
      error: {
        code: 'application_track_selection_unavailable'
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication?.selectedTrackId).toBe('track_agents')
  })

  test('POST /api/events/:eventId/applications/me/actions/select-track rejects ineligible applications and tracks from other events', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/me/actions/select-track',
          handler: selectOwnApplicationTrackHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(events).values({
      id: 'event_2',
      eventType: 'hackathon',
      name: 'Other Event',
      slug: 'other-event',
      description: 'Other fixture event',
      city: 'Vienna',
      country: 'Austria',
      address: 'Other Address',
      registrationOpensAt: fixtureRegistrationOpensAt,
      registrationClosesAt: fixtureRegistrationClosesAt,
      submissionOpensAt: fixtureSubmissionOpensAt,
      submissionClosesAt: fixtureSubmissionClosesAt,
      state: 'registration_open',
      maxTeamMembers: 5,
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'platform_admin'
    })
    await harness.database.insert(eventTracks).values([
      {
        id: 'track_agents',
        eventId: 'event_1',
        name: 'Agents',
        shortDescription: 'Build agent projects.',
        fullDescription: '',
        staffInstructions: '',
        displayOrder: 1,
        createdAt: '2026-03-22T12:08:00.000Z'
      },
      {
        id: 'track_other_event',
        eventId: 'event_2',
        name: 'Other Track',
        shortDescription: 'Belongs to another event.',
        fullDescription: '',
        staffInstructions: '',
        displayOrder: 1,
        createdAt: '2026-03-22T12:08:00.000Z'
      }
    ])
    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'rejected',
      submittedAt: '2026-03-22T12:10:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:10:00.000Z'
    })

    const rejectedStatusResponse = await harness.request('/api/events/event_1/applications/me/actions/select-track', {
      method: 'POST',
      body: JSON.stringify({
        trackId: 'track_agents'
      })
    })
    expect(rejectedStatusResponse.status).toBe(409)
    expect(await rejectedStatusResponse.json()).toMatchObject({
      error: {
        code: 'application_track_selection_unavailable'
      }
    })

    await harness.database
      .update(userApplications)
      .set({
        status: 'submitted'
      })
      .where(eq(userApplications.id, 'application_1'))

    const otherEventTrackResponse = await harness.request('/api/events/event_1/applications/me/actions/select-track', {
      method: 'POST',
      body: JSON.stringify({
        trackId: 'track_other_event'
      })
    })
    expect(otherEventTrackResponse.status).toBe(400)
    expect(await otherEventTrackResponse.json()).toMatchObject({
      error: {
        code: 'event_track_invalid'
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication?.selectedTrackId).toBeNull()
  })

  test('POST /api/events/:eventId/applications/me/actions/withdraw transitions the caller application and writes an audit record', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/me/actions/withdraw',
          handler: withdrawOwnApplicationHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'submitted',
      preApprovalStatus: 'approved',
      submittedAt: '2026-03-22T12:10:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:10:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/applications/me/actions/withdraw', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'application_1',
        status: 'withdrawn',
        preApprovalStatus: null,
        withdrawnAt: expect.any(String)
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: and(
        eq(userApplications.eventId, 'event_1'),
        eq(userApplications.userId, 'regular_user')
      )
    })

    expect(storedApplication).toMatchObject({
      status: 'withdrawn',
      preApprovalStatus: null
    })
    expect(storedApplication?.withdrawnAt).toBeTruthy()

    const auditRecords = await harness.database.query.auditLogs.findMany({
      where: eq(auditLogs.entityId, 'application_1')
    })

    expect(auditRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.withdrawn'
      })
    ]))
  })

  test('POST /api/events/:eventId/applications/me/actions/withdraw is blocked while the caller still has an active team', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/me/actions/withdraw',
          handler: withdrawOwnApplicationHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'approved',
      submittedAt: '2026-03-22T12:10:00.000Z',
      reviewedAt: '2026-03-22T12:20:00.000Z',
      reviewedByUserId: 'event_admin',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:20:00.000Z'
    })
    await harness.database.insert(teams).values({
      id: 'team_1',
      eventId: 'event_1',
      name: 'Active Team',
      slug: 'active-team',
      isOpenToJoinRequests: true,
      createdByUserId: 'regular_user',
      createdAt: '2026-03-22T12:30:00.000Z',
      updatedAt: '2026-03-22T12:30:00.000Z'
    })
    await harness.database.insert(teamMembers).values({
      id: 'team_member_1',
      teamId: 'team_1',
      userId: 'regular_user',
      role: 'admin',
      joinedAt: '2026-03-22T12:30:00.000Z',
      leftAt: null,
      createdAt: '2026-03-22T12:30:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/applications/me/actions/withdraw', {
      method: 'POST'
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'user_application_withdrawal_blocked'
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })

    expect(storedApplication).toMatchObject({
      status: 'approved',
      withdrawnAt: null
    })
  })

  test('POST /api/events/:eventId/applications/me/actions/withdraw enqueues Luma rejection for Luma-enabled events', async () => {
    const lumaQueueProducer = createQueueProducerStub()
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/me/actions/withdraw',
          handler: withdrawOwnApplicationHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      },
      cloudflareEnv: {
        APPLICATION_LUMA_SYNC_QUEUE: lumaQueueProducer
      },
      runtimeConfig: {
        luma: {
          queueBinding: 'APPLICATION_LUMA_SYNC_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123'
    })

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'approved',
      lumaSyncStatus: 'approve_synced',
      submittedAt: '2026-03-22T12:10:00.000Z',
      reviewedAt: '2026-03-22T12:20:00.000Z',
      reviewedByUserId: 'event_admin',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:20:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/applications/me/actions/withdraw', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'application_1',
        status: 'withdrawn',
        lumaSyncStatus: 'not_synced',
        withdrawnAt: expect.any(String)
      }
    })

    expect(lumaQueueProducer.send).toHaveBeenCalledTimes(1)
    expect(lumaQueueProducer.send).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'application_1',
      decision: 'rejected'
    }), {
      contentType: 'json'
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication).toMatchObject({
      status: 'withdrawn',
      lumaSyncStatus: 'not_synced'
    })

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.luma_sync_enqueued',
        metadata: expect.objectContaining({
          decision: 'rejected',
          trigger: 'participant_withdrawal',
          enqueue: expect.objectContaining({
            status: 'enqueued'
          })
        })
      })
    ]))
  })

  test('POST /api/events/:eventId/applications/me/actions/withdraw marks Luma sync as failed when the Luma queue binding is unavailable', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/me/actions/withdraw',
          handler: withdrawOwnApplicationHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
      },
      runtimeConfig: {
        luma: {
          queueBinding: 'APPLICATION_LUMA_SYNC_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123'
    })

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'approved',
      lumaSyncStatus: 'approve_synced',
      submittedAt: '2026-03-22T12:10:00.000Z',
      reviewedAt: '2026-03-22T12:20:00.000Z',
      reviewedByUserId: 'event_admin',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:20:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/applications/me/actions/withdraw', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'application_1',
        status: 'withdrawn',
        lumaSyncStatus: 'reject_failed'
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication).toMatchObject({
      status: 'withdrawn',
      lumaSyncStatus: 'reject_failed'
    })

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.luma_sync_enqueued',
        metadata: expect.objectContaining({
          decision: 'rejected',
          trigger: 'participant_withdrawal',
          enqueue: expect.objectContaining({
            status: 'skipped',
            reason: 'queue_binding_missing:APPLICATION_LUMA_SYNC_QUEUE'
          })
        })
      })
    ]))
  })

  test('POST /api/events/:eventId/applications/:applicationId/actions/withdraw removes the participant from a team that remains valid', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/withdraw',
          handler: adminWithdrawApplicationHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'approved',
      submittedAt: '2026-03-22T12:10:00.000Z',
      reviewedAt: '2026-03-22T12:20:00.000Z',
      reviewedByUserId: 'event_admin',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:20:00.000Z'
    })
    await harness.database.insert(teams).values({
      id: 'team_1',
      eventId: 'event_1',
      name: 'Active Team',
      slug: 'active-team',
      isOpenToJoinRequests: true,
      createdByUserId: 'regular_user',
      createdAt: '2026-03-22T12:30:00.000Z',
      updatedAt: '2026-03-22T12:30:00.000Z'
    })
    await harness.database.insert(teamMembers).values([
      {
        id: 'team_member_regular',
        teamId: 'team_1',
        userId: 'regular_user',
        role: 'member',
        joinedAt: '2026-03-22T12:30:00.000Z',
        leftAt: null,
        createdAt: '2026-03-22T12:30:00.000Z'
      },
      {
        id: 'team_member_admin',
        teamId: 'team_1',
        userId: 'missing_profile_user',
        role: 'admin',
        joinedAt: '2026-03-22T12:30:00.000Z',
        leftAt: null,
        createdAt: '2026-03-22T12:30:00.000Z'
      }
    ])

    const response = await harness.request('/api/events/event_1/applications/application_1/actions/withdraw', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'application_1',
        status: 'withdrawn',
        withdrawnAt: expect.any(String)
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication).toMatchObject({
      status: 'withdrawn'
    })

    const removedMembership = await harness.database.query.teamMembers.findFirst({
      where: eq(teamMembers.id, 'team_member_regular')
    })
    const remainingAdminMembership = await harness.database.query.teamMembers.findFirst({
      where: eq(teamMembers.id, 'team_member_admin')
    })

    expect(removedMembership?.leftAt).toBeTruthy()
    expect(remainingAdminMembership?.leftAt).toBeNull()
  })

  test('POST /api/events/:eventId/applications/:applicationId/actions/withdraw dismantles a solo team and closes pending join requests', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/withdraw',
          handler: adminWithdrawApplicationHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'approved',
      submittedAt: '2026-03-22T12:10:00.000Z',
      reviewedAt: '2026-03-22T12:20:00.000Z',
      reviewedByUserId: 'event_admin',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:20:00.000Z'
    })
    await harness.database.insert(teams).values({
      id: 'team_1',
      eventId: 'event_1',
      name: 'Solo Team',
      slug: 'solo-team',
      isOpenToJoinRequests: true,
      createdByUserId: 'regular_user',
      createdAt: '2026-03-22T12:30:00.000Z',
      updatedAt: '2026-03-22T12:30:00.000Z'
    })
    await harness.database.insert(teamMembers).values({
      id: 'team_member_regular',
      teamId: 'team_1',
      userId: 'regular_user',
      role: 'admin',
      joinedAt: '2026-03-22T12:30:00.000Z',
      leftAt: null,
      createdAt: '2026-03-22T12:30:00.000Z'
    })
    await harness.database.insert(teamJoinRequests).values({
      id: 'team_join_request_1',
      teamId: 'team_1',
      userId: 'missing_profile_user',
      status: 'pending',
      requestedAt: '2026-03-22T12:35:00.000Z',
      reviewedAt: null,
      reviewedByUserId: null,
      createdAt: '2026-03-22T12:35:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/applications/application_1/actions/withdraw', {
      method: 'POST'
    })

    expect(response.status).toBe(200)

    const dissolvedMembership = await harness.database.query.teamMembers.findFirst({
      where: eq(teamMembers.id, 'team_member_regular')
    })
    const updatedTeam = await harness.database.query.teams.findFirst({
      where: eq(teams.id, 'team_1')
    })
    const closedJoinRequest = await harness.database.query.teamJoinRequests.findFirst({
      where: eq(teamJoinRequests.id, 'team_join_request_1')
    })

    expect(dissolvedMembership?.leftAt).toBeTruthy()
    expect(updatedTeam).toMatchObject({
      isOpenToJoinRequests: false
    })
    expect(closedJoinRequest).toMatchObject({
      status: 'rejected',
      reviewedByUserId: 'event_admin'
    })

    const auditRows = await harness.database.query.auditLogs.findMany({
      where: eq(auditLogs.entityId, 'application_1')
    })
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.admin_withdrawn'
      })
    ]))
  })

  test('POST /api/events/:eventId/applications/:applicationId/actions/withdraw dismantles a team when the participant is the last active admin and no submission exists', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/withdraw',
          handler: adminWithdrawApplicationHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'approved',
      submittedAt: '2026-03-22T12:10:00.000Z',
      reviewedAt: '2026-03-22T12:20:00.000Z',
      reviewedByUserId: 'event_admin',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:20:00.000Z'
    })
    await harness.database.insert(teams).values({
      id: 'team_1',
      eventId: 'event_1',
      name: 'Team Without Backup Admin',
      slug: 'team-without-backup-admin',
      isOpenToJoinRequests: true,
      createdByUserId: 'regular_user',
      createdAt: '2026-03-22T12:30:00.000Z',
      updatedAt: '2026-03-22T12:30:00.000Z'
    })
    await harness.database.insert(teamMembers).values([
      {
        id: 'team_member_regular',
        teamId: 'team_1',
        userId: 'regular_user',
        role: 'admin',
        joinedAt: '2026-03-22T12:30:00.000Z',
        leftAt: null,
        createdAt: '2026-03-22T12:30:00.000Z'
      },
      {
        id: 'team_member_other',
        teamId: 'team_1',
        userId: 'missing_profile_user',
        role: 'member',
        joinedAt: '2026-03-22T12:31:00.000Z',
        leftAt: null,
        createdAt: '2026-03-22T12:31:00.000Z'
      }
    ])

    const response = await harness.request('/api/events/event_1/applications/application_1/actions/withdraw', {
      method: 'POST'
    })

    expect(response.status).toBe(200)

    const memberships = await harness.database.query.teamMembers.findMany({
      where: eq(teamMembers.teamId, 'team_1')
    })

    expect(memberships).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'team_member_regular',
        leftAt: expect.any(String)
      }),
      expect.objectContaining({
        id: 'team_member_other',
        leftAt: expect.any(String)
      })
    ]))
  })

  test('POST /api/events/:eventId/applications/:applicationId/actions/withdraw is blocked when dismantling the team would affect an active submission', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/withdraw',
          handler: adminWithdrawApplicationHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'approved',
      submittedAt: '2026-03-22T12:10:00.000Z',
      reviewedAt: '2026-03-22T12:20:00.000Z',
      reviewedByUserId: 'event_admin',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:20:00.000Z'
    })
    await harness.database.insert(teams).values({
      id: 'team_1',
      eventId: 'event_1',
      name: 'Blocked Team',
      slug: 'blocked-team',
      isOpenToJoinRequests: true,
      createdByUserId: 'regular_user',
      createdAt: '2026-03-22T12:30:00.000Z',
      updatedAt: '2026-03-22T12:30:00.000Z'
    })
    await harness.database.insert(teamMembers).values({
      id: 'team_member_regular',
      teamId: 'team_1',
      userId: 'regular_user',
      role: 'admin',
      joinedAt: '2026-03-22T12:30:00.000Z',
      leftAt: null,
      createdAt: '2026-03-22T12:30:00.000Z'
    })
    await harness.database.insert(submissions).values({
      id: 'submission_1',
      teamId: 'team_1',
      status: 'draft',
      projectName: 'Blocked Project',
      summary: 'Cannot dissolve this team while the draft exists.',
      repositoryUrl: null,
      demoUrl: null,
      trackId: null,
      submittedAt: null,
      lockedAt: null,
      withdrawnAt: null,
      disqualifiedAt: null,
      createdAt: '2026-03-22T12:40:00.000Z',
      updatedAt: '2026-03-22T12:40:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/applications/application_1/actions/withdraw', {
      method: 'POST'
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'user_application_admin_withdrawal_blocked'
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    const storedMembership = await harness.database.query.teamMembers.findFirst({
      where: eq(teamMembers.id, 'team_member_regular')
    })

    expect(storedApplication).toMatchObject({
      status: 'approved',
      withdrawnAt: null
    })
    expect(storedMembership?.leftAt).toBeNull()
  })

  test('POST /api/events/:eventId/applications/:applicationId/actions/withdraw enqueues Luma rejection for admin-managed withdrawals', async () => {
    const lumaQueueProducer = createQueueProducerStub()
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/withdraw',
          handler: adminWithdrawApplicationHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      },
      cloudflareEnv: {
        APPLICATION_LUMA_SYNC_QUEUE: lumaQueueProducer
      },
      runtimeConfig: {
        luma: {
          queueBinding: 'APPLICATION_LUMA_SYNC_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123'
    })

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'approved',
      lumaSyncStatus: 'approve_synced',
      submittedAt: '2026-03-22T12:10:00.000Z',
      reviewedAt: '2026-03-22T12:20:00.000Z',
      reviewedByUserId: 'event_admin',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:20:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/applications/application_1/actions/withdraw', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'application_1',
        status: 'withdrawn',
        lumaSyncStatus: 'not_synced'
      }
    })

    expect(lumaQueueProducer.send).toHaveBeenCalledTimes(1)
    expect(lumaQueueProducer.send).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'application_1',
      decision: 'rejected'
    }), {
      contentType: 'json'
    })

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.luma_sync_enqueued',
        metadata: expect.objectContaining({
          decision: 'rejected',
          trigger: 'admin_withdrawal'
        })
      })
    ]))
  })

  test('POST /api/events/:eventId/applications/:applicationId/actions/undo-withdrawal restores a withdrawn application to submitted review', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/undo-withdrawal',
          handler: undoApplicationWithdrawalHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)
    await insertWithdrawnApplication(harness)

    const response = await harness.request('/api/events/event_1/applications/application_1/actions/undo-withdrawal', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'application_1',
        status: 'submitted',
        preApprovalStatus: null,
        lumaSyncStatus: null,
        withdrawnAt: null,
        checkedInAt: null,
        reviewedAt: null,
        reviewedByUserId: null
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication).toMatchObject({
      status: 'submitted',
      preApprovalStatus: null,
      lumaSyncStatus: null,
      withdrawnAt: null,
      checkedInAt: null,
      reviewedAt: null,
      reviewedByUserId: null
    })

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorUserId: 'event_admin',
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.admin_withdrawal_undone',
        metadata: expect.objectContaining({
          nextStatus: 'submitted'
        })
      })
    ]))
  })

  test('POST /api/events/:eventId/applications/:applicationId/actions/undo-withdrawal auto-approves while capacity remains', async () => {
    const queueProducer = createQueueProducerStub()
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/undo-withdrawal',
          handler: undoApplicationWithdrawalHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      },
      cloudflareEnv: {
        APPLICATION_REVIEW_EMAIL_QUEUE: queueProducer
      },
      runtimeConfig: {
        applicationReviewEmails: {
          queueBinding: 'APPLICATION_REVIEW_EMAIL_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      autoApproveApplications: true,
      participantsLimit: 2
    })
    await harness.database.insert(userApplications).values({
      id: 'application_existing_approved',
      eventId: 'event_1',
      userId: 'staff_user',
      status: 'approved',
      submittedAt: '2026-03-22T12:00:00.000Z',
      reviewedAt: '2026-03-22T12:00:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:00:00.000Z',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z'
    })
    await insertWithdrawnApplication(harness)

    const response = await harness.request('/api/events/event_1/applications/application_1/actions/undo-withdrawal', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'application_1',
        status: 'approved',
        preApprovalStatus: null,
        withdrawnAt: null,
        checkedInAt: null,
        reviewedAt: expect.any(String),
        reviewedByUserId: null
      }
    })

    expect(queueProducer.send).toHaveBeenCalledTimes(1)
    expect(queueProducer.send).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'application_1',
      decision: 'approved',
      recipientEmail: 'regular@example.com'
    }), {
      contentType: 'json'
    })

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorUserId: null,
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.approved',
        metadata: expect.objectContaining({
          reviewSource: 'auto_approval'
        })
      }),
      expect.objectContaining({
        actorUserId: 'event_admin',
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.admin_withdrawal_undone',
        metadata: expect.objectContaining({
          nextStatus: 'approved'
        })
      })
    ]))
  })

  test('POST /api/events/:eventId/applications/:applicationId/actions/undo-withdrawal leaves applications submitted when auto-approval capacity is full', async () => {
    const queueProducer = createQueueProducerStub()
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/undo-withdrawal',
          handler: undoApplicationWithdrawalHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      },
      cloudflareEnv: {
        APPLICATION_REVIEW_EMAIL_QUEUE: queueProducer
      },
      runtimeConfig: {
        applicationReviewEmails: {
          queueBinding: 'APPLICATION_REVIEW_EMAIL_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      autoApproveApplications: true,
      participantsLimit: 1
    })
    await harness.database.insert(userApplications).values({
      id: 'application_existing_approved',
      eventId: 'event_1',
      userId: 'staff_user',
      status: 'approved',
      submittedAt: '2026-03-22T12:00:00.000Z',
      reviewedAt: '2026-03-22T12:00:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:00:00.000Z',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z'
    })
    await insertWithdrawnApplication(harness)

    const response = await harness.request('/api/events/event_1/applications/application_1/actions/undo-withdrawal', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'application_1',
        status: 'submitted',
        reviewedAt: null,
        reviewedByUserId: null
      }
    })
    expect(queueProducer.send).toHaveBeenCalledTimes(0)
  })

  test('POST /api/events/:eventId/applications/:applicationId/actions/undo-withdrawal enqueues standard Luma approval sync after auto-approval', async () => {
    const reviewEmailQueueProducer = createQueueProducerStub()
    const lumaQueueProducer = createQueueProducerStub()
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/undo-withdrawal',
          handler: undoApplicationWithdrawalHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      },
      cloudflareEnv: {
        APPLICATION_REVIEW_EMAIL_QUEUE: reviewEmailQueueProducer,
        APPLICATION_LUMA_SYNC_QUEUE: lumaQueueProducer
      },
      runtimeConfig: {
        applicationReviewEmails: {
          queueBinding: 'APPLICATION_REVIEW_EMAIL_QUEUE'
        },
        luma: {
          queueBinding: 'APPLICATION_LUMA_SYNC_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      autoApproveApplications: true,
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123'
    })
    await insertWithdrawnApplication(harness)

    const response = await harness.request('/api/events/event_1/applications/application_1/actions/undo-withdrawal', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'application_1',
        status: 'approved',
        lumaSyncStatus: 'not_synced'
      }
    })

    expect(reviewEmailQueueProducer.send).toHaveBeenCalledTimes(1)
    expect(lumaQueueProducer.send).toHaveBeenCalledTimes(1)
    expect(lumaQueueProducer.send).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'application_1',
      decision: 'approved'
    }), {
      contentType: 'json'
    })
  })

  test('POST /api/events/:eventId/applications/:applicationId/actions/undo-withdrawal requires event admin access', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/undo-withdrawal',
          handler: undoApplicationWithdrawalHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|staff',
        email: 'staff@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)
    await insertWithdrawnApplication(harness)

    const response = await harness.request('/api/events/event_1/applications/application_1/actions/undo-withdrawal', {
      method: 'POST'
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'event_admin_required'
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication).toMatchObject({
      status: 'withdrawn',
      withdrawnAt: '2026-03-23T12:00:00.000Z'
    })
  })

  test('POST /api/events/:eventId/applications/:applicationId/actions/undo-withdrawal is blocked after registration closes', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/undo-withdrawal',
          handler: undoApplicationWithdrawalHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)
    await harness.database
      .update(events)
      .set({
        state: 'submission_open'
      })
      .where(eq(events.id, 'event_1'))
    await insertWithdrawnApplication(harness)

    const response = await harness.request('/api/events/event_1/applications/application_1/actions/undo-withdrawal', {
      method: 'POST'
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'event_state_invalid'
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication).toMatchObject({
      status: 'withdrawn',
      withdrawnAt: '2026-03-23T12:00:00.000Z'
    })
  })

  test('admin application routes list, stage decisions, and apply them with audit logging', async () => {
    const queueProducer = createQueueProducerStub()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/applications', handler: applicationsListHandler },
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/approve',
          handler: approveApplicationHandler
        },
        {
          method: 'post',
          path: '/api/events/:eventId/applications/actions/apply-staged-decisions',
          handler: applyStagedDecisionsHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      },
      cloudflareEnv: {
        APPLICATION_REVIEW_EMAIL_QUEUE: queueProducer
      },
      runtimeConfig: {
        applicationReviewEmails: {
          queueBinding: 'APPLICATION_REVIEW_EMAIL_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)
    await harness.database
      .update(users)
      .set({
        profileIconUpdatedAt: '2026-03-28T12:34:56.000Z'
      })
      .where(eq(users.id, 'regular_user'))

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'submitted',
      submittedAt: '2026-03-22T12:10:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:10:00.000Z'
    })

    const listResponse = await harness.request('/api/events/event_1/applications')
    expect(listResponse.status).toBe(200)
    const listPayload = await listResponse.json()
    expect(listPayload.meta).toMatchObject({
      total: 1
    })
    expect(listPayload.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'application_1',
        user: expect.objectContaining({
          id: 'regular_user',
          profileIconUpdatedAt: '2026-03-28T12:34:56.000Z'
        })
      })
    ]))

    const approveResponse = await harness.request('/api/events/event_1/applications/application_1/actions/approve', {
      method: 'POST'
    })
    expect(approveResponse.status).toBe(200)
    expect(await approveResponse.json()).toMatchObject({
      data: {
        id: 'application_1',
        status: 'submitted',
        preApprovalStatus: 'approved',
        reviewedByUserId: null
      }
    })
    expect(queueProducer.send).toHaveBeenCalledTimes(0)

    const applyResponse = await harness.request('/api/events/event_1/applications/actions/apply-staged-decisions', {
      method: 'POST'
    })
    expect(applyResponse.status).toBe(200)
    expect(await applyResponse.json()).toMatchObject({
      data: {
        appliedCount: 1,
        approvedCount: 1,
        rejectedCount: 0
      }
    })

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.review_decision_staged'
      }),
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.approved'
      }),
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.review_email_enqueued',
        metadata: expect.objectContaining({
          decision: 'approved',
          enqueue: expect.objectContaining({
            status: 'enqueued'
          })
        })
      })
    ]))

    expect(queueProducer.send).toHaveBeenCalledTimes(1)
    expect(queueProducer.send).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'application_1',
      decision: 'approved',
      recipientEmail: 'regular@example.com',
      eventName: 'Fixture Event',
      eventSlug: 'fixture-event'
    }), {
      contentType: 'json'
    })
  })

  test('admin application routes can manually approve above the participant limit', async () => {
    const queueProducer = createQueueProducerStub()
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/approve',
          handler: approveApplicationHandler
        },
        {
          method: 'post',
          path: '/api/events/:eventId/applications/actions/apply-staged-decisions',
          handler: applyStagedDecisionsHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      },
      cloudflareEnv: {
        APPLICATION_REVIEW_EMAIL_QUEUE: queueProducer
      },
      runtimeConfig: {
        applicationReviewEmails: {
          queueBinding: 'APPLICATION_REVIEW_EMAIL_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      autoApproveApplications: true,
      participantsLimit: 1
    })
    await harness.database.insert(userApplications).values([
      {
        id: 'application_existing_approved',
        eventId: 'event_1',
        userId: 'staff_user',
        status: 'approved',
        submittedAt: '2026-03-22T12:00:00.000Z',
        reviewedAt: '2026-03-22T12:00:00.000Z',
        applicationTermsDocumentId: 'terms_app_2',
        applicationTermsAcceptedAt: '2026-03-22T12:00:00.000Z',
        createdAt: '2026-03-22T12:00:00.000Z',
        updatedAt: '2026-03-22T12:00:00.000Z'
      },
      {
        id: 'application_1',
        eventId: 'event_1',
        userId: 'regular_user',
        status: 'submitted',
        submittedAt: '2026-03-22T12:10:00.000Z',
        applicationTermsDocumentId: 'terms_app_2',
        applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
        createdAt: '2026-03-22T12:10:00.000Z',
        updatedAt: '2026-03-22T12:10:00.000Z'
      }
    ])

    const approveResponse = await harness.request('/api/events/event_1/applications/application_1/actions/approve', {
      method: 'POST'
    })
    expect(approveResponse.status).toBe(200)
    expect(await approveResponse.json()).toMatchObject({
      data: {
        id: 'application_1',
        status: 'submitted',
        preApprovalStatus: 'approved'
      }
    })

    const applyResponse = await harness.request('/api/events/event_1/applications/actions/apply-staged-decisions', {
      method: 'POST'
    })
    expect(applyResponse.status).toBe(200)
    expect(await applyResponse.json()).toMatchObject({
      data: {
        appliedCount: 1,
        approvedCount: 1,
        rejectedCount: 0,
        applications: [
          expect.objectContaining({
            id: 'application_1',
            status: 'approved'
          })
        ]
      }
    })
    expect(queueProducer.send).toHaveBeenCalledTimes(1)
  })

  test('staff can list applications but cannot stage review decisions', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/applications', handler: applicationsListHandler },
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/approve',
          handler: approveApplicationHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|staff',
        email: 'staff@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(userApplications).values([
      {
        id: 'application_1',
        eventId: 'event_1',
        userId: 'regular_user',
        status: 'submitted',
        submittedAt: '2026-03-22T12:10:00.000Z',
        applicationTermsDocumentId: 'terms_app_2',
        applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
        createdAt: '2026-03-22T12:10:00.000Z',
        updatedAt: '2026-03-22T12:10:00.000Z'
      },
      {
        id: 'application_staff',
        eventId: 'event_1',
        userId: 'staff_user',
        status: 'approved',
        submittedAt: '2026-03-22T12:05:00.000Z',
        applicationTermsDocumentId: 'terms_app_2',
        applicationTermsAcceptedAt: '2026-03-22T12:05:00.000Z',
        createdAt: '2026-03-22T12:05:00.000Z',
        updatedAt: '2026-03-22T12:05:00.000Z'
      }
    ])

    const listResponse = await harness.request('/api/events/event_1/applications')
    expect(listResponse.status).toBe(200)
    const listPayload = await listResponse.json()
    expect(listPayload).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: 'application_1',
          isEventStaff: false,
          user: expect.objectContaining({
            id: 'regular_user'
          })
        }),
        expect.objectContaining({
          id: 'application_staff',
          isEventStaff: true,
          user: expect.objectContaining({
            id: 'staff_user'
          })
        })
      ]),
      meta: {
        total: 2
      }
    })

    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_regular_staff',
      eventId: 'event_1',
      userId: 'regular_user',
      role: 'staff',
      isInJudgePool: false,
      isStaff: true,
      createdAt: '2026-03-22T12:02:00.000Z'
    })

    const staffDesignatedResponse = await harness.request('/api/events/event_1/applications?status=submitted')
    expect(staffDesignatedResponse.status).toBe(200)
    expect(await staffDesignatedResponse.json()).toMatchObject({
      data: [
        expect.objectContaining({
          id: 'application_1',
          isEventStaff: true
        })
      ]
    })

    await harness.database
      .delete(eventRoleAssignments)
      .where(eq(eventRoleAssignments.id, 'role_regular_staff'))

    const fallbackResponse = await harness.request('/api/events/event_1/applications?status=submitted')
    expect(fallbackResponse.status).toBe(200)
    expect(await fallbackResponse.json()).toMatchObject({
      data: [
        expect.objectContaining({
          id: 'application_1',
          isEventStaff: false
        })
      ]
    })

    const approveResponse = await harness.request('/api/events/event_1/applications/application_1/actions/approve', {
      method: 'POST'
    })
    expect(approveResponse.status).toBe(403)
    expect(await approveResponse.json()).toMatchObject({
      error: {
        code: 'event_admin_required'
      }
    })
  })

  test('staff can page through complete participant lists with mixed statuses', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/applications', handler: applicationsListHandler }
      ],
      sessionUser: {
        sub: 'auth0|staff',
        email: 'staff@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    const participantUsers = Array.from({ length: 29 }, (_, index) => ({
      id: `staff_visible_participant_${index + 1}`,
      auth0Subject: `auth0|staff_visible_participant_${index + 1}`,
      email: `staff-visible-participant-${index + 1}@example.com`,
      displayName: `Staff Visible Participant ${index + 1}`
    }))
    const submittedApplications = Array.from({ length: 25 }, (_, index) => ({
      id: `staff_visible_submitted_application_${index + 1}`,
      eventId: 'event_1',
      userId: `staff_visible_participant_${index + 1}`,
      status: 'submitted' as const,
      submittedAt: `2026-03-28T12:${String(59 - index).padStart(2, '0')}:00.000Z`,
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: `2026-03-28T12:${String(59 - index).padStart(2, '0')}:00.000Z`,
      updatedAt: `2026-03-28T12:${String(59 - index).padStart(2, '0')}:00.000Z`
    }))
    const reviewedApplications = [
      {
        id: 'staff_visible_approved_application',
        eventId: 'event_1',
        userId: 'staff_visible_participant_26',
        status: 'approved' as const,
        submittedAt: '2026-03-20T12:00:00.000Z',
        reviewedAt: '2026-03-21T12:00:00.000Z',
        applicationTermsDocumentId: 'terms_app_2',
        applicationTermsAcceptedAt: '2026-03-20T12:00:00.000Z',
        createdAt: '2026-03-20T12:00:00.000Z',
        updatedAt: '2026-03-21T12:00:00.000Z'
      },
      {
        id: 'staff_visible_rejected_application',
        eventId: 'event_1',
        userId: 'staff_visible_participant_27',
        status: 'rejected' as const,
        submittedAt: '2026-03-20T11:00:00.000Z',
        reviewedAt: '2026-03-21T11:00:00.000Z',
        applicationTermsDocumentId: 'terms_app_2',
        applicationTermsAcceptedAt: '2026-03-20T11:00:00.000Z',
        createdAt: '2026-03-20T11:00:00.000Z',
        updatedAt: '2026-03-21T11:00:00.000Z'
      },
      {
        id: 'staff_visible_withdrawn_application',
        eventId: 'event_1',
        userId: 'staff_visible_participant_28',
        status: 'withdrawn' as const,
        submittedAt: '2026-03-20T10:00:00.000Z',
        withdrawnAt: '2026-03-21T10:00:00.000Z',
        applicationTermsDocumentId: 'terms_app_2',
        applicationTermsAcceptedAt: '2026-03-20T10:00:00.000Z',
        createdAt: '2026-03-20T10:00:00.000Z',
        updatedAt: '2026-03-21T10:00:00.000Z'
      },
      {
        id: 'staff_visible_older_submitted_application',
        eventId: 'event_1',
        userId: 'staff_visible_participant_29',
        status: 'submitted' as const,
        submittedAt: '2026-03-20T09:00:00.000Z',
        applicationTermsDocumentId: 'terms_app_2',
        applicationTermsAcceptedAt: '2026-03-20T09:00:00.000Z',
        createdAt: '2026-03-20T09:00:00.000Z',
        updatedAt: '2026-03-20T09:00:00.000Z'
      }
    ]

    await harness.database.insert(users).values(participantUsers)
    await harness.database.insert(userApplications).values([
      ...submittedApplications,
      ...reviewedApplications
    ])

    const firstPageResponse = await harness.request('/api/events/event_1/applications?page=1&page_size=20')
    expect(firstPageResponse.status).toBe(200)
    const firstPagePayload = await firstPageResponse.json()
    expect(firstPagePayload.data).toHaveLength(20)
    expect(firstPagePayload.data.every((application: { status: string }) => application.status === 'submitted')).toBe(true)
    expect(firstPagePayload.meta).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 29,
      statusCounts: {
        submitted: 26,
        approved: 1,
        rejected: 1,
        withdrawn: 1
      }
    })

    const secondPageResponse = await harness.request('/api/events/event_1/applications?page=2&page_size=20')
    expect(secondPageResponse.status).toBe(200)
    const secondPagePayload = await secondPageResponse.json()
    expect(secondPagePayload.data.map((application: { status: string }) => application.status)).toEqual([
      'submitted',
      'submitted',
      'submitted',
      'submitted',
      'submitted',
      'approved',
      'rejected',
      'withdrawn',
      'submitted'
    ])
  })

  test('GET /api/events/:eventId/applications returns bounded pages for large participant sets', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/events/:eventId/applications', handler: applicationsListHandler }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    const participantCount = 120
    const participantUsers = Array.from({ length: participantCount }, (_, index) => ({
      id: `participant_${index + 1}`,
      auth0Subject: `auth0|participant_${index + 1}`,
      email: `participant_${index + 1}@example.com`,
      displayName: `Participant ${index + 1}`
    }))
    const participantApplications = Array.from({ length: participantCount }, (_, index) => ({
      id: `application_${index + 1}`,
      eventId: 'event_1',
      userId: `participant_${index + 1}`,
      status: 'submitted' as const,
      submittedAt: `2026-03-${String(28 - Math.floor(index / 10)).padStart(2, '0')}T12:${String(index % 60).padStart(2, '0')}:00.000Z`,
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: `2026-03-22T12:${String(index % 60).padStart(2, '0')}:00.000Z`,
      updatedAt: `2026-03-22T12:${String(index % 60).padStart(2, '0')}:00.000Z`
    }))
    const participantTeams = Array.from({ length: participantCount }, (_, index) => ({
      id: `team_${index + 1}`,
      eventId: 'event_1',
      name: `Team ${index + 1}`,
      slug: `team-${index + 1}`,
      createdByUserId: `participant_${index + 1}`
    }))
    const participantMemberships = Array.from({ length: participantCount }, (_, index) => ({
      id: `team_member_${index + 1}`,
      teamId: `team_${index + 1}`,
      userId: `participant_${index + 1}`,
      role: 'admin' as const
    }))

    for (let index = 0; index < participantUsers.length; index += 40) {
      await harness.database.insert(users).values(participantUsers.slice(index, index + 40))
    }

    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_participant_100_staff',
      eventId: 'event_1',
      userId: 'participant_100',
      role: 'staff',
      isInJudgePool: false,
      isStaff: true,
      createdAt: '2026-03-22T12:02:00.000Z'
    })

    for (let index = 0; index < participantApplications.length; index += 40) {
      await harness.database.insert(userApplications).values(participantApplications.slice(index, index + 40))
    }

    for (let index = 0; index < participantTeams.length; index += 40) {
      await harness.database.insert(teams).values(participantTeams.slice(index, index + 40))
    }

    for (let index = 0; index < participantMemberships.length; index += 40) {
      await harness.database.insert(teamMembers).values(participantMemberships.slice(index, index + 40))
    }

    const queryHistoryBeforeRequest = harness.d1Database.queries.length
    const response = await harness.request('/api/events/event_1/applications?page=1&page_size=100')
    const requestQueries = harness.d1Database.queries.slice(queryHistoryBeforeRequest)

    expect(response.status).toBe(200)
    const routeQueryStart = requestQueries.findIndex(query =>
      query.sql.includes('from "user_applications"') && query.sql.includes('limit ?')
    )
    expect(routeQueryStart).toBeGreaterThanOrEqual(0)
    const routeQueries = requestQueries.slice(routeQueryStart)
    expect(routeQueries).toHaveLength(6)
    expect(routeQueries.filter(query => query.sql.includes('from "team_members"'))).toHaveLength(2)
    expect(routeQueries.filter(query => query.sql.includes('from "submissions"'))).toHaveLength(1)
    expect(await response.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: 'application_1',
          user: expect.objectContaining({
            id: 'participant_1',
            email: 'participant_1@example.com'
          }),
          adminWithdrawal: expect.objectContaining({
            isAllowed: true,
            activeTeamId: 'team_1',
            teamAction: 'dissolve_team'
          })
        }),
        expect.objectContaining({
          id: 'application_100',
          user: expect.objectContaining({
            id: 'participant_100',
            email: 'participant_100@example.com'
          }),
          isEventStaff: true,
          adminWithdrawal: expect.objectContaining({
            isAllowed: true,
            activeTeamId: 'team_100',
            teamAction: 'dissolve_team'
          })
        })
      ]),
      meta: {
        page: 1,
        pageSize: 100,
        total: participantCount,
        statusCounts: {
          submitted: participantCount,
          approved: 0,
          rejected: 0,
          withdrawn: 0
        }
      }
    })
  })

  test('staging approval toggles off when the same submitted application is approved again', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/approve',
          handler: approveApplicationHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'submitted',
      submittedAt: '2026-03-22T12:10:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:10:00.000Z'
    })

    const firstResponse = await harness.request('/api/events/event_1/applications/application_1/actions/approve', {
      method: 'POST'
    })
    expect(firstResponse.status).toBe(200)
    expect(await firstResponse.json()).toMatchObject({
      data: {
        id: 'application_1',
        preApprovalStatus: 'approved'
      }
    })

    const secondResponse = await harness.request('/api/events/event_1/applications/application_1/actions/approve', {
      method: 'POST'
    })
    expect(secondResponse.status).toBe(200)
    expect(await secondResponse.json()).toMatchObject({
      data: {
        id: 'application_1',
        preApprovalStatus: null
      }
    })

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.review_decision_staged',
        metadata: expect.objectContaining({
          decision: 'approved',
          previousDecision: null
        })
      }),
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.review_decision_cleared',
        metadata: expect.objectContaining({
          decision: null,
          previousDecision: 'approved'
        })
      })
    ]))
  })

  test('admin can stage rejection and apply it in batch', async () => {
    const queueProducer = createQueueProducerStub()
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/reject',
          handler: rejectApplicationHandler
        },
        {
          method: 'post',
          path: '/api/events/:eventId/applications/actions/apply-staged-decisions',
          handler: applyStagedDecisionsHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      },
      cloudflareEnv: {
        APPLICATION_REVIEW_EMAIL_QUEUE: queueProducer
      },
      runtimeConfig: {
        applicationReviewEmails: {
          queueBinding: 'APPLICATION_REVIEW_EMAIL_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'submitted',
      submittedAt: '2026-03-22T12:10:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:10:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/applications/application_1/actions/reject', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'application_1',
        status: 'submitted',
        preApprovalStatus: 'rejected',
        reviewedByUserId: null
      }
    })
    expect(queueProducer.send).toHaveBeenCalledTimes(0)

    const applyResponse = await harness.request('/api/events/event_1/applications/actions/apply-staged-decisions', {
      method: 'POST'
    })
    expect(applyResponse.status).toBe(200)
    expect(await applyResponse.json()).toMatchObject({
      data: {
        appliedCount: 1,
        approvedCount: 0,
        rejectedCount: 1
      }
    })

    expect(queueProducer.send).toHaveBeenCalledTimes(1)
    expect(queueProducer.send).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'application_1',
      decision: 'rejected',
      recipientEmail: 'regular@example.com'
    }), {
      contentType: 'json'
    })
  })

  test('applying staged approval enqueues Luma sync and keeps lumaSyncStatus as not_synced until the worker completes', async () => {
    const reviewEmailQueueProducer = createQueueProducerStub()
    const lumaQueueProducer = createQueueProducerStub()
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/approve',
          handler: approveApplicationHandler
        },
        {
          method: 'post',
          path: '/api/events/:eventId/applications/actions/apply-staged-decisions',
          handler: applyStagedDecisionsHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      },
      cloudflareEnv: {
        APPLICATION_REVIEW_EMAIL_QUEUE: reviewEmailQueueProducer,
        APPLICATION_LUMA_SYNC_QUEUE: lumaQueueProducer
      },
      runtimeConfig: {
        applicationReviewEmails: {
          queueBinding: 'APPLICATION_REVIEW_EMAIL_QUEUE'
        },
        luma: {
          queueBinding: 'APPLICATION_LUMA_SYNC_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123'
    })

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'submitted',
      submittedAt: '2026-03-22T12:10:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:10:00.000Z'
    })

    const approveResponse = await harness.request('/api/events/event_1/applications/application_1/actions/approve', {
      method: 'POST'
    })
    expect(approveResponse.status).toBe(200)

    const applyResponse = await harness.request('/api/events/event_1/applications/actions/apply-staged-decisions', {
      method: 'POST'
    })
    expect(applyResponse.status).toBe(200)
    expect(await applyResponse.json()).toMatchObject({
      data: {
        appliedCount: 1,
        approvedCount: 1,
        rejectedCount: 0,
        applications: [
          expect.objectContaining({
            id: 'application_1',
            status: 'approved',
            lumaSyncStatus: 'not_synced'
          })
        ]
      }
    })

    expect(reviewEmailQueueProducer.send).toHaveBeenCalledTimes(1)
    expect(lumaQueueProducer.send).toHaveBeenCalledTimes(1)
    expect(lumaQueueProducer.send).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'application_1',
      decision: 'approved'
    }), {
      contentType: 'json'
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication?.lumaSyncStatus).toBe('not_synced')

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.luma_sync_enqueued',
        metadata: expect.objectContaining({
          decision: 'approved',
          enqueue: expect.objectContaining({
            status: 'enqueued'
          })
        })
      })
    ]))
  })

  test('staging rejection toggles off when the same submitted application is rejected again', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/reject',
          handler: rejectApplicationHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'submitted',
      submittedAt: '2026-03-22T12:10:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:10:00.000Z'
    })

    const firstResponse = await harness.request('/api/events/event_1/applications/application_1/actions/reject', {
      method: 'POST'
    })
    expect(firstResponse.status).toBe(200)
    expect(await firstResponse.json()).toMatchObject({
      data: {
        id: 'application_1',
        preApprovalStatus: 'rejected'
      }
    })

    const secondResponse = await harness.request('/api/events/event_1/applications/application_1/actions/reject', {
      method: 'POST'
    })
    expect(secondResponse.status).toBe(200)
    expect(await secondResponse.json()).toMatchObject({
      data: {
        id: 'application_1',
        preApprovalStatus: null
      }
    })

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.review_decision_staged',
        metadata: expect.objectContaining({
          decision: 'rejected',
          previousDecision: null
        })
      }),
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.review_decision_cleared',
        metadata: expect.objectContaining({
          decision: null,
          previousDecision: 'rejected'
        })
      })
    ]))
  })

  test('applying staged decisions remains successful when queue enqueue fails', async () => {
    const queueProducer = createQueueProducerStub({ failSend: true })
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/reject',
          handler: rejectApplicationHandler
        },
        {
          method: 'post',
          path: '/api/events/:eventId/applications/actions/apply-staged-decisions',
          handler: applyStagedDecisionsHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      },
      cloudflareEnv: {
        APPLICATION_REVIEW_EMAIL_QUEUE: queueProducer
      },
      runtimeConfig: {
        applicationReviewEmails: {
          queueBinding: 'APPLICATION_REVIEW_EMAIL_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'submitted',
      submittedAt: '2026-03-22T12:10:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:10:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/applications/application_1/actions/reject', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(queueProducer.send).toHaveBeenCalledTimes(0)

    const applyResponse = await harness.request('/api/events/event_1/applications/actions/apply-staged-decisions', {
      method: 'POST'
    })
    expect(applyResponse.status).toBe(200)
    expect(queueProducer.send).toHaveBeenCalledTimes(1)

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.review_email_enqueued',
        metadata: expect.objectContaining({
          decision: 'rejected',
          enqueue: expect.objectContaining({
            status: 'failed',
            reason: 'queue_send_error'
          })
        })
      })
    ]))
  })

  test('applying staged decisions marks Luma sync as failed when the Luma queue binding is unavailable', async () => {
    const reviewEmailQueueProducer = createQueueProducerStub()
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/reject',
          handler: rejectApplicationHandler
        },
        {
          method: 'post',
          path: '/api/events/:eventId/applications/actions/apply-staged-decisions',
          handler: applyStagedDecisionsHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform_admin',
        email: 'platform-admin@example.com'
      },
      cloudflareEnv: {
        APPLICATION_REVIEW_EMAIL_QUEUE: reviewEmailQueueProducer
      },
      runtimeConfig: {
        applicationReviewEmails: {
          queueBinding: 'APPLICATION_REVIEW_EMAIL_QUEUE'
        },
        luma: {
          queueBinding: 'APPLICATION_LUMA_SYNC_QUEUE'
        }
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness, {
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123'
    })

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'submitted',
      submittedAt: '2026-03-22T12:10:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:10:00.000Z'
    })

    const rejectResponse = await harness.request('/api/events/event_1/applications/application_1/actions/reject', {
      method: 'POST'
    })
    expect(rejectResponse.status).toBe(200)

    const applyResponse = await harness.request('/api/events/event_1/applications/actions/apply-staged-decisions', {
      method: 'POST'
    })
    expect(applyResponse.status).toBe(200)
    expect(await applyResponse.json()).toMatchObject({
      data: {
        appliedCount: 1,
        approvedCount: 0,
        rejectedCount: 1,
        applications: [
          expect.objectContaining({
            id: 'application_1',
            status: 'rejected',
            lumaSyncStatus: 'reject_failed'
          })
        ]
      }
    })

    const storedApplication = await harness.database.query.userApplications.findFirst({
      where: eq(userApplications.id, 'application_1')
    })
    expect(storedApplication?.lumaSyncStatus).toBe('reject_failed')

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'user_application',
        entityId: 'application_1',
        action: 'user_application.luma_sync_enqueued',
        metadata: expect.objectContaining({
          decision: 'rejected',
          enqueue: expect.objectContaining({
            status: 'skipped',
            reason: 'queue_binding_missing:APPLICATION_LUMA_SYNC_QUEUE'
          })
        })
      })
    ]))
  })

  test('event admins can stage rejection for submitted applications', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/events/:eventId/applications/:applicationId/actions/reject',
          handler: rejectApplicationHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedApplicationContext(harness)

    await harness.database.insert(userApplications).values({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'regular_user',
      status: 'submitted',
      submittedAt: '2026-03-22T12:10:00.000Z',
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:10:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/applications/application_1/actions/reject', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'application_1',
        status: 'submitted',
        preApprovalStatus: 'rejected',
        reviewedByUserId: null
      }
    })
  })
})
