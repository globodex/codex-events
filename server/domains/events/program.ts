import type { H3Event } from 'h3'

import { and, eq, sql } from 'drizzle-orm'

import type {
  AdminEventProgram,
  EventProgram,
  ParticipantEventProgram,
  PublicProgramSessions
} from '#shared/domains/events/program'
import { canViewEventProgram, countProgramSessions } from '#shared/domains/events/program'
import { requirePlatformActor } from '#server/auth/actor'
import { resolveEventAuthorization } from '#server/auth/authorization'
import { getDatabase, type AppDatabase } from '#server/database/client'
import { eventAgendaPrograms, eventFloorPlans, events, userApplications } from '#server/database/schema'
import { getEventOrThrow, listPublishedEventRosterMembers, parseEventAgendaItems, requireEventAdmin } from '#server/domains/events'
import { agendaItemRoomJoins, listEventFloorPlans, sessionRoomJoins } from '#server/domains/events/floor-plans'
import { loadAgendaWorkshops } from '#server/domains/events/workshops'
import { ApiError } from '#server/http/api-error'
import { measureRequestPhase } from '#server/http/request-timing'

type EventRecord = typeof events.$inferSelect

export function assertProgramViewAccess(reader: Parameters<typeof canViewEventProgram>[0]) {
  if (!canViewEventProgram(reader)) {
    throw new ApiError({ statusCode: 403, code: 'event_program_access_required', message: 'Only confirmed participants can open this agenda.' })
  }
}

export async function requireEventProgramAccess(h3Event: H3Event, eventId: string) {
  const actor = await measureRequestPhase(h3Event, 'actor', () => requirePlatformActor(h3Event))
  const database = await measureRequestPhase(h3Event, 'd1', () => getDatabase(h3Event))
  const event = await measureRequestPhase(h3Event, 'd1', () => getEventOrThrow(database, eventId))

  const authorization = await measureRequestPhase(h3Event, 'authorization', () => resolveEventAuthorization(h3Event, event.id))
  if (!authorization.isEventAdmin && (event.hiddenAt || (event.state === 'draft' && authorization.explicitRole !== 'staff'))) {
    throw new ApiError({ statusCode: 404, code: 'event_not_found', message: 'The requested event was not found.' })
  }

  const approval = await measureRequestPhase(h3Event, 'd1', () => database.query.userApplications.findFirst({
    columns: { id: true },
    where: and(
      eq(userApplications.eventId, event.id),
      eq(userApplications.userId, actor.platformUser.id),
      eq(userApplications.status, 'approved')
    )
  }))
  assertProgramViewAccess({ isEventAdmin: authorization.isEventAdmin, isStaff: authorization.isStaff, approved: Boolean(approval) })
  return database
}

function findEventProgramRow(database: AppDatabase, eventId: string) {
  return database.select().from(eventAgendaPrograms)
    .where(eq(eventAgendaPrograms.eventId, eventId)).get()
}

function getProgramAgendaItem(event: EventRecord, agendaItemId: string) {
  const item = parseEventAgendaItems(event.agendaItemsJson).find(item => item.id === agendaItemId)
  if (!item?.endsAt || Date.parse(item.endsAt) <= Date.parse(item.startsAt)) {
    return null
  }

  return { id: item.id, title: item.title, startsAt: item.startsAt, endsAt: item.endsAt }
}

function readProgramTracks(tracksJson: string): EventProgram['tracks'] {
  return JSON.parse(tracksJson) as EventProgram['tracks']
}

function readAgendaItemRooms(agendaItemRoomsJson: string): EventProgram['agendaItemRooms'] {
  return JSON.parse(agendaItemRoomsJson) as EventProgram['agendaItemRooms']
}

/** The sessions in the rooms of an event. The event builder shows the number on a tile. */
export async function countEventProgramSessions(database: AppDatabase, eventId: string) {
  const row = await findEventProgramRow(database, eventId)

  return row ? countProgramSessions({ tracks: readProgramTracks(row.tracksJson) }) : 0
}

// The public event page lists the public sessions of the program. So every write of the program
// also rotates the revision of the public event content.
function rotatePublicContentRevision(database: AppDatabase, eventId: string) {
  return database.update(events)
    .set({ publicContentRevision: sql`${events.publicContentRevision} + 1` })
    .where(eq(events.id, eventId))
}

export async function readAdminEventProgram(h3Event: H3Event, eventId: string): Promise<AdminEventProgram> {
  await requireEventAdmin(h3Event, eventId)
  const database = getDatabase(h3Event)
  const [row, floorPlans] = await Promise.all([
    findEventProgramRow(database, eventId),
    listEventFloorPlans(database, eventId)
  ])

  const program = row
    ? { agendaItemId: row.agendaItemId, tracks: readProgramTracks(row.tracksJson), agendaItemRooms: readAgendaItemRooms(row.agendaItemRoomsJson) }
    : null
  return { program, floorPlans }
}

function validateProgramWindow(event: EventRecord, program: EventProgram) {
  const agendaItem = getProgramAgendaItem(event, program.agendaItemId)
  if (!agendaItem) {
    throw new ApiError({ statusCode: 400, code: 'event_program_parent_required', message: 'Choose an agenda item with a start and end time.' })
  }

  const availableMinutes = (Date.parse(agendaItem.endsAt) - Date.parse(agendaItem.startsAt)) / 60_000
  for (const { sessions } of program.tracks) {
    for (const session of sessions) {
      if (session.startsAfterMinutes + session.durationMinutes > availableMinutes) {
        throw new ApiError({ statusCode: 400, code: 'event_program_session_outside_window', message: 'Each session must fit within the selected agenda item.' })
      }
    }
  }
}

// The staff of a session must be on the staff roster of the event.
async function validateProgramStaff(database: AppDatabase, eventId: string, program: EventProgram) {
  const sessionStaffIds = program.tracks.flatMap(track => track.sessions.flatMap(session => session.staffIds ?? []))
  if (!sessionStaffIds.length) {
    return
  }

  const rosterIds = new Set((await listPublishedEventRosterMembers(database, eventId, 'staff')).map(member => member.id))
  if (sessionStaffIds.some(staffId => !rosterIds.has(staffId))) {
    throw new ApiError({ statusCode: 400, code: 'event_program_staff_unknown', message: 'Pick the staff of a session from the staff of the event.' })
  }
}

function availableProgramRooms(eventId: string, tracksJson: string, agendaItemRoomsJson: string) {
  // A place whose room is on no floor plan of the event.
  const missingRoom = sql`json_type(place.value) = 'object'
    and not exists (
      select 1
      from ${eventFloorPlans} as plan
      join json_each(plan.rooms_json) as room
      where plan.event_id = ${eventId}
        and plan.id = json_extract(place.value, '$.floorPlanId')
        and json_extract(room.value, '$.id') = json_extract(place.value, '$.roomId')
    )`

  return sql`not exists (select 1 from ${sessionRoomJoins(tracksJson)} where ${missingRoom})
    and not exists (select 1 from ${agendaItemRoomJoins(agendaItemRoomsJson)} where ${missingRoom})`
}

export async function saveAdminEventProgram(h3Event: H3Event, eventId: string, program: EventProgram): Promise<AdminEventProgram> {
  const { event } = await requireEventAdmin(h3Event, eventId)
  const database = getDatabase(h3Event)
  validateProgramWindow(event, program)
  await validateProgramStaff(database, eventId, program)

  // Compare the agenda read above and the live rooms in the write itself.
  const tracksJson = JSON.stringify(program.tracks)
  const agendaItemRoomsJson = JSON.stringify(program.agendaItemRooms)
  const saveProgram = database.insert(eventAgendaPrograms).select(database.select({
    eventId: events.id,
    agendaItemId: sql<string>`${program.agendaItemId}`.as('agendaItemId'),
    tracksJson: sql<string>`${tracksJson}`.as('tracksJson'),
    agendaItemRoomsJson: sql<string>`${agendaItemRoomsJson}`.as('agendaItemRoomsJson')
  }).from(events).where(and(
    eq(events.id, eventId),
    eq(events.agendaItemsJson, event.agendaItemsJson),
    availableProgramRooms(eventId, tracksJson, agendaItemRoomsJson)
  )).getSQL()).onConflictDoUpdate({
    target: eventAgendaPrograms.eventId,
    set: { agendaItemId: program.agendaItemId, tracksJson, agendaItemRoomsJson }
  })
  // One D1 mutation, so the program and the revision change together. When the agenda or a room
  // changed in the meantime, the program is not written and the revision still rotates. That
  // only makes the public caches read the unchanged event once more.
  const [result] = await database.batch([saveProgram, rotatePublicContentRevision(database, eventId)])

  if (!result.meta.changes) {
    throw new ApiError({ statusCode: 409, code: 'event_program_changed', message: 'The agenda or a selected room changed. Refresh and try again.' })
  }

  return { program, floorPlans: await listEventFloorPlans(database, eventId) }
}

export async function deleteAdminEventProgram(h3Event: H3Event, eventId: string): Promise<AdminEventProgram> {
  await requireEventAdmin(h3Event, eventId)
  const database = getDatabase(h3Event)
  await database.batch([
    database.delete(eventAgendaPrograms).where(eq(eventAgendaPrograms.eventId, eventId)),
    rotatePublicContentRevision(database, eventId)
  ])
  return { program: null, floorPlans: await listEventFloorPlans(database, eventId) }
}

/**
 * The sessions as one person sees them.
 *
 * A session can have a second title and room for participants who are checked in
 * (`afterCheckIn`). A checked-in participant gets that version, without the details, which belong
 * to the first version. Every other person gets the first version. The answer never holds
 * `afterCheckIn`: a person sees one version of a session.
 */
function showTracksTo(tracks: EventProgram['tracks'], viewer: { isCheckedIn: boolean }): EventProgram['tracks'] {
  return tracks.map(track => ({
    ...track,
    sessions: track.sessions.map(({ afterCheckIn, ...session }) => {
      return viewer.isCheckedIn && afterCheckIn
        ? { ...session, title: afterCheckIn.title, room: afterCheckIn.room, details: null }
        : session
    })
  }))
}

/**
 * The event's program for a person who may read it, or null when the event has none.
 * `viewer.isCheckedIn` is true only for a participant who is checked in. `viewer.userId` and
 * `viewer.isEventAdmin` decide which workshops the viewer may edit.
 */
export async function loadParticipantEventProgram(
  database: AppDatabase,
  event: EventRecord,
  viewer: { isCheckedIn: boolean, userId: string, isEventAdmin: boolean }
): Promise<ParticipantEventProgram | null> {
  const row = await findEventProgramRow(database, event.id)
  const agendaItem = row && getProgramAgendaItem(event, row.agendaItemId)
  if (!row || !agendaItem) {
    return null
  }

  const tracks = readProgramTracks(row.tracksJson)
  const [floorPlans, workshops] = await Promise.all([
    listEventFloorPlans(database, event.id),
    loadAgendaWorkshops(database, event.id, tracks, viewer)
  ])

  return {
    eventId: event.id,
    eventName: event.name,
    agendaItem,
    tracks: showTracksTo(tracks, viewer),
    agendaItemRooms: readAgendaItemRooms(row.agendaItemRoomsJson),
    floorPlans,
    workshops
  }
}

/**
 * The sessions that the organizer marked as public, in the order of their start, or null when
 * the event has no public session.
 *
 * A public session gives its own title and its start time. It never gives the room, the details
 * or the version for checked-in participants (`afterCheckIn`).
 */
export async function loadPublicProgramSessions(
  database: AppDatabase,
  event: EventRecord
): Promise<PublicProgramSessions | null> {
  const row = await findEventProgramRow(database, event.id)
  const agendaItem = row && getProgramAgendaItem(event, row.agendaItemId)
  if (!row || !agendaItem) {
    return null
  }

  const blockStart = Date.parse(agendaItem.startsAt)
  const sessions = readProgramTracks(row.tracksJson)
    .flatMap(track => track.sessions)
    .filter(session => session.isPublic)
    .toSorted((left, right) => left.startsAfterMinutes - right.startsAfterMinutes)
    .map(session => ({
      id: session.id,
      title: session.title,
      startsAt: new Date(blockStart + session.startsAfterMinutes * 60_000).toISOString()
    }))

  return sessions.length ? { agendaItemId: agendaItem.id, sessions } : null
}
