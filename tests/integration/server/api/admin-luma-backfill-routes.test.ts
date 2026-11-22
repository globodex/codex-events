import { afterEach, describe, expect, test, vi } from 'vitest'

import { eq } from 'drizzle-orm'

import backfillLumaEmailsHandler from '../../../../server/api/admin/events/[eventId]/actions/backfill-luma-emails.post'
import {
  auditLogs,
  events,
  eventTermsDocuments,
  userApplications,
  users
} from '../../../../server/database/schema'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

describe('admin luma backfill routes', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    vi.unstubAllGlobals()

    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  test.each([false, true])('backfills an active registration with a Luma email conflict of %s', async (conflict) => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/admin/events/:eventId/actions/backfill-luma-emails', handler: backfillLumaEmailsHandler }
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
        id: 'legacy_user',
        auth0Subject: 'auth0|legacy_user',
        email: 'legacy@example.com',
        displayName: 'Legacy User',
        lumaUsername: 'bpirvu'
      },
      {
        id: 'migrated_user',
        auth0Subject: 'auth0|migrated_user',
        email: 'migrated@example.com',
        displayName: 'Migrated User',
        lumaEmail: 'migrated@luma.example',
        lumaUsername: 'already-migrated'
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
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      applicationLumaEmailVisible: true,
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'luma_test_key',
      lumaWebhookSecret: 'whsec_test',
      lumaWebhookStatus: 'configured',
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'platform_admin'
    })

    await harness.database.insert(eventTermsDocuments).values({
      id: 'terms_1',
      eventId: 'event_1',
      documentType: 'application_terms',
      version: 1,
      title: 'Application Terms',
      content: 'Application Terms',
      publishedAt: '2026-03-01T00:00:00.000Z'
    })

    await harness.database.insert(userApplications).values([
      {
        id: 'application_1',
        eventId: 'event_1',
        userId: 'legacy_user',
        status: 'submitted',
        submittedAt: '2026-03-22T12:10:00.000Z',
        reviewedAt: null,
        reviewedByUserId: null,
        applicationTermsDocumentId: 'terms_1',
        applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
        registrationDetailsJson: '{}',
        createdAt: '2026-03-22T12:10:00.000Z',
        updatedAt: '2026-03-22T12:10:00.000Z'
      },
      {
        id: 'application_2',
        eventId: 'event_1',
        userId: 'migrated_user',
        status: 'submitted',
        submittedAt: '2026-03-22T12:11:00.000Z',
        reviewedAt: null,
        reviewedByUserId: null,
        applicationTermsDocumentId: 'terms_1',
        applicationTermsAcceptedAt: '2026-03-22T12:11:00.000Z',
        registrationDetailsJson: '{}',
        createdAt: '2026-03-22T12:11:00.000Z',
        updatedAt: '2026-03-22T12:11:00.000Z'
      }
    ])

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)

      if (url.pathname === '/user/bpirvu') {
        return new Response('<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"user":{"username":"bpirvu","api_id":"usr-123"}}}}</script>', {
          status: 200,
          headers: {
            'content-type': 'text/html'
          }
        })
      }

      if (url.pathname === '/v1/event/get-guests') {
        return new Response(JSON.stringify({
          entries: [
            {
              guest: {
                id: 'gst-123',
                user_id: 'usr-123',
                user_email: conflict ? 'MIGRATED@luma.example' : 'legacy@luma.example'
              }
            }
          ],
          has_more: false
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        })
      }

      return new Response('not found', { status: 404 })
    })

    vi.stubGlobal('fetch', fetchMock)

    const response = await harness.request('/api/admin/events/event_1/actions/backfill-luma-emails', {
      method: 'POST'
    })

    if (conflict) {
      // The account is reported as failed and keeps its empty Luma email. The backfill itself succeeds.
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        data: {
          candidateCount: 1,
          updatedCount: 0,
          failedCount: 1,
          results: [
            {
              userId: 'legacy_user',
              status: 'failed',
              reason: 'This Luma email is already connected to another registration for this event.'
            }
          ]
        }
      })
      expect((await harness.database.query.users.findFirst({ where: eq(users.id, 'legacy_user') }))?.lumaEmail).toBeNull()
      return
    }
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        eventId: 'event_1',
        candidateCount: 1,
        updatedCount: 1,
        failedCount: 0,
        results: [
          {
            userId: 'legacy_user',
            lumaUsername: 'bpirvu',
            lumaEmail: 'legacy@luma.example',
            status: 'updated'
          }
        ]
      }
    })

    const legacyUser = await harness.database.query.users.findFirst({
      where: eq(users.id, 'legacy_user')
    })
    const migratedUser = await harness.database.query.users.findFirst({
      where: eq(users.id, 'migrated_user')
    })
    const auditRows = await harness.database.select().from(auditLogs)

    expect(legacyUser).toMatchObject({
      lumaEmail: 'legacy@luma.example',
      lumaUsername: 'bpirvu'
    })
    expect(migratedUser).toMatchObject({
      lumaEmail: 'migrated@luma.example',
      lumaUsername: 'already-migrated'
    })
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actorUserId: 'platform_admin',
        entityType: 'event',
        entityId: 'event_1',
        action: 'event.luma_email_backfill_completed',
        metadata: expect.objectContaining({
          candidateCount: 1,
          updatedCount: 1,
          failedCount: 0
        })
      })
    ]))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('non-platform admins cannot backfill Luma emails', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'post', path: '/api/admin/events/:eventId/actions/backfill-luma-emails', handler: backfillLumaEmailsHandler }
      ],
      sessionUser: {
        sub: 'auth0|regular_user',
        email: 'regular@example.com'
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
        id: 'regular_user',
        auth0Subject: 'auth0|regular_user',
        email: 'regular@example.com',
        displayName: 'Regular User'
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
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      applicationLumaEmailVisible: true,
      requireLumaEmail: true,
      lumaEventUrl: 'https://luma.com/codex',
      lumaEventApiId: 'evt-123',
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'platform_admin'
    })

    const response = await harness.request('/api/admin/events/event_1/actions/backfill-luma-emails', {
      method: 'POST'
    })

    expect(response.status).toBe(403)
  })
})
