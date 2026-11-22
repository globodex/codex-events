import type { PublicEvent } from '~/domains/events/presentation'
import type { AccountEventWorkspaceSubmission } from '#shared/domains/events/account-event-workspace-page'

export type TeamSubmissionRecord = AccountEventWorkspaceSubmission

export type TeamSubmissionWorkspaceStatus = TeamSubmissionRecord['status'] | 'none'

export interface TeamSubmissionActionAvailability {
  isAllowed: boolean
  reason?: string
}

export interface TeamSubmissionFormInput {
  projectName: string
  summary: string
  repositoryUrl: string
  demoUrl: string
  trackId: string | null
}

export interface TeamSubmissionRequirementConfig {
  requireSubmissionSummary: boolean
  requireSubmissionRepositoryUrl: boolean
  requireSubmissionDemoUrl: boolean
}

export interface SubmissionTrackOption {
  id: string
  name: string
  shortDescription: string
  displayOrder: number
}

export function resolveSelectedTrackPrefillId(
  tracks: SubmissionTrackOption[] | null | undefined,
  selectedTrackId: string | null | undefined
) {
  const normalizedTrackId = selectedTrackId?.trim() ?? ''

  if (!normalizedTrackId) {
    return null
  }

  return tracks?.some(track => track.id === normalizedTrackId) ? normalizedTrackId : null
}

export function getTeamSubmissionWorkspaceStatus(submission: TeamSubmissionRecord | null | undefined): TeamSubmissionWorkspaceStatus {
  return submission?.status ?? 'none'
}

export function formatTeamSubmissionStatus(status: TeamSubmissionWorkspaceStatus) {
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'submitted':
      return 'Submitted'
    case 'withdrawn':
      return 'Withdrawn'
    case 'locked':
      return 'Locked'
    case 'disqualified':
      return 'Disqualified'
    default:
      return 'No submission'
  }
}

export function getTeamSubmissionStatusColor(status: TeamSubmissionWorkspaceStatus) {
  switch (status) {
    case 'draft':
      return 'warning'
    case 'submitted':
      return 'primary'
    case 'withdrawn':
      return 'neutral'
    case 'locked':
      return 'info'
    case 'disqualified':
      return 'error'
    default:
      return 'neutral'
  }
}

export function hasEventEnteredSubmissionPhase(event: Pick<PublicEvent, 'state'>) {
  return event.state !== 'draft' && event.state !== 'registration_open'
}

function requireTeamAdminAccess(canManageSubmission: boolean) {
  if (!canManageSubmission) {
    return {
      isAllowed: false,
      reason: 'Only team admins can manage the project submission.'
    } satisfies TeamSubmissionActionAvailability
  }

  return null
}

export function getCreateSubmissionAvailability(
  event: Pick<PublicEvent, 'state'>,
  submission: TeamSubmissionRecord | null | undefined,
  canManageSubmission: boolean
): TeamSubmissionActionAvailability {
  const adminRequirement = requireTeamAdminAccess(canManageSubmission)

  if (adminRequirement) {
    return adminRequirement
  }

  if (submission) {
    return {
      isAllowed: false,
      reason: 'This team already has a submission record.'
    }
  }

  if (event.state !== 'submission_open') {
    return {
      isAllowed: false,
      reason: 'The first submission draft can be created only while submission is open.'
    }
  }

  return {
    isAllowed: true
  }
}

export function getUpdateSubmissionAvailability(
  event: Pick<PublicEvent, 'state'>,
  submission: TeamSubmissionRecord | null | undefined,
  canManageSubmission: boolean
): TeamSubmissionActionAvailability {
  const adminRequirement = requireTeamAdminAccess(canManageSubmission)

  if (adminRequirement) {
    return adminRequirement
  }

  if (!submission) {
    return {
      isAllowed: false,
      reason: 'Start the first draft before editing the project submission.'
    }
  }

  if (event.state !== 'submission_open' && event.state !== 'judging_preparation') {
    return {
      isAllowed: false,
      reason: 'Project edits are available only until judging starts.'
    }
  }

  if (submission.status !== 'draft' && submission.status !== 'submitted') {
    return {
      isAllowed: false,
      reason: submission.status === 'withdrawn'
        ? 'Withdrawn submissions remain read-only.'
        : submission.status === 'locked'
          ? 'Locked submissions cannot be edited.'
          : 'Disqualified submissions remain read-only.'
    }
  }

  return {
    isAllowed: true
  }
}

export function getSubmitSubmissionAvailability(
  event: Pick<PublicEvent, 'state'>,
  submission: TeamSubmissionRecord | null | undefined,
  canManageSubmission: boolean
): TeamSubmissionActionAvailability {
  const adminRequirement = requireTeamAdminAccess(canManageSubmission)

  if (adminRequirement) {
    return adminRequirement
  }

  if (!submission) {
    return {
      isAllowed: false,
      reason: 'Create the first draft before submitting the project.'
    }
  }

  if (event.state !== 'submission_open' && event.state !== 'judging_preparation') {
    return {
      isAllowed: false,
      reason: 'Project submission is available only until judging starts.'
    }
  }

  if (submission.status !== 'draft') {
    return {
      isAllowed: false,
      reason: submission.status === 'submitted'
        ? 'This project is already submitted.'
        : submission.status === 'withdrawn'
          ? 'Withdrawn submissions cannot be resubmitted.'
          : submission.status === 'locked'
            ? 'Locked submissions are already in judging.'
            : 'Disqualified submissions cannot be submitted.'
    }
  }

  return {
    isAllowed: true
  }
}

export function getWithdrawSubmissionAvailability(
  event: Pick<PublicEvent, 'state'>,
  submission: TeamSubmissionRecord | null | undefined,
  canManageSubmission: boolean
): TeamSubmissionActionAvailability {
  const adminRequirement = requireTeamAdminAccess(canManageSubmission)

  if (adminRequirement) {
    return adminRequirement
  }

  if (!submission) {
    return {
      isAllowed: false,
      reason: 'There is no submission to withdraw for this team.'
    }
  }

  if (event.state !== 'submission_open' && event.state !== 'judging_preparation') {
    return {
      isAllowed: false,
      reason: 'Submissions can be withdrawn only until judging starts.'
    }
  }

  if (submission.status !== 'draft' && submission.status !== 'submitted') {
    return {
      isAllowed: false,
      reason: submission.status === 'withdrawn'
        ? 'This submission is already withdrawn.'
        : submission.status === 'locked'
          ? 'Locked submissions cannot be withdrawn.'
          : 'Disqualified submissions cannot be withdrawn.'
    }
  }

  return {
    isAllowed: true
  }
}

export function getUpdateSubmissionPublicVisibilityAvailability(
  event: Pick<PublicEvent, 'state'>,
  submission: TeamSubmissionRecord | null | undefined,
  canManageSubmission: boolean,
  isWinner: boolean
): TeamSubmissionActionAvailability {
  const adminRequirement = requireTeamAdminAccess(canManageSubmission)

  if (adminRequirement) {
    return adminRequirement
  }

  if (!submission) {
    return {
      isAllowed: false,
      reason: 'There is no submission available to publish publicly.'
    }
  }

  if (event.state !== 'completed') {
    return {
      isAllowed: false,
      reason: 'Project publishing is available only after the event is completed.'
    }
  }

  if (submission.status !== 'locked') {
    return {
      isAllowed: false,
      reason: 'Only completed competition projects can be published publicly.'
    }
  }

  if (isWinner) {
    return {
      isAllowed: false,
      reason: 'Winning projects are already published in the winners showcase.'
    }
  }

  return {
    isAllowed: true
  }
}
