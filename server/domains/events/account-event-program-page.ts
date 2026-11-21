import { participantEventProgramSchema } from '#shared/domains/events/program'
import { defineAccountEventPageRoute } from './account-event-page-contract'
import { getAccountEventPageAccess } from './account-event-page-context'
import { assertProgramViewAccess, loadParticipantEventProgram } from './program'

export const accountEventProgramPageRoute = defineAccountEventPageRoute({
  page: 'program',
  schema: participantEventProgramSchema,
  authorize: async (context) => {
    if (!context.authorization.isEventAdmin) {
      const { application } = await getAccountEventPageAccess(context)
      assertProgramViewAccess(false, application?.status === 'approved')
    }
  },
  load: context => loadParticipantEventProgram(context.database, context.event)
})
