import { afterEach, describe, expect, test, vi } from 'vitest'

import { and, eq } from 'drizzle-orm'

import teamsPageHandler from '../../../../server/api/account/events/[slug]/teams.get'
import createTeamHandler from '../../../../server/api/events/[eventId]/teams/index.post'
import listTeamsHandler from '../../../../server/api/events/[eventId]/teams/index.get'
import getTeamHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/index.get'
import patchTeamHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/index.patch'
import patchJoinPolicyHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/join-policy.patch'
import leaveTeamHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/actions/leave.post'
import makeAdminHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/members/[userId]/actions/make-admin.post'
import removeMemberHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/members/[userId]/actions/remove.post'
import createJoinRequestHandler from '../../../../server/api/events/[eventId]/team-join-requests/index.post'
import listJoinRequestsHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/join-requests/index.get'
import cancelJoinRequestHandler from '../../../../server/api/events/[eventId]/team-join-requests/[requestId]/actions/cancel.post'
import approveJoinRequestHandler from '../../../../server/api/events/[eventId]/team-join-requests/[requestId]/actions/approve.post'
import rejectJoinRequestHandler from '../../../../server/api/events/[eventId]/team-join-requests/[requestId]/actions/reject.post'
import {
  auditLogs,
  eventRoleAssignments,
  eventTermsDocuments,
  events,
  submissions,
  teamJoinRequests,
  teamMembers,
  teams,
  userApplications,
  users
} from '../../../../server/database/schema'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'
import { stubAuth0Session } from '../../../support/backend/runtime'

function createRoutes() {
  return [
    { method: 'get' as const, path: '/api/account/events/:slug/teams', handler: teamsPageHandler },
    { method: 'get' as const, path: '/api/events/:eventId/teams', handler: listTeamsHandler },
    { method: 'post' as const, path: '/api/events/:eventId/teams', handler: createTeamHandler },
    { method: 'get' as const, path: '/api/events/:eventId/teams/:teamId', handler: getTeamHandler },
    { method: 'patch' as const, path: '/api/events/:eventId/teams/:teamId', handler: patchTeamHandler },
    {
      method: 'patch' as const,
      path: '/api/events/:eventId/teams/:teamId/join-policy',
      handler: patchJoinPolicyHandler
    },
    {
      method: 'post' as const,
      path: '/api/events/:eventId/teams/:teamId/actions/leave',
      handler: leaveTeamHandler
    },
    {
      method: 'post' as const,
      path: '/api/events/:eventId/teams/:teamId/members/:userId/actions/make-admin',
      handler: makeAdminHandler
    },
    {
      method: 'post' as const,
      path: '/api/events/:eventId/teams/:teamId/members/:userId/actions/remove',
      handler: removeMemberHandler
    },
    {
      method: 'post' as const,
      path: '/api/events/:eventId/team-join-requests',
      handler: createJoinRequestHandler
    },
    {
      method: 'get' as const,
      path: '/api/events/:eventId/teams/:teamId/join-requests',
      handler: listJoinRequestsHandler
    },
    {
      method: 'post' as const,
      path: '/api/events/:eventId/team-join-requests/:requestId/actions/cancel',
      handler: cancelJoinRequestHandler
    },
    {
      method: 'post' as const,
      path: '/api/events/:eventId/team-join-requests/:requestId/actions/approve',
      handler: approveJoinRequestHandler
    },
    {
      method: 'post' as const,
      path: '/api/events/:eventId/team-join-requests/:requestId/actions/reject',
      handler: rejectJoinRequestHandler
    }
  ]
}

async function seedTeamFormationContext(
  harness: ReturnType<typeof createApiRouteTestHarness>,
  options?: {
    state?: 'registration_open' | 'submission_open' | 'judging_preparation'
    teamOpen?: boolean
    secondTeamAtCapacity?: boolean
    includeStaffRole?: boolean
    teamOneSolo?: boolean
    teamOneActiveSubmissionStatus?: 'draft' | 'submitted'
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
      id: 'team_admin',
      auth0Subject: 'auth0|team_admin',
      email: 'team-admin@example.com',
      displayName: 'Team Admin',
      xProfileUrl: 'https://x.com/team-admin',
      linkedinProfileUrl: 'https://linkedin.com/in/team-admin',
      githubProfileUrl: 'https://github.com/team-admin',
      chatgptEmail: 'team-admin-chatgpt@example.com',
      openaiOrgId: 'org_team_admin',
      lumaUsername: 'team-admin'
    },
    {
      id: 'team_member',
      auth0Subject: 'auth0|team_member',
      email: 'team-member@example.com',
      displayName: 'Team Member',
      githubProfileUrl: 'https://github.com/team-member'
    },
    {
      id: 'requester',
      auth0Subject: 'auth0|requester',
      email: 'requester@example.com',
      displayName: 'Requester',
      githubProfileUrl: 'https://github.com/requester'
    },
    {
      id: 'staff_user',
      auth0Subject: 'auth0|staff_user',
      email: 'staff-user@example.com',
      displayName: 'Staff User',
      githubProfileUrl: 'https://github.com/staff-user'
    },
    {
      id: 'other_requester',
      auth0Subject: 'auth0|other_requester',
      email: 'other-requester@example.com',
      displayName: 'Other Requester',
      githubProfileUrl: 'https://github.com/other-requester'
    },
    {
      id: 'second_team_admin',
      auth0Subject: 'auth0|second_team_admin',
      email: 'second-admin@example.com',
      displayName: 'Second Team Admin',
      githubProfileUrl: 'https://github.com/second-admin'
    },
    ...(options?.secondTeamAtCapacity
      ? [
          {
            id: 'beta_member_one',
            auth0Subject: 'auth0|beta_member_one',
            email: 'beta-member-one@example.com',
            displayName: 'Beta Member One'
          },
          {
            id: 'beta_member_two',
            auth0Subject: 'auth0|beta_member_two',
            email: 'beta-member-two@example.com',
            displayName: 'Beta Member Two'
          },
          {
            id: 'beta_member_three',
            auth0Subject: 'auth0|beta_member_three',
            email: 'beta-member-three@example.com',
            displayName: 'Beta Member Three'
          }
        ]
      : [])
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
    state: options?.state ?? 'registration_open',
    maxTeamMembers: 4,
    requireGithubProfile: false,
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
      createdAt: '2026-03-22T12:00:00.000Z'
    },
    ...(options?.includeStaffRole
      ? [
          {
            id: 'role_staff_user',
            eventId: 'event_1',
            userId: 'staff_user',
            role: 'staff' as const,
            isInJudgePool: false,
            isStaff: true,
            createdAt: '2026-03-22T12:00:00.000Z'
          }
        ]
      : [])
  ])

  await harness.database.insert(eventTermsDocuments).values({
    id: 'terms_app_1',
    eventId: 'event_1',
    documentType: 'application_terms',
    version: 1,
    title: 'Application Terms v1',
    content: 'Application terms',
    publishedAt: '2026-03-20T12:00:00.000Z',
    createdAt: '2026-03-20T12:00:00.000Z'
  })

  await harness.database.insert(userApplications).values([
    approvedApplication('application_team_admin', 'team_admin'),
    approvedApplication('application_team_member', 'team_member'),
    approvedApplication('application_requester', 'requester'),
    approvedApplication('application_other_requester', 'other_requester'),
    approvedApplication('application_second_team_admin', 'second_team_admin')
  ])

  await harness.database.insert(teams).values([
    {
      id: 'team_1',
      eventId: 'event_1',
      name: 'Alpha Team',
      bio: 'We build developer workflows together.',
      slug: 'alpha-team',
      isOpenToJoinRequests: options?.teamOpen ?? true,
      createdByUserId: 'team_admin',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z'
    },
    {
      id: 'team_2',
      eventId: 'event_1',
      name: 'Beta Team',
      slug: 'beta-team',
      isOpenToJoinRequests: true,
      createdByUserId: 'second_team_admin',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z'
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
    ...(options?.teamOneSolo
      ? []
      : [
          {
            id: 'membership_member',
            teamId: 'team_1',
            userId: 'team_member',
            role: 'member' as const,
            joinedAt: '2026-03-22T12:00:00.000Z',
            createdAt: '2026-03-22T12:00:00.000Z'
          }
        ]),
    {
      id: 'membership_second_admin',
      teamId: 'team_2',
      userId: 'second_team_admin',
      role: 'admin',
      joinedAt: '2026-03-22T12:00:00.000Z',
      createdAt: '2026-03-22T12:00:00.000Z'
    },
    ...(options?.secondTeamAtCapacity
      ? [
          {
            id: 'membership_beta_one',
            teamId: 'team_2',
            userId: 'beta_member_one',
            role: 'member' as const,
            joinedAt: '2026-03-22T12:00:00.000Z',
            createdAt: '2026-03-22T12:00:00.000Z'
          },
          {
            id: 'membership_beta_two',
            teamId: 'team_2',
            userId: 'beta_member_two',
            role: 'member' as const,
            joinedAt: '2026-03-22T12:00:00.000Z',
            createdAt: '2026-03-22T12:00:00.000Z'
          },
          {
            id: 'membership_beta_three',
            teamId: 'team_2',
            userId: 'beta_member_three',
            role: 'member' as const,
            joinedAt: '2026-03-22T12:00:00.000Z',
            createdAt: '2026-03-22T12:00:00.000Z'
          }
        ]
      : [])
  ])

  if (options?.teamOneActiveSubmissionStatus) {
    await harness.database.insert(submissions).values({
      id: 'submission_team_1',
      teamId: 'team_1',
      status: options.teamOneActiveSubmissionStatus,
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z'
    })
  }
}

function approvedApplication(id: string, userId: string) {
  return {
    id,
    eventId: 'event_1',
    userId,
    status: 'approved' as const,
    submittedAt: '2026-03-22T11:00:00.000Z',
    reviewedAt: '2026-03-22T11:30:00.000Z',
    reviewedByUserId: 'event_admin',
    applicationTermsDocumentId: 'terms_app_1',
    applicationTermsAcceptedAt: '2026-03-22T11:00:00.000Z',
    createdAt: '2026-03-22T11:00:00.000Z',
    updatedAt: '2026-03-22T11:30:00.000Z'
  }
}

describe('TASK-3.6 team formation routes', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    vi.unstubAllGlobals()

    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  test('approved users can list teams during formation and create a new team with themselves as admin', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|requester',
        email: 'requester@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness)

    const listResponse = await harness.request('/api/events/event_1/teams?page=1&page_size=10')
    expect(listResponse.status).toBe(200)
    expect(await listResponse.json()).toMatchObject({
      meta: {
        total: 2
      },
      data: expect.arrayContaining([
        expect.objectContaining({
          id: 'team_1',
          bio: 'We build developer workflows together.',
          activeMemberCount: 2
        })
      ])
    })

    const createResponse = await harness.request('/api/events/event_1/teams', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Requester Team',
        bio: 'Shipping fast integrations together.',
        isOpenToJoinRequests: false
      })
    })

    expect(createResponse.status).toBe(200)
    const createBody = await createResponse.json()
    expect(createBody).toMatchObject({
      data: {
        name: 'Requester Team',
        bio: 'Shipping fast integrations together.',
        isOpenToJoinRequests: false,
        members: [
          expect.objectContaining({
            userId: 'requester',
            role: 'admin'
          })
        ]
      }
    })
    expect(createBody.data.slug).toMatch(/^requester-team-\d{4}$/)

    const createdTeam = await harness.database.query.teams.findFirst({
      where: and(
        eq(teams.eventId, 'event_1'),
        eq(teams.slug, createBody.data.slug)
      )
    })
    expect(createdTeam).toBeTruthy()
  })

  test('team list can resolve an exact visible team by slug for shared team links', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|requester',
        email: 'requester@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness)

    const response = await harness.request('/api/events/event_1/teams?page=1&page_size=1&slug=beta-team')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      meta: {
        total: 1
      },
      data: [
        expect.objectContaining({
          id: 'team_2',
          slug: 'beta-team',
          name: 'Beta Team'
        })
      ]
    })
  })

  test('team list can filter to teams that are open to join requests', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|requester',
        email: 'requester@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness, {
      teamOpen: false
    })

    const response = await harness.request('/api/events/event_1/teams?page=1&page_size=10&open_to_join=true')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      meta: {
        total: 1
      },
      data: [
        expect.objectContaining({
          id: 'team_2',
          slug: 'beta-team',
          isOpenToJoinRequests: true
        })
      ]
    })
  })

  test('team list can filter to teams that still have capacity', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|requester',
        email: 'requester@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness, {
      secondTeamAtCapacity: true
    })

    const response = await harness.request('/api/events/event_1/teams?page=1&page_size=10&open_to_join=true&has_capacity=true')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      meta: {
        total: 1
      },
      data: [
        expect.objectContaining({
          id: 'team_1',
          slug: 'alpha-team',
          activeMemberCount: 2,
          isOpenToJoinRequests: true
        })
      ]
    })

    const fullTeams = await harness.request('/api/events/event_1/teams?has_capacity=false')
    expect((await fullTeams.json()).data.map((team: { id: string }) => team.id)).toEqual(['team_2'])
  })

  test('team list paginates filtered teams while preserving the filtered total', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|requester',
        email: 'requester@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness)

    const response = await harness.request('/api/events/event_1/teams?page=2&page_size=1&open_to_join=true&has_capacity=true')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      meta: {
        page: 2,
        pageSize: 1,
        total: 2
      },
      data: [
        expect.objectContaining({
          id: 'team_2',
          slug: 'beta-team',
          activeMemberCount: 1,
          isOpenToJoinRequests: true
        })
      ]
    })
  })

  test('create team derives a unique slug from the submitted team name', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|requester',
        email: 'requester@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness)

    const createResponse = await harness.request('/api/events/event_1/teams', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Alpha Team',
        isOpenToJoinRequests: true
      })
    })

    expect(createResponse.status).toBe(200)
    const createBody = await createResponse.json()
    expect(createBody).toMatchObject({
      data: {
        name: 'Alpha Team',
        isOpenToJoinRequests: true
      }
    })
    expect(createBody.data.slug).toMatch(/^alpha-team-\d{4}$/)
    expect(createBody.data.slug).not.toBe('alpha-team')

    const createdTeam = await harness.database.query.teams.findFirst({
      where: and(
        eq(teams.eventId, 'event_1'),
        eq(teams.slug, createBody.data.slug)
      )
    })
    expect(createdTeam).toBeTruthy()
  })

  test('team admins can update team profiles, regenerate slugs on rename, and update join openness', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness)

    const renameResponse = await harness.request('/api/events/event_1/teams/team_1', {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Beta Team',
        bio: 'We prototype fast and keep the team collaborative.'
      })
    })

    expect(renameResponse.status).toBe(200)
    const renameBody = await renameResponse.json()
    expect(renameBody).toMatchObject({
      data: {
        id: 'team_1',
        name: 'Beta Team',
        bio: 'We prototype fast and keep the team collaborative.',
        isOpenToJoinRequests: true
      }
    })
    expect(renameBody.data.slug).toMatch(/^beta-team-\d{4}$/)
    expect(renameBody.data.slug).not.toBe('beta-team')

    const renamedTeam = await harness.database.query.teams.findFirst({
      where: eq(teams.id, 'team_1')
    })
    expect(renamedTeam?.slug).toBe(renameBody.data.slug)

    const policyResponse = await harness.request('/api/events/event_1/teams/team_1/join-policy', {
      method: 'PATCH',
      body: JSON.stringify({
        isOpenToJoinRequests: false
      })
    })

    expect(policyResponse.status).toBe(200)
    expect(await policyResponse.json()).toMatchObject({
      data: {
        id: 'team_1',
        isOpenToJoinRequests: false
      }
    })
  })

  test('team detail redacts member contact data for approved non-members but preserves it for members and admins', async () => {
    const outsiderHarness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|requester',
        email: 'requester@example.com'
      }
    })
    harnesses.push(outsiderHarness)
    await seedTeamFormationContext(outsiderHarness)

    const outsiderResponse = await outsiderHarness.request('/api/events/event_1/teams/team_1')
    expect(outsiderResponse.status).toBe(200)
    const outsiderBody = await outsiderResponse.json()
    expect(outsiderBody.data.bio).toBe('We build developer workflows together.')
    const outsiderAdminMember = outsiderBody.data.members.find((member: { userId: string }) => member.userId === 'team_admin')
    expect(outsiderAdminMember).toMatchObject({
      userId: 'team_admin',
      user: {
        id: 'team_admin',
        displayName: 'Team Admin'
      }
    })
    expect(outsiderAdminMember.user).not.toHaveProperty('email')
    expect(outsiderAdminMember.user).not.toHaveProperty('xProfileUrl')
    expect(outsiderAdminMember.user).not.toHaveProperty('linkedinProfileUrl')
    expect(outsiderAdminMember.user).not.toHaveProperty('githubProfileUrl')
    expect(outsiderAdminMember.user).not.toHaveProperty('chatgptEmail')
    expect(outsiderAdminMember.user).not.toHaveProperty('openaiOrgId')
    expect(outsiderAdminMember.user).not.toHaveProperty('lumaUsername')

    const memberHarness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_member',
        email: 'team-member@example.com'
      }
    })
    harnesses.push(memberHarness)
    await seedTeamFormationContext(memberHarness)

    const memberResponse = await memberHarness.request('/api/events/event_1/teams/team_1')
    expect(memberResponse.status).toBe(200)
    await expect(memberResponse.json()).resolves.toMatchObject({
      data: {
        members: expect.arrayContaining([
          expect.objectContaining({
            userId: 'team_admin',
            user: expect.objectContaining({
              email: 'team-admin@example.com',
              xProfileUrl: 'https://x.com/team-admin',
              linkedinProfileUrl: 'https://linkedin.com/in/team-admin',
              githubProfileUrl: 'https://github.com/team-admin',
              chatgptEmail: 'team-admin-chatgpt@example.com',
              openaiOrgId: 'org_team_admin',
              lumaUsername: 'team-admin'
            })
          })
        ])
      }
    })

    const adminHarness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(adminHarness)
    await seedTeamFormationContext(adminHarness)

    const adminResponse = await adminHarness.request('/api/events/event_1/teams/team_1')
    expect(adminResponse.status).toBe(200)
    await expect(adminResponse.json()).resolves.toMatchObject({
      data: {
        members: expect.arrayContaining([
          expect.objectContaining({
            userId: 'team_admin',
            user: expect.objectContaining({
              email: 'team-admin@example.com',
              chatgptEmail: 'team-admin-chatgpt@example.com',
              openaiOrgId: 'org_team_admin',
              lumaUsername: 'team-admin'
            })
          })
        ])
      }
    })
  })

  test('team admins can remove members and membership changes are audited', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness)

    const response = await harness.request('/api/events/event_1/teams/team_1/members/team_member/actions/remove', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        teamId: 'team_1',
        userId: 'team_member'
      }
    })

    const storedMembership = await harness.database.query.teamMembers.findFirst({
      where: eq(teamMembers.id, 'membership_member')
    })
    expect(storedMembership?.leftAt).toBeTruthy()

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'team_member',
        entityId: 'membership_member',
        action: 'team_member.removed'
      })
    ]))
  })

  test('team admins can promote members to admin and the change is audited', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness)

    const response = await harness.request('/api/events/event_1/teams/team_1/members/team_member/actions/make-admin', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        teamId: 'team_1',
        userId: 'team_member',
        role: 'admin'
      }
    })

    const storedMembership = await harness.database.query.teamMembers.findFirst({
      where: eq(teamMembers.id, 'membership_member')
    })
    expect(storedMembership?.role).toBe('admin')

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'team_member',
        entityId: 'membership_member',
        action: 'team_member.promoted_to_admin'
      })
    ]))
  })

  test('the last active admin cannot leave the team', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness)

    const response = await harness.request('/api/events/event_1/teams/team_1/actions/leave', {
      method: 'POST'
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'team_admin_required'
      }
    })
  })

  test('a solo-team admin can leave during team formation when the team has no active submission and then request to join another team', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness, {
      teamOneSolo: true
    })
    await harness.database.insert(teamJoinRequests).values({
      id: 'request_team_1',
      teamId: 'team_1',
      userId: 'requester',
      status: 'pending',
      requestedAt: '2026-03-22T12:30:00.000Z',
      createdAt: '2026-03-22T12:30:00.000Z'
    })

    const leaveResponse = await harness.request('/api/events/event_1/teams/team_1/actions/leave', {
      method: 'POST'
    })

    expect(leaveResponse.status).toBe(200)
    expect(await leaveResponse.json()).toMatchObject({
      data: {
        teamId: 'team_1',
        userId: 'team_admin',
        teamDissolved: true
      }
    })

    const dissolvedMembership = await harness.database.query.teamMembers.findFirst({
      where: eq(teamMembers.id, 'membership_admin')
    })
    expect(dissolvedMembership?.leftAt).toBeTruthy()

    const closedJoinRequest = await harness.database.query.teamJoinRequests.findFirst({
      where: eq(teamJoinRequests.id, 'request_team_1')
    })
    expect(closedJoinRequest).toMatchObject({
      status: 'rejected',
      reviewedByUserId: 'team_admin'
    })
    expect(closedJoinRequest?.reviewedAt).toBeTruthy()

    const listResponse = await harness.request('/api/events/event_1/teams?page=1&page_size=10')
    expect(listResponse.status).toBe(200)
    expect(await listResponse.json()).toMatchObject({
      meta: {
        total: 1
      },
      data: [
        expect.objectContaining({
          id: 'team_2'
        })
      ]
    })

    const joinResponse = await harness.request('/api/events/event_1/team-join-requests', {
      method: 'POST',
      body: JSON.stringify({
        teamId: 'team_2'
      })
    })

    expect(joinResponse.status).toBe(200)
    expect(await joinResponse.json()).toMatchObject({
      data: {
        teamId: 'team_2',
        userId: 'team_admin',
        status: 'pending'
      }
    })
  })

  test('approved participants cannot resolve a dissolved team in list or detail reads', async () => {
    const adminHarness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(adminHarness)
    await seedTeamFormationContext(adminHarness, {
      teamOneSolo: true
    })

    const leaveResponse = await adminHarness.request('/api/events/event_1/teams/team_1/actions/leave', {
      method: 'POST'
    })
    expect(leaveResponse.status).toBe(200)

    stubAuth0Session({
      sub: 'auth0|requester',
      email: 'requester@example.com'
    })

    const listResponse = await adminHarness.request('/api/events/event_1/teams?page=1&page_size=1&slug=alpha-team')
    expect(listResponse.status).toBe(200)
    expect(await listResponse.json()).toMatchObject({
      meta: {
        total: 0
      },
      data: []
    })

    const detailResponse = await adminHarness.request('/api/events/event_1/teams/team_1')
    expect(detailResponse.status).toBe(404)
    expect(await detailResponse.json()).toMatchObject({
      error: {
        code: 'team_not_found'
      }
    })

    const directory = await adminHarness.request('/api/account/events/fixture-event/teams?selectedTeamSlug=alpha-team')
    expect((await directory.json()).data.page.selectedTeam).toBeNull()
  })

  test('staff can still resolve a dissolved team and see it with zero active members', async () => {
    const adminHarness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(adminHarness)
    await seedTeamFormationContext(adminHarness, {
      includeStaffRole: true,
      teamOneSolo: true
    })

    const leaveResponse = await adminHarness.request('/api/events/event_1/teams/team_1/actions/leave', {
      method: 'POST'
    })
    expect(leaveResponse.status).toBe(200)

    stubAuth0Session({
      sub: 'auth0|staff_user',
      email: 'staff-user@example.com'
    })

    const listResponse = await adminHarness.request('/api/events/event_1/teams?page=1&page_size=10&slug=alpha-team')
    expect(listResponse.status).toBe(200)
    expect(await listResponse.json()).toMatchObject({
      meta: {
        total: 1
      },
      data: [
        expect.objectContaining({
          id: 'team_1',
          activeMemberCount: 0,
          isOpenToJoinRequests: false
        })
      ]
    })

    const detailResponse = await adminHarness.request('/api/events/event_1/teams/team_1')
    expect(detailResponse.status).toBe(200)
    expect(await detailResponse.json()).toMatchObject({
      data: {
        id: 'team_1',
        activeMemberCount: 0,
        members: []
      }
    })

    const directory = await adminHarness.request('/api/account/events/fixture-event/teams?selectedTeamSlug=alpha-team')
    expect((await directory.json()).data.page.selectedTeam).toMatchObject({ id: 'team_1', members: [] })
  })

  test('team admins must use leave for their own membership removals', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness)

    const response = await harness.request('/api/events/event_1/teams/team_1/members/team_admin/actions/remove', {
      method: 'POST'
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'team_member_self_removal_forbidden',
        message: 'Use the leave-team action to remove your own team membership.'
      }
    })
  })

  test('team admins cannot use make-admin for their own membership or an existing admin', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness)

    const selfPromotionResponse = await harness.request('/api/events/event_1/teams/team_1/members/team_admin/actions/make-admin', {
      method: 'POST'
    })

    expect(selfPromotionResponse.status).toBe(403)
    expect(await selfPromotionResponse.json()).toMatchObject({
      error: {
        code: 'team_member_self_promotion_forbidden',
        message: 'Team admins cannot use make-admin on their own membership.'
      }
    })

    const initialPromotionResponse = await harness.request('/api/events/event_1/teams/team_1/members/team_member/actions/make-admin', {
      method: 'POST'
    })

    expect(initialPromotionResponse.status).toBe(200)

    const existingAdminResponse = await harness.request('/api/events/event_1/teams/team_1/members/team_member/actions/make-admin', {
      method: 'POST'
    })

    expect(existingAdminResponse.status).toBe(409)
    expect(await existingAdminResponse.json()).toMatchObject({
      error: {
        code: 'team_member_already_admin',
        message: 'The selected team member is already an admin.'
      }
    })
  })

  test('a solo-team admin cannot leave during team formation when the team has an active submission', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness, {
      teamOneSolo: true,
      teamOneActiveSubmissionStatus: 'draft'
    })

    const response = await harness.request('/api/events/event_1/teams/team_1/actions/leave', {
      method: 'POST'
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'team_submission_active',
        message: 'You cannot leave the last active member of a team that still has an active submission.'
      }
    })
  })

  test('approved users can create and cancel their own pending join requests', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|requester',
        email: 'requester@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness)

    const createResponse = await harness.request('/api/events/event_1/team-join-requests', {
      method: 'POST',
      body: JSON.stringify({
        teamId: 'team_1'
      })
    })

    expect(createResponse.status).toBe(200)
    const createPayload = await createResponse.json()
    expect(createPayload).toMatchObject({
      data: {
        teamId: 'team_1',
        userId: 'requester',
        status: 'pending'
      }
    })

    await harness.database.insert(teamJoinRequests).values({
      id: 'another_request',
      teamId: 'team_1',
      userId: 'other_requester'
    })
    const teamsPagePath = '/api/account/events/fixture-event/teams?selectedTeamSlug=alpha-team'
    const pending = await harness.request(teamsPagePath)
    const { page } = (await pending.json()).data
    expect(page).toMatchObject({
      applicationStatus: 'approved',
      ownTeamId: null,
      selectedTeam: { id: 'team_1' },
      pendingJoinRequests: [{ id: createPayload.data.id, teamId: 'team_1' }]
    })
    expect(page.selectedTeam.members.map((member: { user: unknown }) => member.user)).toEqual(expect.arrayContaining([
      { id: 'team_admin', displayName: 'Team Admin' }
    ]))

    const cancelResponse = await harness.request(
      `/api/events/event_1/team-join-requests/${createPayload.data.id}/actions/cancel`,
      {
        method: 'POST'
      }
    )

    expect(cancelResponse.status).toBe(200)
    expect(await cancelResponse.json()).toMatchObject({
      data: {
        id: createPayload.data.id,
        status: 'canceled'
      }
    })
    const canceled = await harness.request(teamsPagePath)
    expect((await canceled.json()).data.page.pendingJoinRequests).toEqual([])
  })

  test('team admins can approve join requests, creating membership and an audit entry', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness)

    await harness.database.insert(teamJoinRequests).values({
      id: 'request_1',
      teamId: 'team_1',
      userId: 'requester',
      status: 'pending',
      requestedAt: '2026-03-22T12:30:00.000Z',
      createdAt: '2026-03-22T12:30:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/team-join-requests/request_1/actions/approve', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'request_1',
        status: 'approved',
        reviewedByUserId: 'team_admin'
      }
    })

    const membership = await harness.database.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, 'team_1'),
        eq(teamMembers.userId, 'requester')
      )
    })
    expect(membership).toMatchObject({
      role: 'member',
      leftAt: null
    })

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'team_join_request',
        entityId: 'request_1',
        action: 'team_join_request.approved'
      })
    ]))
  })

  test('team admins can list and reject join requests', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedTeamFormationContext(harness)

    await harness.database.insert(teamJoinRequests).values({
      id: 'request_2',
      teamId: 'team_1',
      userId: 'other_requester',
      status: 'pending',
      requestedAt: '2026-03-22T12:45:00.000Z',
      createdAt: '2026-03-22T12:45:00.000Z'
    })

    const listResponse = await harness.request('/api/events/event_1/teams/team_1/join-requests')
    expect(listResponse.status).toBe(200)
    expect(await listResponse.json()).toMatchObject({
      meta: {
        total: 1
      },
      data: [
        expect.objectContaining({
          id: 'request_2',
          user: expect.objectContaining({
            id: 'other_requester'
          })
        })
      ]
    })

    const rejectResponse = await harness.request('/api/events/event_1/team-join-requests/request_2/actions/reject', {
      method: 'POST'
    })

    expect(rejectResponse.status).toBe(200)
    expect(await rejectResponse.json()).toMatchObject({
      data: {
        id: 'request_2',
        status: 'rejected',
        reviewedByUserId: 'team_admin'
      }
    })
  })
})
