import { afterEach, describe, expect, test } from 'vitest'

import { eq } from 'drizzle-orm'

import accountAdminWorkspaceHandler from '../../../../server/api/account/admin-workspace.get'
import accountOverviewHandler from '../../../../server/api/account/overview.get'
import accountStaffWorkspaceHandler from '../../../../server/api/account/staff-workspace.get'
import prizeRedemptionsWorkspaceHandler from '../../../../server/api/prize-redemptions/workspace.get'
import {
  eventRoleAssignments,
  eventTermsDocuments,
  events,
  platformDocuments,
  prizeRedemptions,
  prizes,
  teamMembers,
  teams,
  userApplications,
  userPlatformDocumentAcceptances,
  users
} from '../../../../server/database/schema'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

describe('account page-shaped workspace reads', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  async function seedPlatformUser(
    harness: ReturnType<typeof createApiRouteTestHarness>,
    input: { id: string, subject: string, acceptConsent?: boolean }
  ) {
    await harness.database.insert(users).values({
      id: input.id,
      auth0Subject: input.subject,
      email: `${input.id}@example.com`,
      displayName: input.id
    })
    await harness.database.insert(platformDocuments).values([
      {
        id: `${input.id}-privacy`,
        documentType: 'privacy_policy',
        version: 1,
        title: 'Privacy Policy',
        content: 'Privacy',
        publishedAt: '2026-08-19T00:00:00.000Z'
      },
      {
        id: `${input.id}-terms`,
        documentType: 'platform_terms',
        version: 1,
        title: 'Platform Terms',
        content: 'Terms',
        publishedAt: '2026-08-19T00:00:00.000Z'
      }
    ])

    if (input.acceptConsent === false) {
      return
    }

    await harness.database.insert(userPlatformDocumentAcceptances).values([
      {
        id: `${input.id}-privacy-acceptance`,
        userId: input.id,
        platformDocumentId: `${input.id}-privacy`,
        acceptedAt: '2026-08-19T00:00:00.000Z'
      },
      {
        id: `${input.id}-terms-acceptance`,
        userId: input.id,
        platformDocumentId: `${input.id}-terms`,
        acceptedAt: '2026-08-19T00:00:00.000Z'
      }
    ])
  }

  async function seedEvent(
    harness: ReturnType<typeof createApiRouteTestHarness>,
    input: { id: string, state?: typeof events.$inferInsert['state'], hiddenAt?: string | null, creatorId: string }
  ) {
    await harness.database.insert(events).values({
      id: input.id,
      eventType: 'hackathon',
      name: input.id,
      slug: input.id,
      description: input.id,
      city: 'Vienna',
      country: 'Austria',
      address: 'Event address',
      registrationOpensAt: '2026-08-01T00:00:00.000Z',
      registrationClosesAt: '2026-08-10T00:00:00.000Z',
      submissionOpensAt: '2026-08-11T00:00:00.000Z',
      submissionClosesAt: '2026-08-25T00:00:00.000Z',
      state: input.state ?? 'registration_open',
      hiddenAt: input.hiddenAt ?? null,
      maxTeamMembers: 4,
      createdByUserId: input.creatorId
    })
  }

  function expectSingleRequestSession(
    harness: ReturnType<typeof createApiRouteTestHarness>,
    queryOffset: number
  ) {
    const requestQueries = harness.d1Database.queries.slice(queryOffset)
    expect(requestQueries.length).toBeGreaterThan(0)
    expect(new Set(requestQueries.map(query => query.sessionId))).toHaveLength(1)
  }

  test('account overview returns visible participation in one page response', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/overview', handler: accountOverviewHandler }
      ],
      sessionUser: {
        sub: 'auth0|overview-user',
        email: 'overview-user@example.com',
        name: 'Overview User'
      },
      autoAcceptCurrentPlatformDocuments: false
    })
    harnesses.push(harness)

    await seedPlatformUser(harness, {
      id: 'overview-user',
      subject: 'auth0|overview-user'
    })
    await seedEvent(harness, {
      id: 'overview-visible',
      creatorId: 'overview-user'
    })
    await seedEvent(harness, {
      id: 'overview-hidden',
      creatorId: 'overview-user',
      hiddenAt: '2026-08-19T12:00:00.000Z'
    })
    await harness.database.insert(userApplications).values([
      {
        id: 'overview-visible-application',
        eventId: 'overview-visible',
        userId: 'overview-user',
        status: 'approved'
      },
      {
        id: 'overview-hidden-application',
        eventId: 'overview-hidden',
        userId: 'overview-user',
        status: 'approved'
      }
    ])

    const queryOffset = harness.d1Database.queries.length
    const response = await harness.request('/api/account/overview')
    const body = await response.json() as {
      data: { current: Array<{ event: { id: string } }>, past: unknown[] }
    }

    expect(response.status).toBe(200)
    expect(body.data.current.map(record => record.event.id)).toEqual(['overview-visible'])
    expect(body.data.past).toEqual([])
    expectSingleRequestSession(harness, queryOffset)
  })

  test('admin workspace finds every manageable event even when the public list has over 100 events', async () => {
    const path = '/api/account/admin-workspace'
    const harness = createApiRouteTestHarness({
      routes: [{ method: 'get', path, handler: accountAdminWorkspaceHandler }],
      sessionUser: { sub: 'auth0|organizer', email: 'organizer@example.com' },
      autoAcceptCurrentPlatformDocuments: false
    })
    harnesses.push(harness)
    await seedPlatformUser(harness, { id: 'organizer', subject: 'auth0|organizer' })
    await harness.database.update(users).set({ isEventOrganizer: true }).where(eq(users.id, 'organizer'))
    await seedEvent(harness, { id: 'hidden', creatorId: 'organizer', hiddenAt: '2026-08-19T12:00:00.000Z' })
    for (let index = 0; index < 100; index++) {
      await seedEvent(harness, { id: `visible-${index}`, creatorId: 'organizer' })
    }

    const organizer = await harness.request(path)
    expect((await organizer.json()).data).toEqual([])

    await harness.database.insert(eventRoleAssignments).values({
      id: 'admin-role', eventId: 'hidden', userId: 'organizer', role: 'event_admin', isStaff: false
    })
    const admin = await harness.request(path)
    expect((await admin.json()).data).toMatchObject([{ id: 'hidden', startsAt: '2026-08-11T00:00:00.000Z' }])

    await harness.database.update(users).set({ isPlatformAdmin: true }).where(eq(users.id, 'organizer'))
    const platformAdmin = await harness.request(path)
    expect((await platformAdmin.json()).data).toHaveLength(101)
  })

  test('staff workspace applies staff role and hidden-event visibility on the server', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/staff-workspace', handler: accountStaffWorkspaceHandler }
      ],
      sessionUser: {
        sub: 'auth0|staff-user',
        email: 'staff-user@example.com',
        name: 'Staff User'
      },
      autoAcceptCurrentPlatformDocuments: false
    })
    harnesses.push(harness)

    await seedPlatformUser(harness, {
      id: 'staff-user',
      subject: 'auth0|staff-user'
    })
    await seedEvent(harness, { id: 'staff-current', creatorId: 'staff-user' })
    await seedEvent(harness, {
      id: 'staff-past',
      state: 'completed',
      creatorId: 'staff-user'
    })
    await seedEvent(harness, {
      id: 'staff-hidden',
      creatorId: 'staff-user',
      hiddenAt: '2026-08-19T12:00:00.000Z'
    })
    await seedEvent(harness, { id: 'staff-judge-only', creatorId: 'staff-user' })
    await harness.database.insert(eventRoleAssignments).values([
      {
        id: 'staff-current-role',
        eventId: 'staff-current',
        userId: 'staff-user',
        role: 'staff',
        isStaff: true
      },
      {
        id: 'staff-past-role',
        eventId: 'staff-past',
        userId: 'staff-user',
        role: 'event_admin',
        isStaff: true
      },
      {
        id: 'staff-hidden-role',
        eventId: 'staff-hidden',
        userId: 'staff-user',
        role: 'staff',
        isStaff: true
      },
      {
        id: 'staff-judge-role',
        eventId: 'staff-judge-only',
        userId: 'staff-user',
        role: 'judge',
        isInJudgePool: true
      }
    ])

    const queryOffset = harness.d1Database.queries.length
    const response = await harness.request('/api/account/staff-workspace')
    const body = await response.json() as {
      data: {
        current: Array<{ id: string, staff: { role: string, isStaff: boolean } }>
        past: Array<{ id: string, staff: { role: string } }>
      }
    }

    expect(response.status).toBe(200)
    expect(body.data.current).toMatchObject([
      { id: 'staff-current', staff: { role: 'staff', isStaff: true } }
    ])
    expect(body.data.past).toMatchObject([
      { id: 'staff-past', staff: { role: 'event_admin' } }
    ])
    expect([...body.data.current, ...body.data.past].map(event => event.id)).not.toEqual(
      expect.arrayContaining(['staff-hidden', 'staff-judge-only'])
    )
    expectSingleRequestSession(harness, queryOffset)
  })

  test('prize workspace joins only authorized pending redemptions to exact current terms', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/prize-redemptions/workspace', handler: prizeRedemptionsWorkspaceHandler }
      ],
      sessionUser: {
        sub: 'auth0|prize-user',
        email: 'prize-user@example.com',
        name: 'Prize User'
      },
      autoAcceptCurrentPlatformDocuments: false
    })
    harnesses.push(harness)

    await seedPlatformUser(harness, {
      id: 'prize-user',
      subject: 'auth0|prize-user'
    })
    await harness.database.insert(users).values({
      id: 'prize-outsider',
      auth0Subject: 'auth0|prize-outsider',
      email: 'prize-outsider@example.com',
      displayName: 'Prize Outsider'
    })
    await seedEvent(harness, {
      id: 'prize-event',
      state: 'winners_announced',
      creatorId: 'prize-user'
    })
    await harness.database.insert(eventTermsDocuments).values({
      id: 'prize-winner-terms-v1',
      eventId: 'prize-event',
      documentType: 'winner_terms',
      version: 1,
      title: 'Winner Terms',
      content: 'Exact winner terms',
      publishedAt: '2026-08-19T00:00:00.000Z'
    })
    await harness.database.update(events)
      .set({ currentWinnerTermsDocumentId: 'prize-winner-terms-v1' })
      .where(eq(events.id, 'prize-event'))
    await harness.database.insert(prizes).values([
      {
        id: 'prize-direct',
        eventId: 'prize-event',
        name: 'Direct prize',
        description: 'Direct prize',
        rewardType: 'physical',
        rewardValue: 'A trophy',
        awardScope: 'member',
        rankStart: 1,
        rankEnd: 1
      },
      {
        id: 'prize-team',
        eventId: 'prize-event',
        name: 'Team prize',
        description: 'Team prize',
        rewardType: 'subscription',
        rewardValue: 'One year',
        awardScope: 'team',
        rankStart: 1,
        rankEnd: 1
      },
      {
        id: 'prize-outsider',
        eventId: 'prize-event',
        name: 'Outsider prize',
        description: 'Outsider prize',
        rewardType: 'other',
        rewardValue: 'Other',
        awardScope: 'member',
        rankStart: 2,
        rankEnd: 2
      }
    ])
    await harness.database.insert(teams).values({
      id: 'prize-team-record',
      eventId: 'prize-event',
      name: 'Prize Team',
      slug: 'prize-team',
      createdByUserId: 'prize-user'
    })
    await harness.database.insert(teamMembers).values({
      id: 'prize-team-admin',
      teamId: 'prize-team-record',
      userId: 'prize-user',
      role: 'admin'
    })
    await harness.database.insert(prizeRedemptions).values([
      {
        id: 'prize-direct-redemption',
        prizeId: 'prize-direct',
        userId: 'prize-user',
        createdAt: '2026-08-19T01:00:00.000Z',
        updatedAt: '2026-08-19T01:00:00.000Z'
      },
      {
        id: 'prize-team-redemption',
        prizeId: 'prize-team',
        teamId: 'prize-team-record',
        createdAt: '2026-08-19T02:00:00.000Z',
        updatedAt: '2026-08-19T02:00:00.000Z'
      },
      {
        id: 'prize-outsider-redemption',
        prizeId: 'prize-outsider',
        userId: 'prize-outsider',
        createdAt: '2026-08-19T03:00:00.000Z',
        updatedAt: '2026-08-19T03:00:00.000Z'
      }
    ])

    const queryOffset = harness.d1Database.queries.length
    const response = await harness.request('/api/prize-redemptions/workspace')
    const body = await response.json() as {
      data: {
        redemptions: Array<{
          id: string
          currentWinnerTerms: { id: string, documentType: string, content: string } | null
        }>
      }
    }

    expect(response.status).toBe(200)
    expect(body.data.redemptions.map(redemption => redemption.id)).toEqual([
      'prize-direct-redemption',
      'prize-team-redemption'
    ])
    expect(body.data.redemptions.every(redemption =>
      redemption.currentWinnerTerms?.id === 'prize-winner-terms-v1'
      && redemption.currentWinnerTerms.documentType === 'winner_terms'
      && redemption.currentWinnerTerms.content === 'Exact winner terms'
    )).toBe(true)
    const workspaceQueries = harness.d1Database.queries.slice(queryOffset)
    expect(workspaceQueries.filter(query => query.sql.includes('event_terms_documents'))).toHaveLength(1)
    const workspaceQuery = workspaceQueries.find(query => query.sql.includes('event_terms_documents'))
    expect(workspaceQuery?.sql).toContain('left join "team_members"')
    expect(workspaceQuery?.sql).not.toMatch(/\bexists\s*\(/iu)
    expectSingleRequestSession(harness, queryOffset)
  })

  test('workspace handlers enforce current platform consent', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/staff-workspace', handler: accountStaffWorkspaceHandler }
      ],
      sessionUser: {
        sub: 'auth0|consent-user',
        email: 'consent-user@example.com',
        name: 'Consent User'
      },
      autoAcceptCurrentPlatformDocuments: false
    })
    harnesses.push(harness)

    await seedPlatformUser(harness, {
      id: 'consent-user',
      subject: 'auth0|consent-user',
      acceptConsent: false
    })

    const response = await harness.request('/api/account/staff-workspace')
    const body = await response.json() as { error: { code: string } }

    expect(response.status).toBe(403)
    expect(body.error.code).toBe('platform_consent_required')
  })
})
