import type { AccountEventEntryAccess, AccountEventEntryTabVisibility } from '#shared/domains/events/account-event-entry-page'
import type { AccountEventPageContext } from './account-event-page-context'

export function buildAccountEventTabVisibility(input: {
  event: Pick<AccountEventPageContext['event'], 'eventType' | 'state' | 'talkProposalsEnabled'>
  authorization: Pick<AccountEventPageContext['authorization'], 'isEventAdmin' | 'canViewParticipantsAndTeams' | 'canReviewThroughAssignment'>
  applicationStatus: AccountEventEntryAccess['applicationStatus']
  hasRetainedTalkProposal: boolean
  /** The gallery holds at least one photo that the caller may view (`hasEventPhotos`). */
  hasGallery: boolean
  /** The caller adds photos as a participant (`mayAddParticipantPhotos`). */
  canAddParticipantPhotos: boolean
  /** The event has at least one public agenda block. */
  hasAgenda: boolean
  /** The caller can read at least one published challenge (`listReadableEventChallenges`). */
  hasReadableChallenges: boolean
  hasPublishedPrizes: boolean
  hasPublishedStaff: boolean
}): AccountEventEntryTabVisibility {
  const {
    event,
    authorization,
    applicationStatus,
    hasRetainedTalkProposal,
    hasGallery,
    canAddParticipantPhotos,
    hasAgenda,
    hasReadableChallenges,
    hasPublishedPrizes,
    hasPublishedStaff
  } = input
  const hasApprovedParticipantAccess = applicationStatus === 'approved'
  const hasEligibleTalkProposalApplicant = applicationStatus === 'submitted'
    || applicationStatus === 'approved'
  const isCompetitionEvent = event.eventType === 'hackathon'
  const availableTabs: AccountEventEntryTabVisibility['availableTabs'] = ['overview']

  if (isCompetitionEvent && (hasPublishedPrizes || authorization.isEventAdmin || event.state === 'completed')) {
    availableTabs.push('prizes')
  }

  // The Agenda tab shows the public agenda blocks to everyone, the sessions to people who may
  // read the program, and the challenges to people who may read them. So it is there for an
  // agenda and for a readable challenge.
  if (hasAgenda || hasReadableChallenges) {
    availableTabs.push('program')
  }

  if (event.eventType === 'meetup' && event.talkProposalsEnabled && (
    hasEligibleTalkProposalApplicant
    || hasRetainedTalkProposal
    || authorization.isEventAdmin
    || authorization.canViewParticipantsAndTeams
  )) {
    availableTabs.push('call-for-talks')
  }

  if (
    authorization.canReviewThroughAssignment
    || authorization.isEventAdmin
    || authorization.canViewParticipantsAndTeams
    || (hasApprovedParticipantAccess && hasGallery)
    // A participant who can add photos gets the tab also while the gallery is empty.
    || canAddParticipantPhotos
  ) {
    availableTabs.push('gallery')
  }

  if (isCompetitionEvent) {
    availableTabs.push('judges')
  }

  if (hasPublishedStaff || authorization.isEventAdmin) {
    availableTabs.push('staff')
  }

  if (
    authorization.canReviewThroughAssignment
    || authorization.isEventAdmin
    || authorization.canViewParticipantsAndTeams
  ) {
    availableTabs.push('feedback')
  }

  if (isCompetitionEvent && hasApprovedParticipantAccess) {
    availableTabs.push('workspace', 'teams')
  }

  if (authorization.isEventAdmin || authorization.canViewParticipantsAndTeams) {
    availableTabs.push('participants')
  }

  if (authorization.isEventAdmin) {
    availableTabs.push('certificates')

    if (!hasApprovedParticipantAccess && isCompetitionEvent) {
      availableTabs.push('teams')
    }

    if (isCompetitionEvent) {
      availableTabs.push('submissions')

      if (authorization.canReviewThroughAssignment) {
        availableTabs.push('judging')
      }
    }

    availableTabs.push('operations')
  } else if (authorization.canViewParticipantsAndTeams) {
    if (isCompetitionEvent && authorization.canReviewThroughAssignment) {
      availableTabs.push('judging')
    }

    if (isCompetitionEvent && !hasApprovedParticipantAccess) {
      availableTabs.push('teams')
    }
  } else if (isCompetitionEvent && authorization.canReviewThroughAssignment) {
    availableTabs.push('judging')
  }

  return {
    availableTabs,
    hasPublishedPrizes,
    hasPublishedStaff,
    hasEligibleTalkProposalApplicant,
    hasGallery
  }
}
