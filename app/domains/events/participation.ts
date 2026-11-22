import type { PublicEventState, PublicEventType } from '~/domains/events/presentation'
import type {
  AccountOverviewApplicationSummary,
  AccountOverviewEventSummary,
  AccountOverviewOutcomeSummary,
  AccountOverviewRecord,
  AccountOverviewSubmissionSummary,
  AccountOverviewTeamSummary
} from '#shared/domains/account/account-overview-page'

import { buildEventCertificatePath } from '#shared/domains/events/certificates'
import { normalizeApiError } from '~/lib/api'

export type EventParticipationEventSummary = AccountOverviewEventSummary
export type EventParticipationApplicationSummary = AccountOverviewApplicationSummary
export type EventParticipationTeamSummary = AccountOverviewTeamSummary
export type EventParticipationSubmissionSummary = AccountOverviewSubmissionSummary
export type EventParticipationOutcomeSummary = AccountOverviewOutcomeSummary

export interface EventParticipationRankSummary {
  basis: 'final' | 'blind_review'
  rank: number
  rankedTeamCount: number
  totalTeamCount: number
}

export type EventParticipationRecord = AccountOverviewRecord

export interface EventParticipationPrimaryAction {
  href: string
  label: string
}

export interface EventParticipationTrackSummary {
  id: string
  name: string
}

export interface EventParticipationOutcomeNotice {
  color: 'success' | 'info' | 'neutral'
  title: string
  description: string
}

export function normalizeEventParticipationApiError(error: unknown) {
  return normalizeApiError(error)
}

export function isEventParticipationUpcoming(
  record: Pick<EventParticipationRecord, 'event' | 'isPast'>,
  nowTimestamp: number = Date.now()
) {
  if (record.isPast || record.event.state === 'registration_open') {
    return false
  }

  const startsAtTimestamp = Date.parse(record.event.startsAt)

  return !Number.isNaN(startsAtTimestamp) && startsAtTimestamp > nowTimestamp
}

export function getEventParticipationOutcomeNotice(
  record: {
    event: Pick<EventParticipationEventSummary, 'state'>
    activeTeam?: Pick<EventParticipationTeamSummary, 'name'> | null
    latestTeam?: Pick<EventParticipationTeamSummary, 'name'> | null
    outcome: EventParticipationOutcomeSummary | null
  }
): EventParticipationOutcomeNotice | null {
  const outcome = record.outcome

  if (!outcome) {
    return null
  }

  const teamName = record.activeTeam?.name ?? record.latestTeam?.name ?? 'Your team'

  if (['pitch', 'pitch_review', 'final_deliberation'].includes(record.event.state)) {
    if (!outcome.isShortlisted) {
      return null
    }

    return {
      color: 'info',
      title: 'Your team is shortlisted',
      description: `${teamName} advanced to the live pitch stage.`
    }
  }

  return null
}

export function getEventParticipationRankNotice(input: {
  eventState: PublicEventState
  teamName?: string | null
  rankSummary: EventParticipationRankSummary | null
}): EventParticipationOutcomeNotice | null {
  if (input.eventState !== 'completed' || !input.rankSummary) {
    return null
  }

  const teamName = input.teamName?.trim() || 'Your team'
  const rankLabel = `#${input.rankSummary.rank} out of ${input.rankSummary.totalTeamCount}`

  if (input.rankSummary.basis === 'final') {
    return {
      color: 'info',
      title: 'Your final placement',
      description: `${teamName} finished ${rankLabel} in the completed final ranking.`
    }
  }

  return {
    color: 'info',
    title: 'Your blind-review placement',
    description: `${teamName} finished ${rankLabel} in blind review. Teams below the finalist cutoff do not receive a final placement.`
  }
}

export function getEventParticipationPrimaryAction(
  record: Pick<EventParticipationRecord, 'event' | 'application' | 'activeTeam'>
): EventParticipationPrimaryAction {
  return {
    href: `/account/events/${record.event.slug}`,
    label: 'Open overview'
  }
}

export function getSelectedBuildTrackOverviewTrack(input: {
  eventType: PublicEventType
  applicationStatus: EventParticipationApplicationSummary['status'] | null
  canSelectTrack: boolean
  selectedTrackId: string | null | undefined
  tracks: EventParticipationTrackSummary[]
}) {
  const selectedTrackId = input.selectedTrackId?.trim() ?? ''

  if (
    input.eventType !== 'build'
    || input.applicationStatus !== 'approved'
    || !input.canSelectTrack
    || !selectedTrackId
  ) {
    return null
  }

  return input.tracks.find(track => track.id === selectedTrackId) ?? null
}

export function getEventParticipationCertificateAction(
  record: Pick<EventParticipationRecord, 'event' | 'application'>
): EventParticipationPrimaryAction | null {
  const application = record.application

  if (
    record.event.state !== 'completed'
    || application?.status !== 'approved'
    || !application.isCheckedIn
    || application.certificateHiddenAt
    || application.certificateRevokedAt
  ) {
    return null
  }

  return {
    href: buildEventCertificatePath(record.event.slug, application.userId),
    label: 'View certificate'
  }
}

export function formatParticipationStatusLabel(record: EventParticipationRecord) {
  if (record.application?.status === 'approved') {
    return 'Approved'
  }

  if (record.application?.status === 'submitted') {
    return 'Pending review'
  }

  if (record.application?.status === 'rejected') {
    return 'Not approved'
  }

  if (record.application?.status === 'withdrawn') {
    return 'Withdrawn'
  }

  if (record.activeTeam) {
    return 'Team active'
  }

  if (record.latestSubmission?.status === 'submitted' || record.latestSubmission?.status === 'locked') {
    return 'Project submitted'
  }

  if (record.latestSubmission?.status === 'draft') {
    return 'Draft saved'
  }

  if (record.latestTeam) {
    return 'Participated'
  }

  return 'Participation'
}

export function getParticipationStatusColor(record: EventParticipationRecord) {
  if (record.application?.status === 'approved') {
    return 'success'
  }

  if (record.application?.status === 'submitted') {
    return 'warning'
  }

  if (record.application?.status === 'rejected') {
    return 'error'
  }

  if (record.application?.status === 'withdrawn') {
    return 'neutral'
  }

  if (record.activeTeam) {
    return 'primary'
  }

  if (record.latestSubmission?.status === 'submitted') {
    return 'primary'
  }

  if (record.latestSubmission?.status === 'locked') {
    return 'info'
  }

  if (record.latestSubmission?.status === 'draft') {
    return 'warning'
  }

  return 'neutral'
}

/**
 * Whether a person's own pages show the state of the event beside the person's own status.
 *
 * While registration is open, a registered person learns nothing new from "Registration open":
 * their own status ("Pending review", "Approved") says where they stand. In every other case the
 * state of the event is shown.
 */
export function showsEventStateBesideOwnStatus(
  eventState: string,
  applicationStatus: string | null | undefined
) {
  return eventState !== 'registration_open'
    || (applicationStatus !== 'submitted' && applicationStatus !== 'approved')
}
