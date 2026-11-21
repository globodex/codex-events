import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, nextTick, ref, toValue, watch } from 'vue'

const apiFetch = vi.fn()

vi.mock('~/composables/useApiClient', () => ({
  useApiClient: () => apiFetch
}))

vi.mock('~/domains/teams/workspace', async () => await import('../../../../app/domains/teams/workspace'))

function createTeamDetail(memberUserIds: string[], teamId = 'team_1') {
  return {
    id: teamId,
    eventId: 'event_1',
    name: 'North Star Team',
    bio: 'Building a focused collaboration workspace.',
    slug: teamId === 'team_1' ? 'north-star-team-1234' : `${teamId}-slug`,
    isOpenToJoinRequests: true,
    createdByUserId: 'user_admin',
    createdAt: '2026-04-04T08:00:00.000Z',
    updatedAt: '2026-04-04T08:00:00.000Z',
    activeMemberCount: memberUserIds.length,
    members: memberUserIds.map((userId, index) => ({
      id: `member_${index + 1}`,
      teamId,
      userId,
      role: index === 0 ? 'admin' : 'member',
      joinedAt: '2026-04-04T08:00:00.000Z',
      leftAt: null,
      createdAt: '2026-04-04T08:00:00.000Z',
      user: {
        id: userId,
        displayName: userId === 'user_admin' ? 'Admin User' : 'New Member',
        email: `${userId}@example.com`
      }
    }))
  }
}

function createJoinRequest(status: 'pending' | 'approved') {
  return {
    id: 'request_1',
    teamId: 'team_1',
    userId: 'user_new',
    status,
    requestedAt: '2026-04-04T09:00:00.000Z',
    reviewedAt: status === 'approved' ? '2026-04-04T09:05:00.000Z' : null,
    reviewedByUserId: status === 'approved' ? 'user_admin' : null,
    createdAt: '2026-04-04T09:00:00.000Z',
    user: {
      id: 'user_new',
      displayName: 'New Member',
      email: 'new-member@example.com'
    }
  }
}

async function flushWorkspace() {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await flushWorkspace()

    if (predicate()) {
      return
    }
  }

  throw new Error('Timed out waiting for workspace state.')
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return { promise, resolve }
}

describe('useTeamFormationWorkspace', () => {
  const actor = ref({
    kind: 'platform_user',
    sessionUser: {
      sub: 'auth0|user_admin'
    },
    platformUser: {
      id: 'user_admin'
    }
  })

  beforeEach(() => {
    vi.resetModules()
    apiFetch.mockReset()

    let requestApproved = false

    apiFetch.mockImplementation(async (url: string, options?: {
      method?: string
      query?: Record<string, unknown>
    }) => {
      if (url === '/api/events/event_1/applications/me') {
        return {
          data: {
            id: 'application_1',
            eventId: 'event_1',
            userId: 'user_admin',
            status: 'approved'
          }
        }
      }

      if (url === '/api/events/event_1/teams') {
        return {
          data: [
            {
              id: 'team_1',
              eventId: 'event_1',
              name: 'North Star Team',
              bio: 'Building a focused collaboration workspace.',
              slug: 'north-star-team-1234',
              isOpenToJoinRequests: true,
              createdByUserId: 'user_admin',
              createdAt: '2026-04-04T08:00:00.000Z',
              updatedAt: '2026-04-04T08:00:00.000Z',
              activeMemberCount: requestApproved ? 2 : 1
            }
          ],
          meta: {
            total: 1,
            filterCounts: {
              all: 1,
              open_to_join: 1,
              solo: 0,
              multi_person: 0,
              full: 0
            }
          }
        }
      }

      if (url === '/api/events/event_1/teams/team_1') {
        return {
          data: createTeamDetail(requestApproved ? ['user_admin', 'user_new'] : ['user_admin'])
        }
      }

      if (url === '/api/events/event_1/team-join-requests/request_1/actions/approve' && options?.method === 'POST') {
        requestApproved = true

        return {
          data: createJoinRequest('approved')
        }
      }

      throw new Error(`Unhandled request in test: ${url}`)
    })

    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('watch', watch)
    vi.stubGlobal('toValue', toValue)
    vi.stubGlobal('useState', (_key: string, init: () => unknown) => ref(init()))
    const nuxtApp = {}
    vi.stubGlobal('useNuxtApp', () => nuxtApp)
    vi.stubGlobal('useAsyncData', () => ({
      data: ref({
        id: 'application_1',
        eventId: 'event_1',
        userId: 'user_admin',
        status: 'approved'
      }),
      error: ref(null),
      status: ref('success')
    }))
    vi.stubGlobal('useAccountLifecycleActor', () => ({
      actor,
      status: ref('success')
    }))
    vi.stubGlobal('$fetch', apiFetch)
    vi.stubGlobal('useRequestFetch', vi.fn(() => apiFetch))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('uses page-shaped initial state and updates an approved request without refetching', async () => {
    const { useTeamFormationWorkspace } = await import('../../../../app/composables/useTeamFormationWorkspace')
    const team = createTeamDetail(['user_admin'])

    const workspace = useTeamFormationWorkspace({
      id: 'event_1',
      state: 'registration_open',
      maxTeamMembers: 4
    } as never, {
      teamId: 'team_1',
      initialState: ref({
        application: {
          id: 'application_1',
          eventId: 'event_1',
          userId: 'user_admin',
          status: 'approved'
        },
        ownTeam: team,
        ownMembership: team.members[0],
        selectedTeam: team,
        joinRequests: [createJoinRequest('pending')],
        visibleTeams: [{
          id: team.id,
          eventId: team.eventId,
          name: team.name,
          bio: team.bio,
          slug: team.slug,
          workspaceMode: 'team',
          isOpenToJoinRequests: team.isOpenToJoinRequests,
          createdByUserId: team.createdByUserId,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
          activeMemberCount: team.activeMemberCount
        }],
        visibleTeamsMeta: {
          page: 1,
          pageSize: 6,
          total: 1,
          filterCounts: {
            all: 1,
            open_to_join: 1,
            solo: 0,
            multi_person: 0,
            full: 0
          }
        }
      })
    })

    await waitFor(() =>
      workspace.currentTeam.value?.members.length === 1
      && workspace.teamJoinRequests.value.length === 1
      && workspace.teamJoinRequests.value[0]?.status === 'pending'
    )

    expect(workspace.visibleTeamsFilterCounts.value).toEqual({
      all: 1,
      open_to_join: 1,
      solo: 0,
      multi_person: 0,
      full: 0
    })

    await workspace.approveJoinRequest('request_1')

    expect(workspace.currentTeam.value?.members.map(member => member.userId)).toEqual(['user_admin'])
    expect(workspace.teamJoinRequests.value).toMatchObject([
      { id: 'request_1', status: 'approved' }
    ])
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/events/event_1/team-join-requests/request_1/actions/approve',
      expect.objectContaining({ method: 'POST' })
    )
  })

  test('does not commit a late team response after the selected team changes', async () => {
    const { useTeamFormationWorkspace } = await import('../../../../app/composables/useTeamFormationWorkspace')
    const teamId = ref('team_1')
    const first = deferred<{ data: ReturnType<typeof createTeamDetail> }>()
    const second = deferred<{ data: ReturnType<typeof createTeamDetail> }>()

    apiFetch.mockReset()
    apiFetch.mockImplementation((url: string) => {
      if (url === '/api/events/event_1/teams/team_1') {
        return first.promise
      }

      if (url === '/api/events/event_1/teams/team_2') {
        return second.promise
      }

      throw new Error(`Unhandled request in stale-response test: ${url}`)
    })

    const workspace = useTeamFormationWorkspace({
      id: 'event_1',
      state: 'registration_open',
      maxTeamMembers: 4
    } as never, {
      teamId
    })

    await flushWorkspace()
    teamId.value = 'team_2'
    await flushWorkspace()

    first.resolve({
      data: createTeamDetail(['user_admin'], 'team_1')
    })
    await flushWorkspace()

    expect(workspace.currentTeam.value?.id).not.toBe('team_1')

    second.resolve({
      data: createTeamDetail(['user_admin'], 'team_2')
    })
    await waitFor(() => workspace.currentTeam.value?.id === 'team_2')
  })
})
