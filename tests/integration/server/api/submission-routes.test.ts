import { afterEach, describe, expect, test, vi } from 'vitest'

import { eq } from 'drizzle-orm'

import getSubmissionHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/submission/index.get'
import createSubmissionHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/submission/index.post'
import patchSubmissionHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/submission/index.patch'
import patchSubmissionPublicVisibilityHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/submission/public-visibility.patch'
import submitSubmissionHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/submission/actions/submit.post'
import withdrawSubmissionHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/submission/actions/withdraw.post'
import adminWithdrawSubmissionHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/submission/actions/admin-withdraw.post'
import disqualifySubmissionHandler from '../../../../server/api/events/[eventId]/teams/[teamId]/submission/actions/disqualify.post'
import listNoSubmissionTeamsHandler from '../../../../server/api/events/[eventId]/no-submission-teams/index.get'
import getSubmissionMonitorHandler from '../../../../server/api/events/[eventId]/teams/submission-monitor.get'
import {
  auditLogs,
  eventRoleAssignments,
  eventTermsDocuments,
  events,
  prizeRedemptions,
  prizes,
  submissions,
  teamMembers,
  teams,
  userApplications,
  users
} from '../../../../server/database/schema'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

function createRoutes() {
  return [
    {
      method: 'get' as const,
      path: '/api/events/:eventId/teams/:teamId/submission',
      handler: getSubmissionHandler
    },
    {
      method: 'post' as const,
      path: '/api/events/:eventId/teams/:teamId/submission',
      handler: createSubmissionHandler
    },
    {
      method: 'patch' as const,
      path: '/api/events/:eventId/teams/:teamId/submission',
      handler: patchSubmissionHandler
    },
    {
      method: 'patch' as const,
      path: '/api/events/:eventId/teams/:teamId/submission/public-visibility',
      handler: patchSubmissionPublicVisibilityHandler
    },
    {
      method: 'post' as const,
      path: '/api/events/:eventId/teams/:teamId/submission/actions/submit',
      handler: submitSubmissionHandler
    },
    {
      method: 'post' as const,
      path: '/api/events/:eventId/teams/:teamId/submission/actions/withdraw',
      handler: withdrawSubmissionHandler
    },
    {
      method: 'post' as const,
      path: '/api/events/:eventId/teams/:teamId/submission/actions/admin-withdraw',
      handler: adminWithdrawSubmissionHandler
    },
    {
      method: 'post' as const,
      path: '/api/events/:eventId/teams/:teamId/submission/actions/disqualify',
      handler: disqualifySubmissionHandler
    },
    {
      method: 'get' as const,
      path: '/api/events/:eventId/no-submission-teams',
      handler: listNoSubmissionTeamsHandler
    },
    {
      method: 'get' as const,
      path: '/api/events/:eventId/teams/submission-monitor',
      handler: getSubmissionMonitorHandler
    }
  ]
}

async function seedSubmissionContext(
  harness: ReturnType<typeof createApiRouteTestHarness>,
  options?: {
    state?:
      | 'submission_open'
      | 'judging_preparation'
      | 'blind_review'
      | 'shortlist'
      | 'pitch'
      | 'pitch_review'
      | 'final_deliberation'
      | 'winners_announced'
      | 'completed'
    requireSubmissionSummary?: boolean
    requireSubmissionRepositoryUrl?: boolean
    requireSubmissionDemoUrl?: boolean
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
      displayName: 'Team Admin'
    },
    {
      id: 'team_member',
      auth0Subject: 'auth0|team_member',
      email: 'team-member@example.com',
      displayName: 'Team Member'
    },
    {
      id: 'outsider',
      auth0Subject: 'auth0|outsider',
      email: 'outsider@example.com',
      displayName: 'Outsider'
    },
    {
      id: 'other_team_admin',
      auth0Subject: 'auth0|other_team_admin',
      email: 'other-team-admin@example.com',
      displayName: 'Other Team Admin'
    }
  ])

  await harness.database.insert(events).values({
    id: 'event_1',
    eventType: 'hackathon',
    name: 'Submission Event',
    slug: 'submission-event',
    description: 'Submission Event',
    city: 'Vienna',
    country: 'Austria',
    address: 'Fixture Address',
    registrationOpensAt: '2026-03-20T12:00:00.000Z',
    registrationClosesAt: '2026-03-23T12:00:00.000Z',
    submissionOpensAt: '2026-03-23T12:00:00.000Z',
    submissionClosesAt: '2026-03-25T12:00:00.000Z',
    state: options?.state ?? 'submission_open',
    maxTeamMembers: 4,
    requireGithubProfile: false,
    requireSubmissionSummary: options?.requireSubmissionSummary ?? false,
    requireSubmissionRepositoryUrl: options?.requireSubmissionRepositoryUrl ?? false,
    requireSubmissionDemoUrl: options?.requireSubmissionDemoUrl ?? false,
    currentApplicationTermsDocumentId: null,
    currentWinnerTermsDocumentId: null,
    createdByUserId: 'platform_admin'
  })

  await harness.database.insert(eventRoleAssignments).values({
    id: 'role_event_admin',
    eventId: 'event_1',
    userId: 'event_admin',
    role: 'event_admin',
    isInJudgePool: false,
    createdAt: '2026-03-22T12:00:00.000Z'
  })

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
    approvedApplication('application_outsider', 'outsider'),
    approvedApplication('application_other_team_admin', 'other_team_admin')
  ])

  await harness.database.insert(teams).values([
    {
      id: 'team_1',
      eventId: 'event_1',
      name: 'Alpha Team',
      slug: 'alpha-team',
      isOpenToJoinRequests: true,
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
      createdByUserId: 'other_team_admin',
      createdAt: '2026-03-22T12:30:00.000Z',
      updatedAt: '2026-03-22T12:30:00.000Z'
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
      joinedAt: '2026-03-22T12:00:00.000Z',
      createdAt: '2026-03-22T12:00:00.000Z'
    },
    {
      id: 'membership_other_admin',
      teamId: 'team_2',
      userId: 'other_team_admin',
      role: 'admin',
      joinedAt: '2026-03-22T12:30:00.000Z',
      createdAt: '2026-03-22T12:30:00.000Z'
    }
  ])
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

describe('TASK-3.7 submission routes', () => {
  const harnesses: Array<ReturnType<typeof createApiRouteTestHarness>> = []

  afterEach(async () => {
    vi.unstubAllGlobals()

    while (harnesses.length > 0) {
      await harnesses.pop()?.d1Database.close()
    }
  })

  test('team admins can create, update, fetch, and submit a submission draft', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedSubmissionContext(harness)

    const createResponse = await harness.request('/api/events/event_1/teams/team_1/submission', {
      method: 'POST',
      body: JSON.stringify({
        projectName: 'Alpha Project',
        summary: 'Alpha project summary',
        repositoryUrl: 'https://github.com/example/alpha-project',
        demoUrl: 'https://example.com/alpha-project'
      })
    })

    expect(createResponse.status).toBe(200)
    expect(await createResponse.json()).toMatchObject({
      data: {
        teamId: 'team_1',
        status: 'draft',
        projectName: 'Alpha Project',
        summary: 'Alpha project summary',
        repositoryUrl: 'https://github.com/example/alpha-project',
        demoUrl: 'https://example.com/alpha-project'
      }
    })

    const patchResponse = await harness.request('/api/events/event_1/teams/team_1/submission', {
      method: 'PATCH',
      body: JSON.stringify({
        projectName: 'Alpha Project Revised',
        summary: 'Refined summary',
        repositoryUrl: 'https://github.com/example/alpha',
        demoUrl: 'https://example.com/alpha'
      })
    })

    expect(patchResponse.status).toBe(200)
    expect(await patchResponse.json()).toMatchObject({
      data: {
        status: 'draft',
        projectName: 'Alpha Project Revised',
        summary: 'Refined summary',
        repositoryUrl: 'https://github.com/example/alpha',
        demoUrl: 'https://example.com/alpha'
      }
    })

    const getResponse = await harness.request('/api/events/event_1/teams/team_1/submission')
    expect(getResponse.status).toBe(200)
    expect(await getResponse.json()).toMatchObject({
      data: {
        status: 'draft',
        projectName: 'Alpha Project Revised',
        summary: 'Refined summary',
        repositoryUrl: 'https://github.com/example/alpha',
        demoUrl: 'https://example.com/alpha'
      }
    })

    const submitResponse = await harness.request('/api/events/event_1/teams/team_1/submission/actions/submit', {
      method: 'POST',
      body: JSON.stringify({ projectName: 'Final edited title', summary: '', repositoryUrl: 'https://github.com/example/final', demoUrl: '' })
    })

    expect(submitResponse.status).toBe(200)
    expect(await submitResponse.json()).toMatchObject({
      data: {
        status: 'submitted'
      }
    })

    const storedSubmission = await harness.database.query.submissions.findFirst({
      where: eq(submissions.teamId, 'team_1')
    })

    expect(storedSubmission).toMatchObject({
      status: 'submitted',
      projectName: 'Final edited title',
      repositoryUrl: 'https://github.com/example/final'
    })
  })

  test('submission create and update reject incomplete required fields', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedSubmissionContext(harness, {
      requireSubmissionSummary: true,
      requireSubmissionRepositoryUrl: true,
      requireSubmissionDemoUrl: true
    })

    const incompleteCreateResponse = await harness.request('/api/events/event_1/teams/team_1/submission', {
      method: 'POST',
      body: JSON.stringify({
        projectName: 'Incomplete Project',
        summary: '',
        repositoryUrl: '',
        demoUrl: ''
      })
    })

    expect(incompleteCreateResponse.status).toBe(400)

    await harness.database.insert(submissions).values({
      id: 'submission_1',
      teamId: 'team_1',
      status: 'draft',
      projectName: 'Alpha Project',
      summary: 'Alpha summary',
      repositoryUrl: 'https://github.com/example/alpha',
      demoUrl: 'https://example.com/alpha',
      submittedAt: null,
      lockedAt: null,
      withdrawnAt: null,
      disqualifiedAt: null,
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-24T12:00:00.000Z'
    })

    const incompletePatchResponse = await harness.request('/api/events/event_1/teams/team_1/submission', {
      method: 'PATCH',
      body: JSON.stringify({
        projectName: 'Alpha Project',
        summary: 'Updated summary',
        repositoryUrl: '',
        demoUrl: 'https://example.com/alpha'
      })
    })

    expect(incompletePatchResponse.status).toBe(400)
  })

  test('submit rejects incomplete fields without changing the saved draft', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedSubmissionContext(harness, {
      requireSubmissionRepositoryUrl: true
    })

    await harness.database.insert(submissions).values({
      id: 'submission_1',
      teamId: 'team_1',
      status: 'draft',
      projectName: 'Alpha Project',
      summary: 'Alpha summary',
      repositoryUrl: null,
      demoUrl: null,
      submittedAt: null,
      lockedAt: null,
      withdrawnAt: null,
      disqualifiedAt: null,
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-24T12:00:00.000Z'
    })

    const submitResponse = await harness.request('/api/events/event_1/teams/team_1/submission/actions/submit', {
      method: 'POST',
      body: JSON.stringify({ projectName: 'Missing repository', summary: '', repositoryUrl: '', demoUrl: '' })
    })

    expect(submitResponse.status).toBe(400)
    expect(await submitResponse.json()).toMatchObject({
      error: {
        code: 'submission_fields_invalid'
      }
    })
  })

  test('optional submission fields can be cleared and submitted when the event does not require them', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedSubmissionContext(harness)

    const createResponse = await harness.request('/api/events/event_1/teams/team_1/submission', {
      method: 'POST',
      body: JSON.stringify({
        projectName: 'Optional Fields Project',
        summary: '',
        repositoryUrl: '',
        demoUrl: ''
      })
    })

    expect(createResponse.status).toBe(200)
    expect(await createResponse.json()).toMatchObject({
      data: {
        projectName: 'Optional Fields Project',
        summary: null,
        repositoryUrl: null,
        demoUrl: null
      }
    })

    const patchResponse = await harness.request('/api/events/event_1/teams/team_1/submission', {
      method: 'PATCH',
      body: JSON.stringify({
        projectName: 'Optional Fields Project Revised',
        summary: '',
        repositoryUrl: '',
        demoUrl: ''
      })
    })

    expect(patchResponse.status).toBe(200)
    expect(await patchResponse.json()).toMatchObject({
      data: {
        projectName: 'Optional Fields Project Revised',
        summary: null,
        repositoryUrl: null,
        demoUrl: null
      }
    })

    const submitResponse = await harness.request('/api/events/event_1/teams/team_1/submission/actions/submit', {
      method: 'POST',
      body: JSON.stringify({ projectName: 'Optional Fields Project Revised', summary: '', repositoryUrl: '', demoUrl: '' })
    })

    expect(submitResponse.status).toBe(200)

    const storedSubmission = await harness.database.query.submissions.findFirst({
      where: eq(submissions.teamId, 'team_1')
    })

    expect(storedSubmission).toMatchObject({
      status: 'submitted',
      summary: null,
      repositoryUrl: null,
      demoUrl: null
    })
  })

  test('submission visibility is limited to team members and event admins', async () => {
    const memberHarness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_member',
        email: 'team-member@example.com'
      }
    })
    harnesses.push(memberHarness)
    await seedSubmissionContext(memberHarness)
    await memberHarness.database.insert(submissions).values({
      id: 'submission_1',
      teamId: 'team_1',
      status: 'submitted',
      projectName: 'Visible Project',
      summary: 'Visible Summary',
      repositoryUrl: null,
      demoUrl: null,
      submittedAt: '2026-03-24T12:00:00.000Z',
      lockedAt: null,
      withdrawnAt: null,
      disqualifiedAt: null,
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-24T12:00:00.000Z'
    })

    const memberResponse = await memberHarness.request('/api/events/event_1/teams/team_1/submission')
    expect(memberResponse.status).toBe(200)
    expect(await memberResponse.json()).toMatchObject({
      data: {
        status: 'submitted'
      }
    })

    const outsiderHarness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|outsider',
        email: 'outsider@example.com'
      }
    })
    harnesses.push(outsiderHarness)
    await seedSubmissionContext(outsiderHarness)
    await outsiderHarness.database.insert(submissions).values({
      id: 'submission_1',
      teamId: 'team_1',
      status: 'submitted',
      projectName: 'Visible Project',
      summary: 'Visible Summary',
      repositoryUrl: null,
      demoUrl: null,
      submittedAt: '2026-03-24T12:00:00.000Z',
      lockedAt: null,
      withdrawnAt: null,
      disqualifiedAt: null,
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-24T12:00:00.000Z'
    })

    const outsiderResponse = await outsiderHarness.request('/api/events/event_1/teams/team_1/submission')
    expect(outsiderResponse.status).toBe(403)
    expect(await outsiderResponse.json()).toMatchObject({
      error: {
        code: 'team_submission_access_denied'
      }
    })
  })

  test('team admins can toggle public visibility for completed non-winning locked submissions', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedSubmissionContext(harness, {
      state: 'completed'
    })
    await harness.database.insert(submissions).values({
      id: 'submission_1',
      teamId: 'team_1',
      status: 'locked',
      projectName: 'Alpha Project',
      summary: 'Alpha summary',
      repositoryUrl: 'https://github.com/example/alpha',
      demoUrl: 'https://example.com/alpha',
      isPubliclyVisible: false,
      submittedAt: '2026-03-24T12:00:00.000Z',
      lockedAt: '2026-03-25T12:00:00.000Z',
      withdrawnAt: null,
      disqualifiedAt: null,
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-25T12:00:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/teams/team_1/submission/public-visibility', {
      method: 'PATCH',
      body: JSON.stringify({
        isPubliclyVisible: true
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        id: 'submission_1',
        isPubliclyVisible: true
      }
    })

    const storedSubmission = await harness.database.query.submissions.findFirst({
      where: eq(submissions.id, 'submission_1')
    })
    const storedEvent = await harness.database.query.events.findFirst({
      where: eq(events.id, 'event_1')
    })

    expect(storedSubmission?.isPubliclyVisible).toBe(true)
    expect(storedEvent?.publicContentRevision).toBe(1)
  })

  test('public visibility toggle stays unavailable before completion and for winner teams', async () => {
    const preCompletionHarness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(preCompletionHarness)
    await seedSubmissionContext(preCompletionHarness, {
      state: 'winners_announced'
    })
    await preCompletionHarness.database.insert(submissions).values({
      id: 'submission_pre_completion',
      teamId: 'team_1',
      status: 'locked',
      projectName: 'Alpha Project',
      summary: 'Alpha summary',
      repositoryUrl: 'https://github.com/example/alpha',
      demoUrl: 'https://example.com/alpha',
      isPubliclyVisible: false,
      submittedAt: '2026-03-24T12:00:00.000Z',
      lockedAt: '2026-03-25T12:00:00.000Z',
      withdrawnAt: null,
      disqualifiedAt: null,
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-25T12:00:00.000Z'
    })

    const preCompletionResponse = await preCompletionHarness.request('/api/events/event_1/teams/team_1/submission/public-visibility', {
      method: 'PATCH',
      body: JSON.stringify({
        isPubliclyVisible: true
      })
    })

    expect(preCompletionResponse.status).toBe(409)

    const winnerHarness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(winnerHarness)
    await seedSubmissionContext(winnerHarness, {
      state: 'completed'
    })
    await winnerHarness.database.insert(submissions).values({
      id: 'submission_winner',
      teamId: 'team_1',
      status: 'locked',
      projectName: 'Winning Project',
      summary: 'Winning summary',
      repositoryUrl: 'https://github.com/example/winner',
      demoUrl: 'https://example.com/winner',
      isPubliclyVisible: false,
      submittedAt: '2026-03-24T12:00:00.000Z',
      lockedAt: '2026-03-25T12:00:00.000Z',
      withdrawnAt: null,
      disqualifiedAt: null,
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-25T12:00:00.000Z'
    })
    await winnerHarness.database.insert(prizes).values({
      id: 'prize_winner',
      eventId: 'event_1',
      name: 'Grand Prize',
      description: 'Winner prize',
      rewardType: 'api_credits',
      rewardValue: '5000',
      rewardCurrency: 'USD',
      awardScope: 'team',
      rankStart: 1,
      rankEnd: 1
    })
    await winnerHarness.database.insert(prizeRedemptions).values({
      id: 'redemption_winner',
      prizeId: 'prize_winner',
      userId: null,
      teamId: 'team_1',
      status: 'pending',
      createdAt: '2026-03-26T12:00:00.000Z',
      updatedAt: '2026-03-26T12:00:00.000Z'
    })

    const winnerResponse = await winnerHarness.request('/api/events/event_1/teams/team_1/submission/public-visibility', {
      method: 'PATCH',
      body: JSON.stringify({
        isPubliclyVisible: true
      })
    })

    expect(winnerResponse.status).toBe(409)
    expect(await winnerResponse.json()).toMatchObject({
      error: {
        code: 'submission_public_visibility_invalid'
      }
    })
  })

  test('team-admin withdrawal writes an audit record', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|team_admin',
        email: 'team-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedSubmissionContext(harness)

    await harness.database.insert(submissions).values({
      id: 'submission_1',
      teamId: 'team_1',
      status: 'submitted',
      projectName: 'Alpha Project',
      summary: 'Summary',
      repositoryUrl: null,
      demoUrl: null,
      submittedAt: '2026-03-24T12:00:00.000Z',
      lockedAt: null,
      withdrawnAt: null,
      disqualifiedAt: null,
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-24T12:00:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/teams/team_1/submission/actions/withdraw', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        status: 'withdrawn'
      }
    })

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'submission',
        entityId: 'submission_1',
        action: 'submission.withdrawn'
      })
    ]))
  })

  test('event admins can admin-withdraw only with an active team-admin request', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedSubmissionContext(harness)

    await harness.database.insert(submissions).values({
      id: 'submission_1',
      teamId: 'team_1',
      status: 'submitted',
      projectName: 'Alpha Project',
      summary: 'Summary',
      repositoryUrl: null,
      demoUrl: null,
      submittedAt: '2026-03-24T12:00:00.000Z',
      lockedAt: null,
      withdrawnAt: null,
      disqualifiedAt: null,
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-24T12:00:00.000Z'
    })

    const invalidResponse = await harness.request('/api/events/event_1/teams/team_1/submission/actions/admin-withdraw', {
      method: 'POST',
      body: JSON.stringify({
        requestedByUserId: 'team_member'
      })
    })

    expect(invalidResponse.status).toBe(409)
    expect(await invalidResponse.json()).toMatchObject({
      error: {
        code: 'team_request_required'
      }
    })

    const validResponse = await harness.request('/api/events/event_1/teams/team_1/submission/actions/admin-withdraw', {
      method: 'POST',
      body: JSON.stringify({
        requestedByUserId: 'team_admin',
        reason: 'Requested by team'
      })
    })

    expect(validResponse.status).toBe(200)
    expect(await validResponse.json()).toMatchObject({
      data: {
        status: 'withdrawn'
      }
    })

    const auditRows = await harness.database.select().from(auditLogs)
    expect(auditRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'submission',
        entityId: 'submission_1',
        action: 'submission.admin_withdrawn'
      })
    ]))
  })

  test('event admins can disqualify locked submissions during shortlist review', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedSubmissionContext(harness, {
      state: 'shortlist'
    })

    await harness.database.insert(submissions).values({
      id: 'submission_1',
      teamId: 'team_1',
      status: 'locked',
      projectName: 'Alpha Project',
      summary: 'Summary',
      repositoryUrl: null,
      demoUrl: null,
      submittedAt: '2026-03-24T12:00:00.000Z',
      lockedAt: '2026-03-25T12:00:00.000Z',
      withdrawnAt: null,
      disqualifiedAt: null,
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-25T12:00:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/teams/team_1/submission/actions/disqualify', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Competition removal'
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        status: 'disqualified'
      }
    })

    const storedSubmission = await harness.database.query.submissions.findFirst({
      where: eq(submissions.id, 'submission_1')
    })

    expect(storedSubmission?.status).toBe('disqualified')
  })

  test('event admins see the recorded disqualification reason on submission records', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedSubmissionContext(harness, {
      state: 'shortlist'
    })

    await harness.database.insert(submissions).values({
      id: 'submission_1',
      teamId: 'team_1',
      status: 'disqualified',
      projectName: 'Alpha Project',
      summary: 'Summary',
      repositoryUrl: null,
      demoUrl: null,
      submittedAt: '2026-03-24T12:00:00.000Z',
      lockedAt: '2026-03-25T12:00:00.000Z',
      withdrawnAt: null,
      disqualifiedAt: '2026-03-26T12:00:00.000Z',
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-26T12:00:00.000Z'
    })

    await harness.database.insert(auditLogs).values({
      id: 'audit_submission_disqualified',
      actorUserId: 'event_admin',
      entityType: 'submission',
      entityId: 'submission_1',
      action: 'submission.disqualified',
      metadata: {
        eventId: 'event_1',
        teamId: 'team_1',
        reason: 'Competition removal',
        previousStatus: 'locked',
        nextStatus: 'disqualified'
      },
      createdAt: '2026-03-26T12:00:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/teams/team_1/submission')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        status: 'disqualified',
        disqualificationReason: 'Competition removal'
      }
    })
  })

  test('submission records keep the disqualification reason empty when no reason was recorded', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedSubmissionContext(harness, {
      state: 'shortlist'
    })

    await harness.database.insert(submissions).values({
      id: 'submission_1',
      teamId: 'team_1',
      status: 'disqualified',
      projectName: 'Alpha Project',
      summary: 'Summary',
      repositoryUrl: null,
      demoUrl: null,
      submittedAt: '2026-03-24T12:00:00.000Z',
      lockedAt: '2026-03-25T12:00:00.000Z',
      withdrawnAt: null,
      disqualifiedAt: '2026-03-26T12:00:00.000Z',
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-26T12:00:00.000Z'
    })

    await harness.database.insert(auditLogs).values({
      id: 'audit_submission_disqualified',
      actorUserId: 'event_admin',
      entityType: 'submission',
      entityId: 'submission_1',
      action: 'submission.disqualified',
      metadata: {
        eventId: 'event_1',
        teamId: 'team_1',
        reason: '   ',
        previousStatus: 'locked',
        nextStatus: 'disqualified'
      },
      createdAt: '2026-03-26T12:00:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/teams/team_1/submission')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        status: 'disqualified',
        disqualificationReason: null
      }
    })
  })

  test('draft submissions cannot be disqualified during shortlist review and remain part of the no-submission model', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedSubmissionContext(harness, {
      state: 'shortlist'
    })

    await harness.database.insert(submissions).values({
      id: 'submission_1',
      teamId: 'team_1',
      status: 'draft',
      projectName: 'Alpha Draft',
      summary: 'Draft summary',
      repositoryUrl: null,
      demoUrl: null,
      submittedAt: null,
      lockedAt: null,
      withdrawnAt: null,
      disqualifiedAt: null,
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-24T12:00:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/teams/team_1/submission/actions/disqualify', {
      method: 'POST',
      body: JSON.stringify({
        reason: 'Should fail'
      })
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: {
        code: 'submission_state_invalid'
      }
    })
  })

  test('no-submission teams include draft and withdrawn teams but exclude submitted teams', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedSubmissionContext(harness)

    await harness.database.insert(submissions).values([
      {
        id: 'submission_draft',
        teamId: 'team_1',
        status: 'draft',
        projectName: 'Alpha Draft',
        summary: 'Draft summary',
        repositoryUrl: null,
        demoUrl: null,
        submittedAt: null,
        lockedAt: null,
        withdrawnAt: null,
        disqualifiedAt: null,
        createdAt: '2026-03-24T12:00:00.000Z',
        updatedAt: '2026-03-24T12:00:00.000Z'
      },
      {
        id: 'submission_submitted',
        teamId: 'team_2',
        status: 'submitted',
        projectName: 'Beta Submitted',
        summary: 'Submitted summary',
        repositoryUrl: null,
        demoUrl: null,
        submittedAt: '2026-03-24T13:00:00.000Z',
        lockedAt: null,
        withdrawnAt: null,
        disqualifiedAt: null,
        createdAt: '2026-03-24T13:00:00.000Z',
        updatedAt: '2026-03-24T13:00:00.000Z'
      }
    ])

    const response = await harness.request('/api/events/event_1/no-submission-teams')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: [
        {
          team: {
            id: 'team_1'
          },
          submission: {
            status: 'draft'
          }
        }
      ]
    })
  })

  test('submission monitor returns team details and latest submissions in one admin request', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedSubmissionContext(harness)

    await harness.database.insert(submissions).values({
      id: 'submission_current',
      teamId: 'team_1',
      status: 'submitted',
      projectName: 'Alpha Submitted',
      summary: 'Submitted summary',
      repositoryUrl: null,
      demoUrl: null,
      submittedAt: '2026-03-24T13:00:00.000Z',
      lockedAt: null,
      withdrawnAt: null,
      disqualifiedAt: null,
      createdAt: '2026-03-24T13:00:00.000Z',
      updatedAt: '2026-03-24T13:00:00.000Z'
    })

    const response = await harness.request('/api/events/event_1/teams/submission-monitor')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        teamDetails: [
          {
            id: 'team_1',
            activeMemberCount: 2,
            members: [
              {
                userId: 'team_admin',
                role: 'admin'
              },
              {
                userId: 'team_member',
                role: 'member'
              }
            ]
          },
          {
            id: 'team_2',
            activeMemberCount: 1,
            members: [
              {
                userId: 'other_team_admin',
                role: 'admin'
              }
            ]
          }
        ],
        teamSubmissions: [
          {
            id: 'submission_current',
            teamId: 'team_1',
            status: 'submitted'
          },
          null
        ]
      }
    })
  })

  test('submission operation lists batch large team lookups under D1 parameter limits', async () => {
    const harness = createApiRouteTestHarness({
      routes: createRoutes(),
      sessionUser: {
        sub: 'auth0|event_admin',
        email: 'event-admin@example.com'
      }
    })
    harnesses.push(harness)
    await seedSubmissionContext(harness)

    const teamCount = 120
    const bulkUsers = Array.from({ length: teamCount }, (_, index) => ({
      id: `bulk_user_${index + 1}`,
      auth0Subject: `auth0|bulk_user_${index + 1}`,
      email: `bulk-user-${index + 1}@example.com`,
      displayName: `Bulk User ${index + 1}`
    }))
    const bulkApplications = bulkUsers.map(user => approvedApplication(`bulk_application_${user.id}`, user.id))
    const bulkTeams = bulkUsers.map((user, index) => ({
      id: `bulk_team_${index + 1}`,
      eventId: 'event_1',
      name: `Bulk Team ${index + 1}`,
      slug: `bulk-team-${index + 1}`,
      isOpenToJoinRequests: false,
      createdByUserId: user.id,
      createdAt: '2026-03-22T14:00:00.000Z',
      updatedAt: '2026-03-22T14:00:00.000Z'
    }))
    const bulkMemberships = bulkUsers.map((user, index) => ({
      id: `bulk_membership_${index + 1}`,
      teamId: `bulk_team_${index + 1}`,
      userId: user.id,
      role: 'admin' as const,
      joinedAt: '2026-03-22T14:00:00.000Z',
      createdAt: '2026-03-22T14:00:00.000Z'
    }))
    const bulkSubmissions = bulkUsers.map((_, index) => ({
      id: `bulk_submission_${index + 1}`,
      teamId: `bulk_team_${index + 1}`,
      status: 'draft' as const,
      projectName: `Bulk Draft ${index + 1}`,
      summary: 'Draft summary',
      repositoryUrl: null,
      demoUrl: null,
      submittedAt: null,
      lockedAt: null,
      withdrawnAt: null,
      disqualifiedAt: null,
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-24T12:00:00.000Z'
    }))

    for (let index = 0; index < teamCount; index += 40) {
      await harness.database.insert(users).values(bulkUsers.slice(index, index + 40))
      await harness.database.insert(userApplications).values(bulkApplications.slice(index, index + 40))
      await harness.database.insert(teams).values(bulkTeams.slice(index, index + 40))
      await harness.database.insert(teamMembers).values(bulkMemberships.slice(index, index + 40))
      await harness.database.insert(submissions).values(bulkSubmissions.slice(index, index + 40))
    }

    enforceD1BindParameterLimit(harness)

    const monitorResponse = await harness.request('/api/events/event_1/teams/submission-monitor')
    expect(monitorResponse.status).toBe(200)
    const monitorBody = await monitorResponse.json()
    expect(monitorBody.data.teamDetails).toHaveLength(teamCount + 2)
    expect(monitorBody.data.teamSubmissions).toHaveLength(teamCount + 2)

    const noSubmissionResponse = await harness.request('/api/events/event_1/no-submission-teams')
    expect(noSubmissionResponse.status).toBe(200)
    expect((await noSubmissionResponse.json()).data).toHaveLength(teamCount + 2)
  })
})
