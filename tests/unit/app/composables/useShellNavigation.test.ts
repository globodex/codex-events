import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  computed,
  nextTick,
  reactive,
  shallowReactive,
  shallowRef,
  toValue
} from 'vue'

import { isShellNavigationLinkActive } from '../../../../app/domains/accounts/shell-navigation'

const useAccountBootstrap = vi.hoisted(() => vi.fn())
const useApiData = vi.hoisted(() => vi.fn())
const authorizationGeneration = shallowRef(0)
const payloadData = shallowReactive<Record<string, unknown>>({})

describe('useShellNavigation', () => {
  const route = reactive({
    path: '/account/events/e2e-fixture-event',
    fullPath: '/account/events/e2e-fixture-event?tab=overview',
    params: { slug: 'e2e-fixture-event' },
    query: { tab: 'overview' }
  })
  const actor = shallowRef({
    kind: 'platform_user',
    isAuthenticated: true,
    hasPlatformAccount: true,
    hasAcceptedCurrentPlatformDocuments: true,
    sessionUser: { sub: 'auth0|event-admin' },
    platformUser: { id: 'user_event_admin' },
    isPlatformAdmin: false,
    isEventOrganizer: false,
    eventRoles: [
      {
        eventId: 'event-1',
        role: 'event_admin',
        isInJudgePool: false,
        isStaff: true,
        staffTrackId: null,
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      {
        eventId: 'event-2',
        role: 'staff',
        isInJudgePool: false,
        isStaff: true,
        staffTrackId: null,
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    ]
  })
  const capabilities = computed(() => ({
    canAccessAdminDashboard: true,
    canAccessJudgeDashboard: false,
    canAccessPlatformSettings: false,
    canAccessStaffDashboard: true,
    canCreateEvent: false
  }))

  beforeEach(() => {
    vi.resetModules()
    useAccountBootstrap.mockReset()
    useApiData.mockReset()
    route.path = '/account/events/e2e-fixture-event'
    route.fullPath = '/account/events/e2e-fixture-event?tab=overview'
    route.params.slug = 'e2e-fixture-event'
    route.query.tab = 'overview'
    authorizationGeneration.value = 0
    for (const key of Object.keys(payloadData)) {
      Reflect.deleteProperty(payloadData, key)
    }
    useAccountBootstrap.mockReturnValue({
      actor,
      capabilities,
      status: shallowRef('success'),
      refresh: vi.fn()
    })

    vi.stubGlobal('computed', computed)
    vi.stubGlobal('toValue', toValue)
    vi.stubGlobal('useRoute', () => route)
    vi.stubGlobal('useNuxtApp', () => ({ payload: { data: payloadData } }))
    vi.stubGlobal('useAuthorizationCache', () => ({
      protectedKey: (key: string | (() => string)) => computed(() =>
        `protected-api:${authorizationGeneration.value}:${toValue(key)}`
      )
    }))
    vi.stubGlobal('useAccountBootstrap', useAccountBootstrap)
    vi.stubGlobal('useApiData', useApiData)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('derives event navigation from page-owned context without shell feature reads', async () => {
    const {
      useShellAccountEventPageContext,
      useShellNavigation
    } = await import('../../../../app/composables/useShellNavigation')
    const { currentAccountEventId } = useShellAccountEventPageContext()
    const navigation = useShellNavigation({ currentAccountEventId })

    expect(currentAccountEventId.value).toBeNull()
    expect(navigation.accountEventNavigationMode.value).toBeUndefined()
    payloadData['protected-api:0:account-event-page:e2e-fixture-event:entry'] = {
      event: { id: 'event-1' }
    }
    await nextTick()

    expect(currentAccountEventId.value).toBe('event-1')
    expect(navigation.accountEventNavigationMode.value).toBe('admin')
    expect(isShellNavigationLinkActive(route.path, route.query.tab, '/account/admin', {
      accountEventNavigationMode: navigation.accountEventNavigationMode.value
    })).toBe(true)
    expect(useAccountBootstrap).toHaveBeenCalledOnce()
    expect(useApiData).not.toHaveBeenCalled()

    route.query.tab = 'settings'
    route.fullPath = '/account/events/e2e-fixture-event?tab=settings'
    await nextTick()

    expect(navigation.accountEventNavigationMode.value).toBe('admin')
    expect(useAccountBootstrap).toHaveBeenCalledOnce()
    expect(useApiData).not.toHaveBeenCalled()

    route.path = '/account/events/staff-fixture-event'
    route.fullPath = '/account/events/staff-fixture-event?tab=participants'
    route.params.slug = 'staff-fixture-event'
    route.query.tab = 'participants'
    await nextTick()

    expect(currentAccountEventId.value).toBeNull()
    expect(navigation.accountEventNavigationMode.value).toBeUndefined()
    payloadData['protected-api:0:account-event-page:staff-fixture-event:entry'] = {
      event: { id: 'event-2' }
    }
    await nextTick()

    expect(currentAccountEventId.value).toBe('event-2')
    expect(navigation.accountEventNavigationMode.value).toBe('staff')
    expect(isShellNavigationLinkActive(route.path, route.query.tab, '/account/staff', {
      accountEventNavigationMode: navigation.accountEventNavigationMode.value
    })).toBe(true)

    authorizationGeneration.value = 1
    await nextTick()
    expect(currentAccountEventId.value).toBeNull()
    expect(navigation.accountEventNavigationMode.value).toBeUndefined()

    payloadData['protected-api:1:account-event-page:staff-fixture-event:entry'] = {
      event: { id: 'event-2' }
    }
    await nextTick()
    expect(currentAccountEventId.value).toBe('event-2')
    expect(navigation.accountEventNavigationMode.value).toBe('staff')
    expect(useApiData).not.toHaveBeenCalled()

    for (const path of [
      '/account',
      '/account/admin',
      '/account/judging',
      '/account/staff',
      '/account/settings',
      '/prize-redemptions'
    ]) {
      route.path = path
      route.fullPath = path
      await nextTick()
      expect(useAccountBootstrap).toHaveBeenCalledOnce()
      expect(useApiData).not.toHaveBeenCalled()
    }
  })
})
