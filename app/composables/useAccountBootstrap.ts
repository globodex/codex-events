import type {
  PlatformUserProfile,
  SessionActor,
  SessionActorResponse
} from '~/domains/accounts/session-actor'

import { computed, watch } from 'vue'

import {
  buildAnonymousSessionActor
} from '~/domains/accounts/session-actor'
import {
  canAccessAdminDashboard,
  canCreateEvent,
  isEventRoleJudgingEnabled,
  isEventRoleStaffEnabled
} from '~/domains/events/access'
import { createAbortError, throwIfAborted } from '~/lib/request-cancellation'

import { useApiClient } from './useApiClient'
import { useAuthorizationCache } from './useAuthorizationCache'

interface SessionActorCapabilities {
  canAccessAdminDashboard: boolean
  canAccessJudgeDashboard: boolean
  canAccessPlatformSettings: boolean
  canAccessStaffDashboard: boolean
  canCreateEvent: boolean
}

function isUnauthorizedError(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const status = error as { status?: unknown, statusCode?: unknown }

  return status.status === 401 || status.statusCode === 401
}

async function waitForAbortable<T>(promise: Promise<T>, signal?: AbortSignal) {
  if (!signal) {
    return await promise
  }

  throwIfAborted(signal)

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup()
      reject(createAbortError())
    }
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort)
    }

    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        cleanup()
        resolve(value)
      },
      (error) => {
        cleanup()
        reject(error)
      }
    )
  })
}

function createAccountBootstrap() {
  const apiFetch = useApiClient()
  const { data, error, status, refresh, clear } = useAsyncData<SessionActor>(
    'session-actor',
    async (_nuxtApp, { signal }) => {
      try {
        const response = await apiFetch<SessionActorResponse>('/api/session', { signal })
        return response.data.actor
      } catch (error) {
        if (isUnauthorizedError(error)) {
          return buildAnonymousSessionActor()
        }

        throw error
      }
    },
    {
      deep: false,
      dedupe: 'defer',
      getCachedData: () => undefined,
      server: false
    }
  )

  const actor = computed(() => data.value ?? null)
  const capabilities = computed<SessionActorCapabilities>(() => ({
    canAccessAdminDashboard: canAccessAdminDashboard(actor.value),
    canAccessJudgeDashboard: actor.value?.kind === 'platform_user'
      && actor.value.eventRoles.some(isEventRoleJudgingEnabled),
    canAccessPlatformSettings: actor.value?.kind === 'platform_user' && actor.value.isPlatformAdmin,
    canAccessStaffDashboard: actor.value?.kind === 'platform_user'
      && actor.value.eventRoles.some(isEventRoleStaffEnabled),
    canCreateEvent: canCreateEvent(actor.value)
  }))

  const { syncAuthorization } = useAuthorizationCache()
  watch(actor, nextActor => syncAuthorization(nextActor, capabilities.value), { flush: 'sync' })

  async function saveProfile(profile: Record<string, string | null>) {
    const { data: { user } } = await apiFetch<{ data: { user: PlatformUserProfile } }>('/api/account', {
      method: 'PATCH',
      body: profile
    })
    if (data.value?.kind === 'platform_user' && data.value.platformUser.id === user.id) {
      data.value = { ...data.value, platformUser: user }
    }
  }

  async function ensureLoaded(signal?: AbortSignal): Promise<SessionActor> {
    if (signal) {
      throwIfAborted(signal)
    }

    if (status.value === 'idle' || status.value === 'pending') {
      await waitForAbortable(refresh(), signal)
    }

    if (signal) {
      throwIfAborted(signal)
    }
    if (error.value) {
      throw error.value
    }
    if (status.value !== 'success' || !actor.value) {
      throw createAbortError()
    }

    return actor.value
  }

  return { actor, capabilities, error, status, ensureLoaded, refresh, clear, saveProfile }
}

const accountBootstraps = new WeakMap<object, ReturnType<typeof createAccountBootstrap>>()

export function useAccountBootstrap() {
  const nuxtApp = useNuxtApp()
  const existing = accountBootstraps.get(nuxtApp)

  if (existing) {
    return existing
  }

  // Keep the session request and authorization watcher alive across layout changes.
  const bootstrap = nuxtApp._scope.run(createAccountBootstrap)!
  accountBootstraps.set(nuxtApp, bootstrap)
  return bootstrap
}
