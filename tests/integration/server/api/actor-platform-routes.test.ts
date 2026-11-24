import { spawn } from 'node:child_process'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { and, asc, eq } from 'drizzle-orm'

import accountDeleteHandler from '../../../../server/api/account.delete'
import accountEmailVerificationPostHandler from '../../../../server/api/account/email-verification.post'
import accountEventsGetHandler from '../../../../server/api/account/events.get'
import accountPatchHandler from '../../../../server/api/account.patch'
import accountProfileIconDeleteHandler from '../../../../server/api/account/profile-icon.delete'
import accountProfileIconGetHandler from '../../../../server/api/account/profile-icon.get'
import accountProfileIconPostHandler from '../../../../server/api/account/profile-icon.post'
import accountRegistrationPostHandler from '../../../../server/api/account/registration.post'
import sessionHandler from '../../../../server/api/session.get'
import platformDocumentAcceptancePostHandler from '../../../../server/api/platform-document-acceptances.post'
import platformDocumentCurrentGetHandler from '../../../../server/api/platform-documents/current.get'
import platformDocumentVersionsGetHandler from '../../../../server/api/platform-documents/[documentType]/versions.get'
import platformDocumentVersionsPostHandler from '../../../../server/api/platform-documents/[documentType]/versions.post'
import platformLegalSettingsCurrentGetHandler from '../../../../server/api/platform-legal-settings/current.get'
import platformLegalSettingsCurrentPatchHandler from '../../../../server/api/platform-legal-settings/current.patch'
import platformSettingsCurrentGetHandler from '../../../../server/api/platform-settings/current.get'
import platformSettingsDefaultBackgroundDeleteHandler from '../../../../server/api/platform-settings/event-default-background-image.delete'
import platformSettingsDefaultBackgroundPostHandler from '../../../../server/api/platform-settings/event-default-background-image.post'
import publicPlatformDefaultEventBackgroundGetHandler from '../../../../server/api/public/platform/event-default-background-image.get'
import {
  auditLogs,
  emptyRegistrationDetailsJson,
  eventPhotos,
  events,
  eventRoleAssignments,
  eventTermsDocuments,
  mcpAccessTokens,
  mediaCleanupOutbox,
  platformDocuments,
  platformLegalSettings,
  platformSettings,
  submissions,
  teamMembers,
  teams,
  userAuthIdentities,
  userApplications,
  userPlatformDocumentAcceptances,
  users
} from '../../../../server/database/schema'
import loginHandler from '../../../../server/routes/auth/login'
import { linkedAuth0SubjectsClaim } from '../../../../server/domains/accounts/linking'
import { authenticatedUploadRateLimitBindingName } from '../../../../server/utils/rate-limit'
import { fixtureTimestamp } from '../../../support/backend/runtime'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

describe('TASK-3.5 actor-facing API routes', () => {
  const databases: Array<ReturnType<typeof createApiRouteTestHarness>> = []
  const profileIconBindingName = 'PROFILE_ICONS'
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

  function createImagesBinding() {
    return {
      input: vi.fn(() => ({
        transform: vi.fn(() => ({
          output: vi.fn(async () => ({
            response: () => new Response(new Uint8Array([0x52, 0x49, 0x46, 0x46])),
            contentType: () => 'image/webp'
          }))
        }))
      }))
    }
  }

  async function seedCurrentPlatformDocuments(
    harness: ReturnType<typeof createApiRouteTestHarness>
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
  }

  async function seedAcceptedPlatformUser(
    harness: ReturnType<typeof createApiRouteTestHarness>,
    input: {
      id: string
      auth0Subject: string
      email: string
      isPlatformAdmin?: boolean
    }
  ) {
    await harness.database.insert(users).values({
      id: input.id,
      auth0Subject: input.auth0Subject,
      email: input.email,
      displayName: input.email,
      isPlatformAdmin: input.isPlatformAdmin ?? false
    })
    await seedCurrentPlatformDocumentAcceptances(harness, input.id)
  }

  async function seedCurrentPlatformDocumentAcceptances(
    harness: ReturnType<typeof createApiRouteTestHarness>,
    userId: string
  ) {
    await seedCurrentPlatformDocuments(harness)
    await harness.database.insert(userPlatformDocumentAcceptances).values([
      {
        id: `${userId}_privacy_acceptance`,
        userId,
        platformDocumentId: 'privacy_v1',
        acceptedAt: '2026-03-03T00:00:00.000Z'
      },
      {
        id: `${userId}_terms_acceptance`,
        userId,
        platformDocumentId: 'terms_v1',
        acceptedAt: '2026-03-03T00:00:00.000Z'
      }
    ])
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
  }

  afterEach(async () => {
    vi.unstubAllGlobals()

    while (databases.length > 0) {
      await databases.pop()?.d1Database.close()
    }
  })

  test('fixture login refuses interactive sign-in before starting a host process', async () => {
    const harness = createApiRouteTestHarness({
      routes: [{ method: 'get', path: '/auth/login', handler: loginHandler }],
      runtimeConfig: { localCodexAuth: true }
    })
    databases.push(harness)

    const response = await harness.request('/auth/login')

    expect(response.status).toBe(403)
    expect(spawn).not.toHaveBeenCalled()
  })

  test('GET /api/session returns authenticated actor context and event roles', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      sessionUser: {
        sub: 'auth0|judge',
        email: 'judge@example.com',
        name: 'Judge Persona'
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'user_judge',
      auth0Subject: 'auth0|judge',
      email: 'judge@example.com',
      displayName: 'Judge Persona'
    })
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
      createdByUserId: 'user_judge'
    })

    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_1',
      eventId: 'event_1',
      userId: 'user_judge',
      role: 'judge',
      isInJudgePool: true,
      createdAt: fixtureTimestamp()
    })
    const response = await harness.request('/api/session')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        actor: {
          kind: 'platform_user',
          hasPlatformAccount: true,
          isPlatformAdmin: false,
          platformUser: {
            id: 'user_judge',
            email: 'judge@example.com',
            company: null,
            bio: null,
            profileIconUpdatedAt: null
          },
          eventRoles: [
            {
              eventId: 'event_1',
              role: 'judge',
              isInJudgePool: true
            }
          ]
        }
      }
    })
  })

  test('GET /api/session marks the configured first platform admin identity as setup-eligible', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      runtimeConfig: {
        firstPlatformAdminEmail: 'First-Admin@Example.com'
      },
      sessionUser: {
        sub: 'google-oauth2|first-admin',
        email: 'first-admin@example.com',
        email_verified: true,
        name: 'First Admin'
      }
    })
    databases.push(harness)

    const response = await harness.request('/api/session')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        actor: {
          kind: 'authenticated_identity',
          hasPlatformAccount: false,
          canCreateFirstPlatformAdminSetupAccount: true,
          platformUser: null
        }
      }
    })
  })

  test('GET /api/session does not mark regular authenticated identities as first-admin setup-eligible', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      runtimeConfig: {
        firstPlatformAdminEmail: 'first-admin@example.com'
      },
      sessionUser: {
        sub: 'google-oauth2|regular-user',
        email: 'regular-user@example.com',
        email_verified: true,
        name: 'Regular User'
      }
    })
    databases.push(harness)

    const response = await harness.request('/api/session')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        actor: {
          kind: 'authenticated_identity',
          hasPlatformAccount: false,
          canCreateFirstPlatformAdminSetupAccount: false,
          platformUser: null
        }
      }
    })
  })

  test('GET /api/account/events returns current and past events for the platform user', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events', handler: accountEventsGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|participant',
        email: 'participant@example.com',
        name: 'Participant'
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'participant_1',
        auth0Subject: 'auth0|participant',
        email: 'participant@example.com',
        displayName: 'Participant'
      }
    ])

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
        id: 'acceptance_privacy_1',
        userId: 'participant_1',
        platformDocumentId: 'privacy_v1',
        acceptedAt: '2026-03-03T00:00:00.000Z'
      },
      {
        id: 'acceptance_terms_1',
        userId: 'participant_1',
        platformDocumentId: 'terms_v1',
        acceptedAt: '2026-03-03T00:00:00.000Z'
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
        id: 'event_current_terms_v1',
        eventId: 'event_current',
        documentType: 'application_terms',
        version: 1,
        title: 'Current application terms',
        content: 'Current application terms',
        publishedAt: '2026-03-18T00:00:00.000Z'
      },
      {
        id: 'event_past_terms_v1',
        eventId: 'event_past',
        documentType: 'application_terms',
        version: 1,
        title: 'Past application terms',
        content: 'Past application terms',
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
        applicationTermsDocumentId: 'event_current_terms_v1',
        applicationTermsAcceptedAt: '2026-03-20T13:00:00.000Z'
      },
      {
        id: 'application_past',
        eventId: 'event_past',
        userId: 'participant_1',
        status: 'approved',
        submittedAt: '2026-01-10T13:00:00.000Z',
        applicationTermsDocumentId: 'event_past_terms_v1',
        applicationTermsAcceptedAt: '2026-01-10T13:00:00.000Z'
      }
    ])

    await harness.database.insert(teams).values([
      {
        id: 'team_current',
        eventId: 'event_current',
        name: 'Current Team',
        slug: 'current-team',
        createdByUserId: 'participant_1'
      }
    ])

    await harness.database.insert(teamMembers).values({
      id: 'membership_current',
      teamId: 'team_current',
      userId: 'participant_1',
      role: 'admin',
      joinedAt: '2026-03-20T16:00:00.000Z',
      leftAt: null
    })

    await harness.database.insert(submissions).values({
      id: 'submission_current',
      teamId: 'team_current',
      status: 'submitted',
      projectName: 'Current Project',
      submittedAt: '2026-03-24T11:00:00.000Z',
      createdAt: '2026-03-24T10:00:00.000Z',
      updatedAt: '2026-03-24T11:00:00.000Z'
    })

    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_staff_current',
      eventId: 'event_current',
      userId: 'participant_1',
      role: 'staff',
      isStaff: true,
      createdAt: '2026-03-20T17:00:00.000Z'
    })

    const response = await harness.request('/api/account/events')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        current: [
          {
            id: 'event_current',
            eventType: 'hackathon',
            slug: 'current-event',
            startsAt: '2026-03-23T12:00:00.000Z',
            maxTeamMembers: 5,
            applicationStatus: 'approved',
            team: {
              id: 'team_current',
              slug: 'current-team',
              role: 'admin'
            },
            submissionStatus: 'submitted',
            roles: ['staff']
          }
        ],
        past: [
          {
            id: 'event_past',
            eventType: 'hackathon',
            slug: 'past-event',
            startsAt: '2026-01-13T12:00:00.000Z',
            maxTeamMembers: 4,
            applicationStatus: 'approved',
            team: null,
            submissionStatus: null,
            roles: []
          }
        ]
      }
    })
  })

  test('GET /api/account/events hides street address for non-approved participants without staff access', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events', handler: accountEventsGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|participant',
        email: 'participant@example.com',
        name: 'Participant'
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'creator_1',
        auth0Subject: 'auth0|creator',
        email: 'creator@example.com',
        displayName: 'Creator'
      },
      {
        id: 'participant_1',
        auth0Subject: 'auth0|participant',
        email: 'participant@example.com',
        displayName: 'Participant'
      }
    ])

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
        id: 'acceptance_privacy_1',
        userId: 'participant_1',
        platformDocumentId: 'privacy_v1',
        acceptedAt: '2026-03-03T00:00:00.000Z'
      },
      {
        id: 'acceptance_terms_1',
        userId: 'participant_1',
        platformDocumentId: 'terms_v1',
        acceptedAt: '2026-03-03T00:00:00.000Z'
      }
    ])

    await harness.database.insert(events).values([
      {
        id: 'event_submitted',
        eventType: 'hackathon',
        name: 'Submitted Event',
        slug: 'submitted-event',
        description: 'Submitted program',
        city: 'Vienna',
        country: 'Austria',
        address: 'Submitted Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-25T12:00:00.000Z',
        state: 'registration_open',
        maxTeamMembers: 5,
        createdByUserId: 'creator_1'
      },
      {
        id: 'event_staff',
        eventType: 'hackathon',
        name: 'Staff Event',
        slug: 'staff-event',
        description: 'Staff program',
        city: 'Berlin',
        country: 'Germany',
        address: 'Staff Address',
        registrationOpensAt: '2026-03-20T12:00:00.000Z',
        registrationClosesAt: '2026-03-23T12:00:00.000Z',
        submissionOpensAt: '2026-03-23T12:00:00.000Z',
        submissionClosesAt: '2026-03-26T12:00:00.000Z',
        state: 'registration_open',
        maxTeamMembers: 5,
        createdByUserId: 'creator_1'
      }
    ])

    await harness.database.insert(eventTermsDocuments).values({
      id: 'event_submitted_terms_v1',
      eventId: 'event_submitted',
      documentType: 'application_terms',
      version: 1,
      title: 'Submitted application terms',
      content: 'Submitted application terms',
      publishedAt: '2026-03-18T00:00:00.000Z'
    })

    await harness.database.insert(userApplications).values({
      id: 'application_submitted',
      eventId: 'event_submitted',
      userId: 'participant_1',
      status: 'submitted',
      submittedAt: '2026-03-20T13:00:00.000Z',
      applicationTermsDocumentId: 'event_submitted_terms_v1',
      applicationTermsAcceptedAt: '2026-03-20T13:00:00.000Z'
    })

    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_staff',
      eventId: 'event_staff',
      userId: 'participant_1',
      role: 'staff',
      isStaff: true,
      createdAt: '2026-03-20T17:00:00.000Z'
    })

    const response = await harness.request('/api/account/events')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        current: expect.arrayContaining([
          expect.objectContaining({
            slug: 'submitted-event',
            applicationStatus: 'submitted',
            address: '',
            roles: []
          }),
          expect.objectContaining({
            slug: 'staff-event',
            applicationStatus: null,
            address: 'Staff Address',
            roles: ['staff']
          })
        ]),
        past: []
      }
    })
  })

  test('GET /api/session keeps a missing platform account as an authenticated identity even when legacy signup consent claims are present', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      sessionUser: {
        'sub': 'auth0|consented-user',
        'email': 'consented-user@example.com',
        'name': 'Consented User',
        'https://codex-events/consents/privacy_policy': true,
        'https://codex-events/consents/platform_terms': true
      }
    })
    databases.push(harness)

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

    const response = await harness.request('/api/session')
    const createdUser = await harness.database.query.users.findFirst({
      where: eq(users.auth0Subject, 'auth0|consented-user')
    })
    const acceptances = await harness.database.select().from(userPlatformDocumentAcceptances)
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        actor: {
          kind: 'authenticated_identity',
          hasPlatformAccount: false,
          hasAcceptedCurrentPlatformDocuments: false,
          platformUser: null
        }
      }
    })
    expect(createdUser).toBeUndefined()
    expect(acceptances).toHaveLength(0)
    expect(auditEntries).toHaveLength(0)
  })

  test('GET /api/session does not promote the configured first platform admin during actor resolution', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      runtimeConfig: {
        firstPlatformAdminEmail: 'First-Admin@Example.com'
      },
      sessionUser: {
        sub: 'auth0|first-admin',
        email: 'first-admin@example.com',
        email_verified: true,
        name: 'First Admin'
      }
    })
    databases.push(harness)

    await seedAcceptedPlatformUser(harness, {
      id: 'first_admin',
      auth0Subject: 'auth0|first-admin',
      email: 'first-admin@example.com'
    })

    const response = await harness.request('/api/session')
    const configuredUser = await harness.database.query.users.findFirst({
      where: eq(users.id, 'first_admin')
    })
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        actor: {
          kind: 'platform_user',
          isPlatformAdmin: false,
          platformUser: {
            id: 'first_admin',
            isPlatformAdmin: false
          }
        }
      }
    })
    expect(configuredUser?.isPlatformAdmin).toBe(false)
    expect(auditEntries).toHaveLength(0)
  })

  test('GET /api/session leaves the configured email unchanged when another platform admin exists', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      runtimeConfig: {
        firstPlatformAdminEmail: 'first-admin@example.com'
      },
      sessionUser: {
        sub: 'auth0|first-admin',
        email: 'first-admin@example.com',
        email_verified: true,
        name: 'First Admin'
      }
    })
    databases.push(harness)

    await seedAcceptedPlatformUser(harness, {
      id: 'first_admin',
      auth0Subject: 'auth0|first-admin',
      email: 'first-admin@example.com'
    })
    await harness.database.insert(users).values({
      id: 'existing_admin',
      auth0Subject: 'auth0|existing-admin',
      email: 'existing-admin@example.com',
      displayName: 'Existing Admin',
      isPlatformAdmin: true
    })

    const response = await harness.request('/api/session')
    const configuredUser = await harness.database.query.users.findFirst({
      where: eq(users.id, 'first_admin')
    })
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        actor: {
          isPlatformAdmin: false,
          platformUser: {
            id: 'first_admin',
            isPlatformAdmin: false
          }
        }
      }
    })
    expect(configuredUser?.isPlatformAdmin).toBe(false)
    expect(auditEntries).toHaveLength(0)
  })

  test('GET /api/session does not expose app-runtime account-link metadata for verified social identities', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      sessionUser: {
        sub: 'google-oauth2|existing-google-user',
        email: 'existing-user@example.com',
        email_verified: true,
        name: 'Existing User'
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'existing_platform_user',
      auth0Subject: 'auth0|existing-password-user',
      email: 'existing-user@example.com',
      displayName: 'Existing User'
    })

    const response = await harness.request('/api/session')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        actor: {
          kind: 'authenticated_identity',
          hasPlatformAccount: false,
          platformUser: null
        }
      }
    })
  })

  test('GET /api/session exposes a derived GitHub profile URL for GitHub-backed sessions', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      sessionUser: {
        sub: 'github|fixture-user',
        email: 'fixture-user@example.com',
        nickname: 'fixture-user',
        name: 'Fixture User'
      }
    })
    databases.push(harness)

    const response = await harness.request('/api/session')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        actor: {
          kind: 'authenticated_identity',
          sessionUser: {
            sub: 'github|fixture-user',
            githubProfileUrl: 'https://github.com/fixture-user'
          }
        }
      }
    })
  })

  test('GET /api/session resolves the primary account without reconciling Auth0 Action claims', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      sessionUser: {
        sub: 'auth0|existing-password-user',
        email: 'existing-user@example.com',
        email_verified: true,
        name: 'Existing User',
        [linkedAuth0SubjectsClaim]: [
          'auth0|existing-password-user',
          'google-oauth2|existing-google-user'
        ]
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'existing_platform_user',
      auth0Subject: 'auth0|existing-password-user',
      email: 'existing-user@example.com',
      displayName: 'Existing User'
    })

    const response = await harness.request('/api/session')
    const storedGoogleIdentity = await harness.database.query.userAuthIdentities.findFirst({
      where: eq(userAuthIdentities.auth0Subject, 'google-oauth2|existing-google-user')
    })
    const responseBody = await response.json()

    expect(response.status).toBe(200)
    expect(responseBody).toMatchObject({
      data: {
        actor: {
          kind: 'platform_user',
          hasPlatformAccount: true,
          platformUser: {
            id: 'existing_platform_user',
            email: 'existing-user@example.com'
          }
        }
      }
    })
    expect(responseBody.data.actor.sessionUser).not.toHaveProperty('linkedAuth0Subjects')
    expect(storedGoogleIdentity).toBeUndefined()
  })

  test('GET /api/session resolves an existing linked Auth0 identity', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      sessionUser: {
        sub: 'google-oauth2|existing-google-user',
        email: 'existing-user@example.com',
        email_verified: true,
        name: 'Existing User'
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'existing_platform_user',
      auth0Subject: 'auth0|existing-password-user',
      email: 'existing-user@example.com',
      displayName: 'Existing User'
    })
    await harness.database.insert(userAuthIdentities).values({
      id: 'existing_google_identity',
      userId: 'existing_platform_user',
      auth0Subject: 'google-oauth2|existing-google-user',
      createdAt: '2026-03-02T00:00:00.000Z'
    })

    const response = await harness.request('/api/session')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        actor: {
          kind: 'platform_user',
          hasPlatformAccount: true,
          platformUser: {
            id: 'existing_platform_user',
            email: 'existing-user@example.com'
          }
        }
      }
    })
  })

  test('GET /api/session marks a platform account consent-blocked when current required platform documents are not accepted', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      sessionUser: {
        sub: 'auth0|consent-blocked-user',
        email: 'consent-blocked@example.com',
        name: 'Consent Blocked'
      },
      autoAcceptCurrentPlatformDocuments: false
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'user_consent_blocked',
      auth0Subject: 'auth0|consent-blocked-user',
      email: 'consent-blocked@example.com',
      displayName: 'Consent Blocked'
    })
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

    const response = await harness.request('/api/session')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        actor: {
          kind: 'platform_user',
          hasPlatformAccount: true,
          hasAcceptedCurrentPlatformDocuments: false,
          platformUser: {
            id: 'user_consent_blocked'
          }
        }
      }
    })
  })

  test('GET /api/platform-documents/current returns current documents publicly', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/platform-documents/current', handler: platformDocumentCurrentGetHandler }
      ]
    })
    databases.push(harness)

    await harness.database.insert(platformDocuments).values([
      {
        id: 'privacy_v1',
        documentType: 'privacy_policy',
        version: 1,
        title: 'Privacy Policy v1',
        content: 'Old privacy',
        publishedAt: '2026-03-01T00:00:00.000Z'
      },
      {
        id: 'privacy_v2',
        documentType: 'privacy_policy',
        version: 2,
        title: 'Privacy Policy v2',
        content: 'Current privacy',
        publishedAt: '2026-03-02T00:00:00.000Z'
      },
      {
        id: 'terms_v1',
        documentType: 'platform_terms',
        version: 1,
        title: 'Platform Terms v1',
        content: 'Current terms',
        publishedAt: '2026-03-03T00:00:00.000Z'
      }
    ])

    const response = await harness.request('/api/platform-documents/current')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        privacy_policy: {
          id: 'privacy_v2',
          version: 2
        },
        platform_terms: {
          id: 'terms_v1',
          version: 1
        }
      }
    })
  })

  test('GET /api/platform-legal-settings/current returns deployment legal settings publicly', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'get',
          path: '/api/platform-legal-settings/current',
          handler: platformLegalSettingsCurrentGetHandler
        }
      ]
    })
    databases.push(harness)

    const missingResponse = await harness.request('/api/platform-legal-settings/current')

    expect(missingResponse.status).toBe(200)
    expect(await missingResponse.json()).toEqual({
      data: null
    })

    await harness.database.insert(platformLegalSettings).values({
      id: 'default',
      supportEmail: 'support@example.com',
      imprintContent: 'Example imprint.'
    })

    const configuredResponse = await harness.request('/api/platform-legal-settings/current')

    expect(configuredResponse.status).toBe(200)
    expect(await configuredResponse.json()).toMatchObject({
      data: {
        id: 'default',
        supportEmail: 'support@example.com',
        imprintContent: 'Example imprint.'
      }
    })
  })

  test('GET /api/platform-settings/current returns event defaults publicly', async () => {
    const defaultBackgroundUrl = 'http://localhost/api/public/platform/event-default-background-image'
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'get',
          path: '/api/platform-settings/current',
          handler: platformSettingsCurrentGetHandler
        }
      ]
    })
    databases.push(harness)

    const missingResponse = await harness.request('/api/platform-settings/current')

    expect(missingResponse.status).toBe(200)
    expect(await missingResponse.json()).toEqual({
      data: null
    })

    await harness.database.insert(platformSettings).values({
      id: 'default',
      defaultEventBackgroundImageUrl: defaultBackgroundUrl,
      defaultEventBackgroundImageObjectKey: 'platform/default-event-background/fixture-1',
      defaultEventBackgroundImageRevision: 1
    })

    const configuredResponse = await harness.request('/api/platform-settings/current')

    expect(configuredResponse.status).toBe(200)
    expect(await configuredResponse.json()).toMatchObject({
      data: {
        id: 'default',
        defaultEventBackgroundImageUrl: `${defaultBackgroundUrl}?variant=background&v=1`,
        defaultEventBackgroundImageRevision: 1
      }
    })
  })

  test('PATCH /api/platform-legal-settings/current upserts settings for platform admins only', async () => {
    const regularHarness = createApiRouteTestHarness({
      routes: [
        {
          method: 'patch',
          path: '/api/platform-legal-settings/current',
          handler: platformLegalSettingsCurrentPatchHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|regular-user',
        email: 'regular@example.com'
      }
    })
    databases.push(regularHarness)
    await seedAcceptedPlatformUser(regularHarness, {
      id: 'regular_user',
      auth0Subject: 'auth0|regular-user',
      email: 'regular@example.com'
    })

    const body = {
      supportEmail: 'support@example.com',
      imprintContent: 'Example imprint.'
    }

    const forbiddenResponse = await regularHarness.request('/api/platform-legal-settings/current', {
      method: 'PATCH',
      body: JSON.stringify(body)
    })

    expect(forbiddenResponse.status).toBe(403)
    expect(await forbiddenResponse.json()).toMatchObject({
      error: {
        code: 'platform_admin_required'
      }
    })

    const adminHarness = createApiRouteTestHarness({
      routes: [
        {
          method: 'patch',
          path: '/api/platform-legal-settings/current',
          handler: platformLegalSettingsCurrentPatchHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform-admin',
        email: 'admin@example.com'
      }
    })
    databases.push(adminHarness)
    await seedAcceptedPlatformUser(adminHarness, {
      id: 'platform_admin',
      auth0Subject: 'auth0|platform-admin',
      email: 'admin@example.com',
      isPlatformAdmin: true
    })

    const obsoleteContractResponse = await adminHarness.request('/api/platform-legal-settings/current', {
      method: 'PATCH',
      body: JSON.stringify({
        ...body,
        privacyEmail: 'privacy@example.com'
      })
    })

    expect(obsoleteContractResponse.status).toBe(400)
    expect(await obsoleteContractResponse.json()).toMatchObject({
      error: {
        code: 'invalid_request'
      }
    })

    const successResponse = await adminHarness.request('/api/platform-legal-settings/current', {
      method: 'PATCH',
      body: JSON.stringify(body)
    })
    const storedSettings = await adminHarness.database.query.platformLegalSettings.findFirst({
      where: eq(platformLegalSettings.id, 'default')
    })
    const auditRows = await adminHarness.database.select().from(auditLogs)

    expect(successResponse.status).toBe(200)
    expect(await successResponse.json()).toMatchObject({
      data: {
        id: 'default',
        supportEmail: 'support@example.com',
        imprintContent: 'Example imprint.'
      }
    })
    expect(storedSettings).toMatchObject({
      id: 'default',
      supportEmail: 'support@example.com',
      imprintContent: 'Example imprint.'
    })
    expect(auditRows).toEqual([
      expect.objectContaining({
        actorUserId: 'platform_admin',
        entityType: 'platform_legal_settings',
        entityId: 'default',
        action: 'platform_legal_settings.created'
      })
    ])
  })

  test('platform default event background upload and removal are platform-admin only', async () => {
    const defaultBackgroundUrl = 'http://localhost/api/public/platform/event-default-background-image'
    const regularHarness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/platform-settings/event-default-background-image',
          handler: platformSettingsDefaultBackgroundPostHandler
        },
        {
          method: 'delete',
          path: '/api/platform-settings/event-default-background-image',
          handler: platformSettingsDefaultBackgroundDeleteHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|regular-background-user',
        email: 'regular-background-user@example.com'
      }
    })
    databases.push(regularHarness)
    await seedAcceptedPlatformUser(regularHarness, {
      id: 'regular_background_user',
      auth0Subject: 'auth0|regular-background-user',
      email: 'regular-background-user@example.com'
    })

    const forbiddenUploadForm = new FormData()
    forbiddenUploadForm.append(
      'file',
      new Blob([pngSignatureBytes], { type: 'image/png' }),
      'background.png'
    )

    const forbiddenUploadResponse = await regularHarness.request(
      '/api/platform-settings/event-default-background-image',
      {
        method: 'POST',
        body: forbiddenUploadForm
      }
    )
    const forbiddenDeleteResponse = await regularHarness.request(
      '/api/platform-settings/event-default-background-image',
      {
        method: 'DELETE'
      }
    )

    expect(forbiddenUploadResponse.status).toBe(403)
    expect(await forbiddenUploadResponse.json()).toMatchObject({
      error: {
        code: 'platform_admin_required'
      }
    })
    expect(forbiddenDeleteResponse.status).toBe(403)
    expect(await forbiddenDeleteResponse.json()).toMatchObject({
      error: {
        code: 'platform_admin_required'
      }
    })

    const eventImagesBucket = new InMemoryR2Bucket()
    const adminHarness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/platform-settings/event-default-background-image',
          handler: platformSettingsDefaultBackgroundPostHandler
        },
        {
          method: 'delete',
          path: '/api/platform-settings/event-default-background-image',
          handler: platformSettingsDefaultBackgroundDeleteHandler
        },
        {
          method: 'get',
          path: '/api/public/platform/event-default-background-image',
          handler: publicPlatformDefaultEventBackgroundGetHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform-background-admin',
        email: 'platform-background-admin@example.com'
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
    databases.push(adminHarness)
    const expectCleanupRecorded = async (objectKey: string) => {
      const rows = await adminHarness.database.select().from(mediaCleanupOutbox).where(and(
        eq(mediaCleanupOutbox.kind, 'platform_default_event_background'),
        eq(mediaCleanupOutbox.objectKey, objectKey)
      ))

      expect(rows).toHaveLength(1)
    }
    await seedAcceptedPlatformUser(adminHarness, {
      id: 'platform_background_admin',
      auth0Subject: 'auth0|platform-background-admin',
      email: 'platform-background-admin@example.com',
      isPlatformAdmin: true
    })

    const missingImageResponse = await adminHarness.request('/api/public/platform/event-default-background-image')

    expect(missingImageResponse.status).toBe(404)
    expect(await missingImageResponse.json()).toMatchObject({
      error: {
        code: 'platform_default_event_background_image_not_found'
      }
    })

    const uploadForm = new FormData()
    uploadForm.append(
      'file',
      new Blob([pngSignatureBytes], { type: 'image/png' }),
      'default-background.png'
    )

    const uploadResponse = await adminHarness.request('/api/platform-settings/event-default-background-image', {
      method: 'POST',
      body: uploadForm
    })
    const storedSettings = await adminHarness.database.query.platformSettings.findFirst({
      where: eq(platformSettings.id, 'default')
    })

    expect(uploadResponse.status).toBe(200)
    expect(await uploadResponse.json()).toMatchObject({
      data: {
        id: 'default',
        defaultEventBackgroundImageUrl: `${defaultBackgroundUrl}?variant=background&v=1`,
        defaultEventBackgroundImageRevision: 1
      }
    })
    expect(storedSettings).toMatchObject({
      id: 'default',
      defaultEventBackgroundImageUrl: defaultBackgroundUrl,
      defaultEventBackgroundImageRevision: 1
    })
    expect(storedSettings?.defaultEventBackgroundImageObjectKey).toMatch(/^platform\/default-event-background\//)

    const imageResponse = await adminHarness.request('/api/public/platform/event-default-background-image')

    expect(imageResponse.status).toBe(404)

    const versionedImageResponse = await adminHarness.request(
      `/api/public/platform/event-default-background-image?variant=background&v=${storedSettings!.defaultEventBackgroundImageRevision}`,
      {
        headers: {
          accept: 'image/avif,image/webp;q=0.8'
        }
      }
    )

    expect(versionedImageResponse.status).toBe(200)
    expect(versionedImageResponse.headers.get('cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(versionedImageResponse.headers.get('cloudflare-cdn-cache-control')).toBe('public, max-age=30, stale-if-error=0')
    expect(versionedImageResponse.headers.get('content-type')).toBe('image/webp')
    expect(versionedImageResponse.headers.get('vary')).toBe('Accept')

    const replacementUploadForm = new FormData()
    replacementUploadForm.append(
      'file',
      new Blob([pngSignatureBytes], { type: 'image/png' }),
      'replacement-background.png'
    )

    const replacementUploadResponse = await adminHarness.request('/api/platform-settings/event-default-background-image', {
      method: 'POST',
      body: replacementUploadForm
    })
    const replacedSettings = await adminHarness.database.query.platformSettings.findFirst({
      where: eq(platformSettings.id, 'default')
    })

    expect(replacementUploadResponse.status).toBe(200)
    expect(replacedSettings?.defaultEventBackgroundImageRevision).toBe(storedSettings!.defaultEventBackgroundImageRevision + 1)
    expect(replacedSettings?.defaultEventBackgroundImageObjectKey).not.toBe(storedSettings!.defaultEventBackgroundImageObjectKey)
    expect(await eventImagesBucket.get(storedSettings!.defaultEventBackgroundImageObjectKey!)).not.toBeNull()
    await expectCleanupRecorded(storedSettings!.defaultEventBackgroundImageObjectKey!)
    expect((await adminHarness.request(
      `/api/public/platform/event-default-background-image?variant=background&v=${storedSettings!.defaultEventBackgroundImageRevision}`
    )).status).toBe(404)

    const deleteResponse = await adminHarness.request('/api/platform-settings/event-default-background-image', {
      method: 'DELETE'
    })
    const clearedSettings = await adminHarness.database.query.platformSettings.findFirst({
      where: eq(platformSettings.id, 'default')
    })

    expect(deleteResponse.status).toBe(200)
    expect(await deleteResponse.json()).toMatchObject({
      data: {
        id: 'default',
        defaultEventBackgroundImageUrl: null
      }
    })
    expect(clearedSettings).toMatchObject({
      id: 'default',
      defaultEventBackgroundImageUrl: null,
      defaultEventBackgroundImageObjectKey: null,
      defaultEventBackgroundImageRevision: replacedSettings!.defaultEventBackgroundImageRevision + 1
    })
    expect(await eventImagesBucket.get(replacedSettings!.defaultEventBackgroundImageObjectKey!)).not.toBeNull()
    await expectCleanupRecorded(replacedSettings!.defaultEventBackgroundImageObjectKey!)

    const removedImageResponse = await adminHarness.request('/api/public/platform/event-default-background-image')
    const auditRows = await adminHarness.database.select().from(auditLogs)

    expect(removedImageResponse.status).toBe(404)
    expect(await removedImageResponse.json()).toMatchObject({
      error: {
        code: 'platform_default_event_background_image_not_found'
      }
    })
    expect((await adminHarness.request(
      `/api/public/platform/event-default-background-image?variant=background&v=${replacedSettings!.defaultEventBackgroundImageRevision}`
    )).status).toBe(404)
    expect(auditRows).toEqual([
      expect.objectContaining({
        actorUserId: 'platform_background_admin',
        entityType: 'platform_settings',
        entityId: 'default',
        action: 'platform_settings.created'
      }),
      expect.objectContaining({
        actorUserId: 'platform_background_admin',
        entityType: 'platform_settings',
        entityId: 'default',
        action: 'platform_settings.updated'
      }),
      expect.objectContaining({
        actorUserId: 'platform_background_admin',
        entityType: 'platform_settings',
        entityId: 'default',
        action: 'platform_settings.updated'
      })
    ])
  })

  test('POST /api/platform-settings/event-default-background-image rejects invalid image files', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/platform-settings/event-default-background-image',
          handler: platformSettingsDefaultBackgroundPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform-invalid-background-admin',
        email: 'platform-invalid-background-admin@example.com'
      },
      cloudflareEnv: {
        [eventImagesBindingName]: new InMemoryR2Bucket(),
        [authenticatedUploadRateLimitBindingName]: createRateLimiter()
      },
      runtimeConfig: {
        eventImages: {
          binding: eventImagesBindingName
        }
      }
    })
    databases.push(harness)
    await seedAcceptedPlatformUser(harness, {
      id: 'platform_invalid_background_admin',
      auth0Subject: 'auth0|platform-invalid-background-admin',
      email: 'platform-invalid-background-admin@example.com',
      isPlatformAdmin: true
    })

    const invalidImageForm = new FormData()
    invalidImageForm.append(
      'file',
      new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }),
      'default-background.png'
    )

    const invalidTypeResponse = await harness.request('/api/platform-settings/event-default-background-image', {
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
      'default-background.png'
    )

    const oversizedResponse = await harness.request('/api/platform-settings/event-default-background-image', {
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

  test('POST /api/platform-settings/event-default-background-image returns 429 when upload rate limited', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/platform-settings/event-default-background-image',
          handler: platformSettingsDefaultBackgroundPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|platform-rate-limited-background-admin',
        email: 'platform-rate-limited-background-admin@example.com'
      },
      cloudflareEnv: {
        [eventImagesBindingName]: new InMemoryR2Bucket(),
        [authenticatedUploadRateLimitBindingName]: createRateLimiter(false)
      },
      runtimeConfig: {
        eventImages: {
          binding: eventImagesBindingName
        }
      }
    })
    databases.push(harness)
    await seedAcceptedPlatformUser(harness, {
      id: 'platform_rate_limited_background_admin',
      auth0Subject: 'auth0|platform-rate-limited-background-admin',
      email: 'platform-rate-limited-background-admin@example.com',
      isPlatformAdmin: true
    })

    const uploadForm = new FormData()
    uploadForm.append(
      'file',
      new Blob([pngSignatureBytes], { type: 'image/png' }),
      'default-background.png'
    )

    const response = await harness.request('/api/platform-settings/event-default-background-image', {
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

  test('GET /api/platform-documents/:documentType/versions requires auth and lists versions descending', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'get',
          path: '/api/platform-documents/:documentType/versions',
          handler: platformDocumentVersionsGetHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|reader',
        email: 'reader@example.com'
      }
    })
    databases.push(harness)

    await harness.database.insert(platformDocuments).values([
      {
        id: 'privacy_v1',
        documentType: 'privacy_policy',
        version: 1,
        title: 'Privacy Policy v1',
        content: 'One',
        publishedAt: '2026-03-01T00:00:00.000Z'
      },
      {
        id: 'privacy_v2',
        documentType: 'privacy_policy',
        version: 2,
        title: 'Privacy Policy v2',
        content: 'Two',
        publishedAt: '2026-03-02T00:00:00.000Z'
      }
    ])

    const response = await harness.request('/api/platform-documents/privacy_policy/versions')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: [
        { id: 'privacy_v2', version: 2 },
        { id: 'privacy_v1', version: 1 }
      ],
      meta: {
        total: 2
      }
    })
  })

  test('POST /api/platform-documents/:documentType/versions publishes append-only versions for platform admins only', async () => {
    const regularHarness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/platform-documents/:documentType/versions',
          handler: platformDocumentVersionsPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|document-regular-user',
        email: 'document-regular@example.com'
      }
    })
    databases.push(regularHarness)
    await seedAcceptedPlatformUser(regularHarness, {
      id: 'document_regular_user',
      auth0Subject: 'auth0|document-regular-user',
      email: 'document-regular@example.com'
    })

    const forbiddenResponse = await regularHarness.request('/api/platform-documents/privacy_policy/versions', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Privacy Policy v2',
        content: 'Updated privacy'
      })
    })

    expect(forbiddenResponse.status).toBe(403)
    expect(await forbiddenResponse.json()).toMatchObject({
      error: {
        code: 'platform_admin_required'
      }
    })

    const adminHarness = createApiRouteTestHarness({
      routes: [
        {
          method: 'post',
          path: '/api/platform-documents/:documentType/versions',
          handler: platformDocumentVersionsPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|document-platform-admin',
        email: 'document-admin@example.com'
      }
    })
    databases.push(adminHarness)
    await seedAcceptedPlatformUser(adminHarness, {
      id: 'document_platform_admin',
      auth0Subject: 'auth0|document-platform-admin',
      email: 'document-admin@example.com',
      isPlatformAdmin: true
    })

    const successResponse = await adminHarness.request('/api/platform-documents/privacy_policy/versions', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Privacy Policy v2',
        content: 'Updated privacy',
        publishedAt: '2026-05-06T12:00:00.000Z'
      })
    })
    const privacyDocuments = await adminHarness.database.query.platformDocuments.findMany({
      where: eq(platformDocuments.documentType, 'privacy_policy')
    })
    const auditRows = await adminHarness.database.select().from(auditLogs)

    expect(successResponse.status).toBe(200)
    expect(await successResponse.json()).toMatchObject({
      data: {
        documentType: 'privacy_policy',
        version: 2,
        title: 'Privacy Policy v2',
        content: 'Updated privacy',
        publishedAt: '2026-05-06T12:00:00.000Z'
      }
    })
    expect(privacyDocuments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'privacy_v1',
        version: 1,
        content: 'Privacy'
      }),
      expect.objectContaining({
        version: 2,
        content: 'Updated privacy'
      })
    ]))
    expect(auditRows).toContainEqual(expect.objectContaining({
      actorUserId: 'document_platform_admin',
      entityType: 'platform_document',
      action: 'platform_document.created',
      metadata: {
        documentType: 'privacy_policy',
        version: 2
      }
    }))
  })

  test('platform legal setup APIs allow an unconsented platform admin to publish first-run content', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'patch',
          path: '/api/platform-legal-settings/current',
          handler: platformLegalSettingsCurrentPatchHandler
        },
        {
          method: 'post',
          path: '/api/platform-documents/:documentType/versions',
          handler: platformDocumentVersionsPostHandler
        }
      ],
      sessionUser: {
        sub: 'auth0|first-run-admin',
        email: 'first-run-admin@example.com'
      },
      autoAcceptCurrentPlatformDocuments: false
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'first_run_admin',
      auth0Subject: 'auth0|first-run-admin',
      email: 'first-run-admin@example.com',
      displayName: 'First Run Admin',
      isPlatformAdmin: true
    })

    const settingsResponse = await harness.request('/api/platform-legal-settings/current', {
      method: 'PATCH',
      body: JSON.stringify({
        supportEmail: 'support@example.com',
        imprintContent: 'Example imprint.'
      })
    })
    const privacyResponse = await harness.request('/api/platform-documents/privacy_policy/versions', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Privacy Policy',
        content: 'Initial privacy policy.'
      })
    })
    const termsResponse = await harness.request('/api/platform-documents/platform_terms/versions', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Platform Terms',
        content: 'Initial platform terms.'
      })
    })
    const settings = await harness.database.query.platformLegalSettings.findFirst({
      where: eq(platformLegalSettings.id, 'default')
    })
    const documents = await harness.database.query.platformDocuments.findMany()
    const acceptances = await harness.database.select().from(userPlatformDocumentAcceptances)

    expect(settingsResponse.status).toBe(200)
    expect(privacyResponse.status).toBe(200)
    expect(termsResponse.status).toBe(200)
    expect(settings).toMatchObject({
      supportEmail: 'support@example.com',
      imprintContent: 'Example imprint.'
    })
    expect(documents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        documentType: 'privacy_policy',
        version: 1,
        title: 'Privacy Policy'
      }),
      expect.objectContaining({
        documentType: 'platform_terms',
        version: 1,
        title: 'Platform Terms'
      })
    ]))
    expect(acceptances).toHaveLength(0)
  })

  test('POST /api/platform-document-acceptances records only the current exact document version', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/platform-document-acceptances', handler: platformDocumentAcceptancePostHandler }
      ],
      sessionUser: {
        sub: 'auth0|user',
        email: 'user@example.com'
      },
      autoAcceptCurrentPlatformDocuments: false
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'user_1',
      auth0Subject: 'auth0|user',
      email: 'user@example.com',
      displayName: 'Regular User'
    })

    await harness.database.insert(platformDocuments).values([
      {
        id: 'privacy_v1',
        documentType: 'privacy_policy',
        version: 1,
        title: 'Privacy Policy v1',
        content: 'Old privacy',
        publishedAt: '2026-03-01T00:00:00.000Z'
      },
      {
        id: 'privacy_v2',
        documentType: 'privacy_policy',
        version: 2,
        title: 'Privacy Policy v2',
        content: 'Current privacy',
        publishedAt: '2026-03-02T00:00:00.000Z'
      }
    ])

    const outdatedResponse = await harness.request('/api/platform-document-acceptances', {
      method: 'POST',
      body: JSON.stringify({
        platformDocumentId: 'privacy_v1'
      })
    })

    expect(outdatedResponse.status).toBe(409)
    expect(await outdatedResponse.json()).toMatchObject({
      error: {
        code: 'platform_document_outdated'
      }
    })

    const successResponse = await harness.request('/api/platform-document-acceptances', {
      method: 'POST',
      body: JSON.stringify({
        platformDocumentId: 'privacy_v2'
      })
    })

    expect(successResponse.status).toBe(200)
    expect(await successResponse.json()).toMatchObject({
      data: {
        acceptance: {
          userId: 'user_1',
          platformDocumentId: 'privacy_v2'
        },
        document: {
          id: 'privacy_v2',
          version: 2
        }
      }
    })

    const storedAcceptances = await harness.database.select().from(userPlatformDocumentAcceptances)
    expect(storedAcceptances).toHaveLength(1)
  })

  test('POST /api/account/registration creates the platform user and records required document acceptances', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/registration', handler: accountRegistrationPostHandler },
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      sessionUser: {
        sub: 'auth0|new-user',
        email: 'new-user@example.com',
        email_verified: true,
        name: 'New User'
      }
    })
    databases.push(harness)

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

    const response = await harness.request('/api/account/registration', {
      method: 'POST',
      body: JSON.stringify({
        privacyPolicyDocumentId: 'privacy_v1',
        platformTermsDocumentId: 'terms_v1'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        user: {
          email: 'new-user@example.com',
          displayName: 'New User',
          firstName: '',
          familyName: '',
          githubProfileUrl: null,
          chatgptEmail: null,
          openaiOrgId: null,
          lumaEmail: null,
          lumaUsername: null,
          profileIconUpdatedAt: null
        },
        acceptedDocumentIds: {
          privacyPolicyDocumentId: 'privacy_v1',
          platformTermsDocumentId: 'terms_v1'
        }
      }
    })

    const createdUser = await harness.database.query.users.findFirst({
      where: eq(users.auth0Subject, 'auth0|new-user')
    })
    const createdPrimaryIdentity = await harness.database.query.userAuthIdentities.findFirst({
      where: eq(userAuthIdentities.auth0Subject, 'auth0|new-user')
    })
    const acceptances = await harness.database.select().from(userPlatformDocumentAcceptances)
    const auditEntries = await harness.database.select().from(auditLogs)
    const sessionResponse = await harness.request('/api/session')

    expect(createdUser?.email).toBe('new-user@example.com')
    expect(createdUser?.displayName).toBe('New User')
    expect(createdUser?.firstName).toBe('')
    expect(createdUser?.familyName).toBe('')
    expect(createdUser?.githubProfileUrl).toBeNull()
    expect(createdUser?.chatgptEmail).toBeNull()
    expect(createdUser?.openaiOrgId).toBeNull()
    expect(createdUser?.lumaEmail).toBeNull()
    expect(createdUser?.lumaUsername).toBeNull()
    expect(createdUser?.profileIconUpdatedAt).toBeNull()
    expect(createdPrimaryIdentity).toMatchObject({
      userId: createdUser?.id,
      auth0Subject: 'auth0|new-user'
    })
    expect(acceptances).toHaveLength(2)
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorUserId: createdUser?.id,
        entityType: 'user',
        entityId: createdUser?.id,
        action: 'account.registered'
      })
    ])
    expect(await sessionResponse.json()).toMatchObject({
      data: {
        actor: {
          kind: 'platform_user',
          hasPlatformAccount: true,
          hasAcceptedCurrentPlatformDocuments: true,
          platformUser: {
            id: createdUser?.id,
            email: 'new-user@example.com',
            displayName: 'New User',
            firstName: '',
            familyName: '',
            chatgptEmail: null,
            openaiOrgId: null,
            lumaEmail: null,
            lumaUsername: null,
            profileIconUpdatedAt: null
          }
        }
      }
    })
  })

  test('POST /api/account/registration grants the configured first platform admin', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/registration', handler: accountRegistrationPostHandler }
      ],
      runtimeConfig: {
        firstPlatformAdminEmail: 'First-Admin@Example.com'
      },
      sessionUser: {
        sub: 'auth0|new-first-admin',
        email: 'first-admin@example.com',
        email_verified: true,
        name: 'First Admin'
      }
    })
    databases.push(harness)

    await seedCurrentPlatformDocuments(harness)

    const response = await harness.request('/api/account/registration', {
      method: 'POST',
      body: JSON.stringify({
        privacyPolicyDocumentId: 'privacy_v1',
        platformTermsDocumentId: 'terms_v1'
      })
    })
    const createdUser = await harness.database.query.users.findFirst({
      where: eq(users.auth0Subject, 'auth0|new-first-admin')
    })
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        user: {
          email: 'first-admin@example.com',
          isPlatformAdmin: true
        }
      }
    })
    expect(createdUser?.isPlatformAdmin).toBe(true)
    expect(auditEntries).toHaveLength(2)
    expect(auditEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorUserId: createdUser?.id,
        entityType: 'user',
        entityId: createdUser?.id,
        action: 'account.registered'
      }),
      expect.objectContaining({
        actorUserId: null,
        entityType: 'user',
        entityId: createdUser?.id,
        action: 'platform_admin.first_bootstrap_granted'
      })
    ]))
  })

  test('POST /api/account/registration lets the configured first platform admin create a setup account before legal documents exist', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/registration', handler: accountRegistrationPostHandler }
      ],
      runtimeConfig: {
        firstPlatformAdminEmail: 'First-Admin@Example.com'
      },
      sessionUser: {
        sub: 'auth0|setup-first-admin',
        email: 'first-admin@example.com',
        email_verified: true,
        name: 'First Admin'
      },
      autoAcceptCurrentPlatformDocuments: false
    })
    databases.push(harness)

    const response = await harness.request('/api/account/registration', {
      method: 'POST',
      body: JSON.stringify({})
    })
    const createdUser = await harness.database.query.users.findFirst({
      where: eq(users.auth0Subject, 'auth0|setup-first-admin')
    })
    const createdPrimaryIdentity = await harness.database.query.userAuthIdentities.findFirst({
      where: eq(userAuthIdentities.auth0Subject, 'auth0|setup-first-admin')
    })
    const acceptances = await harness.database.select().from(userPlatformDocumentAcceptances)
    const platformDocumentRows = await harness.database.select().from(platformDocuments)
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        user: {
          email: 'first-admin@example.com',
          isPlatformAdmin: true
        },
        acceptedDocumentIds: {
          privacyPolicyDocumentId: null,
          platformTermsDocumentId: null
        }
      }
    })
    expect(createdUser?.isPlatformAdmin).toBe(true)
    expect(createdPrimaryIdentity).toMatchObject({
      userId: createdUser?.id,
      auth0Subject: 'auth0|setup-first-admin'
    })
    expect(acceptances).toHaveLength(0)
    expect(platformDocumentRows).toHaveLength(0)
    expect(auditEntries).toHaveLength(2)
    expect(auditEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorUserId: createdUser?.id,
        entityType: 'user',
        entityId: createdUser?.id,
        action: 'account.registered'
      }),
      expect.objectContaining({
        actorUserId: null,
        entityType: 'user',
        entityId: createdUser?.id,
        action: 'platform_admin.first_bootstrap_granted'
      })
    ]))
  })

  test('POST /api/account/registration rejects regular setup before legal documents exist', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/registration', handler: accountRegistrationPostHandler }
      ],
      runtimeConfig: {
        firstPlatformAdminEmail: 'first-admin@example.com'
      },
      sessionUser: {
        sub: 'auth0|regular-before-documents',
        email: 'regular-before-documents@example.com',
        email_verified: true,
        name: 'Regular User'
      },
      autoAcceptCurrentPlatformDocuments: false
    })
    databases.push(harness)

    const response = await harness.request('/api/account/registration', {
      method: 'POST',
      body: JSON.stringify({})
    })
    const createdUser = await harness.database.query.users.findFirst({
      where: eq(users.auth0Subject, 'auth0|regular-before-documents')
    })
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'platform_documents_required'
      }
    })
    expect(createdUser).toBeUndefined()
    expect(auditEntries).toHaveLength(0)
  })

  test('POST /api/account/registration stores the GitHub profile URL for GitHub-backed sessions', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/registration', handler: accountRegistrationPostHandler },
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      sessionUser: {
        sub: 'github|new-github-user',
        email: 'new-github-user@example.com',
        email_verified: true,
        nickname: 'new-github-user',
        name: 'New GitHub User'
      }
    })
    databases.push(harness)

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

    const response = await harness.request('/api/account/registration', {
      method: 'POST',
      body: JSON.stringify({
        privacyPolicyDocumentId: 'privacy_v1',
        platformTermsDocumentId: 'terms_v1'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        user: {
          email: 'new-github-user@example.com',
          githubProfileUrl: 'https://github.com/new-github-user'
        }
      }
    })

    const createdUser = await harness.database.query.users.findFirst({
      where: eq(users.auth0Subject, 'github|new-github-user')
    })
    const sessionResponse = await harness.request('/api/session')

    expect(createdUser?.githubProfileUrl).toBe('https://github.com/new-github-user')
    expect(await sessionResponse.json()).toMatchObject({
      data: {
        actor: {
          kind: 'platform_user',
          sessionUser: {
            sub: 'github|new-github-user',
            githubProfileUrl: 'https://github.com/new-github-user'
          },
          platformUser: {
            githubProfileUrl: 'https://github.com/new-github-user'
          }
        }
      }
    })
  })

  test('POST /api/account/registration uses the email as the initial presentation label without seeding canonical names', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/registration', handler: accountRegistrationPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|email-only-user',
        email: 'email-only-user@example.com',
        email_verified: true
      }
    })
    databases.push(harness)

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

    const response = await harness.request('/api/account/registration', {
      method: 'POST',
      body: JSON.stringify({
        privacyPolicyDocumentId: 'privacy_v1',
        platformTermsDocumentId: 'terms_v1'
      })
    })

    const createdUser = await harness.database.query.users.findFirst({
      where: eq(users.auth0Subject, 'auth0|email-only-user')
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        user: {
          email: 'email-only-user@example.com',
          displayName: 'email-only-user@example.com',
          firstName: '',
          familyName: ''
        }
      }
    })
    expect(createdUser).toMatchObject({
      email: 'email-only-user@example.com',
      displayName: 'email-only-user@example.com',
      firstName: '',
      familyName: ''
    })
  })

  test('POST /api/account/registration rejects authenticated identities that do not expose an email address', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/registration', handler: accountRegistrationPostHandler }
      ],
      sessionUser: {
        sub: 'github|missing-email-user',
        nickname: 'missing-email-user'
      }
    })
    databases.push(harness)

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

    const response = await harness.request('/api/account/registration', {
      method: 'POST',
      body: JSON.stringify({
        privacyPolicyDocumentId: 'privacy_v1',
        platformTermsDocumentId: 'terms_v1'
      })
    })

    const createdUser = await harness.database.query.users.findFirst({
      where: eq(users.auth0Subject, 'github|missing-email-user')
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'identity_email_unavailable',
        message: 'The authenticated identity does not expose an email address required for platform account registration.'
      }
    })
    expect(createdUser).toBeUndefined()
  })

  test('POST /api/account/registration rejects identities with unverified or missing email verification before writes', async () => {
    const cases = [
      {
        auth0Subject: 'auth0|unverified-email-user',
        emailVerified: false
      },
      {
        auth0Subject: 'auth0|missing-email-verification-user',
        emailVerified: undefined
      }
    ]

    for (const testCase of cases) {
      const harness = createApiRouteTestHarness({
        routes: [
          { method: 'post', path: '/api/account/registration', handler: accountRegistrationPostHandler }
        ],
        sessionUser: {
          sub: testCase.auth0Subject,
          email: `${testCase.auth0Subject.split('|')[1]}@example.com`,
          ...(testCase.emailVerified === undefined ? {} : { email_verified: testCase.emailVerified }),
          name: 'Unverified User'
        }
      })
      databases.push(harness)

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

      const response = await harness.request('/api/account/registration', {
        method: 'POST',
        body: JSON.stringify({
          privacyPolicyDocumentId: 'privacy_v1',
          platformTermsDocumentId: 'terms_v1'
        })
      })

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({
        error: {
          code: 'identity_email_unverified',
          message: 'Verify your email address with your sign-in provider before creating a platform account.'
        }
      })
      expect(await harness.database.select().from(users)).toHaveLength(0)
      expect(await harness.database.select().from(userAuthIdentities)).toHaveLength(0)
      expect(await harness.database.select().from(userPlatformDocumentAcceptances)).toHaveLength(0)
      expect(await harness.database.select().from(auditLogs)).toHaveLength(0)
    }
  })

  test('POST /api/account/email-verification sends another Auth0 confirmation email for an unverified identity', async () => {
    const auth0Fetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = String(input)

      if (url === 'https://codex-events-test.eu.auth0.com/oauth/token') {
        expect(init?.method).toBe('POST')
        expect(String(init?.body)).toContain('grant_type=client_credentials')
        expect(String(init?.body)).toContain('client_id=management-client-id')

        return new Response(JSON.stringify({
          access_token: 'management-access-token',
          token_type: 'Bearer',
          expires_in: 86400
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        })
      }

      expect(url).toBe('https://codex-events-test.eu.auth0.com/api/v2/jobs/verification-email')
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer management-access-token')
      expect(JSON.parse(String(init?.body))).toEqual({
        user_id: 'auth0|unverified-email-user',
        client_id: 'application-client-id'
      })

      return new Response(JSON.stringify({
        id: 'job_email_verification',
        type: 'verification_email',
        status: 'pending'
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      })
    })
    vi.stubGlobal('fetch', auth0Fetch)

    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/email-verification', handler: accountEmailVerificationPostHandler }
      ],
      runtimeConfig: {
        auth0: {
          domain: 'codex-events-test.eu.auth0.com',
          clientId: 'application-client-id',
          managementClientId: 'management-client-id',
          managementClientSecret: 'management-client-secret'
        }
      },
      sessionUser: {
        sub: 'auth0|unverified-email-user',
        email: 'unverified@example.com',
        email_verified: false,
        name: 'Unverified User'
      }
    })
    databases.push(harness)

    const response = await harness.request('/api/account/email-verification', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        sent: true
      }
    })
    expect(auth0Fetch).toHaveBeenCalledTimes(2)
  })

  test('POST /api/account/email-verification rejects identities that are already verified', async () => {
    const auth0Fetch = vi.fn()
    vi.stubGlobal('fetch', auth0Fetch)

    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/email-verification', handler: accountEmailVerificationPostHandler }
      ],
      runtimeConfig: {
        auth0: {
          domain: 'codex-events-test.eu.auth0.com',
          clientId: 'application-client-id',
          managementClientId: 'management-client-id',
          managementClientSecret: 'management-client-secret'
        }
      },
      sessionUser: {
        sub: 'auth0|verified-email-user',
        email: 'verified@example.com',
        email_verified: true,
        name: 'Verified User'
      }
    })
    databases.push(harness)

    const response = await harness.request('/api/account/email-verification', {
      method: 'POST'
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'identity_email_already_verified',
        message: 'The authenticated identity email address is already confirmed.'
      }
    })
    expect(auth0Fetch).not.toHaveBeenCalled()
  })

  test('POST /api/account/registration rejects an unverified session without an Auth0 refresh', async () => {
    const sessionUser = {
      sub: 'auth0|stale-verification-user',
      email: 'stale-verification@example.com',
      email_verified: false,
      name: 'Stale Verification'
    }
    const getAccessToken = vi.fn(async () => ({
      accessToken: 'userinfo-token',
      audience: 'default',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      scope: 'openid profile email'
    }))
    const userInfoFetch = vi.fn()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/registration', handler: accountRegistrationPostHandler },
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      runtimeConfig: {
        auth0: {
          domain: 'codex-events-test.eu.auth0.com'
        }
      },
      sessionUser
    })
    databases.push(harness)
    vi.stubGlobal('useAuth0', vi.fn(() => ({
      getSession: vi.fn(async () => ({ user: sessionUser })),
      getAccessToken
    })))
    vi.stubGlobal('fetch', userInfoFetch)

    await seedCurrentPlatformDocuments(harness)

    const sessionResponse = await harness.request('/api/session')

    expect(sessionResponse.status).toBe(200)
    expect(await sessionResponse.json()).toMatchObject({
      data: {
        actor: {
          kind: 'authenticated_identity',
          sessionUser: {
            email: sessionUser.email,
            email_verified: false
          }
        }
      }
    })

    const registrationResponse = await harness.request('/api/account/registration', {
      method: 'POST',
      body: JSON.stringify({
        privacyPolicyDocumentId: 'privacy_v1',
        platformTermsDocumentId: 'terms_v1'
      })
    })
    const createdUser = await harness.database.query.users.findFirst({
      where: eq(users.auth0Subject, sessionUser.sub)
    })

    expect(registrationResponse.status).toBe(409)
    expect(await registrationResponse.json()).toMatchObject({
      error: {
        code: 'identity_email_unverified'
      }
    })
    expect(createdUser).toBeUndefined()
    expect(getAccessToken).not.toHaveBeenCalled()
    expect(userInfoFetch).not.toHaveBeenCalled()
  })

  test('POST /api/account/registration rejects outdated or mismatched platform document ids', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/registration', handler: accountRegistrationPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|registration-guard-user',
        email: 'registration-guard@example.com',
        email_verified: true,
        name: 'Registration Guard'
      }
    })
    databases.push(harness)

    await harness.database.insert(platformDocuments).values([
      {
        id: 'privacy_v1',
        documentType: 'privacy_policy',
        version: 1,
        title: 'Privacy Policy v1',
        content: 'Old privacy',
        publishedAt: '2026-03-01T00:00:00.000Z'
      },
      {
        id: 'privacy_v2',
        documentType: 'privacy_policy',
        version: 2,
        title: 'Privacy Policy v2',
        content: 'Current privacy',
        publishedAt: '2026-03-02T00:00:00.000Z'
      },
      {
        id: 'terms_v1',
        documentType: 'platform_terms',
        version: 1,
        title: 'Platform Terms v1',
        content: 'Current terms',
        publishedAt: '2026-03-03T00:00:00.000Z'
      }
    ])

    const outdatedResponse = await harness.request('/api/account/registration', {
      method: 'POST',
      body: JSON.stringify({
        privacyPolicyDocumentId: 'privacy_v1',
        platformTermsDocumentId: 'terms_v1'
      })
    })

    expect(outdatedResponse.status).toBe(409)
    expect(await outdatedResponse.json()).toMatchObject({
      error: {
        code: 'platform_document_outdated',
        details: {
          documentType: 'privacy_policy'
        }
      }
    })

    const mismatchedResponse = await harness.request('/api/account/registration', {
      method: 'POST',
      body: JSON.stringify({
        privacyPolicyDocumentId: 'terms_v1',
        platformTermsDocumentId: 'terms_v1'
      })
    })

    expect(mismatchedResponse.status).toBe(409)
    expect(await mismatchedResponse.json()).toMatchObject({
      error: {
        code: 'platform_document_type_mismatch',
        details: {
          expectedDocumentType: 'privacy_policy',
          actualDocumentType: 'platform_terms'
        }
      }
    })

    const createdUsers = await harness.database.select().from(users)
    const acceptances = await harness.database.select().from(userPlatformDocumentAcceptances)

    expect(createdUsers).toHaveLength(0)
    expect(acceptances).toHaveLength(0)
  })

  test('POST /api/account/registration requests account linking for a verified social identity that matches an existing password account email', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/registration', handler: accountRegistrationPostHandler }
      ],
      sessionUser: {
        sub: 'google-oauth2|existing-google-user',
        email: 'existing-user@example.com',
        email_verified: true,
        name: 'Existing User'
      },
      runtimeConfig: {
        auth0: {
          appBaseUrl: 'https://test.codex-events.com',
          databaseConnectionName: 'Username-Password-Authentication',
          accountLinkChallengeSecret: 'link-secret'
        }
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'existing_platform_user',
      auth0Subject: 'auth0|existing-password-user',
      email: 'existing-user@example.com',
      displayName: 'Existing User'
    })
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

    const response = await harness.request('/api/account/registration', {
      method: 'POST',
      body: JSON.stringify({
        privacyPolicyDocumentId: 'privacy_v1',
        platformTermsDocumentId: 'terms_v1',
        returnTo: '/events/fixture/register'
      })
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'platform_account_link_required',
        details: {
          email: 'existing-user@example.com'
        }
      }
    })
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  test('POST /api/account/registration keeps unverified social identities blocked on existing platform account email conflicts', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/registration', handler: accountRegistrationPostHandler }
      ],
      sessionUser: {
        sub: 'google-oauth2|unverified-google-user',
        email: 'existing-user@example.com',
        email_verified: false,
        name: 'Existing User'
      },
      runtimeConfig: {
        auth0: {
          appBaseUrl: 'https://test.codex-events.com',
          databaseConnectionName: 'Username-Password-Authentication',
          accountLinkChallengeSecret: 'link-secret'
        }
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'existing_platform_user',
      auth0Subject: 'auth0|existing-password-user',
      email: 'existing-user@example.com',
      displayName: 'Existing User'
    })
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

    const response = await harness.request('/api/account/registration', {
      method: 'POST',
      body: JSON.stringify({
        privacyPolicyDocumentId: 'privacy_v1',
        platformTermsDocumentId: 'terms_v1',
        returnTo: '/events/fixture/register'
      })
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'identity_email_unverified',
        message: 'Verify your email address with your sign-in provider before creating a platform account.'
      }
    })
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(await harness.database.select().from(userAuthIdentities)).toHaveLength(1)
    expect(await harness.database.select().from(userPlatformDocumentAcceptances)).toHaveLength(0)
    expect(await harness.database.select().from(auditLogs)).toHaveLength(0)
  })

  test('PATCH /api/account rejects authenticated identities without a platform account', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'patch', path: '/api/account', handler: accountPatchHandler }
      ],
      sessionUser: {
        sub: 'auth0|identity-only',
        email: 'identity-only@example.com',
        name: 'Identity Only'
      }
    })
    databases.push(harness)

    const response = await harness.request('/api/account', {
      method: 'PATCH',
      body: JSON.stringify({
        firstName: 'Identity',
        familyName: 'Only'
      })
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'platform_account_required'
      }
    })
  })

  test('PATCH /api/account rejects platform users who have not accepted the current platform documents', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'patch', path: '/api/account', handler: accountPatchHandler }
      ],
      sessionUser: {
        sub: 'auth0|consent-patch-user',
        email: 'consent-patch@example.com',
        name: 'Consent Patch'
      },
      autoAcceptCurrentPlatformDocuments: false
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'user_consent_patch',
      auth0Subject: 'auth0|consent-patch-user',
      email: 'consent-patch@example.com',
      displayName: 'Consent Patch'
    })
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

    const response = await harness.request('/api/account', {
      method: 'PATCH',
      body: JSON.stringify({
        firstName: 'Consent',
        familyName: 'Patch'
      })
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'platform_consent_required'
      }
    })
  })

  test('PATCH /api/account updates canonical names and display name without changing existing profile urls', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'patch', path: '/api/account', handler: accountPatchHandler }
      ],
      sessionUser: {
        sub: 'auth0|display-name-user',
        email: 'display-name@example.com',
        name: 'Display Name User'
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'user_display_name',
      auth0Subject: 'auth0|display-name-user',
      email: 'display-name@example.com',
      displayName: 'Display Name User',
      firstName: 'Display',
      familyName: 'Name User',
      company: 'Analytical Engines Ltd.',
      bio: 'Builds careful systems.',
      githubProfileUrl: 'https://github.com/display-name-user',
      chatgptEmail: 'display-name@chatgpt.example',
      openaiOrgId: 'org_display_name',
      lumaUsername: 'display-name-user'
    })
    await seedCurrentPlatformDocumentAcceptances(harness, 'user_display_name')

    const response = await harness.request('/api/account', {
      method: 'PATCH',
      body: JSON.stringify({
        firstName: 'Display',
        familyName: 'Name Updated'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        user: {
          id: 'user_display_name',
          displayName: 'Display Name Updated',
          firstName: 'Display',
          familyName: 'Name Updated',
          company: 'Analytical Engines Ltd.',
          bio: 'Builds careful systems.',
          githubProfileUrl: 'https://github.com/display-name-user',
          chatgptEmail: 'display-name@chatgpt.example',
          openaiOrgId: 'org_display_name',
          lumaUsername: 'display-name-user'
        }
      }
    })

    const updatedUser = await harness.database.query.users.findFirst({
      where: eq(users.id, 'user_display_name')
    })

    expect(updatedUser).toMatchObject({
      displayName: 'Display Name Updated',
      firstName: 'Display',
      familyName: 'Name Updated',
      company: 'Analytical Engines Ltd.',
      bio: 'Builds careful systems.',
      githubProfileUrl: 'https://github.com/display-name-user',
      chatgptEmail: 'display-name@chatgpt.example',
      openaiOrgId: 'org_display_name',
      lumaUsername: 'display-name-user'
    })
  })

  test('PATCH /api/account updates the current platform user profile fields', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'patch', path: '/api/account', handler: accountPatchHandler }
      ],
      sessionUser: {
        sub: 'auth0|account-user',
        email: 'account-user@example.com',
        name: 'Account User'
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'user_account',
      auth0Subject: 'auth0|account-user',
      email: 'account-user@example.com',
      displayName: 'Account User',
      firstName: 'Account',
      familyName: 'User'
    })
    await seedCurrentPlatformDocumentAcceptances(harness, 'user_account')

    const response = await harness.request('/api/account', {
      method: 'PATCH',
      body: JSON.stringify({
        firstName: 'Updated',
        familyName: 'Account User',
        company: 'Codex Labs',
        bio: 'Building tools for event participants.',
        xProfileUrl: 'x.com/account-user',
        linkedinProfileUrl: 'linkedin.com/in/account-user',
        githubProfileUrl: '',
        chatgptEmail: 'account-user@chatgpt.example',
        openaiOrgId: 'org_account_user',
        lumaEmail: 'account-user@luma.example'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        user: {
          id: 'user_account',
          displayName: 'Updated Account User',
          firstName: 'Updated',
          familyName: 'Account User',
          company: 'Codex Labs',
          bio: 'Building tools for event participants.',
          xProfileUrl: 'https://x.com/account-user',
          linkedinProfileUrl: 'https://linkedin.com/in/account-user',
          githubProfileUrl: null,
          chatgptEmail: 'account-user@chatgpt.example',
          openaiOrgId: 'org_account_user',
          lumaEmail: 'account-user@luma.example'
        }
      }
    })

    const updatedUser = await harness.database.query.users.findFirst({
      where: eq(users.id, 'user_account')
    })
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(updatedUser).toMatchObject({
      displayName: 'Updated Account User',
      firstName: 'Updated',
      familyName: 'Account User',
      company: 'Codex Labs',
      bio: 'Building tools for event participants.',
      xProfileUrl: 'https://x.com/account-user',
      linkedinProfileUrl: 'https://linkedin.com/in/account-user',
      githubProfileUrl: null,
      chatgptEmail: 'account-user@chatgpt.example',
      openaiOrgId: 'org_account_user',
      lumaEmail: 'account-user@luma.example'
    })
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorUserId: 'user_account',
        entityType: 'user',
        entityId: 'user_account',
        action: 'account.updated'
      })
    ])
  })

  test('PATCH /api/account rejects unsupported social profile URL domains', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'patch', path: '/api/account', handler: accountPatchHandler }
      ],
      sessionUser: {
        sub: 'auth0|domain-user',
        email: 'domain-user@example.com',
        name: 'Domain User'
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'user_domain',
      auth0Subject: 'auth0|domain-user',
      email: 'domain-user@example.com',
      displayName: 'Domain User',
      firstName: 'Domain',
      familyName: 'User'
    })
    await seedCurrentPlatformDocumentAcceptances(harness, 'user_domain')

    const response = await harness.request('/api/account', {
      method: 'PATCH',
      body: JSON.stringify({
        firstName: 'Domain',
        familyName: 'User',
        githubProfileUrl: 'github.cox/domain-user'
      })
    })

    expect(response.status).toBe(400)
  })

  test('profile-icon account routes upload, read, and remove the caller profile icon', async () => {
    const profileIconsBucket = new InMemoryR2Bucket()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/profile-icon', handler: accountProfileIconPostHandler },
        { method: 'get', path: '/api/account/profile-icon', handler: accountProfileIconGetHandler },
        { method: 'delete', path: '/api/account/profile-icon', handler: accountProfileIconDeleteHandler },
        { method: 'get', path: '/api/session', handler: sessionHandler }
      ],
      sessionUser: {
        sub: 'auth0|profile-icon-user',
        email: 'profile-icon-user@example.com',
        name: 'Profile Icon User'
      },
      cloudflareEnv: {
        [profileIconBindingName]: profileIconsBucket,
        [authenticatedUploadRateLimitBindingName]: createRateLimiter()
      },
      runtimeConfig: {
        profileIcons: {
          binding: profileIconBindingName
        }
      }
    })
    databases.push(harness)
    const expectCleanupRecorded = async (objectKey: string) => {
      const rows = await harness.database.select().from(mediaCleanupOutbox).where(and(
        eq(mediaCleanupOutbox.kind, 'profile_icon'),
        eq(mediaCleanupOutbox.objectKey, objectKey)
      ))

      expect(rows).toHaveLength(1)
    }

    await harness.database.insert(users).values({
      id: 'user_profile_icon',
      auth0Subject: 'auth0|profile-icon-user',
      email: 'profile-icon-user@example.com',
      displayName: 'Profile Icon User'
    })
    await seedCurrentPlatformDocumentAcceptances(harness, 'user_profile_icon')

    const uploadForm = new FormData()
    uploadForm.append(
      'file',
      new Blob([pngSignatureBytes], { type: 'image/png' }),
      'profile.png'
    )

    const uploadResponse = await harness.request('/api/account/profile-icon', {
      method: 'POST',
      body: uploadForm
    })

    expect(uploadResponse.status).toBe(200)
    expect(await uploadResponse.json()).toMatchObject({
      data: {
        user: {
          id: 'user_profile_icon',
          profileIconRevision: 1
        }
      }
    })

    const uploadedUser = await harness.database.query.users.findFirst({
      where: eq(users.id, 'user_profile_icon')
    })
    expect(uploadedUser?.profileIconRevision).toBe(1)
    expect(uploadedUser?.profileIconObjectKey).toMatch(/^users\/user_profile_icon\/profile-icon\//)

    const replacementForm = new FormData()
    replacementForm.append(
      'file',
      new Blob([pngSignatureBytes], { type: 'image/png' }),
      'profile-replacement.png'
    )

    const replacementResponse = await harness.request('/api/account/profile-icon', {
      method: 'POST',
      body: replacementForm
    })

    expect(replacementResponse.status).toBe(200)
    const replacedUser = await harness.database.query.users.findFirst({
      where: eq(users.id, 'user_profile_icon')
    })
    expect(replacedUser?.profileIconRevision).toBe(2)
    expect(replacedUser?.profileIconObjectKey).not.toBe(uploadedUser?.profileIconObjectKey)
    expect(await profileIconsBucket.get(uploadedUser!.profileIconObjectKey!)).not.toBeNull()
    await expectCleanupRecorded(uploadedUser!.profileIconObjectKey!)

    const iconResponse = await harness.request('/api/account/profile-icon')

    expect(iconResponse.status).toBe(200)
    expect(iconResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(iconResponse.headers.get('cloudflare-cdn-cache-control')).toBeNull()
    expect(iconResponse.headers.get('vary')).toBe('Cookie')
    expect(iconResponse.headers.get('content-type')).toBe('image/png')
    expect(iconResponse.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await iconResponse.arrayBuffer())).toEqual(pngSignatureBytes)

    const sessionResponse = await harness.request('/api/session')
    const sessionPayload = await sessionResponse.json()

    expect(sessionPayload).toMatchObject({
      data: {
        actor: {
          platformUser: {
            profileIconUpdatedAt: expect.any(String)
          }
        }
      }
    })

    const removeResponse = await harness.request('/api/account/profile-icon', {
      method: 'DELETE'
    })

    expect(removeResponse.status).toBe(200)
    expect(await removeResponse.json()).toMatchObject({
      data: {
        user: {
          id: 'user_profile_icon',
          profileIconUpdatedAt: null,
          profileIconRevision: null
        }
      }
    })

    const removedUser = await harness.database.query.users.findFirst({
      where: eq(users.id, 'user_profile_icon')
    })
    expect(removedUser?.profileIconRevision).toBe(3)
    expect(removedUser?.profileIconObjectKey).toBeNull()
    expect(await profileIconsBucket.get(replacedUser!.profileIconObjectKey!)).not.toBeNull()
    await expectCleanupRecorded(replacedUser!.profileIconObjectKey!)

    const removedIconResponse = await harness.request('/api/account/profile-icon')

    expect(removedIconResponse.status).toBe(404)
    expect(await removedIconResponse.json()).toMatchObject({
      error: {
        code: 'profile_icon_not_found'
      }
    })
  })

  test('GET /api/account/profile-icon supports event-scoped participant visibility reads', async () => {
    const profileIconsBucket = new InMemoryR2Bucket()
    await profileIconsBucket.put(
      'users/user_participant_icon/profile-icon/fixture-1',
      pngSignatureBytes,
      {
        httpMetadata: {
          contentType: 'image/png'
        }
      }
    )

    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/profile-icon', handler: accountProfileIconGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|event-admin-profile-icon',
        email: 'event-admin-profile-icon@example.com',
        name: 'Event Admin'
      },
      cloudflareEnv: {
        [profileIconBindingName]: profileIconsBucket
      },
      runtimeConfig: {
        profileIcons: {
          binding: profileIconBindingName
        }
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'user_event_admin_profile_icon',
        auth0Subject: 'auth0|event-admin-profile-icon',
        email: 'event-admin-profile-icon@example.com',
        displayName: 'Event Admin'
      },
      {
        id: 'user_participant_icon',
        auth0Subject: 'auth0|participant-profile-icon',
        email: 'participant-profile-icon@example.com',
        displayName: 'Participant Icon User',
        profileIconUpdatedAt: fixtureTimestamp(),
        profileIconObjectKey: 'users/user_participant_icon/profile-icon/fixture-1',
        profileIconRevision: 1
      }
    ])
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
        id: 'acceptance_event_admin_profile_icon_privacy',
        userId: 'user_event_admin_profile_icon',
        platformDocumentId: 'privacy_v1',
        acceptedAt: '2026-03-03T00:00:00.000Z'
      },
      {
        id: 'acceptance_event_admin_profile_icon_terms',
        userId: 'user_event_admin_profile_icon',
        platformDocumentId: 'terms_v1',
        acceptedAt: '2026-03-03T00:00:00.000Z'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_profile_icon',
      eventType: 'hackathon',
      name: 'Profile Icon Fixture Event',
      slug: 'profile-icon-fixture-event',
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
      createdByUserId: 'user_event_admin_profile_icon'
    })
    await harness.database.insert(eventTermsDocuments).values({
      id: 'event_terms_profile_icon_v1',
      eventId: 'event_profile_icon',
      documentType: 'application_terms',
      version: 1,
      title: 'Application Terms v1',
      content: 'Terms',
      publishedAt: '2026-03-03T00:00:00.000Z'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_event_admin_profile_icon',
      eventId: 'event_profile_icon',
      userId: 'user_event_admin_profile_icon',
      role: 'event_admin',
      isInJudgePool: false,
      createdAt: fixtureTimestamp()
    })
    await harness.database.insert(userApplications).values({
      id: 'application_participant_profile_icon',
      eventId: 'event_profile_icon',
      userId: 'user_participant_icon',
      status: 'approved',
      applicationTermsDocumentId: 'event_terms_profile_icon_v1',
      applicationTermsAcceptedAt: '2026-03-03T00:00:00.000Z'
    })

    const iconResponse = await harness.request(
      '/api/account/profile-icon?user=user_participant_icon&event=event_profile_icon'
    )

    expect(iconResponse.status).toBe(200)
    expect(iconResponse.headers.get('content-type')).toBe('image/png')
    expect(iconResponse.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await iconResponse.arrayBuffer())).toEqual(pngSignatureBytes)

    const missingEventResponse = await harness.request('/api/account/profile-icon?user=user_participant_icon')

    expect(missingEventResponse.status).toBe(400)
    expect(await missingEventResponse.json()).toMatchObject({
      error: {
        code: 'event_id_required'
      }
    })
  })

  test('GET /api/account/profile-icon supports published roster reads for workspace users', async () => {
    const profileIconsBucket = new InMemoryR2Bucket()
    await profileIconsBucket.put(
      'users/user_judge_icon/profile-icon/fixture-1',
      pngSignatureBytes,
      {
        httpMetadata: {
          contentType: 'image/png'
        }
      }
    )

    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/profile-icon', handler: accountProfileIconGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|participant-roster-viewer',
        email: 'participant-roster-viewer@example.com',
        name: 'Participant Viewer'
      },
      cloudflareEnv: {
        [profileIconBindingName]: profileIconsBucket
      },
      runtimeConfig: {
        profileIcons: {
          binding: profileIconBindingName
        }
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values([
      {
        id: 'user_participant_roster_viewer',
        auth0Subject: 'auth0|participant-roster-viewer',
        email: 'participant-roster-viewer@example.com',
        displayName: 'Participant Viewer'
      },
      {
        id: 'user_judge_icon',
        auth0Subject: 'auth0|judge-profile-icon',
        email: 'judge-profile-icon@example.com',
        displayName: 'Judge Icon User',
        profileIconUpdatedAt: fixtureTimestamp(),
        profileIconObjectKey: 'users/user_judge_icon/profile-icon/fixture-1',
        profileIconRevision: 1
      },
      {
        id: 'user_unrelated_icon',
        auth0Subject: 'auth0|unrelated-profile-icon',
        email: 'unrelated-profile-icon@example.com',
        displayName: 'Unrelated Icon User',
        profileIconUpdatedAt: fixtureTimestamp(),
        profileIconObjectKey: 'users/user_unrelated_icon/profile-icon/fixture-1',
        profileIconRevision: 1
      }
    ])
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
        id: 'acceptance_participant_roster_viewer_privacy',
        userId: 'user_participant_roster_viewer',
        platformDocumentId: 'privacy_v1',
        acceptedAt: '2026-03-03T00:00:00.000Z'
      },
      {
        id: 'acceptance_participant_roster_viewer_terms',
        userId: 'user_participant_roster_viewer',
        platformDocumentId: 'terms_v1',
        acceptedAt: '2026-03-03T00:00:00.000Z'
      }
    ])
    await harness.database.insert(events).values({
      id: 'event_profile_icon',
      eventType: 'hackathon',
      name: 'Profile Icon Fixture Event',
      slug: 'profile-icon-fixture-event',
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
      createdByUserId: 'user_participant_roster_viewer'
    })
    await harness.database.insert(eventTermsDocuments).values({
      id: 'event_terms_profile_icon_v1',
      eventId: 'event_profile_icon',
      documentType: 'application_terms',
      version: 1,
      title: 'Application Terms v1',
      content: 'Terms',
      publishedAt: '2026-03-03T00:00:00.000Z'
    })
    await harness.database.insert(userApplications).values({
      id: 'application_participant_roster_viewer',
      eventId: 'event_profile_icon',
      userId: 'user_participant_roster_viewer',
      status: 'submitted',
      applicationTermsDocumentId: 'event_terms_profile_icon_v1',
      applicationTermsAcceptedAt: '2026-03-03T00:00:00.000Z'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_judge_profile_icon',
      eventId: 'event_profile_icon',
      userId: 'user_judge_icon',
      role: 'judge',
      isInJudgePool: true,
      createdAt: fixtureTimestamp()
    })

    const iconResponse = await harness.request(
      '/api/account/profile-icon?user=user_judge_icon&event=event_profile_icon'
    )

    expect(iconResponse.status).toBe(200)
    expect(iconResponse.headers.get('content-type')).toBe('image/png')
    expect(iconResponse.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await iconResponse.arrayBuffer())).toEqual(pngSignatureBytes)

    const hiddenIconResponse = await harness.request(
      '/api/account/profile-icon?user=user_unrelated_icon&event=event_profile_icon'
    )

    expect(hiddenIconResponse.status).toBe(404)
    expect(await hiddenIconResponse.json()).toMatchObject({
      error: {
        code: 'profile_icon_not_found'
      }
    })
  })

  test('POST /api/account/profile-icon rejects invalid content types and oversized files', async () => {
    const profileIconsBucket = new InMemoryR2Bucket()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/profile-icon', handler: accountProfileIconPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|profile-icon-guard-user',
        email: 'profile-icon-guard@example.com',
        name: 'Profile Icon Guard'
      },
      cloudflareEnv: {
        [profileIconBindingName]: profileIconsBucket,
        [authenticatedUploadRateLimitBindingName]: createRateLimiter()
      },
      runtimeConfig: {
        profileIcons: {
          binding: profileIconBindingName
        }
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'user_profile_icon_guard',
      auth0Subject: 'auth0|profile-icon-guard-user',
      email: 'profile-icon-guard@example.com',
      displayName: 'Profile Icon Guard'
    })
    await seedCurrentPlatformDocumentAcceptances(harness, 'user_profile_icon_guard')

    const invalidImageForm = new FormData()
    invalidImageForm.append(
      'file',
      new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }),
      'profile.png'
    )

    const invalidTypeResponse = await harness.request('/api/account/profile-icon', {
      method: 'POST',
      body: invalidImageForm
    })

    expect(invalidTypeResponse.status).toBe(400)
    expect(await invalidTypeResponse.json()).toMatchObject({
      error: {
        code: 'profile_icon_content_type_invalid'
      }
    })

    const oversizedForm = new FormData()
    oversizedForm.append(
      'file',
      new Blob([createOversizedPngBytes(1024 * 1024 + 1)], { type: 'image/png' }),
      'profile.png'
    )

    const oversizedResponse = await harness.request('/api/account/profile-icon', {
      method: 'POST',
      body: oversizedForm
    })

    expect(oversizedResponse.status).toBe(400)
    expect(await oversizedResponse.json()).toMatchObject({
      error: {
        code: 'profile_icon_file_too_large'
      }
    })
  })

  test('POST /api/account/profile-icon returns 429 when the authenticated upload rate limit is exceeded', async () => {
    const profileIconsBucket = new InMemoryR2Bucket()
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/account/profile-icon', handler: accountProfileIconPostHandler }
      ],
      sessionUser: {
        sub: 'auth0|profile-icon-guard-user',
        email: 'profile-icon-guard@example.com',
        name: 'Profile Icon Guard'
      },
      cloudflareEnv: {
        [profileIconBindingName]: profileIconsBucket,
        [authenticatedUploadRateLimitBindingName]: createRateLimiter(false)
      },
      runtimeConfig: {
        profileIcons: {
          binding: profileIconBindingName
        }
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'user_profile_icon_guard',
      auth0Subject: 'auth0|profile-icon-guard-user',
      email: 'profile-icon-guard@example.com',
      displayName: 'Profile Icon Guard'
    })
    await seedCurrentPlatformDocumentAcceptances(harness, 'user_profile_icon_guard')

    const uploadForm = new FormData()
    uploadForm.append(
      'file',
      new Blob([pngSignatureBytes], { type: 'image/png' }),
      'profile.png'
    )

    const response = await harness.request('/api/account/profile-icon', {
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

  test('DELETE /api/account soft-deletes the user and writes an audit record', async () => {
    const profileIconsBucket = new InMemoryR2Bucket()
    await profileIconsBucket.put(
      'users/user_delete/profile-icon/fixture-1',
      new Uint8Array([9, 9, 9]),
      {
        httpMetadata: {
          contentType: 'image/png'
        }
      }
    )

    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'delete', path: '/api/account', handler: accountDeleteHandler }
      ],
      sessionUser: {
        sub: 'auth0|delete-me',
        email: 'delete-me@example.com'
      },
      cloudflareEnv: {
        [profileIconBindingName]: profileIconsBucket,
        [authenticatedUploadRateLimitBindingName]: createRateLimiter()
      },
      runtimeConfig: {
        profileIcons: {
          binding: profileIconBindingName
        }
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values({
      id: 'user_delete',
      auth0Subject: 'auth0|delete-me',
      email: 'delete-me@example.com',
      displayName: 'Delete Me',
      isPlatformAdmin: true,
      profileIconUpdatedAt: fixtureTimestamp(),
      profileIconObjectKey: 'users/user_delete/profile-icon/fixture-1',
      profileIconRevision: 1
    })
    await harness.database.insert(events).values({
      id: 'event_1',
      eventType: 'hackathon',
      name: 'Fixture Event',
      slug: 'fixture-event-delete',
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
      createdByUserId: 'user_delete'
    })
    await harness.database.insert(platformDocuments).values({
      id: 'terms_v1',
      documentType: 'platform_terms',
      version: 1,
      title: 'Platform Terms v1',
      content: 'Terms',
      publishedAt: '2026-03-03T00:00:00.000Z'
    })
    await harness.database.insert(userPlatformDocumentAcceptances).values({
      id: 'acceptance_1',
      userId: 'user_delete',
      platformDocumentId: 'terms_v1',
      acceptedAt: fixtureTimestamp()
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'role_delete',
      eventId: 'event_1',
      userId: 'user_delete',
      role: 'event_admin',
      isInJudgePool: false,
      createdAt: fixtureTimestamp()
    })
    await harness.database.insert(mcpAccessTokens).values({
      id: '00000000-0000-4000-8000-000000000001',
      userId: 'user_delete',
      name: 'Delete with account',
      displayPrefix: 'ce_mcp_00000000',
      secretHash: 'a'.repeat(64),
      expiresAt: '2026-09-12T00:00:00.000Z'
    })

    const response = await harness.request('/api/account', {
      method: 'DELETE'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        userId: 'user_delete'
      }
    })

    const deletedUser = await harness.database.query.users.findFirst({
      where: eq(users.id, 'user_delete')
    })
    const deletedIdentities = await harness.database.select().from(userAuthIdentities)
    const deletedAcceptances = await harness.database.select().from(userPlatformDocumentAcceptances)
    const deletedAssignments = await harness.database.select().from(eventRoleAssignments)
    const deletedMcpTokens = await harness.database.select().from(mcpAccessTokens)
    const auditEntries = await harness.database.select().from(auditLogs)

    expect(deletedUser?.deletedAt).toBeTruthy()
    expect(deletedUser?.displayName).toBe('Deleted User')
    expect(deletedUser?.isPlatformAdmin).toBe(false)
    expect(deletedUser?.profileIconUpdatedAt).toBeNull()
    expect(deletedIdentities).toHaveLength(0)
    expect(deletedAcceptances).toHaveLength(0)
    expect(deletedAssignments).toHaveLength(0)
    expect(deletedMcpTokens).toHaveLength(0)
    expect(await profileIconsBucket.get('users/user_delete/profile-icon/fixture-1')).not.toBeNull()
    const cleanupRows = await harness.database.select().from(mediaCleanupOutbox).where(and(
      eq(mediaCleanupOutbox.kind, 'profile_icon'),
      eq(mediaCleanupOutbox.objectKey, 'users/user_delete/profile-icon/fixture-1')
    ))
    expect(cleanupRows).toHaveLength(1)
    expect(auditEntries).toEqual([
      expect.objectContaining({
        actorUserId: 'user_delete',
        entityType: 'user',
        entityId: 'user_delete',
        action: 'account.deleted'
      })
    ])
  })

  test('DELETE /api/account removes the registration answers and keeps the registration and the photos', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'delete', path: '/api/account', handler: accountDeleteHandler }
      ],
      sessionUser: {
        sub: 'auth0|delete-me',
        email: 'delete-me@example.com'
      }
    })
    databases.push(harness)

    await harness.database.insert(users).values([
      { id: 'user_delete', auth0Subject: 'auth0|delete-me', email: 'delete-me@example.com', displayName: 'Delete Me' },
      { id: 'user_other', auth0Subject: 'auth0|other', email: 'other@example.com', displayName: 'Other Participant' }
    ])
    await seedCurrentPlatformDocumentAcceptances(harness, 'user_delete')
    await harness.database.insert(events).values({
      id: 'event_1',
      eventType: 'build',
      name: 'Fixture Event',
      slug: 'fixture-event-delete-answers',
      description: 'Fixture event',
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 1,
      createdByUserId: 'user_other'
    })
    const writtenAnswers = {
      registrationDetailsJson: JSON.stringify({
        teamIntent: 'team',
        teamMembers: [{ fullName: 'Grace Hopper', email: 'grace@example.com' }],
        inPersonAttendanceCommitment: true,
        whyThisEvent: 'I want to build a compiler.',
        proofOfExecutionUrl: 'https://example.com/my-work',
        aiKnowledgeLevel: 'advanced'
      }),
      registrationAnswersJson: JSON.stringify([
        { questionId: 'project', prompt: 'What do you want to build today?', value: 'A compiler' }
      ])
    }
    await harness.database.insert(userApplications).values([
      {
        id: 'application_delete',
        eventId: 'event_1',
        userId: 'user_delete',
        status: 'approved',
        submittedAt: fixtureTimestamp(),
        checkedInAt: fixtureTimestamp(),
        checkInSource: 'staff',
        ...writtenAnswers
      },
      {
        id: 'application_other',
        eventId: 'event_1',
        userId: 'user_other',
        status: 'approved',
        submittedAt: fixtureTimestamp(),
        ...writtenAnswers
      }
    ])
    await harness.database.insert(eventPhotos).values({
      id: 'photo_delete',
      eventId: 'event_1',
      uploadedByUserId: 'user_delete',
      fileName: 'table.png',
      isParticipantUpload: true,
      contentType: 'image/png',
      width: 10,
      height: 10
    })

    const response = await harness.request('/api/account', {
      method: 'DELETE'
    })

    expect(response.status).toBe(200)

    const applications = await harness.database.select().from(userApplications).orderBy(asc(userApplications.id))

    // The registration of the deleted account stays, without what the participant wrote.
    expect(applications[0]).toMatchObject({
      id: 'application_delete',
      status: 'approved',
      checkedInAt: fixtureTimestamp(),
      registrationDetailsJson: emptyRegistrationDetailsJson,
      registrationAnswersJson: '[]'
    })
    // Another participant keeps their answers.
    expect(applications[1]).toMatchObject({ id: 'application_other', ...writtenAnswers })
    // The photo that the participant added stays in the gallery.
    expect(await harness.database.select().from(eventPhotos)).toHaveLength(1)
  })
})
