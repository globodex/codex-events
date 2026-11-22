import type { H3Event } from 'h3'

import { and, eq, sql } from 'drizzle-orm'

import type { AdminEventProgram, EventProgram, ParticipantEventProgram } from '#shared/domains/events/program'
import { requirePlatformActor } from '#server/auth/actor'
import { resolveEventAuthorization } from '#server/auth/authorization'
import { getDatabase, type AppDatabase } from '#server/database/client'
import { eventAgendaPrograms, eventFloorPlans, events, userApplications } from '#server/database/schema'
import { getEventOrThrow, parseEventAgendaItems, requireEventAdmin } from '#server/domains/events'
import { listEventFloorPlans } from '#server/domains/events/floor-plans'
import { ApiError } from '#server/http/api-error'
import { measureRequestPhase } from '#server/http/request-timing'

type EventRecord = typeof events.$inferSelect

/** Event admins and confirmed participants read the program. */
export function canViewEventProgram(isEventAdmin: boolean, approved: boolean) {
  return isEventAdmin || approved
}

export function assertProgramViewAccess(isEventAdmin: boolean, approved: boolean) {
  if (!canViewEventProgram(isEventAdmin, approved)) {
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
  assertProgramViewAccess(authorization.isEventAdmin, Boolean(approval))
  return database
}

function findEventProgramRow(database: AppDatabase, eventId: string) {
  return database.select().from(eventAgendaPrograms)
    .where(eq(eventAgendaPrograms.eventId, eventId)).get()
}

export async function findEventProgramItemId(database: AppDatabase, eventId: string) {
  const row = await database.select({ agendaItemId: eventAgendaPrograms.agendaItemId })
    .from(eventAgendaPrograms).where(eq(eventAgendaPrograms.eventId, eventId)).get()
  return row?.agendaItemId ?? null
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

export async function readAdminEventProgram(h3Event: H3Event, eventId: string): Promise<AdminEventProgram> {
  await requireEventAdmin(h3Event, eventId)
  const database = getDatabase(h3Event)
  const [row, floorPlans] = await Promise.all([
    findEventProgramRow(database, eventId),
    listEventFloorPlans(database, eventId)
  ])

  const program = row ? { agendaItemId: row.agendaItemId, tracks: readProgramTracks(row.tracksJson) } : null
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

function availableProgramRooms(eventId: string, tracksJson: string) {
  return sql`not exists (
    select 1
    from json_each(${tracksJson}) as track
    join json_each(track.value, '$.sessions') as session
    where json_type(session.value, '$.room') = 'object'
      and not exists (
        select 1
        from ${eventFloorPlans} as plan
        join json_each(plan.rooms_json) as room
        where plan.event_id = ${eventId}
          and plan.id = json_extract(session.value, '$.room.floorPlanId')
          and json_extract(room.value, '$.id') = json_extract(session.value, '$.room.roomId')
      )
  )`
}

export async function saveAdminEventProgram(h3Event: H3Event, eventId: string, program: EventProgram): Promise<AdminEventProgram> {
  const { event } = await requireEventAdmin(h3Event, eventId)
  const database = getDatabase(h3Event)
  validateProgramWindow(event, program)

  // Compare the agenda read above and the live rooms in the write itself.
  const tracksJson = JSON.stringify(program.tracks)
  const result = await database.insert(eventAgendaPrograms).select(database.select({
    eventId: events.id,
    agendaItemId: sql<string>`${program.agendaItemId}`.as('agendaItemId'),
    tracksJson: sql<string>`${tracksJson}`.as('tracksJson')
  }).from(events).where(and(
    eq(events.id, eventId),
    eq(events.agendaItemsJson, event.agendaItemsJson),
    availableProgramRooms(eventId, tracksJson)
  )).getSQL()).onConflictDoUpdate({
    target: eventAgendaPrograms.eventId,
    set: { agendaItemId: program.agendaItemId, tracksJson }
  })

  if (!result.meta.changes) {
    throw new ApiError({ statusCode: 409, code: 'event_program_changed', message: 'The agenda or a selected room changed. Refresh and try again.' })
  }

  return { program, floorPlans: await listEventFloorPlans(database, eventId) }
}

export async function deleteAdminEventProgram(h3Event: H3Event, eventId: string): Promise<AdminEventProgram> {
  await requireEventAdmin(h3Event, eventId)
  const database = getDatabase(h3Event)
  await database.delete(eventAgendaPrograms).where(eq(eventAgendaPrograms.eventId, eventId))
  return { program: null, floorPlans: await listEventFloorPlans(database, eventId) }
}

/** The event's program for a person who may read it, or null when the event has none. */
export async function loadParticipantEventProgram(database: AppDatabase, event: EventRecord): Promise<ParticipantEventProgram | null> {
  const row = await findEventProgramRow(database, event.id)
  const agendaItem = row && getProgramAgendaItem(event, row.agendaItemId)
  if (!row || !agendaItem) {
    return null
  }

  return {
    eventId: event.id,
    eventName: event.name,
    agendaItem,
    tracks: readProgramTracks(row.tracksJson),
    floorPlans: await listEventFloorPlans(database, event.id)
  }
}
