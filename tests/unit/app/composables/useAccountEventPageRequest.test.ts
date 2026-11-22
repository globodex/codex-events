import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, ref, toValue } from 'vue'

const useApiResponse = vi.hoisted(() => vi.fn())
const useAuthorizationCache = vi.hoisted(() => vi.fn())
const pageRequestSource = readFileSync(
  new URL('../../../../app/composables/useAccountEventPageRequest.ts', import.meta.url),
  'utf8'
)

vi.mock('../../../../app/composables/useApiData', () => ({
  useApiResponse
}))

vi.mock('../../../../app/composables/useAuthorizationCache', () => ({
  useAuthorizationCache
}))

describe('useAccountEventPageRequest', () => {
  beforeEach(() => {
    vi.resetModules()
    useApiResponse.mockReset().mockReturnValue({
      clear: vi.fn(),
      data: ref(null),
      error: ref(null),
      pending: ref(false),
      refresh: vi.fn(),
      invalidationKey: ref('active-view-with-watched-inputs'),
      status: ref('idle')
    })
    useAuthorizationCache.mockReset().mockReturnValue({
      authorizationGeneration: ref(3),
      clearReads: vi.fn()
    })

    vi.stubGlobal('computed', computed)
    vi.stubGlobal('toValue', toValue)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('uses the shared bootstrap/client boundary without a feature-local session read or refresh', () => {
    expect(pageRequestSource).not.toContain('/api/session')
    expect(pageRequestSource).not.toContain('ensureLoaded(')
    expect(pageRequestSource).not.toContain('$fetch')
  })

  test('refreshes the active participant search and clears other cached views of the list', async () => {
    const { useAccountEventPageRequest } = await import('../../../../app/composables/useAccountEventPageRequest')
    const request = useAccountEventPageRequest('fixture-event', 'participants', { query: { participantSearch: 'ben' } })
    const pageRead = useApiResponse.mock.results[0]!.value
    const cache = useAuthorizationCache.mock.results[0]!.value

    expect(pageRead.refresh).not.toHaveBeenCalled()
    await request.refreshFor('previous-event')
    expect(cache.clearReads).toHaveBeenCalledExactlyOnceWith(['account-event-page:previous-event:participants'])
    expect(pageRead.refresh).not.toHaveBeenCalled()
    cache.clearReads.mockClear()
    await request.refresh()
    expect(cache.clearReads).toHaveBeenCalledExactlyOnceWith(
      ['account-event-page:fixture-event:participants'],
      'active-view-with-watched-inputs'
    )
    expect(pageRead.refresh).toHaveBeenCalledOnce()
  })

  test('passes one browser-only request and the tab gate to the protected data helper', async () => {
    const { useAccountEventPageRequest } = await import('../../../../app/composables/useAccountEventPageRequest')
    const enabled = ref(false)
    const request = useAccountEventPageRequest('fixture-event', 'operations', { enabled })

    expect(toValue(request.requestKey)).toBe('account-event-page:fixture-event:operations')
    expect(toValue(request.path)).toBe('/api/account/events/fixture-event/operations')
    expect(request.authorizationGeneration.value).toBe(3)
    expect(useApiResponse).toHaveBeenCalledExactlyOnceWith(request.requestKey, request.path, {
      enabled,
      server: false
    })
  })

  test('includes typed selected-team query state in the request path and cache key', async () => {
    const { useAccountEventPageRequest } = await import('../../../../app/composables/useAccountEventPageRequest')
    const selectedTeamSlug = ref(' Team Alpha ')
    const request = useAccountEventPageRequest('fixture-event', 'teams', {
      query: computed(() => ({ selectedTeamSlug: selectedTeamSlug.value }))
    })

    expect(toValue(request.path)).toBe(
      '/api/account/events/fixture-event/teams?selectedTeamSlug=team%20alpha'
    )
    expect(toValue(request.requestKey)).toBe(
      'account-event-page:fixture-event:teams:selectedTeamSlug=team%20alpha'
    )

    selectedTeamSlug.value = 'team-beta'
    expect(toValue(request.path)).toBe(
      '/api/account/events/fixture-event/teams?selectedTeamSlug=team-beta'
    )
    expect(toValue(request.requestKey)).toBe(
      'account-event-page:fixture-event:teams:selectedTeamSlug=team-beta'
    )
  })

  test('follows a changed participant search text in the request path and cache key', async () => {
    const { useAccountEventPageRequest } = await import('../../../../app/composables/useAccountEventPageRequest')
    const participantSearch = ref('anna')
    const request = useAccountEventPageRequest('fixture-event', 'participants', {
      query: computed(() => ({ participantSearch: participantSearch.value }))
    })

    expect(toValue(request.path)).toBe(
      '/api/account/events/fixture-event/participants?participantSearch=anna'
    )

    participantSearch.value = 'ben'

    expect(toValue(request.path)).toBe(
      '/api/account/events/fixture-event/participants?participantSearch=ben'
    )
    expect(toValue(request.requestKey)).toBe(
      'account-event-page:fixture-event:participants:participantSearch=ben'
    )
  })

  test('follows a longer participant list in the request path and cache key', async () => {
    const { useAccountEventPageRequest } = await import('../../../../app/composables/useAccountEventPageRequest')
    const participantRows = ref(100)
    const request = useAccountEventPageRequest('fixture-event', 'participants', {
      query: computed(() => ({ participantRows: participantRows.value }))
    })

    expect(toValue(request.path)).toBe('/api/account/events/fixture-event/participants')

    participantRows.value = 200

    expect(toValue(request.path)).toBe(
      '/api/account/events/fixture-event/participants?participantRows=200'
    )
    expect(toValue(request.requestKey)).toBe(
      'account-event-page:fixture-event:participants:participantRows=200'
    )
  })

  test('keeps semantically unchanged query state stable across tab-only navigation', async () => {
    const { useAccountEventPageRequest } = await import('../../../../app/composables/useAccountEventPageRequest')
    const query = ref<{ selectedTeamSlug?: string }>({})
    const request = useAccountEventPageRequest('fixture-event', 'operations', { query })
    const initialQuery = toValue(request.query)

    query.value = {}

    expect(toValue(request.query)).toBe(initialQuery)

    query.value = { selectedTeamSlug: 'team-beta' }

    expect(toValue(request.query)).not.toBe(initialQuery)
    expect(toValue(request.query)).toEqual({ selectedTeamSlug: 'team-beta' })
  })
})
