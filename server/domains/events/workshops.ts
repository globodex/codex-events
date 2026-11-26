import type { H3Event } from 'h3'

import { eq } from 'drizzle-orm'

import { emptyDeck } from '#shared/domains/events/decks'
import type { AgendaWorkshop, EventProgram } from '#shared/domains/events/program'
import { requirePlatformActor } from '#server/auth/actor'
import { resolveEventAuthorization } from '#server/auth/authorization'
import { getDatabase, type AppDatabase } from '#server/database/client'
import { eventAgendaPrograms } from '#server/database/schema'
import { listPublishedEventRosterMembers } from '#server/domains/events'
import { loadEventDecks, type DeckEditor } from '#server/domains/events/decks'
import { ApiError } from '#server/http/api-error'

// A workshop is a program session with staff. Its page shows its deck (`decks.ts`), which its staff
// and the event admins edit. Only people who read the program open the page and its PDFs.

/** The program session with this id, when it is a workshop: a session with staff. */
export async function findWorkshopSession(database: AppDatabase, eventId: string, sessionId: string) {
  const row = await database.select({ tracksJson: eventAgendaPrograms.tracksJson })
    .from(eventAgendaPrograms)
    .where(eq(eventAgendaPrograms.eventId, eventId))
    .get()
  const tracks = row ? JSON.parse(row.tracksJson) as EventProgram['tracks'] : []
  const session = tracks.flatMap(track => track.sessions).find(candidate => candidate.id === sessionId)

  if (!session?.staffIds?.length) {
    throw new ApiError({ statusCode: 404, code: 'workshop_not_found', message: 'Workshop not found.' })
  }
  return { ...session, staffIds: session.staffIds }
}

/**
 * The workshops of a program as the Agenda tab shows them, in program order. Only people on the
 * staff roster of the event appear as its staff. An event admin and the staff of a workshop may
 * edit it.
 */
export async function loadAgendaWorkshops(
  database: AppDatabase,
  eventId: string,
  tracks: EventProgram['tracks'],
  viewer: { userId: string, isEventAdmin: boolean }
): Promise<AgendaWorkshop[]> {
  const sessions = tracks.flatMap(track => track.sessions).filter(session => session.staffIds?.length)
  if (!sessions.length) {
    return []
  }

  const [decks, roster] = await Promise.all([
    loadEventDecks(database, eventId, 'workshop'),
    listPublishedEventRosterMembers(database, eventId, 'staff')
  ])
  const rosterById = new Map(roster.map(member => [member.id, member]))

  return sessions.map((session) => {
    const staff = (session.staffIds ?? []).flatMap((staffId) => {
      const member = rosterById.get(staffId)
      return member ? [{ id: member.id, fullName: member.fullName, profileIconRevision: member.profileIconRevision }] : []
    })
    const canEdit = viewer.isEventAdmin || staff.some(member => member.id === viewer.userId)

    return { sessionId: session.id, staff, deck: { ...(decks.get(session.id) ?? emptyDeck), canEdit } }
  })
}

/** An event admin, or a member of the staff of the workshop who is still on the event staff. */
export async function requireWorkshopEditor(h3Event: H3Event, eventId: string, sessionId: string): Promise<DeckEditor> {
  const actor = await requirePlatformActor(h3Event)
  const database = getDatabase(h3Event)
  const [authorization, session] = await Promise.all([
    resolveEventAuthorization(h3Event, eventId),
    findWorkshopSession(database, eventId, sessionId)
  ])
  const isWorkshopStaff = authorization.isStaff && session.staffIds.includes(actor.platformUser.id)

  if (!authorization.isEventAdmin && !isWorkshopStaff) {
    throw new ApiError({
      statusCode: 403,
      code: 'workshop_edit_forbidden',
      message: 'Only the staff of this workshop and the event admins can change it.'
    })
  }
  return { database, actorUserId: actor.platformUser.id }
}
