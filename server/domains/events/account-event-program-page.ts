import { isApplicationEffectivelyCheckedIn } from '#shared/domains/applications/check-in'
import { accountEventAgendaPageSchema, canViewEventProgram } from '#shared/domains/events/program'
import { defineAccountEventPageRoute } from './account-event-page-contract'
import { getAccountEventPageAccess } from './account-event-page-context'
import { listReadableEventChallenges } from './challenges'
import { loadParticipantEventProgram, loadPublicProgramSessions } from './program'

export const accountEventProgramPageRoute = defineAccountEventPageRoute({
  page: 'program',
  schema: accountEventAgendaPageSchema,
  // Everyone who can open the event workspace can open the Agenda tab. Only event admins and
  // confirmed participants get the program; the others see the public agenda blocks with the
  // sessions that the organizer made public. The challenges have their own rule for who reads
  // them (`listReadableEventChallenges`).
  authorize: async () => undefined,
  load: async (context) => {
    const isEventAdmin = context.authorization.isEventAdmin
    // An event admin reads the program as an organizer, without a registration.
    const application = isEventAdmin ? null : (await getAccountEventPageAccess(context)).application
    const approved = application?.status === 'approved'

    const challenges = listReadableEventChallenges({
      event: context.event,
      authorization: context.authorization,
      application
    })

    if (!canViewEventProgram(isEventAdmin, approved)) {
      return {
        program: null,
        publicSessions: await loadPublicProgramSessions(context.database, context.event),
        challenges
      }
    }

    return {
      program: await loadParticipantEventProgram(context.database, context.event, {
        isCheckedIn: application ? isApplicationEffectivelyCheckedIn(application) : false
      }),
      publicSessions: null,
      challenges
    }
  }
})
