import type { AccountEventEntryAccess, AccountEventEntryTabVisibility } from '#shared/domains/events/account-event-entry-page'
import type { AccountEventPageContext } from './account-event-page-context'

export function buildAccountEventTabVisibility(input: {
  event: AccountEventPageContext['event']
  authorization: AccountEventPageContext['authorization']
  applicationStatus: AccountEventEntryAccess['applicationStatus']
  hasRetainedTalkProposal: boolean
  hasCreditInventory: boolean
  hasGallery: boolean
  hasProgram: boolean
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
    hasProgram,
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
