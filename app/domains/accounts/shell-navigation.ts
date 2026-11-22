import type { LocationQueryValue } from 'vue-router'
import type { SessionActor } from '~/domains/accounts/session-actor'

import { isEventRoleStaffEnabled } from '~/domains/events/access'
import { normalizeTabQueryValue } from '~/lib/query-values'

export interface ShellNavigationMatchOptions {
  accountEventNavigationMode?: 'participant' | 'staff' | 'admin'
}

const dashboardPaths = {
  admin: '/account/admin',
  staff: '/account/staff',
  participant: '/account',
  judging: '/account/judging'
} as const

export function isAccountEventDetailPath(path: string) {
  return path.startsWith('/account/events/')
}

export function resolveShellAccountEventNavigationMode(options: {
  actor: SessionActor | null
  currentEventId?: string | null
  currentPath: string
}): ShellNavigationMatchOptions['accountEventNavigationMode'] {
  if (!isAccountEventDetailPath(options.currentPath) || options.actor?.kind !== 'platform_user') {
    return undefined
  }

  if (options.actor.isPlatformAdmin) {
    return 'admin'
  }

  const currentEventId = options.currentEventId?.trim() ?? ''

  if (!currentEventId) {
    return undefined
  }

  const roles = options.actor.eventRoles.filter(role => role.eventId === currentEventId)
  if (roles.some(role => role.role === 'event_admin')) {
    return 'admin'
  }

  return roles.some(isEventRoleStaffEnabled) ? 'staff' : 'participant'
}

export function isShellNavigationLinkActive(
  currentPath: string,
  currentTab: LocationQueryValue | LocationQueryValue[] | null | undefined,
  targetPath: string,
  options: ShellNavigationMatchOptions = {}
) {
  if (isAccountEventDetailPath(currentPath)) {
    const mode = options.accountEventNavigationMode
    if (!mode) {
      return false
    }

    const viewingJudgingTab = mode !== 'admin' && normalizeTabQueryValue(currentTab) === 'judging'
    return targetPath === dashboardPaths[viewingJudgingTab ? 'judging' : mode]
  }

  if (targetPath === '/account' || targetPath === '/') {
    return currentPath === targetPath
  }

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
}
