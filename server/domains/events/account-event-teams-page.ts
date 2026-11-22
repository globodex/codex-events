import { assertCompetitionEvent } from '#server/domains/events'
import {
  findDirectoryTeamBySlug,
  listPendingJoinRequestsForUser,
  listVisibleTeams
} from '#server/domains/teams'
import type { AccountEventTeamsPage } from '#shared/domains/events/account-event-teams-page'
import type { AccountEventPageQuery } from '#shared/domains/events/account-event-page-registry'
import { accountEventTeamsPageSchema } from '#shared/domains/events/account-event-teams-page'
import { defineAccountEventPageRoute } from './account-event-page-contract'
import {
  assertAccountEventTeamAccess,
  getAccountEventPageAccess
} from './account-event-page-context'

const firstTeamPageSize = 6

export const accountEventTeamsPageRoute = defineAccountEventPageRoute({
  page: 'teams',
  schema: accountEventTeamsPageSchema,
  authorize: async (context) => {
    assertCompetitionEvent(context.event)
    assertAccountEventTeamAccess(context)
  },
  load: async (context, query: AccountEventPageQuery): Promise<AccountEventTeamsPage> => {
    const { database, event, authorization } = context
    const includeInactiveTeams = authorization.canViewParticipantsAndTeams
    const [access, pendingJoinRequests, visibleTeams, selectedTeam] = await Promise.all([
      getAccountEventPageAccess(context),
      listPendingJoinRequestsForUser(database, event.id, context.actor.platformUser.id),
      listVisibleTeams(database, event, event.id, { page: 1, page_size: firstTeamPageSize }, { includeInactiveTeams }),
      query.selectedTeamSlug ? findDirectoryTeamBySlug(database, event.id, query.selectedTeamSlug, includeInactiveTeams) : null
    ])

    return {
      event: { id: event.id, slug: event.slug, state: event.state, maxTeamMembers: event.maxTeamMembers },
      applicationStatus: access.application?.status ?? null,
      ownTeamId: access.memberships.find(({ membership }) => membership.leftAt === null)?.membership.teamId ?? null,
      selectedTeam,
      pendingJoinRequests,
      visibleTeams: visibleTeams.data,
      visibleTeamsMeta: {
        page: 1,
        pageSize: firstTeamPageSize,
        total: visibleTeams.total,
        filterCounts: visibleTeams.filterCounts
      }
    }
  }
})
