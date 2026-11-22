import { and, eq, or } from 'drizzle-orm'

import type {
  AccountEventEntryAccess,
  AccountEventEntryEvent
} from '#shared/domains/events/account-event-entry-page'
import type { AccountEventPageShell } from '#shared/domains/events/account-event-page-shell'
import {
  eventRoleAssignments,
  prizes
} from '#server/database/schema'
import {
  listEventTracks,
  serializeAccountEvent
} from '#server/domains/events'
import { listReadableEventChallenges } from '#server/domains/events/challenges'
import {
  getEventPhotoViewer,
  hasEventPhotos,
  mayAddParticipantPhotos
} from '#server/domains/events/photos'
import { getEventDisplayImageOptions } from '#server/domains/platform/settings'
import { getOwnTalkProposal } from '#server/domains/talk-proposals'
import { parseCustomQuestionsJson } from '#shared/domains/events/custom-questions'
import {
  getAccountEventPageAccess,
  type AccountEventPageContext
} from './account-event-page-context'
import { buildAccountEventTabVisibility } from './account-event-tab-visibility'

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
  const photoViewer = getEventPhotoViewer(context.authorization)
  const [
    access,
    tracks,
    imageOptions,
    galleryExists,
    publishedPrize,
    publishedStaffAssignment,
    talkProposal
  ] = await Promise.all([
    getAccountEventPageAccess(context),
    listEventTracks(context.database, context.event.id),
    getEventDisplayImageOptions(context.database),
    hasEventPhotos(context.database, context.event.id, photoViewer),
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
    context.event.eventType === 'meetup' && context.event.talkProposalsEnabled
      ? getOwnTalkProposal(context.database, context.event.id, context.actor.platformUser.id)
      : Promise.resolve(null)
  ])
  const application = access.application
  const canViewRestrictedDetails = context.authorization.isPlatformAdmin
    || context.authorization.explicitRole !== null
    || application?.status === 'approved'
  const serializedEvent = serializeAccountEvent(context.event, tracks, imageOptions, context.authorization, application)
  const event: AccountEventEntryEvent = {
    ...serializedEvent,
    address: canViewRestrictedDetails ? context.event.address : '',
    discordServerUrl: canViewRestrictedDetails ? context.event.discordServerUrl : null,
    slidesUrl: canViewRestrictedDetails ? context.event.slidesUrl : null,
    simplifiedClaimingEnabled: context.event.simplifiedClaimingEnabled,
    talkProposalQuestions: parseCustomQuestionsJson(context.event.talkProposalQuestionsJson),
    talkProposalQuestionsRevision: context.event.talkProposalQuestionsRevision,
    hasGallery: galleryExists
  }
  const tabVisibility = buildAccountEventTabVisibility({
    event: context.event,
    authorization: context.authorization,
    applicationStatus: application?.status ?? null,
    hasRetainedTalkProposal: Boolean(talkProposal),
    hasAgenda: serializedEvent.agendaItems.length > 0,
    hasReadableChallenges: listReadableEventChallenges({
      event: context.event,
      authorization: context.authorization,
      application
    }).length > 0,
    hasGallery: galleryExists,
    canAddParticipantPhotos: mayAddParticipantPhotos({
      event: context.event,
      viewer: photoViewer,
      application
    }),
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
