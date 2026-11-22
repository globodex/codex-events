import { readFileSync } from 'node:fs'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, ref } from 'vue'

const useApiResponse = vi.hoisted(() => vi.fn())
const useAccountBootstrap = vi.hoisted(() => vi.fn())
const creationPageSources = [
  '../../../../app/pages/admin/events/new.vue',
  '../../../../app/pages/admin/events/builder/new.vue'
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8'))

vi.mock('~/composables/useApiData', () => ({
  useApiResponse
}))

vi.mock('~/composables/useAccountBootstrap', () => ({
  useAccountBootstrap
}))

describe('useAdminWorkspace', () => {
  beforeEach(() => {
    vi.resetModules()
    useApiResponse.mockReset()
    useAccountBootstrap.mockReset()

    useAccountBootstrap.mockReturnValue({
      actor: ref({
        kind: 'anonymous',
        isAuthenticated: false,
        hasPlatformAccount: false,
        hasAcceptedCurrentPlatformDocuments: false,
        sessionUser: null,
        platformUser: null,
        isPlatformAdmin: false,
        isEventOrganizer: false,
        eventRoles: []
      }),
      error: ref(null),
      status: ref('success')
    })
    useApiResponse.mockReturnValue({
      data: ref([]),
      error: ref(null),
      status: ref('success')
    })

    vi.stubGlobal('computed', computed)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('keeps the root admin index separate from event page reads', async () => {
    const { useAdminWorkspace } = await import('../../../../app/composables/useAdminWorkspace')

    useAdminWorkspace()

    expect(useApiResponse).toHaveBeenCalledExactlyOnceWith('admin-workspace-events', '/api/events?page=1&page_size=100', {
      server: false
    })
  })

  test('keeps creation pages on the session boundary', () => {
    for (const source of creationPageSources) {
      expect(source).toContain('const session = useAccountBootstrap()')
      expect(source).toContain('await session.refresh()')
      expect(source).not.toContain('useAdminWorkspace')
    }
  })
})
