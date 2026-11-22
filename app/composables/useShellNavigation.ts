import type { AccountEventPageResponse } from '~/domains/events/account-workspace-page'

import {
  isAccountEventDetailPath,
  resolveShellAccountEventNavigationMode
} from '~/domains/accounts/shell-navigation'
import { buildAccountEventPageCacheKey } from '~/domains/events/account-workspace-page'

export interface ShellNavigationOptions {
  currentAccountEventId?: MaybeRefOrGetter<string | null | undefined>
}

export interface ShellNavigationItem {
  id: string
  label: string
  description: string
  to: string
  icon: string
  badge?: string
  external?: boolean
}

export interface ShellNavigationGroup {
  label: string
  items: ShellNavigationItem[]
}

export function useShellAccountEventPageContext() {
  const route = useRoute()
  const nuxtApp = useNuxtApp()
  const authorizationCache = useAuthorizationCache()
  const slug = computed(() =>
    isAccountEventDetailPath(route.path) ? String(route.params.slug ?? '').trim() : ''
  )
  const entryPageKey = authorizationCache.protectedKey(computed(() =>
    buildAccountEventPageCacheKey(slug.value, 'entry')
  ))
  const currentAccountEventId = computed(() => {
    if (!slug.value) {
      return null
    }

    const entryPage = nuxtApp.payload.data[entryPageKey.value] as AccountEventPageResponse<unknown> | undefined
    return entryPage?.event.id ?? null
  })

  return {
    currentAccountEventId
  }
}

export function useShellNavigation(options: ShellNavigationOptions = {}) {
  const route = useRoute()

  const { actor, capabilities } = useAccountBootstrap()
  const currentAccountEventId = computed(() => {
    const eventId = options.currentAccountEventId === undefined
      ? ''
      : String(toValue(options.currentAccountEventId) ?? '').trim()

    return eventId || null
  })

  const accountEventNavigationMode = computed(() =>
    resolveShellAccountEventNavigationMode({
      actor: actor.value,
      currentEventId: currentAccountEventId.value,
      currentPath: route.path
    })
  )

  const sidebarGroups = computed<ShellNavigationGroup[]>(() => {
    if (actor.value?.kind !== 'platform_user') {
      return []
    }

    const items: ShellNavigationItem[] = [{
      id: 'profile-settings',
      label: 'Profile settings',
      description: 'Profile details and platform lifecycle',
      to: '/account/settings',
      icon: 'i-lucide-id-card'
    }, {
      id: 'my-events',
      label: 'My events',
      description: 'Your active, upcoming, and past events',
      to: '/account',
      icon: 'i-lucide-flag'
    }]

    if (capabilities.value.canAccessJudgeDashboard) {
      items.push({
        id: 'judge-dashboard',
        label: 'Judge dashboard',
        description: 'Events where you are assigned as a judge',
        to: '/account/judging',
        icon: 'i-lucide-scale'
      })
    }

    if (capabilities.value.canAccessStaffDashboard) {
      items.push({
        id: 'staff-dashboard',
        label: 'Staff dashboard',
        description: 'Events where you support staff operations',
        to: '/account/staff',
        icon: 'i-lucide-users'
      })
    }

    if (capabilities.value.canAccessAdminDashboard) {
      items.push({
        id: 'admin-dashboard',
        label: 'Admin dashboard',
        description: actor.value.isPlatformAdmin
          ? 'Events you can manage'
          : 'Events you can manage and create',
        to: '/account/admin',
        icon: 'i-lucide-shield-check'
      })
    }

    if (actor.value.isPlatformAdmin) {
      items.push({
        id: 'platform-settings',
        label: 'Platform settings',
        description: 'Legal settings and platform-wide access',
        to: '/account/platform-settings',
        icon: 'i-lucide-settings'
      })
    }

    return [{
      label: '',
      items
    }]
  })

  return {
    actor,
    accountEventNavigationMode,
    sidebarGroups
  }
}
