import { accountEventAgendaPageSchema } from '#shared/domains/events/program'
import { defineAccountEventPageRoute } from './account-event-page-contract'
import { getAccountEventPageAccess } from './account-event-page-context'
import { canViewEventProgram, loadParticipantEventProgram } from './program'

export const accountEventProgramPageRoute = defineAccountEventPageRoute({
  page: 'program',
  schema: accountEventAgendaPageSchema,
  // Everyone who can open the event workspace can open the Agenda tab. Only event admins and
  // confirmed participants get the program; the others see the public agenda blocks.
  authorize: async () => undefined,
  load: async (context) => {
    const isEventAdmin = context.authorization.isEventAdmin
    const approved = !isEventAdmin && (await getAccountEventPageAccess(context)).application?.status === 'approved'

    return {
      program: canViewEventProgram(isEventAdmin, approved)
        ? await loadParticipantEventProgram(context.database, context.event)
        : null
    }
  }
})
