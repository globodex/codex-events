import type { OperationalUserSummary } from '~/domains/accounts/session-actor'
import type { TermsDocument } from '~/domains/events/records'
import type {
  ApplicationCheckInOverrideStatus,
  ApplicationCheckInSource
} from '#shared/domains/applications/check-in'
import type { RegistrationAnswerRecord } from '#shared/domains/applications/registration-answers'
import {
  isApplicationEffectivelyCheckedIn,
  resolveApplicationAttendanceSource
} from '#shared/domains/applications/check-in'

export interface AdminApplicationRecord {
  id: string
  eventId: string
  userId: string
  status: 'submitted' | 'approved' | 'rejected' | 'withdrawn'
  preApprovalStatus?: 'approved' | 'rejected' | null
  lumaSyncStatus?: 'not_synced' | 'approve_synced' | 'reject_synced' | 'approve_failed' | 'reject_failed' | null
  checkedInAt?: string | null
  checkInSource?: ApplicationCheckInSource | null
  checkInOverrideStatus?: ApplicationCheckInOverrideStatus | null
  checkInOverrideAt?: string | null
  certificateHiddenAt?: string | null
  certificateRevokedAt?: string | null
  certificateEmailQueuedAt?: string | null
  certificateEmailQueuedByUserId?: string | null
  certificateEmailSentAt?: string | null
  isEventStaff?: boolean
  selectedTrackId: string | null
  /** The open track or challenge that the participant chose. Only the participant list carries it. */
  selectedChallengeId?: string | null
  submittedAt: string
  withdrawnAt: string | null
  reviewedAt: string | null
  reviewedByUserId: string | null
  applicationTermsDocumentId: string | null
  applicationTermsAcceptedAt: string | null
  registrationDetailsJson: string
  /**
   * The answers to the event's registration questions, each with the question text of that moment.
   * Only the participant list carries them.
   */
  registrationAnswers?: RegistrationAnswerRecord[]
  createdAt: string
  updatedAt: string
  user?: OperationalUserSummary
  applicationTermsDocument?: TermsDocument
  adminWithdrawal?: {
    isAllowed: boolean
    reason: string | null
    warning: string | null
    activeTeamId: string | null
    teamAction: 'none' | 'remove_member' | 'dissolve_team'
  }
}

export interface ParticipantsLimitSummary {
  participantsLimit: number
  approvedCount: number
  stagedApprovedCount: number
  projectedApprovedCount: number
  description: string
}

function startCase(value: string) {
  return value
    .split('_')
    .map(part => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function formatRemainingSpots(count: number) {
  return `${count} ${count === 1 ? 'spot' : 'spots'}`
}

export function formatApplicationStatus(status: AdminApplicationRecord['status']) {
  return startCase(status)
}

export function getApplicationStatusColor(status: AdminApplicationRecord['status']) {
  switch (status) {
    case 'submitted':
      return 'warning'
    case 'approved':
      return 'success'
    case 'rejected':
      return 'error'
    case 'withdrawn':
      return 'neutral'
  }
}

export function isApplicationCheckedIn(
  application: Pick<AdminApplicationRecord, 'checkedInAt' | 'checkInOverrideStatus'>
) {
  return isApplicationEffectivelyCheckedIn({
    checkedInAt: application.checkedInAt ?? null,
    checkInOverrideStatus: application.checkInOverrideStatus ?? null
  })
}

export function listParticipantRosterApplications<T extends Pick<AdminApplicationRecord, 'isEventStaff'>>(
  applications: T[]
) {
  return applications.filter(application => !application.isEventStaff)
}

export function formatApplicationAttendanceStatus(
  application: Pick<AdminApplicationRecord, 'checkedInAt' | 'checkInOverrideStatus'>
) {
  return isApplicationCheckedIn(application) ? 'Checked in' : 'Not checked in'
}

export function getApplicationAttendanceStatusColor(
  application: Pick<AdminApplicationRecord, 'checkedInAt' | 'checkInOverrideStatus'>
) {
  return isApplicationCheckedIn(application) ? 'success' : 'neutral'
}

// The switch has no default on purpose: a new check-in source without a label fails the typecheck.
export function formatApplicationAttendanceSource(
  application: Pick<AdminApplicationRecord, 'checkedInAt' | 'checkInSource' | 'checkInOverrideStatus'>
): string {
  const source = resolveApplicationAttendanceSource({
    checkedInAt: application.checkedInAt ?? null,
    checkInSource: application.checkInSource ?? null,
    checkInOverrideStatus: application.checkInOverrideStatus ?? null
  })

  switch (source) {
    case 'manual':
      return application.checkInOverrideStatus === 'joined' ? 'Marked joined by event team' : 'Marked not joined by event team'
    case 'luma':
      return 'Checked in via Luma'
    case 'simplified_claim':
      return 'Checked in after claiming the event credit'
    case 'staff':
      return 'Checked in by event staff'
    case null:
      return 'No check-in recorded'
  }
}

export function shouldShowApplicationLumaSyncStatus(
  application: Pick<AdminApplicationRecord, 'status' | 'lumaSyncStatus'>
) {
  return application.status !== 'submitted' && Boolean(application.lumaSyncStatus)
}

export function listFailedApplicationLumaSyncApplications(
  applications: AdminApplicationRecord[],
  view: 'applications' | 'approved' | 'rejected' | 'withdrawn'
) {
  if (view === 'approved') {
    return applications.filter(application =>
      application.status === 'approved' && application.lumaSyncStatus === 'approve_failed'
    )
  }

  if (view === 'rejected') {
    return applications.filter(application =>
      application.status === 'rejected' && application.lumaSyncStatus === 'reject_failed'
    )
  }

  if (view === 'withdrawn') {
    return applications.filter(application =>
      application.status === 'withdrawn' && application.lumaSyncStatus === 'reject_failed'
    )
  }

  return []
}

export function formatFailedApplicationLumaSyncAlertToggleLabel(count: number, expanded: boolean) {
  if (count <= 0) {
    return ''
  }

  if (expanded) {
    return 'Collapse'
  }

  return 'Expand'
}

export function formatApplicationLumaSyncStatus(status: AdminApplicationRecord['lumaSyncStatus']) {
  switch (status) {
    case 'not_synced':
      return 'Luma sync pending'
    case 'approve_synced':
      return 'Luma approved'
    case 'reject_synced':
      return 'Luma rejected'
    case 'approve_failed':
      return 'Luma approval failed'
    case 'reject_failed':
      return 'Luma rejection failed'
    default:
      return ''
  }
}

export function getApplicationLumaSyncStatusColor(status: AdminApplicationRecord['lumaSyncStatus']) {
  switch (status) {
    case 'not_synced':
    case 'approve_failed':
    case 'reject_failed':
      return 'warning'
    case 'approve_synced':
      return 'success'
    case 'reject_synced':
      return 'error'
    default:
      return 'neutral'
  }
}

export function getParticipantsLimitSummary(
  applications: AdminApplicationRecord[],
  participantsLimit?: number | null
): ParticipantsLimitSummary | null {
  if (!participantsLimit || participantsLimit <= 0) {
    return null
  }

  const approvedCount = applications.filter(application => application.status === 'approved').length
  const stagedApprovedCount = applications.filter(
    application => application.status === 'submitted' && application.preApprovalStatus === 'approved'
  ).length
  const projectedApprovedCount = approvedCount + stagedApprovedCount
  const spotsDelta = participantsLimit - projectedApprovedCount

  let projectedOutcome: string

  if (spotsDelta > 0) {
    projectedOutcome = `leaving ${formatRemainingSpots(spotsDelta)} remaining against the target.`
  } else if (spotsDelta === 0) {
    projectedOutcome = 'matching the target exactly.'
  } else {
    projectedOutcome = `which is ${formatRemainingSpots(Math.abs(spotsDelta))} over the target.`
  }

  return {
    participantsLimit,
    approvedCount,
    stagedApprovedCount,
    projectedApprovedCount,
    description: `Current fill: ${approvedCount}/${participantsLimit} approved against the planning target. If you save the current staged decisions, projected fill becomes ${projectedApprovedCount}/${participantsLimit}, ${projectedOutcome}`
  }
}

export function getParticipantApplicationStatusSummary(
  applications: Array<Pick<AdminApplicationRecord, 'status'>>
) {
  const submittedCount = applications.filter(application => application.status === 'submitted').length
  const approvedCount = applications.filter(application => application.status === 'approved').length
  const rejectedCount = applications.filter(application => application.status === 'rejected').length
  const withdrawnCount = applications.filter(application => application.status === 'withdrawn').length

  return {
    totalCount: applications.length,
    submittedCount,
    approvedCount,
    rejectedCount,
    withdrawnCount
  }
}

export function formatApprovedParticipantRegistrationSummary(
  applications: Array<Pick<AdminApplicationRecord, 'status'>>
) {
  const summary = getParticipantApplicationStatusSummary(applications)
  return `${summary.approvedCount} / ${summary.totalCount}`
}
