import { and, eq, or } from 'drizzle-orm'

import type {
  AccountEventEntryAccess,
  AccountEventEntryEvent,
  AccountEventEntryTabVisibility
} from '#shared/domains/events/account-event-entry-page'
import type { AccountEventPageShell } from '#shared/domains/events/account-event-page-shell'
import {
  eventCreditCodes,
  eventCreditOffers,
  eventRoleAssignments,
  prizes
} from '#server/database/schema'
import {
  listEventTracks,
  serializeAccountEvent
} from '#server/domains/events'
import { hasEventPhotos } from '#server/domains/events/photos'
import { getEventDisplayImageOptions } from '#server/domains/platform/settings'
import { getOwnTalkProposal } from '#server/domains/talk-proposals'
import { parseTalkProposalQuestionsJson } from '#shared/domains/talk-proposals/questions'
import {
  getAccountEventPageAccess,
  type AccountEventPageContext
} from './account-event-page-context'

function buildTabVisibility(input: {
  event: AccountEventPageContext['event']
  authorization: AccountEventPageContext['authorization']
  applicationStatus: AccountEventEntryAccess['applicationStatus']
  hasRetainedTalkProposal: boolean
  hasCreditInventory: boolean
  hasGallery: boolean
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

function serializeShellAccess(
  context: AccountEventPageContext,
  application: NonNullable<AccountEventPageContext['access']>['application'],
  memberships: NonNullable<AccountEventPageContext['access']>['memberships']
): AccountEventEntryAccess {
  const primaryMembership = memberships.find(({ membership }) => membership.leftAt === null)
    ?? memberships[0]
    ?? null
  const roles = context.authorization.isPlatformAdmin
    ? ['event_admin'] as const
    : context.authorization.explicitRole
      ? [context.authorization.explicitRole] as const
      : [] as const

  return {
    id: context.event.id,
    eventId: context.event.id,
    applicationStatus: application?.status ?? null,
    team: primaryMembership
      ? {
          id: primaryMembership.team.id,
          name: primaryMembership.team.name,
          slug: primaryMembership.team.slug,
          membershipRole: primaryMembership.membership.role
        }
      : null,
    submissionStatus: null,
    roles: [...roles]
  }
}

export async function loadAccountEventPageShell(
  context: AccountEventPageContext
): Promise<AccountEventPageShell> {
  const accessPromise = getAccountEventPageAccess(context)
  const [
    access,
    tracks,
    imageOptions,
    galleryExists,
    publishedPrize,
    publishedStaffAssignment,
    creditInventory,
    talkProposal
  ] = await Promise.all([
    accessPromise,
    listEventTracks(context.database, context.event.id),
    getEventDisplayImageOptions(context.database),
    hasEventPhotos(context.database, context.event.id),
    context.database.query.prizes.findFirst({
      columns: { id: true },
      where: eq(prizes.eventId, context.event.id)
    }),
    context.database.query.eventRoleAssignments.findFirst({
      columns: { id: true },
      where: and(
        eq(eventRoleAssignments.eventId, context.event.id),
        or(
          eq(eventRoleAssignments.role, 'staff'),
          and(eq(eventRoleAssignments.role, 'event_admin'), eq(eventRoleAssignments.isStaff, true))
        )
      )
    }),
    context.database
      .select({ offerId: eventCreditOffers.id })
      .from(eventCreditOffers)
      .innerJoin(eventCreditCodes, eq(eventCreditCodes.creditOfferId, eventCreditOffers.id))
      .where(eq(eventCreditOffers.eventId, context.event.id))
      .limit(1),
    context.event.eventType === 'meetup' && context.event.talkProposalsEnabled
      ? getOwnTalkProposal(context.database, context.event.id, context.actor.platformUser.id)
      : Promise.resolve(null)
  ])
  const application = access.application
  const canViewRestrictedDetails = context.authorization.isPlatformAdmin
    || context.authorization.explicitRole !== null
    || application?.status === 'approved'
  const serializedEvent = serializeAccountEvent(context.event, tracks, imageOptions)
  const event: AccountEventEntryEvent = {
    ...serializedEvent,
    programItemId: null,
    address: canViewRestrictedDetails ? context.event.address : '',
    tracks: serializedEvent.tracks ?? [],
    discordServerUrl: canViewRestrictedDetails ? context.event.discordServerUrl : null,
    slidesUrl: canViewRestrictedDetails ? context.event.slidesUrl : null,
    simplifiedClaimingEnabled: context.event.simplifiedClaimingEnabled,
    talkProposalQuestions: parseTalkProposalQuestionsJson(context.event.talkProposalQuestionsJson),
    talkProposalQuestionsRevision: context.event.talkProposalQuestionsRevision,
    hasGallery: galleryExists
  }
  const hasCreditInventory = creditInventory.length > 0
  const tabVisibility = buildTabVisibility({
    event: context.event,
    authorization: context.authorization,
    applicationStatus: application?.status ?? null,
    hasRetainedTalkProposal: Boolean(talkProposal),
    hasCreditInventory,
    hasGallery: galleryExists,
    hasPublishedPrizes: Boolean(publishedPrize),
    hasPublishedStaff: Boolean(publishedStaffAssignment)
  })

  return {
    event,
    access: serializeShellAccess(context, application, access.memberships),
    tabVisibility,
    applicationStatus: application?.status ?? null,
    lumaSyncStatus: application?.lumaSyncStatus ?? null
  }
}
