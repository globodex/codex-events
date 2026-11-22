import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { useTeamDirectory } from '../../../../app/composables/useTeamDirectory'

const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('~/composables/useApiClient', () => ({ useApiClient: () => apiFetch }))
vi.mock('~/composables/useAuthorizationCache', () => ({
  useAuthorizationCache: () => ({
    authorizationGeneration: ref(1),
    protectedKey: (key: string) => ref(key)
  })
}))

const event = { id: 'e1', slug: 'hackathon', state: 'registration_open', maxTeamMembers: 4 } as const
const filterCounts = { all: 5, solo: 2, multi_person: 3, full: 1, open_to_join: 1 }

function page(number: number, ...ids: string[]) {
  return {
    data: ids.map(id => ({
      id, eventId: event.id, slug: id, name: id, workspaceMode: 'team' as const,
      bio: null, isOpenToJoinRequests: true, createdByUserId: 'host', createdAt: '', updatedAt: ''
    })),
    meta: { page: number, pageSize: 2, total: 5, filterCounts }
  }
}

describe('team directory pagination', () => {
  let scope = effectScope()

  function directory() {
    const firstPage = page(1, 'a', 'b')
    return scope.run(() => useTeamDirectory(() => ({
      event, visibleTeams: firstPage.data, visibleTeamsMeta: firstPage.meta
    })))!
  }

  beforeEach(() => {
    scope = effectScope()
    const nuxtApp = {}
    vi.stubGlobal('useNuxtApp', () => nuxtApp)
    apiFetch.mockReset()
  })
  afterEach(() => {
    scope.stop()
    vi.unstubAllGlobals()
  })

  test('fetches only the next page and handles a team moving across a page boundary', async () => {
    apiFetch.mockResolvedValueOnce(page(2, 'b', 'c')).mockResolvedValueOnce(page(3, 'd'))
    const list = directory()
    expect(apiFetch).not.toHaveBeenCalled()
    await list.loadMore()
    await list.loadMore()
    expect(apiFetch.mock.calls.map(([, options]) => options.query.page)).toEqual([2, 3])
    expect(list.teams.value.map(team => team.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(list.hasMore.value).toBe(false)
  })

  test('keeps the new filter when an abandoned load-more response arrives late', async () => {
    const slow = Promise.withResolvers<ReturnType<typeof page>>()
    apiFetch.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(page(1, 'solo'))
    const list = directory()
    const abandoned = list.loadMore()
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledOnce())
    await list.changeFilter('solo')
    slow.resolve(page(2, 'late'))
    await abandoned
    expect(list.teams.value.map(team => team.id)).toEqual(['solo'])
    expect(list.loading.value).toBeNull()
    await list.changeFilter('all')
    expect(list.teams.value.map(team => team.id)).toEqual(['a', 'b'])
    expect(apiFetch).toHaveBeenCalledTimes(2)
  })

  test('keeps visible teams when loading more fails and retries the same page on demand', async () => {
    apiFetch.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(page(2, 'c'))
    const list = directory()
    await list.loadMore()
    expect(list.error.value).toMatchObject({ page: 2 })
    expect(list.teams.value.map(team => team.id)).toEqual(['a', 'b'])
    await list.loadMore()
    expect(list.teams.value.map(team => team.id)).toEqual(['a', 'b', 'c'])
    expect(list.error.value).toBeUndefined()
  })
})
