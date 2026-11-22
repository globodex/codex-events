import type { PublicEventState } from '~/domains/events/presentation'
import type { AccountEventPageName } from '~/domains/events/account-workspace-page'
import { accountEventEntryTabs, type AccountEventEntryTab } from '#shared/domains/events/account-event-entry-page'

export const accountEventWorkspaceTabs = accountEventEntryTabs

export type AccountEventWorkspaceTab = AccountEventEntryTab

export const accountEventWorkspacePageByTab: Readonly<Record<AccountEventWorkspaceTab, AccountEventPageName>> = {
  'overview': 'entry',
  'prizes': 'prizes',
  'program': 'program',
  'call-for-talks': 'entry',
  'gallery': 'gallery',
  'feedback': 'feedback',
  'judges': 'rosters',
  'staff': 'rosters',
  'workspace': 'workspace',
  'teams': 'teams',
  'participants': 'participants',
  'certificates': 'certificates',
  'submissions': 'submissions',
  'judging': 'judging',
  'operations': 'operations',
  'settings': 'settings'
}

export function getAccountEventPageForTab(tab: AccountEventWorkspaceTab) {
  return accountEventWorkspacePageByTab[tab]
}

export function shouldPreserveAccountEventTabSelection(options: {
  tab: AccountEventWorkspaceTab
  hasEntryPage: boolean
  hasPageShell: boolean
}) {
  return !options.hasEntryPage
    && !options.hasPageShell
    && getAccountEventPageForTab(options.tab) === 'entry'
}

export interface AccountEventWorkspaceBackLink {
  to: string
  label: string
}

const defaultAccountEventTabLabels: Record<AccountEventWorkspaceTab, string> = {
  'overview': 'Overview',
  'workspace': 'Workspace',
  'prizes': 'Prizes',
  'program': 'Agenda',
  'call-for-talks': 'Call for talks',
  'gallery': 'Gallery',
  'feedback': 'Feedback',
  'judges': 'Judges',
  'staff': 'Staff',
  'judging': 'Judging',
  'participants': 'Participants',
  'certificates': 'Certificates',
  'teams': 'Teams',
  'submissions': 'Submissions',
  'operations': 'Operations',
  'settings': 'Settings'
}

export function getAccountEventTabLabel(
  tab: AccountEventWorkspaceTab,
  options?: {
    eventState?: PublicEventState | null
  }
) {
  if (tab === 'prizes' && options?.eventState === 'completed') {
    return 'Winners'
  }

  return defaultAccountEventTabLabels[tab]
}

export function canAccessAccountEventWorkspace(options: {
  hasAccessRecord: boolean
  canJudge: boolean
  canManage: boolean
  canViewParticipantsAndTeams: boolean
}) {
  return options.hasAccessRecord
    || options.canJudge
    || options.canManage
    || options.canViewParticipantsAndTeams
}

export function resolveAccountEventScopedId(options: {
  accessRecordId?: string | null
  eventId: string
}) {
  const accessRecordId = options.accessRecordId?.trim() ?? ''
  return accessRecordId.length > 0 ? accessRecordId : options.eventId.trim()
}

export function getAccountEventWorkspaceBackLink(options: {
  canManage: boolean
  canViewParticipantsAndTeams: boolean
}): AccountEventWorkspaceBackLink {
  if (options.canManage) {
    return {
      to: '/account/admin',
      label: 'Back to Admin dashboard'
    }
  }

  if (options.canViewParticipantsAndTeams) {
    return {
      to: '/account/staff',
      label: 'Back to Staff dashboard'
    }
  }

  return {
    to: '/account',
    label: 'Back to my events'
  }
}
