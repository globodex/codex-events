import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { effectScope, shallowRef } from 'vue'
import type { SessionActor } from '../../../../app/domains/accounts/session-actor'

const useAsyncData = vi.hoisted(() => vi.fn())
const useApiClient = vi.hoisted(() => vi.fn())
const syncAuthorization = vi.hoisted(() => vi.fn())
const bootstrapFetch = vi.hoisted(() => vi.fn())

vi.mock('../../../../app/composables/useApiClient', () => ({
  useApiClient
}))

vi.mock('../../../../app/composables/useAuthorizationCache', () => ({
  useAuthorizationCache: () => ({
    syncAuthorization
  })
}))

describe('useAccountBootstrap', () => {
  let currentNuxtApp: { _scope: ReturnType<typeof effectScope> }

  const actor = {
    kind: 'platform_user' as const,
    isAuthenticated: true as const,
    hasPlatformAccount: true as const,
    hasAcceptedCurrentPlatformDocuments: true,
    sessionUser: {
      sub: 'auth0|event-admin',
      email: 'event-admin@example.com'
    },
    platformUser: {
      id: 'event-admin',
      email: 'event-admin@example.com',
      displayName: 'Event Admin',
      firstName: 'Event',
      familyName: 'Admin',
      isPlatformAdmin: false,
      isEventOrganizer: true
    },
    isPlatformAdmin: false,
    isEventOrganizer: true,
    eventRoles: [{
      eventId: 'event-1',
      role: 'event_admin' as const,
      isInJudgePool: true,
      isStaff: true,
      staffTrackId: null,
      createdAt: '2026-08-19T00:00:00.000Z'
    }]
  }

  beforeEach(() => {
    vi.resetModules()
    useAsyncData.mockReset()
    useApiClient.mockReset()
    syncAuthorization.mockReset()
    bootstrapFetch.mockReset()

    useApiClient.mockReturnValue(bootstrapFetch)
    currentNuxtApp = { _scope: effectScope(true) }
    bootstrapFetch.mockResolvedValue({ data: { actor } })
    useAsyncData.mockImplementation((_key, handler) => {
      const data = shallowRef<SessionActor>()
      const error = shallowRef<unknown>()
      const status = shallowRef('idle')
      let pending: Promise<void> | undefined
      const refresh = () => {
        if (pending) {
          return pending
        }

        status.value = 'pending'
        pending = handler({}, { signal: new AbortController().signal })
          .then((result: SessionActor) => {
            data.value = result
            error.value = undefined
            status.value = 'success'
          }, (cause: unknown) => {
            data.value = undefined
            error.value = cause
            status.value = 'error'
          })
          .finally(() => { pending = undefined })
        return pending
      }

      const clear = () => {
        data.value = undefined
        error.value = undefined
        status.value = 'idle'
      }

      return { data, error, status, refresh, clear }
    })
    vi.stubGlobal('useNuxtApp', () => currentNuxtApp)
    vi.stubGlobal('useAsyncData', useAsyncData)
  })

  afterEach(() => {
    currentNuxtApp._scope.stop()
    vi.unstubAllGlobals()
  })

  test('uses one committed actor and authorization watcher across components and tab changes', async () => {
    const { useAccountBootstrap } = await import('../../../../app/composables/useAccountBootstrap')
    const componentScope = effectScope()
    const session = componentScope.run(useAccountBootstrap)!
    const second = useAccountBootstrap()
    expect(second).toBe(session)
    expect(session.actor.value).toBeNull()
    expect(syncAuthorization).not.toHaveBeenCalled()
    expect(useAsyncData).toHaveBeenCalledOnce()
    const [key, , options] = useAsyncData.mock.calls[0]!
    expect(key).toBe('session-actor')
    expect(options).toMatchObject({ dedupe: 'defer', server: false })
    expect(options).not.toHaveProperty('watch')
    expect(options.getCachedData()).toBeUndefined()

    componentScope.stop()
    await expect(Promise.all([session.ensureLoaded(), second.ensureLoaded()])).resolves.toEqual([actor, actor])
    expect(bootstrapFetch).toHaveBeenCalledOnce()
    expect(bootstrapFetch).toHaveBeenCalledWith('/api/session', { signal: expect.any(AbortSignal) })
    expect(syncAuthorization).toHaveBeenCalledExactlyOnceWith(actor, {
      canAccessAdminDashboard: true,
      canAccessJudgeDashboard: true,
      canAccessPlatformSettings: false,
      canAccessStaffDashboard: true,
      canCreateEvent: true
    })
    expect(session.actor.value).toEqual(actor)
    expect(session.status.value).toBe('success')

    const changedActor = { ...actor, hasAcceptedCurrentPlatformDocuments: false }
    bootstrapFetch.mockResolvedValue({ data: { actor: changedActor } })
    await session.refresh()
    expect(syncAuthorization).toHaveBeenLastCalledWith(changedActor, session.capabilities.value)

    session.clear()
    expect(session.actor.value).toBeNull()
    expect(session.status.value).toBe('idle')
    expect(syncAuthorization).toHaveBeenLastCalledWith(null, session.capabilities.value)
  })

  test('saving a profile updates all session consumers without fetching the session again', async () => {
    const { useAccountBootstrap } = await import('../../../../app/composables/useAccountBootstrap')
    const session = useAccountBootstrap()
    await session.ensureLoaded()
    const user = { ...actor.platformUser, familyName: 'Smith' }
    bootstrapFetch.mockResolvedValueOnce({ data: { user } })
    await session.saveProfile({ familyName: 'Smith' })
    expect(useAccountBootstrap().actor.value?.platformUser).toEqual(user)
    expect(bootstrapFetch.mock.calls.map(([path]) => path)).toEqual(['/api/session', '/api/account'])
  })

  test('returns anonymous only after a 401 and exposes other failures until an explicit retry', async () => {
    const { useAccountBootstrap } = await import('../../../../app/composables/useAccountBootstrap')
    const session = useAccountBootstrap()
    const failure = Object.assign(new Error('Unavailable'), { statusCode: 503 })
    bootstrapFetch.mockRejectedValueOnce(failure)
    await expect(session.ensureLoaded()).rejects.toBe(failure)
    expect(session.actor.value).toBeNull()
    await expect(session.ensureLoaded()).rejects.toBe(failure)
    expect(bootstrapFetch).toHaveBeenCalledOnce()
    expect(syncAuthorization).not.toHaveBeenCalled()

    bootstrapFetch.mockRejectedValueOnce({ status: 401 })
    await session.refresh()
    await expect(session.ensureLoaded()).resolves.toMatchObject({ kind: 'anonymous' })
    expect(session.status.value).toBe('success')
    expect(syncAuthorization).toHaveBeenCalledOnce()
  })

  test('does not carry an actor or readiness into a new Nuxt app', async () => {
    const { useAccountBootstrap } = await import('../../../../app/composables/useAccountBootstrap')
    await useAccountBootstrap().ensureLoaded()
    currentNuxtApp._scope.stop()
    currentNuxtApp = { _scope: effectScope(true) }
    const fresh = useAccountBootstrap()
    expect(fresh.actor.value).toBeNull()
    expect(fresh.status.value).toBe('idle')
  })

  test('keeps the shared session request alive when one caller stops waiting', async () => {
    let releaseFetch!: () => void
    bootstrapFetch.mockImplementation(() => new Promise((resolve) => {
      releaseFetch = () => resolve({ data: { actor } })
    }))

    const { useAccountBootstrap } = await import('../../../../app/composables/useAccountBootstrap')
    const session = useAccountBootstrap()
    const controller = new AbortController()
    const aborted = session.ensureLoaded(controller.signal)
    const shared = session.ensureLoaded()

    controller.abort()
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' })
    expect(session.actor.value).toBeNull()
    expect(session.status.value).toBe('pending')
    expect(bootstrapFetch).toHaveBeenCalledOnce()

    releaseFetch()
    await expect(shared).resolves.toEqual(actor)
    expect(session.actor.value).toEqual(actor)
  })
})
