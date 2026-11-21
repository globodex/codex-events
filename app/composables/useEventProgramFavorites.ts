import type { ParticipantEventProgram } from '#shared/domains/events/program'
import type { ApiDataResponse } from '~/lib/api'
import type { useAccountEventPageRequest } from './useAccountEventPageRequest'

import { computed, shallowReactive } from 'vue'

import { buildAccountEventPageCacheKey } from '~/domains/events/account-workspace-page'
import { normalizeApiError } from '~/lib/api'
import { useApiClient } from './useApiClient'
import { useAuthorizationCache } from './useAuthorizationCache'
import { useProtectedRequestOwner } from './useProtectedRequestOwner'

type EventProgramRequest = Pick<
  ReturnType<typeof useAccountEventPageRequest<ParticipantEventProgram>>,
  'data' | 'requestKey' | 'slug'
>

const emptyPendingSessions: ReadonlySet<string> = new Set()

export function useEventProgramFavorites({ data, requestKey, slug }: EventProgramRequest) {
  const { protectedKey } = useAuthorizationCache()
  const owner = useProtectedRequestOwner()
  const nuxtApp = useNuxtApp()
  const cacheKey = protectedKey(requestKey)
  const plainKey = protectedKey(() => buildAccountEventPageCacheKey(slug.value, 'program'))
  const shellKey = protectedKey(() => buildAccountEventPageCacheKey(slug.value, 'program', { includeEventShell: true }))
  const apiFetch = useApiClient()
  const toast = useToast()
  const pendingByPage = shallowReactive(new Map<string, ReadonlySet<string>>())
  const pendingSessions = computed(() => pendingByPage.get(cacheKey.value) ?? emptyPendingSessions)

  async function toggleFavorite(sessionId: string) {
    const current = data.value?.page
    if (!current?.canSave || pendingSessions.value.has(sessionId)) {
      return
    }

    const key = cacheKey.value
    const alternateKey = key === plainKey.value ? shellKey.value : plainKey.value
    const sessionPath = `/api/events/${encodeURIComponent(current.eventId)}/program/favorites/${encodeURIComponent(sessionId)}`
    const saved = !current.savedSessionIds.includes(sessionId)
    pendingByPage.set(key, new Set([...pendingSessions.value, sessionId]))

    try {
      const response = await apiFetch<ApiDataResponse<{ saved: boolean }>>(sessionPath, {
        method: 'PUT',
        body: { saved }
      })
      owner.invalidate(key)
      owner.invalidate(alternateKey)
      if (alternateKey !== cacheKey.value) {
        nuxtApp.runWithContext(() => clearNuxtData(alternateKey))
      }

      const activeResponse = data.value
      if (cacheKey.value !== key || activeResponse?.page.eventId !== current.eventId) {
        return
      }

      const otherSessions = activeResponse.page.savedSessionIds.filter(id => id !== sessionId)
      data.value = {
        ...activeResponse,
        page: {
          ...activeResponse.page,
          savedSessionIds: response.data.saved ? [...otherSessions, sessionId] : otherSessions
        }
      }
    } catch (error) {
      if (cacheKey.value === key) {
        toast.add({ title: normalizeApiError(error).message, color: 'error' })
      }
    } finally {
      const remaining = new Set(pendingByPage.get(key))
      remaining.delete(sessionId)
      if (remaining.size > 0) {
        pendingByPage.set(key, remaining)
      } else {
        pendingByPage.delete(key)
      }
    }
  }

  return { pendingSessions, toggleFavorite }
}
