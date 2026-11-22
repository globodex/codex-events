import type { MultiWatchSources } from 'vue'
import type { ApiDataResponse } from '~/lib/api'

import { computed, toValue, watch } from 'vue'

import { useAccountBootstrap } from './useAccountBootstrap'
import { useApiClient } from './useApiClient'
import { useAuthorizationCache, type ApiCacheScope } from './useAuthorizationCache'
import {
  buildProtectedRequestKey,
  resolveProtectedWatchSources,
  useProtectedRequestOwner
} from './useProtectedRequestOwner'

interface UseApiDataOptions<Data> {
  cacheScope?: ApiCacheScope
  default?: () => Data
  dedupe?: 'cancel' | 'defer'
  enabled?: MaybeRefOrGetter<boolean>
  immediate?: boolean
  lazy?: boolean
  server?: boolean
  timeout?: number
  watch?: MultiWatchSources
}

interface UseApiDataContext {
  apiFetch: ReturnType<typeof useApiClient>
  signal: AbortSignal
}

export function useApiData<Data>(
  key: MaybeRefOrGetter<string>,
  handler: (context: UseApiDataContext) => Promise<Data>,
  options?: UseApiDataOptions<Data>
) {
  const apiFetch = useApiClient()
  const cacheScope = options?.cacheScope ?? 'protected'
  const asyncDataOptions = { ...options }
  delete asyncDataOptions.cacheScope
  const bootstrap = cacheScope === 'protected'
    ? useAccountBootstrap()
    : null
  const invalidationKey = computed(() => {
    const watched = cacheScope === 'protected' && resolveProtectedWatchSources(options?.watch)
    return watched && watched.length ? `${toValue(key)}:watch=${buildProtectedRequestKey(watched)}` : toValue(key)
  })
  const resolvedKey = cacheScope === 'protected'
    ? useAuthorizationCache().protectedKey(invalidationKey)
    : key
  const protectedRequestOwner = cacheScope === 'protected'
    ? useProtectedRequestOwner()
    : null

  const request = useAsyncData<Data>(
    resolvedKey,
    async (_nuxtApp, { signal }) => {
      if (!protectedRequestOwner) {
        return await handler({ apiFetch, signal })
      }

      await bootstrap?.ensureLoaded(signal)
      return await protectedRequestOwner.execute(
        toValue(resolvedKey),
        signal,
        async ownerSignal => await handler({ apiFetch, signal: ownerSignal })
      )
    },
    {
      deep: false,
      ...asyncDataOptions,
      dedupe: cacheScope === 'protected' ? 'cancel' : asyncDataOptions.dedupe ?? 'cancel'
    }
  )

  const rawExecute = request.execute
  const rawRefresh = request.refresh
  const rawClear = request.clear
  const enabled = options?.enabled
  let queuedRefreshKey: string | undefined

  const activate = () => {
    if (request.status.value !== 'idle') {
      return Promise.resolve()
    }

    return rawExecute({ dedupe: 'defer' })
  }

  const refresh = (refreshOptions?: Parameters<typeof request.refresh>[0]) => {
    const currentKey = toValue(resolvedKey)
    protectedRequestOwner?.invalidate(currentKey)

    if (toValue(enabled) === false) {
      queuedRefreshKey = currentKey
      return Promise.resolve()
    }

    queuedRefreshKey = undefined
    return rawRefresh({
      ...refreshOptions,
      dedupe: 'cancel'
    })
  }

  if (enabled !== undefined) {
    watch(() => toValue(enabled), (active) => {
      if (!active) {
        return
      }

      const needsRefresh = queuedRefreshKey === toValue(resolvedKey)
      queuedRefreshKey = undefined
      void (needsRefresh && request.status.value !== 'pending' ? refresh() : activate())
    })
  }

  const clear = () => {
    queuedRefreshKey = undefined
    protectedRequestOwner?.invalidate(toValue(resolvedKey))
    rawClear()
  }

  const state = {
    data: request.data,
    error: request.error,
    pending: request.pending,
    status: request.status,
    invalidationKey,
    clear: protectedRequestOwner ? clear : rawClear,
    refresh: protectedRequestOwner ? refresh : rawRefresh,
    execute: protectedRequestOwner ? refresh : rawExecute
  }
  // Nuxt returns a promise with synchronous fields and resolves it to a separate object.
  return Object.assign(request.then(() => state), state)
}

export function useApiResponse<Data>(
  key: MaybeRefOrGetter<string>,
  request: MaybeRefOrGetter<string>,
  options?: UseApiDataOptions<Data>
) {
  return useApiData<Data>(
    key,
    async ({ apiFetch, signal }) => {
      const response = await apiFetch<ApiDataResponse<Data>>(toValue(request), {
        signal
      })

      return response.data
    },
    options
  )
}
