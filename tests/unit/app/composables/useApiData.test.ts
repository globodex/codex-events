import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, nextTick, ref, toValue } from 'vue'

const clientFetch = vi.hoisted(() => vi.fn())
const useApiClient = vi.hoisted(() => vi.fn())
const useAccountBootstrap = vi.hoisted(() => vi.fn())
const ensureLoaded = vi.hoisted(() => vi.fn())
const useAuthorizationCache = vi.hoisted(() => vi.fn())
const useProtectedRequestOwner = vi.hoisted(() => vi.fn())
const buildProtectedRequestKey = vi.hoisted(() => vi.fn((...parts: unknown[]) => JSON.stringify(parts)))
const resolveProtectedWatchSources = vi.hoisted(() => vi.fn((sources: unknown[] | false | undefined) => {
  if (!sources || sources === false) {
    return []
  }

  return sources.map((source) => {
    if (typeof source === 'function') {
      return source()
    }

    if (source && typeof source === 'object' && 'value' in source) {
      return source.value
    }

    return source
  })
}))
const useAsyncData = vi.hoisted(() => vi.fn())
const protectedExecute = vi.hoisted(() => vi.fn())
const protectedInvalidate = vi.hoisted(() => vi.fn())

vi.mock('../../../../app/composables/useAccountBootstrap', () => ({
  useAccountBootstrap
}))

vi.mock('../../../../app/composables/useApiClient', () => ({
  useApiClient
}))

vi.mock('../../../../app/composables/useAuthorizationCache', () => ({
  useAuthorizationCache
}))

vi.mock('../../../../app/composables/useProtectedRequestOwner', () => ({
  buildProtectedRequestKey,
  resolveProtectedWatchSources,
  useProtectedRequestOwner
}))

describe('useApiData', () => {
  beforeEach(() => {
    vi.resetModules()
    clientFetch.mockReset()
    useApiClient.mockReset()
    useAccountBootstrap.mockReset()
    ensureLoaded.mockReset()
    useAuthorizationCache.mockReset()
    useProtectedRequestOwner.mockReset()
    useAsyncData.mockReset()
    protectedExecute.mockReset()
    protectedInvalidate.mockReset()

    useApiClient.mockReturnValue(clientFetch)
    useAccountBootstrap.mockReturnValue({ ensureLoaded })
    useAuthorizationCache.mockReturnValue({
      protectedKey: (key: unknown) => computed(() => `protected-api:0:${toValue(key as never)}`)
    })
    protectedExecute.mockImplementation(async (
      _key: string,
      signal: AbortSignal,
      load: (signal: AbortSignal) => Promise<unknown>
    ) => await load(signal))
    useProtectedRequestOwner.mockReturnValue({
      execute: protectedExecute,
      invalidate: protectedInvalidate
    })

    useAsyncData.mockReturnValue(Promise.resolve({}))
    vi.stubGlobal('useAsyncData', useAsyncData)
    vi.stubGlobal('toValue', (value: unknown) =>
      typeof value === 'function'
        ? (value as () => unknown)()
        : value
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('passes the selected fetcher and abort signal into useApiData handlers', async () => {
    const { useApiData } = await import('../../../../app/composables/useApiData')
    useApiData('session-actor:auth0|user', async ({ apiFetch, signal }) => {
      expect(apiFetch).toBe(clientFetch)
      expect(signal).toBeInstanceOf(AbortSignal)

      return {
        actor: 'platform_user'
      }
    }, {
      default: () => ({
        actor: 'anonymous'
      })
    })

    const [key, handler, options] = useAsyncData.mock.calls[0]!
    expect(toValue(key)).toBe('protected-api:0:session-actor:auth0|user')
    expect(options).toMatchObject({
      deep: false,
      dedupe: 'cancel'
    })
    expect(useApiClient).toHaveBeenCalledOnce()

    const signal = new AbortController().signal

    await expect(handler({}, {
      signal
    })).resolves.toEqual({
      actor: 'platform_user'
    })
    expect(ensureLoaded).toHaveBeenCalledWith(signal)
  })

  test('does not dispatch a protected consumer before the shared bootstrap resolves', async () => {
    let releaseBootstrap!: () => void
    const bootstrapReady = new Promise<void>((resolve) => {
      releaseBootstrap = resolve
    })
    ensureLoaded.mockReturnValue(bootstrapReady)
    const consumer = vi.fn(async ({ apiFetch }: { apiFetch: typeof clientFetch }) => {
      return await apiFetch('/api/account/judging')
    })

    const { useApiData } = await import('../../../../app/composables/useApiData')
    useApiData('judge-workspace', consumer)
    const [, handler] = useAsyncData.mock.calls[0]!

    const signal = new AbortController().signal
    const pending = handler({}, { signal })
    await Promise.resolve()

    expect(ensureLoaded).toHaveBeenCalledWith(signal)
    expect(consumer).not.toHaveBeenCalled()
    releaseBootstrap()
    await pending

    expect(consumer).toHaveBeenCalledOnce()
    expect(clientFetch).toHaveBeenCalledWith('/api/account/judging')
  })

  test('does not dispatch a protected consumer after its wait signal is aborted', async () => {
    ensureLoaded.mockImplementation(async (signal: AbortSignal) => {
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
      throw new DOMException('The request was aborted.', 'AbortError')
    })
    const consumer = vi.fn(async () => 'never')

    const { useApiData } = await import('../../../../app/composables/useApiData')
    useApiData('judge-workspace', consumer)
    const [, handler] = useAsyncData.mock.calls[0]!

    const controller = new AbortController()
    const pending = handler({}, { signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(consumer).not.toHaveBeenCalled()
  })

  test('changes the protected async-data key when a watched request shape changes', async () => {
    const watchedValue = ref('first')
    const { useApiData } = await import('../../../../app/composables/useApiData')
    useApiData('shared-read', async () => 'ready', {
      watch: [watchedValue]
    })

    const [key, handler] = useAsyncData.mock.calls[0]!
    const firstKey = toValue(key)
    watchedValue.value = 'second'
    await nextTick()

    expect(toValue(key)).not.toBe(firstKey)
    await handler({}, { signal: new AbortController().signal })
    expect(protectedExecute.mock.calls[0]?.[0]).toBe(toValue(key))
  })

  test('keeps public async-data keys independent from authorization generation', async () => {
    const { useApiData } = await import('../../../../app/composables/useApiData')
    useApiData('public-event', async () => ({ title: 'Public' }), {
      cacheScope: 'public'
    })

    expect(useAsyncData.mock.calls[0]![0]).toBe('public-event')
    expect(useAuthorizationCache).not.toHaveBeenCalled()
  })

  test('retries a failed protected read from the awaited result', async () => {
    const { createProtectedRequestOwner } = await vi.importActual<typeof import('../../../../app/composables/useProtectedRequestOwner')>(
      '../../../../app/composables/useProtectedRequestOwner'
    )
    useProtectedRequestOwner.mockReturnValue(createProtectedRequestOwner())

    const data = ref<string>()
    const error = ref<unknown>()
    const pending = ref(false)
    const status = ref('idle')
    useAsyncData.mockImplementation((_key, handler) => {
      async function refresh() {
        try {
          data.value = await handler({}, { signal: new AbortController().signal })
          error.value = undefined
          status.value = 'success'
        } catch (caught) {
          error.value = caught
          status.value = 'error'
        }
      }
      const raw = { data, error, pending, status, clear: vi.fn(), execute: refresh, refresh }
      return Object.assign(refresh().then(() => raw), raw)
    })

    const { useApiData } = await import('../../../../app/composables/useApiData')
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('online')
    const request = useApiData('retry', load)
    const awaited = await request

    expect(awaited.status.value).toBe('error')
    for (const field of ['data', 'error', 'pending', 'status', 'invalidationKey', 'clear', 'execute', 'refresh'] as const) {
      expect(awaited[field]).toBe(request[field])
    }

    await awaited.refresh()
    expect(load).toHaveBeenCalledTimes(2)
    expect(request.data.value).toBe('online')
    expect(request.error.value).toBeUndefined()
  })

  test('unwraps canonical api data responses in useApiResponse', async () => {
    clientFetch.mockResolvedValue({
      data: {
        id: 'privacy'
      }
    })

    const { useApiResponse } = await import('../../../../app/composables/useApiData')
    useApiResponse('current-platform-documents', '/api/platform-documents/current', {
      default: () => null
    })
    const [, handler] = useAsyncData.mock.calls[0]!
    const signal = new AbortController().signal

    await expect(handler({}, {
      signal
    })).resolves.toEqual({
      id: 'privacy'
    })

    expect(clientFetch).toHaveBeenCalledWith('/api/platform-documents/current', {
      signal
    })
  })
})
