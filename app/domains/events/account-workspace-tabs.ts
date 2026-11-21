import type { PublicEventState } from '~/domains/events/presentation'
import type { EventType } from '~/domains/events/records'
import type { AccountEventPageName } from '~/domains/events/account-workspace-page'
import { accountEventEntryTabs, type AccountEventEntryTab } from '#shared/domains/events/account-event-entry-page'

export const accountEventWorkspaceTabs = accountEventEntryTabs

export type AccountEventWorkspaceTab = AccountEventEntryTab

export const accountEventWorkspacePageByTab: Readonly<Record<AccountEventWorkspaceTab, AccountEventPageName>> = {
  'overview': 'entry',
  'credits': 'entry',
  'prizes': 'prizes',
  'details': 'entry',
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

export interface AccountEventTabAccessOptions {
  hasApprovedParticipantAccess: boolean
  hasEligibleTalkProposalApplicant?: boolean
  hasRetainedTalkProposal?: boolean
  hasCreditInventory?: boolean
  hasGallery: boolean
  hasPublishedPrizes: boolean
  hasPublishedStaff: boolean
  eventType?: EventType | null
  eventState?: PublicEventState | null
  talkProposalsEnabled?: boolean
  canJudge: boolean
  canManage: boolean
  showCredits?: boolean
  canViewParticipantsAndTeams: boolean
}

export interface AccountEventTabAccess {
  availableTabs: AccountEventWorkspaceTab[]
  showPrizeConfiguration: boolean
  showAgendaConfigurationInDetails: boolean
}

export interface AccountEventWorkspaceBackLink {
  to: string
  label: string
}

const defaultAccountEventTabLabels: Record<AccountEventWorkspaceTab, string> = {
  'overview': 'Overview',
  'credits': 'Credits',
  'workspace': 'Workspace',
  'prizes': 'Prizes',
  'details': 'Details',
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

export function getAccountEventTabAccess(
  options: AccountEventTabAccessOptions
): AccountEventTabAccess {
  const {
    hasApprovedParticipantAccess,
    hasEligibleTalkProposalApplicant = hasApprovedParticipantAccess,
    hasRetainedTalkProposal = false,
    hasCreditInventory = false,
    hasGallery,
    hasPublishedPrizes,
    hasPublishedStaff,
    eventType,
    eventState,
    canJudge,
    canManage,
    showCredits = true,
    canViewParticipantsAndTeams
  } = options
  const isCompetitionEvent = eventType === 'hackathon'
  const availableTabs: AccountEventWorkspaceTab[] = ['overview']

  if (showCredits && (canManage || ((hasApprovedParticipantAccess || canViewParticipantsAndTeams) && hasCreditInventory))) {
    availableTabs.push('credits')
  }

  if (isCompetitionEvent && (hasPublishedPrizes || canManage || eventState === 'completed')) {
    availableTabs.push('prizes')
  }

  availableTabs.push('details')

  if (eventType === 'meetup' && options.talkProposalsEnabled && (
    hasEligibleTalkProposalApplicant
    || hasRetainedTalkProposal
    || canManage
    || canViewParticipantsAndTeams
  )) {
    availableTabs.push('call-for-talks')
  }

  if (canJudge || canManage || canViewParticipantsAndTeams || (hasApprovedParticipantAccess && hasGallery)) {
    availableTabs.push('gallery')
  }

  if (isCompetitionEvent) {
    availableTabs.push('judges')
  }

  if (hasPublishedStaff || canManage) {
    availableTabs.push('staff')
  }

  if (canJudge || canManage || canViewParticipantsAndTeams) {
    availableTabs.push('feedback')
  }

  if (isCompetitionEvent && hasApprovedParticipantAccess) {
    availableTabs.push('workspace', 'teams')
  }

  if (canManage || canViewParticipantsAndTeams) {
    availableTabs.push('participants')
  }

  if (canManage) {
    availableTabs.push('certificates')

    if (!hasApprovedParticipantAccess) {
      if (isCompetitionEvent) {
        availableTabs.push('teams')
      }
    }

    if (isCompetitionEvent) {
      availableTabs.push('submissions')

      if (canJudge) {
        availableTabs.push('judging')
      }
    }

    availableTabs.push('operations', 'settings')
  } else if (canViewParticipantsAndTeams) {
    if (isCompetitionEvent && canJudge) {
      availableTabs.push('judging')
    }

    if (isCompetitionEvent && !hasApprovedParticipantAccess) {
      availableTabs.push('teams')
    }
  } else if (isCompetitionEvent && canJudge) {
    availableTabs.push('judging')
  }

  return {
    availableTabs,
    showPrizeConfiguration: isCompetitionEvent && canManage && !['winners_announced', 'completed'].includes(eventState ?? ''),
    showAgendaConfigurationInDetails: canManage
  }
}
