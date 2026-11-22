import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, ref, toValue } from 'vue'

const useAccountBootstrap = vi.hoisted(() => vi.fn())

vi.mock('../../../../app/composables/useAccountBootstrap', () => ({ useAccountBootstrap }))

describe('usePublicEventWorkspaceAccess', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('waits for a confirmed account and distinguishes a failed lookup from denied access', async () => {
    const sessionStatus = ref('idle')
    const actor = ref<{ kind: string, hasAcceptedCurrentPlatformDocuments: boolean } | null>(null)
    useAccountBootstrap.mockReturnValue({ actor, status: sessionStatus })
    const accessStatus = ref('idle')
    const accessResult = ref<string[]>()
    const useApiData = vi.fn().mockReturnValue({ data: accessResult, status: accessStatus })
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('toValue', toValue)
    vi.stubGlobal('useApiData', useApiData)

    const { usePublicEventWorkspaceAccess } = await import('../../../../app/composables/usePublicEventWorkspaceAccess')
    const needed = ref(false)
    const access = usePublicEventWorkspaceAccess('e2e-fixture-event', needed)
    const [, handler, options] = useApiData.mock.calls[0] as [
      string,
      (context: { apiFetch: typeof vi.fn, signal: AbortSignal }) => Promise<string[]>,
      { server: boolean, enabled: () => boolean }
    ]

    expect(options.server).toBe(false)
    needed.value = true
    expect(options.enabled()).toBe(false)
    expect(access.value).toBe('unknown')
    sessionStatus.value = 'error'
    expect(access.value).toBe('error')
    actor.value = { kind: 'anonymous', hasAcceptedCurrentPlatformDocuments: false }
    sessionStatus.value = 'success'
    expect(options.enabled()).toBe(false)
    expect(access.value).toBe('denied')
    actor.value = { kind: 'platform_user', hasAcceptedCurrentPlatformDocuments: true }
    expect(options.enabled()).toBe(true)
    expect(access.value).toBe('unknown')
    const apiFetch = vi.fn().mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValue({
      data: { current: [{ slug: 'e2e-fixture-event' }], past: [] }
    })
    const signal = new AbortController().signal
    await expect(handler({ apiFetch, signal })).rejects.toThrow('network unavailable')
    accessStatus.value = 'error'
    expect(access.value).toBe('error')
    accessResult.value = await handler({ apiFetch, signal })
    accessStatus.value = 'success'
    expect(access.value).toBe('granted')
    expect(apiFetch).toHaveBeenCalledWith('/api/account/events', { signal })
    needed.value = false
    expect(options.enabled()).toBe(false)
  })
})
