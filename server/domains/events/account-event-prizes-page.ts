import { asc, desc, eq } from 'drizzle-orm'

import type {
  AccountEventPublishedProject,
  AccountEventPrizesPage,
  AccountEventPrizesEvent,
  AccountEventWinner
} from '#shared/domains/events/account-event-prizes-page'
import { accountEventPrizesPageSchema } from '#shared/domains/events/account-event-prizes-page'
import { assertCompetitionEvent, serializePrize } from '#server/domains/events'
import { getPublishedProjectsView, getWinnersView } from '#server/domains/outcomes'
import { prizes } from '#server/database/schema'
import { defineAccountEventPageRoute } from './account-event-page-contract'
import { loadAccountEventParticipation } from './account-event-entry-page'
import type { AccountEventPageContext } from './account-event-page-context'

export const accountEventPrizesPageRoute = defineAccountEventPageRoute({
  page: 'prizes',
  schema: accountEventPrizesPageSchema,
  authorize: async (context) => {
    assertCompetitionEvent(context.event)
  },
  load: async (context: AccountEventPageContext): Promise<AccountEventPrizesPage> => {
    const event = context.event
    const prizeRows = await context.database.query.prizes.findMany({
      where: eq(prizes.eventId, event.id),
      orderBy: [asc(prizes.displayOrder), asc(prizes.rankEnd), desc(prizes.rankStart), asc(prizes.createdAt)]
    })
    let winners: AccountEventWinner[] = []
    let publishedProjects: AccountEventPublishedProject[] = []

    if (event.state === 'completed') {
      const completedViews = await Promise.all([
        getWinnersView(context.database, event.id),
        getPublishedProjectsView(context.database, event.id)
      ])
      winners = completedViews[0] as AccountEventWinner[]
      publishedProjects = completedViews[1] as AccountEventPublishedProject[]
    }
    const participation = await loadAccountEventParticipation(context)
    const pageEvent: AccountEventPrizesEvent = {
      id: event.id,
      eventType: event.eventType,
      state: event.state
    }

    return {
      event: pageEvent,
      prizes: prizeRows.map(serializePrize),
      winners,
      publishedProjects,
      participantRank: participation.rankSummary,
      participantOutcome: participation.record?.outcome ?? null
    }
  }
})
