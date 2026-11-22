import { afterEach, describe, expect, test } from 'vitest'

import operationsPageGetHandler from '../../../../server/api/account/events/[slug]/operations.get'
import participantsPageGetHandler from '../../../../server/api/account/events/[slug]/participants.get'
import rostersPageGetHandler from '../../../../server/api/account/events/[slug]/rosters.get'
import submissionsPageGetHandler from '../../../../server/api/account/events/[slug]/submissions.get'
import teamsPageGetHandler from '../../../../server/api/account/events/[slug]/teams.get'
import judgingPageGetHandler from '../../../../server/api/account/events/[slug]/judging.get'
import workspacePageGetHandler from '../../../../server/api/account/events/[slug]/workspace.get'
import judgeInboxGetHandler from '../../../../server/api/account/judging.get'
import {
  eventRoleAssignments,
  eventTracks,
  events,
  userApplications,
  users
} from '../../../../server/database/schema'
import { accountEventOperationsPageSchema } from '../../../../shared/domains/events/account-event-operations-page'
import { accountEventParticipantsPageSchema } from '../../../../shared/domains/events/account-event-participants-page'
import { accountEventRostersPageSchema } from '../../../../shared/domains/events/account-event-rosters-page'
import { accountEventSubmissionsPageSchema } from '../../../../shared/domains/events/account-event-submissions-page'
import { accountEventJudgingPageSchema, accountJudgeInboxPageSchema } from '../../../../shared/domains/events/account-event-judging-page'
import { accountEventWorkspacePageSchema } from '../../../../shared/domains/events/account-event-workspace-page'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

describe('account event operations, submissions, and judging page reads', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  async function seedFixture(
    harness: ReturnType<typeof createApiRouteTestHarness>,
    userId: string,
    role: 'event_admin' | 'judge' | 'staff' | null,
    applicationStatus?: 'submitted' | 'approved' | 'rejected' | 'withdrawn'
  ) {
    const now = '2026-08-19T12:00:00.000Z'

    await harness.database.insert(users).values({
      id: userId,
      auth0Subject: `auth0|${userId}`,
      email: `${userId}@example.com`,
      displayName: userId
    })
    await harness.database.insert(events).values({
      id: 'event_page_read',
      eventType: 'hackathon',
      name: 'Page read fixture',
      slug: 'page-read-fixture',
      description: 'A bounded page-shaped read fixture.',
      city: 'Vienna',
      country: 'Austria',
      address: 'Event address',
      registrationOpensAt: now,
      registrationClosesAt: '2026-08-20T12:00:00.000Z',
      submissionOpensAt: '2026-08-20T12:00:00.000Z',
      submissionClosesAt: '2026-08-21T12:00:00.000Z',
      state: 'judging_preparation',
      maxTeamMembers: 4,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now
    })
    if (role) {
      await harness.database.insert(eventRoleAssignments).values({
        id: `${userId}_role`,
        eventId: 'event_page_read',
        userId,
        role,
        isInJudgePool: role === 'judge',
        isStaff: role === 'staff',
        createdAt: now
      })
    }

    if (applicationStatus) {
      await harness.database.insert(userApplications).values({
        id: `${userId}_application`,
        eventId: 'event_page_read',
        userId,
        status: applicationStatus,
        submittedAt: now,
        updatedAt: now
      })
    }
  }

  test('returns the operations page in one request-scoped D1 session', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/operations', handler: operationsPageGetHandler },
        { method: 'get', path: '/api/account/events/:slug/submissions', handler: submissionsPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|operations_admin',
        email: 'operations_admin@example.com',
        name: 'Operations Admin'
      }
    })
    harnesses.push(harness)
    await seedFixture(harness, 'operations_admin', 'event_admin')

    const queryOffset = harness.d1Database.queries.length
    const response = await harness.request('/api/account/events/page-read-fixture/operations')
    const body = await response.json() as { data: { page: unknown, visibility: { canManage: boolean } } }

    expect(response.status).toBe(200)
    expect(body.data.visibility.canManage).toBe(true)
    expect(accountEventOperationsPageSchema.parse(body.data.page)).toMatchObject({
      event: { id: 'event_page_read', slug: 'page-read-fixture' },
      roles: { assignments: [{ userId: 'operations_admin', role: 'event_admin' }] },
      assignments: { data: [], total: 0 },
      teams: { data: [], total: 0 },
      applications: [],
      leaderboard: []
    })
    expect(new Set(harness.d1Database.queries.slice(queryOffset).map(query => query.sessionId))).toHaveLength(1)

    const submissionsResponse = await harness.request('/api/account/events/page-read-fixture/submissions')
    const submissionsBody = await submissionsResponse.json() as { data: { page: unknown } }

    expect(submissionsResponse.status).toBe(200)
    expect(accountEventSubmissionsPageSchema.parse(submissionsBody.data.page)).toMatchObject({
      event: { id: 'event_page_read' },
      teams: { data: [], total: 0 },
      applications: [],
      submissionMonitor: { teamDetails: [], teamSubmissions: [] },
      noSubmissionTeams: []
    })
  })

  test('keeps a direct operations shell read on one session with one joined credit probe', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/operations', handler: operationsPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|direct_operations_admin',
        email: 'direct_operations_admin@example.com',
        name: 'Direct Operations Admin'
      }
    })
    harnesses.push(harness)
    await seedFixture(harness, 'direct_operations_admin', 'event_admin')
    await harness.database.insert(eventTracks).values({
      id: 'operations_track',
      eventId: 'event_page_read',
      name: 'Operations track',
      shortDescription: 'Track description.',
      fullDescription: 'Track guidelines.',
      staffInstructions: 'Staff guidance.',
      resourcesJson: '[]',
      displayOrder: 1,
      createdAt: '2026-08-19T12:00:00.000Z'
    })

    const queryOffset = harness.d1Database.queries.length
    const response = await harness.request(
      '/api/account/events/page-read-fixture/operations?includeEventShell=true'
    )
    const body = await response.json() as {
      data: {
        page: unknown
        shell?: {
          event: { tracks: Array<Record<string, unknown>> }
          tabVisibility: { hasCreditInventory: boolean }
        }
      }
    }

    expect(response.status).toBe(200)
    expect(accountEventOperationsPageSchema.parse(body.data.page)).toMatchObject({
      event: { id: 'event_page_read' }
    })
    expect(body.data.shell?.event.tracks).toEqual([{
      id: 'operations_track',
      name: 'Operations track',
      shortDescription: 'Track description.',
      fullDescription: 'Track guidelines.',
      staffInstructions: 'Staff guidance.',
      resources: [],
      displayOrder: 1
    }])
    expect(body.data.shell?.tabVisibility.hasCreditInventory).toBe(false)

    const requestQueries = harness.d1Database.queries.slice(queryOffset)
    expect(new Set(requestQueries.map(query => query.sessionId))).toHaveLength(1)
    const creditQueries = requestQueries.filter(query =>
      query.sql.includes('event_credit_offers') || query.sql.includes('event_credit_codes')
    )

    expect(creditQueries).toHaveLength(1)
    expect(creditQueries[0]?.sql).toContain('event_credit_offers')
    expect(creditQueries[0]?.sql).toContain('event_credit_codes')
  })

  test('uses the bounded participant model for a direct admin Participants link', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/participants', handler: participantsPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|direct_participants_admin',
        email: 'direct_participants_admin@example.com',
        name: 'Direct Participants Admin'
      }
    })
    harnesses.push(harness)
    await seedFixture(harness, 'direct_participants_admin', 'event_admin')

    const queryOffset = harness.d1Database.queries.length
    const response = await harness.request(
      '/api/account/events/page-read-fixture/participants?includeEventShell=true'
    )
    const body = await response.json() as {
      data: {
        page: unknown
        visibility: { canManage: boolean }
        shell?: unknown
      }
    }

    expect(response.status).toBe(200)
    expect(body.data.visibility.canManage).toBe(true)
    expect(accountEventParticipantsPageSchema.parse(body.data.page)).toMatchObject({
      event: { state: 'judging_preparation', tracks: [] },
      applications: [],
      pagination: { page: 1, pageSize: 100, total: 0 },
      statusCounts: {
        submitted: 0,
        approved: 0,
        rejected: 0,
        withdrawn: 0
      }
    })
    expect(body.data.page).not.toHaveProperty('assignments')
    expect(body.data.shell).toBeDefined()
    expect(new Set(harness.d1Database.queries.slice(queryOffset).map(query => query.sessionId))).toHaveLength(1)
  })

  test('keeps staff out of the participant page and aggregates all non-staff applications past the page limit', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/participants', handler: participantsPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|bounded_participants_admin',
        email: 'bounded_participants_admin@example.com',
        name: 'Bounded participants admin'
      }
    })
    harnesses.push(harness)
    await seedFixture(harness, 'bounded_participants_admin', 'event_admin')

    const participantStatuses = Array.from({ length: 100 }, (_, index) => {
      if (index < 40) {
        return 'submitted' as const
      }

      if (index < 70) {
        return 'approved' as const
      }

      if (index < 90) {
        return 'rejected' as const
      }

      return 'withdrawn' as const
    })
    const participantUsers = participantStatuses.map((_, index) => {
      const id = `bounded_participant_${String(index).padStart(3, '0')}`

      return {
        id,
        auth0Subject: `auth0|${id}`,
        email: `${id}@example.com`,
        displayName: id
      }
    })
    const participantApplications = participantStatuses.map((status, index) => ({
      id: `bounded_participant_application_${String(index).padStart(3, '0')}`,
      eventId: 'event_page_read',
      userId: participantUsers[index]!.id,
      status,
      submittedAt: '2026-08-19T12:00:00.000Z',
      updatedAt: '2026-08-19T12:00:00.000Z'
    }))
    const staffUsers = Array.from({ length: 3 }, (_, index) => {
      const id = `bounded_staff_${index}`

      return {
        id,
        auth0Subject: `auth0|${id}`,
        email: `${id}@example.com`,
        displayName: id
      }
    })
    const staffApplications = staffUsers.map((user, index) => ({
      id: `bounded_staff_application_${index}`,
      eventId: 'event_page_read',
      userId: user.id,
      status: (index === 0 ? 'submitted' : index === 1 ? 'approved' : 'withdrawn') as const,
      submittedAt: '2026-08-20T12:00:00.000Z',
      updatedAt: '2026-08-20T12:00:00.000Z'
    }))

    await harness.database.insert(users).values([...participantUsers, ...staffUsers])
    await harness.database.insert(userApplications).values([
      ...participantApplications,
      ...staffApplications
    ])
    await harness.database.insert(eventRoleAssignments).values(staffUsers.map((user, index) => ({
      id: `bounded_staff_role_${index}`,
      eventId: 'event_page_read',
      userId: user.id,
      role: 'staff' as const,
      isStaff: true,
      createdAt: '2026-08-20T12:00:00.000Z'
    })))

    const queryOffset = harness.d1Database.queries.length
    const response = await harness.request('/api/account/events/page-read-fixture/participants')
    const body = await response.json() as { data: { page: unknown } }
    const page = accountEventParticipantsPageSchema.parse(body.data.page)
    const rawPage = body.data.page as {
      applications: Array<{
        user?: Record<string, unknown>
      }>
    }

    expect(response.status).toBe(200)
    expect(page.applications).toHaveLength(100)
    expect(page.pagination).toMatchObject({ page: 1, pageSize: 100, total: 100 })
    expect(page.statusCounts).toEqual({
      submitted: 40,
      approved: 30,
      rejected: 20,
      withdrawn: 10
    })
    expect(page.applications.every(application => application.isEventStaff === false)).toBe(true)
    expect(page.applications.some(application => application.userId.startsWith('bounded_staff_'))).toBe(false)
    expect(rawPage.applications[0]?.user).not.toHaveProperty('auth0Subject')
    expect(rawPage.applications[0]?.user).not.toHaveProperty('isPlatformAdmin')

    const requestQueries = harness.d1Database.queries.slice(queryOffset)
    expect(requestQueries.some(query =>
      query.sql.includes('user_applications')
      && query.sql.includes('event_role_assignments')
      && query.sql.includes('is_staff')
    )).toBe(true)
    expect(new Set(requestQueries.map(query => query.sessionId))).toHaveLength(1)
  })

  test.each(['rejected', 'withdrawn'] as const)(
    'rejects a %s applicant before loading Teams or member data',
    async (applicationStatus) => {
      const harness = createApiRouteTestHarness({
        routes: [
          { method: 'get', path: '/api/account/events/:slug/teams', handler: teamsPageGetHandler }
        ],
        sessionUser: {
          sub: `auth0|${applicationStatus}_teams_applicant`,
          email: `${applicationStatus}_teams_applicant@example.com`,
          name: `${applicationStatus} Teams applicant`
        }
      })
      harnesses.push(harness)
      await seedFixture(harness, `${applicationStatus}_teams_applicant`, null, applicationStatus)

      const queryOffset = harness.d1Database.queries.length
      const response = await harness.request(
        '/api/account/events/page-read-fixture/teams?selectedTeamSlug=private-team'
      )
      const body = await response.json() as { data?: unknown }

      expect(response.status).toBe(403)
      expect(body.data).toBeUndefined()
      expect(harness.d1Database.queries.slice(queryOffset).some(query => query.sql.includes('event_tracks'))).toBe(false)
    }
  )

  test('rejects a judge before loading Teams or member data', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/teams', handler: teamsPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|judge_teams_denied',
        email: 'judge_teams_denied@example.com',
        name: 'Judge Teams denied'
      }
    })
    harnesses.push(harness)
    await seedFixture(harness, 'judge_teams_denied', 'judge')

    const queryOffset = harness.d1Database.queries.length
    const response = await harness.request(
      '/api/account/events/page-read-fixture/teams?selectedTeamSlug=private-team'
    )
    const body = await response.json() as { data?: unknown }

    expect(response.status).toBe(403)
    expect(body.data).toBeUndefined()
    expect(harness.d1Database.queries.slice(queryOffset).some(query => query.sql.includes('event_tracks'))).toBe(false)
  })

  test('allows an ordinary workspace user with an application to read published rosters', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/rosters', handler: rostersPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|roster_workspace_user',
        email: 'roster_workspace_user@example.com',
        name: 'Roster workspace user'
      }
    })
    harnesses.push(harness)
    await seedFixture(harness, 'roster_workspace_user', null, 'submitted')
    await harness.database.insert(eventTracks).values({
      id: 'rosters_track',
      eventId: 'event_page_read',
      name: 'Rosters track',
      shortDescription: 'Roster track description.',
      fullDescription: 'Roster track guidelines.',
      staffInstructions: 'Roster staff guidance.',
      resourcesJson: '[]',
      displayOrder: 1,
      createdAt: '2026-08-19T12:00:00.000Z'
    })
    await harness.database.insert(users).values({
      id: 'published_judge',
      auth0Subject: 'auth0|published_judge',
      email: 'published_judge@example.com',
      displayName: 'Published Judge'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'published_judge_role',
      eventId: 'event_page_read',
      userId: 'published_judge',
      role: 'judge',
      isInJudgePool: true,
      isStaff: false,
      createdAt: '2026-08-19T12:00:00.000Z'
    })
    await harness.database.insert(users).values({
      id: 'unpublished_admin',
      auth0Subject: 'auth0|unpublished_admin',
      email: 'unpublished_admin@example.com',
      displayName: 'Unpublished Admin'
    })
    await harness.database.insert(eventRoleAssignments).values({
      id: 'unpublished_admin_role',
      eventId: 'event_page_read',
      userId: 'unpublished_admin',
      role: 'event_admin',
      isInJudgePool: false,
      isStaff: false,
      createdAt: '2026-08-19T12:01:00.000Z'
    })

    const response = await harness.request('/api/account/events/page-read-fixture/rosters?includeEventShell=true')
    const body = await response.json() as {
      data: {
        page: unknown
        shell?: { event: { tracks: Array<Record<string, unknown>> } }
      }
    }
    const rawPage = body.data.page as {
      publishedJudges: Array<Record<string, unknown>>
      publishedStaff: Array<Record<string, unknown>>
    }

    expect(response.status).toBe(200)
    expect(accountEventRostersPageSchema.parse(body.data.page)).toMatchObject({
      publishedJudges: [{ id: 'published_judge', fullName: 'Published Judge' }],
      canManageRoles: false
    })
    expect(body.data.shell?.event.tracks).toEqual([{
      id: 'rosters_track',
      name: 'Rosters track',
      shortDescription: 'Roster track description.',
      displayOrder: 1
    }])
    expect(rawPage.publishedJudges).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'unpublished_admin' })
    ]))
    for (const member of [...rawPage.publishedJudges, ...rawPage.publishedStaff]) {
      expect(member).not.toHaveProperty('email')
      expect(member).not.toHaveProperty('auth0Subject')
      expect(member).not.toHaveProperty('isPlatformAdmin')
      expect(member).not.toHaveProperty('isEventOrganizer')
      expect(member).not.toHaveProperty('chatgptEmail')
      expect(member).not.toHaveProperty('openaiOrgId')
      expect(member).not.toHaveProperty('lumaEmail')
      expect(member).not.toHaveProperty('lumaUsername')
    }
  })

  test('allows a judge with an event role to read published rosters', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/rosters', handler: rostersPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|roster_judge',
        email: 'roster_judge@example.com',
        name: 'Roster judge'
      }
    })
    harnesses.push(harness)
    await seedFixture(harness, 'roster_judge', 'judge')

    const response = await harness.request('/api/account/events/page-read-fixture/rosters')
    const body = await response.json() as { data: { page: unknown } }

    expect(response.status).toBe(200)
    expect(accountEventRostersPageSchema.parse(body.data.page)).toMatchObject({
      publishedJudges: [{ id: 'roster_judge', fullName: 'roster_judge' }],
      canManageRoles: false
    })
  })

  test('denies a workspace user without an application or team before loading published rosters', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/rosters', handler: rostersPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|roster_unaffiliated',
        email: 'roster_unaffiliated@example.com',
        name: 'Unaffiliated roster user'
      }
    })
    harnesses.push(harness)
    await seedFixture(harness, 'roster_unaffiliated', null)

    const response = await harness.request('/api/account/events/page-read-fixture/rosters')
    const body = await response.json() as { data?: unknown }

    expect(response.status).toBe(403)
    expect(body.data).toBeUndefined()
  })

  test('returns judge event and global inbox page models without event GET fan-out', async () => {
    const eventHarness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/judging', handler: judgingPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|judge_page',
        email: 'judge_page@example.com',
        name: 'Judge'
      }
    })
    harnesses.push(eventHarness)
    await seedFixture(eventHarness, 'judge_page', 'judge')

    const eventResponse = await eventHarness.request('/api/account/events/page-read-fixture/judging')
    const eventBody = await eventResponse.json() as { data: { page: unknown } }

    expect(eventResponse.status).toBe(200)
    expect(accountEventJudgingPageSchema.parse(eventBody.data.page)).toMatchObject({
      event: { id: 'event_page_read' },
      assignments: [],
      criteria: [],
      summary: { totalAssignmentCount: 0, activeAssignmentCount: 0 }
    })

    const inboxHarness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/judging', handler: judgeInboxGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|judge_inbox',
        email: 'judge_inbox@example.com',
        name: 'Judge Inbox'
      }
    })
    harnesses.push(inboxHarness)
    await seedFixture(inboxHarness, 'judge_inbox', 'judge')

    const queryOffset = inboxHarness.d1Database.queries.length
    const inboxResponse = await inboxHarness.request('/api/account/judging')
    const inboxBody = await inboxResponse.json() as { data: unknown }

    expect(inboxResponse.status).toBe(200)
    expect(accountJudgeInboxPageSchema.parse(inboxBody.data)).toMatchObject({
      groups: [{ event: { id: 'event_page_read' }, assignments: [] }],
      assignmentCount: 0,
      inProgressCount: 0
    })
    expect(new Set(inboxHarness.d1Database.queries.slice(queryOffset).map(query => query.sessionId))).toHaveLength(1)
  })

  test('does not let an assigned judge read the event-admin operations page', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/operations', handler: operationsPageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|operations_judge',
        email: 'operations_judge@example.com',
        name: 'Operations Judge'
      }
    })
    harnesses.push(harness)
    await seedFixture(harness, 'operations_judge', 'judge')

    const response = await harness.request('/api/account/events/page-read-fixture/operations')

    expect(response.status).toBe(403)
  })

  test('authorizes an approved participant before loading the workspace and optional shell', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/workspace', handler: workspacePageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|approved_workspace_participant',
        email: 'approved_workspace_participant@example.com',
        name: 'Approved workspace participant'
      }
    })
    harnesses.push(harness)
    await seedFixture(harness, 'approved_workspace_participant', null, 'approved')

    const response = await harness.request(
      '/api/account/events/page-read-fixture/workspace?includeEventShell=true'
    )
    const body = await response.json() as {
      data: {
        page: unknown
        shell?: unknown
      }
    }

    expect(response.status).toBe(200)
    expect(accountEventWorkspacePageSchema.parse(body.data.page)).toMatchObject({
      application: { userId: 'approved_workspace_participant', status: 'approved' },
      workflow: {
        applicationStatus: 'approved',
        isApprovedParticipant: true
      }
    })
    expect(body.data.shell).toBeDefined()
  })

  test('allows an event role to use the participant workspace only with an approved application', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/events/:slug/workspace', handler: workspacePageGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|admin_participant',
        email: 'admin_participant@example.com',
        name: 'Admin participant'
      }
    })
    harnesses.push(harness)
    await seedFixture(harness, 'admin_participant', 'event_admin', 'approved')

    const response = await harness.request(
      '/api/account/events/page-read-fixture/workspace?includeEventShell=true'
    )
    const body = await response.json() as {
      data: {
        page: unknown
        shell?: unknown
      }
    }

    expect(response.status).toBe(200)
    expect(accountEventWorkspacePageSchema.parse(body.data.page)).toMatchObject({
      workflow: {
        applicationStatus: 'approved',
        isApprovedParticipant: true
      }
    })
    expect(body.data.shell).toBeDefined()
  })

  test.each(['event_admin', 'staff'] as const)(
    'rejects a role-only %s before loading the workspace or optional shell',
    async (role) => {
      const harness = createApiRouteTestHarness({
        routes: [
          { method: 'get', path: '/api/account/events/:slug/workspace', handler: workspacePageGetHandler }
        ],
        sessionUser: {
          sub: `auth0|role_only_${role}`,
          email: `role_only_${role}@example.com`,
          name: `Role-only ${role}`
        }
      })
      harnesses.push(harness)
      await seedFixture(harness, `role_only_${role}`, role)

      const response = await harness.request(
        '/api/account/events/page-read-fixture/workspace?includeEventShell=true'
      )
      const body = await response.json() as { data?: unknown }

      expect(response.status).toBe(403)
      expect(body.data).toBeUndefined()
    }
  )

  test('rejects the global judge inbox without a judge-capable event role', async () => {
    const harness = createApiRouteTestHarness({
      routes: [
        { method: 'get', path: '/api/account/judging', handler: judgeInboxGetHandler }
      ],
      sessionUser: {
        sub: 'auth0|not_a_judge',
        email: 'not_a_judge@example.com',
        name: 'Not a judge'
      }
    })
    harnesses.push(harness)
    await harness.database.insert(users).values({
      id: 'not_a_judge',
      auth0Subject: 'auth0|not_a_judge',
      email: 'not_a_judge@example.com',
      displayName: 'Not a judge'
    })

    const response = await harness.request('/api/account/judging')

    expect(response.status).toBe(403)
  })
})
