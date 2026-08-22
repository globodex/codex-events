import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import { events, prizeRedemptions, prizes } from '#server/database/schema'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  enqueueWinnerOutcomeEmails
} from '#server/domains/outcomes/email-queue'
import { chunkRowsForD1 } from '#server/domains/judging'
import {
  assertEventNotHidden,
  requireEventAdmin,
  routeIdParamsSchema,
  serializePrize,
  serializeEvent
} from '#server/domains/events'
import {
  buildPrizeRedemptionRows,
  getCurrentWinnerTermsForEvent
} from '#server/domains/prize-redemptions'
import {
  assertWinnersAnnouncementAllowed,
  assertFinalDeliberationReorderMatchesEntries,
  getFinalDeliberationView
} from '#server/domains/outcomes'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'
import { assertGuard } from '#server/domains/lifecycle-guard'

type WinnerPrizeSummary = ReturnType<typeof serializePrize>
type AnnouncedWinner = {
  teamId: string
  teamName: string
  finalRank: number
  prizes: WinnerPrizeSummary[]
}

const announceWinnersBodySchema = z.object({
  orderedSubmissionIds: z.array(z.string().trim().min(1)).min(1).optional()
}).default({})

export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.actions.announce-winners',
  domain: 'judging',
  description: 'POST /api/events/:eventId/actions/announce-winners',
  rest: { method: 'POST', path: '/api/events/:eventId/actions/announce-winners' },
  input: { params: routeIdParamsSchema, body: announceWinnersBodySchema },
  output: 'data',
  capabilities: ['event_admin'],
  effect: 'destructive'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const body = await parseValidatedBody(h3Event, announceWinnersBodySchema)
  const database = getDatabase(h3Event)
  const { event } = await requireEventAdmin(h3Event, eventId)

  assertEventNotHidden(event)
  assertWinnersAnnouncementAllowed(event)

  const prizeList = await database.query.prizes.findMany({
    where: eq(prizes.eventId, eventId)
  })
  const currentWinnerTerms = await getCurrentWinnerTermsForEvent(database, event)

  if (prizeList.length > 0) {
    assertGuard(Boolean(currentWinnerTerms), {
      code: 'winner_terms_required',
      message: 'Winner announcement requires current winner terms when prize redemption is enabled.',
      details: { eventId }
    })
  }

  const finalDeliberationView = await getFinalDeliberationView(database, eventId)
  const rankedEntries = finalDeliberationView.entries.filter(
    (entry): entry is typeof finalDeliberationView.entries[number] & { finalRank: number } =>
      entry.finalRank !== null
  )

  if (body.orderedSubmissionIds) {
    assertFinalDeliberationReorderMatchesEntries(
      body.orderedSubmissionIds,
      rankedEntries.map(entry => ({ submissionId: entry.submissionId }))
    )
  }

  const finalRankingSubmissionIds = body.orderedSubmissionIds
    ?? (finalDeliberationView.finalRankingSubmissionIds.length > 0
      ? finalDeliberationView.finalRankingSubmissionIds
      : rankedEntries.map(entry => entry.submissionId))
  const rankedEntriesBySubmissionId = new Map(
    rankedEntries.map(entry => [entry.submissionId, entry] as const)
  )
  const winners: AnnouncedWinner[] = finalRankingSubmissionIds
    .map(submissionId => rankedEntriesBySubmissionId.get(submissionId))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry, index) => {
      const finalRank = index + 1
      const awardedPrizes = prizeList
        .filter((prize: typeof prizeList[number]) => finalRank >= prize.rankStart && finalRank <= prize.rankEnd)
        .map(serializePrize)

      return {
        teamId: entry.teamId,
        teamName: entry.teamName,
        finalRank,
        prizes: awardedPrizes
      }
    })
    .filter(entry => entry.prizes.length > 0)

  const announcedAt = new Date().toISOString()
  const redemptionRows = await buildPrizeRedemptionRows(database, eventId, prizeList, announcedAt, winners)
  const redemptionRowChunks = chunkRowsForD1(redemptionRows, 7)

  await database.batch([
    database
      .update(events)
      .set({
        state: 'winners_announced',
        publicContentRevision: sql`${events.publicContentRevision} + 1`,
        finalRankingSubmissionIdsJson: JSON.stringify(finalRankingSubmissionIds),
        updatedAt: announcedAt
      })
      .where(eq(events.id, eventId)),
    ...redemptionRowChunks.map(rows =>
      database.insert(prizeRedemptions).values(rows)
    )
  ])

  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'event',
    entityId: eventId,
    action: 'event.announce_winners',
    metadata: {
      previousState: event.state,
      nextState: 'winners_announced',
      finalRankingSubmissionIds,
      winnerCount: winners.length,
      createdPrizeRedemptionCount: redemptionRows.length
    }
  })

  await enqueueWinnerOutcomeEmails({
    h3Event,
    database,
    event: {
      id: eventId,
      name: event.name,
      slug: event.slug
    },
    winners,
    trigger: 'announce_winners',
    triggeredByUserId: actor.platformUser.id,
    announcedAt
  })

  const updatedEvent = await database.query.events.findFirst({
    where: eq(events.id, eventId)
  })

  return apiData(serializeEvent(updatedEvent!))
})

export default defineStructuredOperationApiHandler(applicationOperation)
