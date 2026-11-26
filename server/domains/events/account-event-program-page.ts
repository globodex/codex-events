import { isApplicationEffectivelyCheckedIn } from '#shared/domains/applications/check-in'
import { accountEventAgendaPageSchema, canViewEventProgram } from '#shared/domains/events/program'
import { defineAccountEventPageRoute } from './account-event-page-contract'
import { getAccountEventPageAccess } from './account-event-page-context'
import { listPublishedEventRosterMembers } from '#server/domains/events'
import { emptyDeck, type Deck } from '#shared/domains/events/decks'
import { canEditChallengeDeck, listReadableEventChallenges } from './challenges'
import { loadEventDecks } from './decks'
import { loadParticipantEventProgram, loadPublicProgramSessions } from './program'

export const accountEventProgramPageRoute = defineAccountEventPageRoute({
  page: 'program',
  schema: accountEventAgendaPageSchema,
  // Everyone who can open the event workspace can open the Agenda tab. Only event admins, event
  // staff and confirmed participants get the program; the others see the public agenda blocks with the
  // sessions that the organizer made public. The challenges have their own rule for who reads
  // them (`listReadableEventChallenges`).
  authorize: async () => undefined,
  load: async (context) => {
    const isEventAdmin = context.authorization.isEventAdmin
    // An event admin reads the program as an organizer, without a registration.
    const application = isEventAdmin ? null : (await getAccountEventPageAccess(context)).application
    const approved = application?.status === 'approved'
    const isStaff = context.authorization.isStaff
    const isCheckedIn = application ? isApplicationEffectivelyCheckedIn(application) : false
    const waitingForCheckIn = approved && context.event.checkInFlowEnabled && !isCheckedIn && context.event.state !== 'completed'

    const readableChallenges = listReadableEventChallenges({
      event: context.event,
      authorization: context.authorization,
      application
    })
    // Each challenge names the staff members who support it, and has its deck. An event without a
    // readable challenge reads neither.
    const hasChallenges = readableChallenges.length > 0
    const [staff, decks] = await Promise.all([
      hasChallenges ? listPublishedEventRosterMembers(context.database, context.event.id, 'staff', readableChallenges) : [],
      hasChallenges ? loadEventDecks(context.database, context.event.id, 'challenge') : new Map<string, Deck>()
    ])
    const challenges = readableChallenges.map(challenge => ({
      ...challenge,
      staff: staff
        .filter(member => member.staffChallenge?.id === challenge.id)
        .map(member => ({ id: member.id, fullName: member.fullName, profileIconRevision: member.profileIconRevision })),
      deck: { ...(decks.get(challenge.id) ?? emptyDeck), canEdit: canEditChallengeDeck(context.authorization, challenge.id) }
    }))

    if (!canViewEventProgram({ isEventAdmin, isStaff, approved })) {
      return {
        program: null,
        publicSessions: await loadPublicProgramSessions(context.database, context.event),
        challenges,
        waitingForCheckIn
      }
    }

    return {
      program: await loadParticipantEventProgram(context.database, context.event, {
        isCheckedIn,
        userId: context.actor.platformUser.id,
        isEventAdmin
      }),
      publicSessions: null,
      challenges,
      waitingForCheckIn
    }
  }
})
