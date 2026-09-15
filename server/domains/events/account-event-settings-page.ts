import { and, asc, desc, eq, getTableColumns, or } from 'drizzle-orm'

import type { AccountEventSettingsPage } from '#shared/domains/events/account-event-settings-page'
import {
  parseEventAgendaItems,
  serializeAdminEvent,
  serializeEventRoleAssignment,
  serializeEventTermsDocument,
  serializeEvaluationCriterion,
  serializePrize,
  listEventTracks
} from '#server/domains/events'
import { assertEventAdminAccess } from '#server/auth/authorization'
import {
  evaluationCriteria,
  eventRoleAssignments,
  eventTermsDocuments,
  prizes,
  talkProposals,
  users
} from '#server/database/schema'
import { getSimplifiedClaimingSummary } from '#server/domains/credits/simplified-claiming'
import { listAdminEventCreditOfferSummaries } from '#server/domains/credits'
import { getEventDisplayImageOptions } from '#server/domains/platform/settings'
import { defineAccountEventPageRoute } from './account-event-page-contract'
import { accountEventSettingsPageSchema } from '#shared/domains/events/account-event-settings-page'

const settingsTermsVersionLimit = 25
type EventTermsDocumentRecord = typeof eventTermsDocuments.$inferSelect

const emptySimplifiedClaimingSummary = {
  ready: false,
  locked: false,
  issues: [] as Array<{ code: string, message: string }>,
  attendeeCount: 0,
  offerCount: 0,
  ordinaryOfferCount: 0,
  totalInventoryCount: 0,
  availableInventoryCount: 0,
  genericClaimCount: 0,
  simplifiedClaimCount: 0,
  offers: []
}

function isJudgeAssignment(assignment: typeof eventRoleAssignments.$inferSelect) {
  return assignment.role === 'judge'
    || (assignment.role === 'event_admin' && assignment.isInJudgePool)
}

function isStaffAssignment(assignment: typeof eventRoleAssignments.$inferSelect) {
  return assignment.role === 'staff'
    || (assignment.role === 'event_admin' && assignment.isStaff)
}

function getTermsByType(
  documents: Array<EventTermsDocumentRecord>,
  documentType: EventTermsDocumentRecord['documentType'],
  currentId: string | null
) {
  const typedDocuments = documents.filter(document => document.documentType === documentType)
  const current = typedDocuments.find(document => document.id === currentId) ?? null

  return {
    current: current ? serializeEventTermsDocument(current) : null,
    versions: typedDocuments
      .filter(document => document.id !== current?.id)
      .map(document => serializeEventTermsDocument(document))
      .map(({ content: _content, ...summary }) => summary)
  }
}

export const accountEventSettingsPageRoute = defineAccountEventPageRoute({
  page: 'settings',
  schema: accountEventSettingsPageSchema,
  authorize: async (context) => {
    assertEventAdminAccess(context.authorization)
  },
  load: async (context): Promise<AccountEventSettingsPage> => {
    const event = context.event

    const [
      tracks,
      criteria,
      prizeRows,
      assignments,
      relatedUsers,
      currentTerms,
      applicationTermVersions,
      winnerTermVersions,
      imageOptions,
      credits,
      simplifiedClaimingSummary,
      existingTalkProposals
    ] = await Promise.all([
      listEventTracks(context.database, event.id),
      event.eventType === 'hackathon'
        ? context.database.query.evaluationCriteria.findMany({
            where: eq(evaluationCriteria.eventId, event.id),
            orderBy: [asc(evaluationCriteria.displayOrder)]
          })
        : Promise.resolve([]),
      event.eventType === 'hackathon'
        ? context.database.query.prizes.findMany({
            where: eq(prizes.eventId, event.id),
            orderBy: [asc(prizes.displayOrder), asc(prizes.rankEnd), desc(prizes.rankStart), asc(prizes.createdAt)]
          })
        : Promise.resolve([]),
      context.database.query.eventRoleAssignments.findMany({
        where: eq(eventRoleAssignments.eventId, event.id),
        orderBy: [asc(eventRoleAssignments.createdAt)]
      }),
      context.database
        .select(getTableColumns(users))
        .from(users)
        .innerJoin(eventRoleAssignments, eq(eventRoleAssignments.userId, users.id))
        .where(eq(eventRoleAssignments.eventId, event.id)),
      context.database.query.eventTermsDocuments.findMany({
        where: and(
          eq(eventTermsDocuments.eventId, event.id),
          or(
            eq(eventTermsDocuments.id, event.currentApplicationTermsDocumentId ?? ''),
            eq(eventTermsDocuments.id, event.currentWinnerTermsDocumentId ?? '')
          )
        )
      }),
      context.database.query.eventTermsDocuments.findMany({
        where: and(
          eq(eventTermsDocuments.eventId, event.id),
          eq(eventTermsDocuments.documentType, 'application_terms')
        ),
        orderBy: [desc(eventTermsDocuments.version)],
        limit: settingsTermsVersionLimit
      }),
      context.database.query.eventTermsDocuments.findMany({
        where: and(
          eq(eventTermsDocuments.eventId, event.id),
          eq(eventTermsDocuments.documentType, 'winner_terms')
        ),
        orderBy: [desc(eventTermsDocuments.version)],
        limit: settingsTermsVersionLimit
      }),
      getEventDisplayImageOptions(context.database),
      listAdminEventCreditOfferSummaries(context.database, event.id),
      event.eventType === 'meetup'
        ? getSimplifiedClaimingSummary(context.database, event)
        : Promise.resolve(emptySimplifiedClaimingSummary),
      context.database.query.talkProposals.findMany({
        columns: { id: true },
        where: eq(talkProposals.eventId, event.id),
        limit: 1
      })
    ])

    const userById = new Map(relatedUsers.map(user => [user.id, user]))
    const serializedAssignments = assignments.map(assignment =>
      serializeEventRoleAssignment(assignment, userById.get(assignment.userId) ?? null)
    )
    const applicationDocuments = getTermsByType(
      [...currentTerms, ...applicationTermVersions],
      'application_terms',
      event.currentApplicationTermsDocumentId
    )
    const winnerDocuments = getTermsByType(
      [...currentTerms, ...winnerTermVersions],
      'winner_terms',
      event.currentWinnerTermsDocumentId
    )
    const serializedEvent = serializeAdminEvent(
      event,
      undefined,
      tracks,
      {
        appBaseUrl: '',
        ...imageOptions
      }
    )
    const eventPayload = {
      ...serializedEvent,
      tracks: serializedEvent.tracks ?? [],
      displayBackgroundImageRevision: serializedEvent.displayBackgroundImageRevision == null
        ? serializedEvent.displayBackgroundImageRevision
        : Number(serializedEvent.displayBackgroundImageRevision)
    }
    const agendaItems = parseEventAgendaItems(event.agendaItemsJson)
    const typedAgendaBlockCount = agendaItems.filter(item => Boolean(item.builderBlockType)).length

    return {
      event: eventPayload,
      criteria: criteria.map(serializeEvaluationCriterion),
      prizes: prizeRows.map(serializePrize),
      terms: {
        application: applicationDocuments,
        winner: winnerDocuments
      },
      roles: {
        assignments: serializedAssignments,
        counts: {
          admins: assignments.filter(assignment => assignment.role === 'event_admin').length,
          staff: assignments.filter(isStaffAssignment).length,
          judges: assignments.filter(isJudgeAssignment).length
        }
      },
      credits,
      simplifiedClaiming: {
        enabled: event.simplifiedClaimingEnabled,
        redemptionUrl: `/events/${event.slug}/redeem`,
        ...simplifiedClaimingSummary
      },
      talkProposals: {
        hasExistingProposal: existingTalkProposals.length > 0
      },
      builder: {
        creationFlow: event.creationFlow,
        agendaBlockCount: agendaItems.length,
        typedAgendaBlockCount,
        balanceScore: event.balanceScore,
        balanceBreakdown: eventPayload.balanceBreakdown ?? null
      }
    }
  }
})
