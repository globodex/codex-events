import { afterEach, describe, expect, test } from 'vitest'

import galleryPageGetHandler from '../../../../server/api/account/events/[slug]/gallery.get'
import {
  eventRoleAssignments,
  events,
  userApplications,
  users
} from '../../../../server/database/schema'
import { accountEventGalleryPageSchema } from '../../../../shared/domains/events/account-event-gallery-page'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

const now = '2026-08-19T12:00:00.000Z'

describe('account event gallery page reads', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  async function seedFixture(
    harness: ReturnType<typeof createApiRouteTestHarness>,
    userId: string,
    options: {
      role?: 'event_admin' | 'judge'
      applicationStatus?: 'submitted' | 'approved'
    } = {}
  ) {
    await harness.database.insert(users).values({
      id: userId,
      auth0Subject: `auth0|${userId}`,
      email: `${userId}@example.com`,
      displayName: userId
    })
    await harness.database.insert(events).values({
      id: 'event_gallery_page',
      eventType: 'hackathon',
      name: 'Gallery page fixture',
      slug: 'gallery-page-fixture',
      description: 'A protected gallery page fixture.',
      city: 'Vienna',
      country: 'Austria',
      address: 'Event address',
      registrationOpensAt: now,
      registrationClosesAt: '2026-08-20T12:00:00.000Z',
      submissionOpensAt: '2026-08-20T12:00:00.000Z',
      submissionClosesAt: '2026-08-21T12:00:00.000Z',
      state: 'submission_open',
      maxTeamMembers: 4,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now
    })

    if (options.role) {
      await harness.database.insert(eventRoleAssignments).values({
        id: `${userId}_role`,
        eventId: 'event_gallery_page',
        userId,
        role: options.role,
        isInJudgePool: options.role === 'judge',
        createdAt: now
      })
    }

    if (options.applicationStatus) {
      await harness.database.insert(userApplications).values({
        id: `${userId}_application`,
        eventId: 'event_gallery_page',
        userId,
        status: options.applicationStatus,
        submittedAt: now,
        updatedAt: now
      })
    }
  }

  test('shares one application and membership access wave with context authorization and the optional shell', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/gallery', handler: galleryPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|gallery_participant',
        email: 'gallery_participant@example.com',
        name: 'Gallery participant'
      }
    })
    harnesses.push(harness)
    await seedFixture(harness, 'gallery_participant', { applicationStatus: 'approved' })

    const queryOffset = harness.d1Database.queries.length
    const response = await harness.request(
      '/api/account/events/gallery-page-fixture/gallery?includeEventShell=true'
    )
    const body = await response.json() as {
      data: {
        page: unknown
        shell?: unknown
      }
    }

    expect(response.status).toBe(200)
    expect(accountEventGalleryPageSchema.parse(body.data.page)).toEqual({
      photos: [],
      canAddParticipantPhotos: false,
      mustFinishCheckInFlowToAddPhotos: false
    })
    expect(body.data.shell).toBeDefined()

    const requestQueries = harness.d1Database.queries.slice(queryOffset)
    expect(requestQueries.filter(query => query.sql.includes('user_applications'))).toHaveLength(1)
    expect(requestQueries.filter(query => query.sql.includes('from "team_members"'))).toHaveLength(1)
  })

  test.each(['event_admin', 'judge'] as const)('allows an explicit %s to read the gallery without an application', async (role) => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/gallery', handler: galleryPageGetHandler }
      ],
      sessionUser: {
        sub: `auth0|gallery_${role}`,
        email: `gallery_${role}@example.com`,
        name: `Gallery ${role}`
      }
    })
    harnesses.push(harness)
    await seedFixture(harness, `gallery_${role}`, { role })

    const response = await harness.request('/api/account/events/gallery-page-fixture/gallery')

    expect(response.status).toBe(200)
  })

  test('rejects a participant without an approved application', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/gallery', handler: galleryPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|gallery_pending',
        email: 'gallery_pending@example.com',
        name: 'Gallery pending participant'
      }
    })
    harnesses.push(harness)
    await seedFixture(harness, 'gallery_pending', { applicationStatus: 'submitted' })

    const response = await harness.request('/api/account/events/gallery-page-fixture/gallery')

    expect(response.status).toBe(403)
  })
})
