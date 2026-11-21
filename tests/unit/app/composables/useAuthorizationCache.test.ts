import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, toValue } from 'vue'

const clearNuxtData = vi.hoisted(() => vi.fn())
const states = new Map<string, { value: unknown }>()

describe('useAuthorizationCache', () => {
  const settledKey = 'protected-api:0:account-event'
  const pendingKey = 'protected-api:0:pending-event'
  const publicKey = 'public-event:account-event'
  const asyncData: Record<string, { _abortController: AbortController }> = {}

  beforeEach(() => {
    vi.resetModules()
    clearNuxtData.mockReset()
    states.clear()

    vi.stubGlobal('computed', computed)
    vi.stubGlobal('toValue', toValue)
    vi.stubGlobal('useNuxtApp', () => ({
      _asyncData: asyncData,
      payload: { data: { [settledKey]: {}, [publicKey]: {} } }
    }))
    vi.stubGlobal('useState', (key: string, init: () => unknown) => {
      const existing = states.get(key)

      if (existing) {
        return existing
      }

      const state = { value: init() }
      states.set(key, state)
      return state
    })
    vi.stubGlobal('clearNuxtData', clearNuxtData)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('scopes protected keys to authorization generation and clears them on authorization changes', async () => {
    const { useAuthorizationCache } = await import('../../../../app/composables/useAuthorizationCache')
    const cache = useAuthorizationCache()
    const actor = {
      kind: 'platform_user' as const,
      isAuthenticated: true as const,
      hasPlatformAccount: true as const,
      hasAcceptedCurrentPlatformDocuments: true,
      sessionUser: { sub: 'auth0|one' },
      platformUser: { id: 'user-one' },
      isPlatformAdmin: false,
      isEventOrganizer: false,
      eventRoles: []
    }

    const pendingRequest = new AbortController()
    asyncData[pendingKey] = { _abortController: pendingRequest }

    expect(cache.protectedKey('account-event').value).toBe(settledKey)
    expect(cache.syncAuthorization(actor, { canView: true })).toBe(true)
    expect(cache.authorizationGeneration.value).toBe(0)
    expect(clearNuxtData).not.toHaveBeenCalled()
    expect(pendingRequest.signal.aborted).toBe(false)
    expect(cache.syncAuthorization(actor, { canView: true })).toBe(false)

    const changedActor = {
      ...actor,
      hasAcceptedCurrentPlatformDocuments: false
    }
    clearNuxtData.mockImplementationOnce(() => expect(cache.authorizationGeneration.value).toBe(0))
    expect(cache.syncAuthorization(changedActor, { canView: false })).toBe(true)
    expect(cache.authorizationGeneration.value).toBe(1)
    expect(cache.protectedKey('account-event').value).toBe('protected-api:1:account-event')
    expect(clearNuxtData).toHaveBeenCalledTimes(1)

    expect(clearNuxtData).toHaveBeenLastCalledWith([pendingKey, settledKey])
    expect(pendingRequest.signal.aborted).toBe(true)
  })
})
