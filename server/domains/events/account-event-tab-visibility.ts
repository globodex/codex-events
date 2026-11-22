import type { AccountEventEntryAccess, AccountEventEntryTabVisibility } from '#shared/domains/events/account-event-entry-page'
import type { AccountEventPageContext } from './account-event-page-context'

export function buildAccountEventTabVisibility(input: {
  event: AccountEventPageContext['event']
  authorization: AccountEventPageContext['authorization']
  applicationStatus: AccountEventEntryAccess['applicationStatus']
  hasRetainedTalkProposal: boolean
  hasCreditInventory: boolean
  /** The gallery holds at least one photo that the caller may view (`hasEventPhotos`). */
  hasGallery: boolean
  /** The caller adds photos as a participant (`mayAddParticipantPhotos`). */
  canAddParticipantPhotos: boolean
  hasProgram: boolean
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
    hasCreditInventory,
    hasGallery,
    canAddParticipantPhotos,
    hasProgram,
    hasReadableChallenges,
    hasPublishedPrizes,
    hasPublishedStaff
  } = input
  const hasApprovedParticipantAccess = applicationStatus === 'approved'
  const hasEligibleTalkProposalApplicant = applicationStatus === 'submitted'
    || applicationStatus === 'approved'
  const isCompetitionEvent = event.eventType === 'hackathon'
  const availableTabs: AccountEventEntryTabVisibility['availableTabs'] = ['overview']

  if (!event.simplifiedClaimingEnabled && (
    authorization.isEventAdmin
    || ((hasApprovedParticipantAccess || authorization.canViewParticipantsAndTeams) && hasCreditInventory)
  )) {
    availableTabs.push('credits')
  }

  if (isCompetitionEvent && (hasPublishedPrizes || authorization.isEventAdmin || event.state === 'completed')) {
    availableTabs.push('prizes')
  }

  availableTabs.push('details')

  if (hasProgram) {
    availableTabs.push('program')
  }

  if (hasReadableChallenges) {
    availableTabs.push('challenges')
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

    availableTabs.push('operations', 'settings')
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
    showPrizeConfiguration: isCompetitionEvent
      && authorization.isEventAdmin
      && !['winners_announced', 'completed'].includes(event.state),
    showAgendaConfigurationInDetails: authorization.isEventAdmin,
    hasPublishedPrizes,
    hasPublishedStaff,
    hasCreditInventory,
    hasEligibleTalkProposalApplicant,
    hasGallery
  }
}
