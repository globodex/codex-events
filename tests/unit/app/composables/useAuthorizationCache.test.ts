import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, shallowRef, toValue } from 'vue'

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
    const app = { _asyncData: asyncData, payload: { data: { [settledKey]: {}, [publicKey]: {} } } }
    vi.stubGlobal('useNuxtApp', () => app)
    vi.stubGlobal('useState', (key: string, init: () => unknown) => {
      const existing = states.get(key)

      if (existing) {
        return existing
      }

      const state = shallowRef(init())
      states.set(key, state)
      return state
    })
    vi.stubGlobal('clearNuxtData', clearNuxtData)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('a write expires tab and search variants while keeping the displayed record and unrelated reads', async () => {
    const { useAuthorizationCache } = await import('../../../../app/composables/useAuthorizationCache')
    const { useProtectedRequestOwner } = await import('../../../../app/composables/useProtectedRequestOwner')
    const cache = useAuthorizationCache()
    const owner = useProtectedRequestOwner()
    const base = 'event:one:teams'
    const displayed = cache.protectedKey(base).value
    const search = displayed + ':watch=["ab"]'
    const other = displayed + '-archived'
    for (const key of [displayed, search, other]) {
      await owner.execute(key, undefined, async () => 'before')
    }
    cache.clearReads([base], base)
    expect(clearNuxtData).toHaveBeenCalledWith([search])
    for (const key of [displayed, search]) {
      expect(await owner.execute(key, undefined, async () => 'after')).toBe('after')
    }
    expect(await owner.execute(other, undefined, async () => 'after')).toBe('before')
  })

  test('creating and renaming an event expires cached dashboard links and cached missing destinations', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ data: { slug: 'draft' } }))
    const { useAuthorizationCache } = await import('../../../../app/composables/useAuthorizationCache')
    const { useProtectedRequestOwner } = await import('../../../../app/composables/useProtectedRequestOwner')
    const { useEventConfiguration } = await import('../../../../app/composables/useEventConfiguration')
    const cache = useAuthorizationCache()
    const owner = useProtectedRequestOwner()
    const { createDraft, clearUpdatedEvent } = useEventConfiguration()
    const read = (key: string, answer: string) => owner.execute(cache.protectedKey(key).value, undefined, async () => answer)

    const lists = ['admin-workspace', 'account-workspace-slugs', 'account-overview-page', 'staff-workspace', 'judge-workspace-inbox']
    const draftSettings = 'account-event-page:draft:settings'
    const renamedSettings = 'account-event-page:renamed:settings:includeEventShell'
    const unrelatedSettings = 'account-event-page:other:settings'
    for (const key of [...lists, draftSettings, renamedSettings, unrelatedSettings]) {
      await read(key, 'before')
    }

    await createDraft({ slug: 'draft' })
    expect(await read('admin-workspace', 'created')).toBe('created')
    expect(await read(draftSettings, 'created')).toBe('created')
    expect(await read('staff-workspace', 'created')).toBe('before')

    clearUpdatedEvent('draft', 'renamed')
    for (const key of [...lists, draftSettings, renamedSettings]) {
      expect(await read(key, 'renamed')).toBe('renamed')
    }
    expect(await read(unrelatedSettings, 'renamed')).toBe('before')
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

    expect(cache.syncAuthorization(null, {})).toBe(true)
    expect(cache.authorizationGeneration.value).toBe(2)
    expect(cache.syncAuthorization(null, {})).toBe(false)
    expect(cache.syncAuthorization(actor, { canView: true })).toBe(true)
    expect(cache.authorizationGeneration.value).toBe(2)
  })
})
