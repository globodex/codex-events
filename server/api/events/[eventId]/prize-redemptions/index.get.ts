import { z } from 'zod'

import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { requireEventAdmin, routeIdParamsSchema } from '#server/domains/events'
import {
  listEventPrizeRedemptions,
  listOperationalPrizeRedemptionTeamMembersByTeamId
} from '#server/domains/prize-redemptions'
import {
  getFinalDeliberationView,
  getWinnersView,
  listBlindRankingEntries
} from '#server/domains/outcomes'
import { parseValidatedParams, parseValidatedQuery } from '#server/http/validation'

const prizeRedemptionQuerySchema = z.object({
  include_rankings: z.union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .default(false)
    .transform(value => value === true || value === 'true')
})

export const applicationOperation = defineStructuredRouteOperation({
  id: 'get.events.by-eventId.prize-redemptions',
  domain: 'participation',
  description: 'GET /api/events/:eventId/prize-redemptions',
  rest: { method: 'GET', path: '/api/events/:eventId/prize-redemptions' },
  input: { params: routeIdParamsSchema, query: prizeRedemptionQuerySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'read'
}, async (h3Event) => {
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const query = parseValidatedQuery(h3Event, prizeRedemptionQuerySchema)
  const database = getDatabase(h3Event)

  await requireEventAdmin(h3Event, eventId)

  const [winners, redemptions] = await Promise.all([
    getWinnersView(database, eventId),
    listEventPrizeRedemptions(database, eventId)
  ])
  const [finalDeliberation, blindRankingEntries] = query.include_rankings
    ? await Promise.all([
        getFinalDeliberationView(database, eventId),
        listBlindRankingEntries(database, eventId)
      ])
    : [
        { entries: [] as Awaited<ReturnType<typeof getFinalDeliberationView>>['entries'] },
        [] as Awaited<ReturnType<typeof listBlindRankingEntries>>
      ]
  const teamIds = [...new Set([
    ...winners.map(entry => entry.teamId),
    ...finalDeliberation.entries
      .filter((entry): entry is typeof finalDeliberation.entries[number] & { finalRank: number } =>
        entry.finalRank !== null
      )
      .map(entry => entry.teamId),
    ...blindRankingEntries
      .filter((entry): entry is typeof blindRankingEntries[number] & { rank: number } =>
        entry.rank !== null
      )
      .map(entry => entry.teamId)
  ])]
  const teamMembersByTeamId = await listOperationalPrizeRedemptionTeamMembersByTeamId(database, eventId, teamIds)

  return apiData({
    winners: winners.map(entry => ({
      ...entry,
      teamMembers: teamMembersByTeamId.get(entry.teamId) ?? []
    })),
    redemptions,
    finalRankingEntries: finalDeliberation.entries
      .filter((entry): entry is typeof finalDeliberation.entries[number] & { finalRank: number } =>
        entry.finalRank !== null
      )
      .map(entry => ({
        teamId: entry.teamId,
        teamName: entry.teamName,
        submissionId: entry.submissionId,
        projectName: entry.projectName,
        summary: entry.summary,
        repositoryUrl: entry.repositoryUrl,
        demoUrl: entry.demoUrl,
        finalRank: entry.finalRank,
        teamMembers: teamMembersByTeamId.get(entry.teamId) ?? []
      })),
    blindRankingEntries: blindRankingEntries
      .filter((entry): entry is typeof blindRankingEntries[number] & { rank: number } =>
        entry.rank !== null
      )
      .map(entry => ({
        teamId: entry.teamId,
        teamName: entry.teamName,
        submissionId: entry.submissionId,
        projectName: entry.projectName,
        summary: entry.summary,
        repositoryUrl: entry.repositoryUrl,
        demoUrl: entry.demoUrl,
        blindRank: entry.rank,
        teamMembers: teamMembersByTeamId.get(entry.teamId) ?? []
      }))
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
