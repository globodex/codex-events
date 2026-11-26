import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'

import { canReadEventChallenges, parseEventChallengesJson } from '#shared/domains/events/challenges'
import { requirePlatformActor } from '#server/auth/actor'
import { resolveEventAuthorization, type EventAuthorization } from '#server/auth/authorization'
import { getDatabase } from '#server/database/client'
import { userApplications, type events } from '#server/database/schema'
import { getEventOrThrow, getVisibleEventOrThrow } from '#server/domains/events'
import type { DeckEditor } from '#server/domains/events/decks'
import { ApiError } from '#server/http/api-error'

type EventRecord = typeof events.$inferSelect
type ApplicationRecord = typeof userApplications.$inferSelect

/** The published challenges and open tracks of the event in display order, without drafts. */
export function listPublishedEventChallenges(event: Pick<EventRecord, 'challengesJson'>) {
  return parseEventChallengesJson(event.challengesJson).filter(challenge => challenge.isPublished)
}

/**
 * The challenges that a participant page gives one person: the published challenges of the
 * event in display order for a person who may read them, and no challenge for everyone else.
 *
 * Every server path that sends challenges to a participant page asks this function. That way
 * nobody receives a challenge they may not read, and nobody receives a draft. The function reads
 * the stored event and registration and applies the one shared rule, `canReadEventChallenges`.
 *
 * Drafts leave the server only inside the admin event (`serializeAdminEvent`), for the event
 * builder.
 */
export function listReadableEventChallenges(reader: {
  event: EventRecord
  authorization: Pick<EventAuthorization, 'isEventAdmin' | 'isStaff'>
  /** The person's registration of this event in any status, when they have one. */
  application: ApplicationRecord | null | undefined
}) {
  const { event, authorization, application } = reader
  const mayRead = canReadEventChallenges({
    // A platform admin is an event admin of every event.
    isEventStaffOrAdmin: authorization.isEventAdmin || authorization.isStaff,
    isApprovedParticipant: application?.status === 'approved'
  })

  if (!mayRead) {
    return []
  }

  const challenges = listPublishedEventChallenges(event)
  // The staff instructions are for the event team only.
  return authorization.isEventAdmin || authorization.isStaff
    ? challenges
    : challenges.map(({ staffInstructions: _staffInstructions, ...challenge }) => challenge)
}

/** Event admins and the staff members who support a challenge edit its page (`decks.ts`). */
export function canEditChallengeDeck(
  authorization: Pick<EventAuthorization, 'isEventAdmin' | 'isStaff' | 'staffChallengeId'>,
  challengeId: string
) {
  return authorization.isEventAdmin || (authorization.isStaff && authorization.staffChallengeId === challengeId)
}

function challengeNotFound() {
  return new ApiError({ statusCode: 404, code: 'challenge_not_found', message: 'Challenge not found.' })
}

/** An event admin, or a staff member who supports this challenge. The challenge may still be a draft. */
export async function requireChallengeEditor(h3Event: H3Event, eventId: string, challengeId: string): Promise<DeckEditor> {
  const actor = await requirePlatformActor(h3Event)
  const database = getDatabase(h3Event)
  const [authorization, event] = await Promise.all([
    resolveEventAuthorization(h3Event, eventId),
    getEventOrThrow(database, eventId)
  ])

  if (!parseEventChallengesJson(event.challengesJson).some(challenge => challenge.id === challengeId)) {
    throw challengeNotFound()
  }
  if (!canEditChallengeDeck(authorization, challengeId)) {
    throw new ApiError({
      statusCode: 403,
      code: 'challenge_edit_forbidden',
      message: 'Only the staff of this challenge and the event admins can change its page.'
    })
  }
  return { database, actorUserId: actor.platformUser.id }
}

/** A person who may read this published challenge (`listReadableEventChallenges`). */
export async function requireChallengeReader(h3Event: H3Event, eventId: string, challengeId: string) {
  const actor = await requirePlatformActor(h3Event)
  const database = getDatabase(h3Event)
  const [authorization, event, application] = await Promise.all([
    resolveEventAuthorization(h3Event, eventId),
    getVisibleEventOrThrow(h3Event, eventId),
    database.query.userApplications.findFirst({
      where: and(eq(userApplications.eventId, eventId), eq(userApplications.userId, actor.platformUser.id))
    })
  ])

  if (!listReadableEventChallenges({ event, authorization, application }).some(challenge => challenge.id === challengeId)) {
    throw challengeNotFound()
  }
  return database
}
