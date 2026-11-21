import type { H3Event } from 'h3'

import { and, eq, isNull, sql } from 'drizzle-orm'

import type { AdminEventProgram, EventProgram, ParticipantEventProgram } from '#shared/domains/events/program'
import { requirePlatformActor } from '#server/auth/actor'
import { resolveEventAuthorization } from '#server/auth/authorization'
import { getDatabase, type AppDatabase } from '#server/database/client'
import {
  eventAgendaFavorites,
  eventAgendaPrograms,
  eventFloorPlans,
  events,
  userApplications,
  users
} from '#server/database/schema'
import { getEventOrThrow, parseEventAgendaItems, requireEventAdmin } from '#server/domains/events'
import { listEventFloorPlans } from '#server/domains/events/floor-plans'
import { ApiError } from '#server/http/api-error'
import { measureRequestPhase } from '#server/http/request-timing'

type EventRecord = typeof events.$inferSelect

function approvedApplication(eventId: string, userId: string) {
  return and(
    eq(userApplications.eventId, eventId),
    eq(userApplications.userId, userId),
    eq(userApplications.status, 'approved')
  )
}

export function assertProgramViewAccess(isEventAdmin: boolean, approved: boolean) {
  if (!isEventAdmin && !approved) {
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
    where: approvedApplication(event.id, actor.platformUser.id)
  }))
  assertProgramViewAccess(authorization.isEventAdmin, Boolean(approval))
  return { actor, database, event, canSave: Boolean(approval) }
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

async function readActiveProgram(database: AppDatabase, event: EventRecord) {
  const row = await findEventProgramRow(database, event.id)
  const agendaItem = row && getProgramAgendaItem(event, row.agendaItemId)

  if (!row || !agendaItem) {
    throw new ApiError({ statusCode: 404, code: 'event_program_not_found', message: 'This agenda is unavailable.' })
  }

  return { agendaItem, row, tracks: readProgramTracks(row.tracksJson) }
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

function removeDeletedSessionFavorites(database: AppDatabase, eventId: string) {
  return database.delete(eventAgendaFavorites).where(and(
    eq(eventAgendaFavorites.eventId, eventId),
    sql`not exists (
      select 1
      from ${eventAgendaPrograms} as program
      join json_each(program.tracks_json) as track
      join json_each(track.value, '$.sessions') as session
      where program.event_id = ${eventAgendaFavorites.eventId}
        and json_extract(session.value, '$.id') = ${eventAgendaFavorites.sessionId}
    )`
  ))
}

export async function saveAdminEventProgram(h3Event: H3Event, eventId: string, program: EventProgram): Promise<AdminEventProgram> {
  const { event } = await requireEventAdmin(h3Event, eventId)
  const database = getDatabase(h3Event)
  validateProgramWindow(event, program)

  // Compare the agenda read above and the live rooms in the write itself.
  const tracksJson = JSON.stringify(program.tracks)
  const save = database.insert(eventAgendaPrograms).select(database.select({
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
  const [result] = await database.batch([save, removeDeletedSessionFavorites(database, eventId)])

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

export async function loadParticipantEventProgram({ database, event, userId, canSave }: {
  database: AppDatabase
  event: EventRecord
  userId: string
  canSave: boolean
}): Promise<ParticipantEventProgram> {
  const { agendaItem, tracks } = await readActiveProgram(database, event)
  const [floorPlans, favorites] = await Promise.all([
    listEventFloorPlans(database, event.id),
    canSave
      ? database.select({ sessionId: eventAgendaFavorites.sessionId }).from(eventAgendaFavorites).where(and(
          eq(eventAgendaFavorites.eventId, event.id),
          eq(eventAgendaFavorites.userId, userId)
        ))
      : []
  ])

  return {
    eventId: event.id,
    eventName: event.name,
    agendaItem,
    tracks,
    floorPlans,
    savedSessionIds: favorites.map(favorite => favorite.sessionId),
    canSave
  }
}

export async function writeEventProgramFavorite(h3Event: H3Event, eventId: string, sessionId: string, saved: boolean) {
  const { actor, database, event, canSave } = await requireEventProgramAccess(h3Event, eventId)
  const userId = actor.platformUser.id
  if (!canSave) {
    throw new ApiError({ statusCode: 403, code: 'event_program_access_required', message: 'Only confirmed participants can save sessions.' })
  }

  const { row, tracks } = await readActiveProgram(database, event)
  if (!tracks.some(track => track.sessions.some(session => session.id === sessionId))) {
    throw new ApiError({ statusCode: 404, code: 'event_program_session_not_found', message: 'This session is unavailable.' })
  }

  if (!saved) {
    await database.delete(eventAgendaFavorites).where(and(
      eq(eventAgendaFavorites.eventId, eventId),
      eq(eventAgendaFavorites.userId, userId),
      eq(eventAgendaFavorites.sessionId, sessionId)
    ))
    return { saved }
  }

  const candidate = database.select({
    eventId: eventAgendaPrograms.eventId,
    userId: sql<string>`${userId}`.as('userId'),
    sessionId: sql<string>`${sessionId}`.as('sessionId')
  }).from(eventAgendaPrograms)
    .innerJoin(userApplications, approvedApplication(eventId, userId))
    .innerJoin(users, and(eq(users.id, userId), isNull(users.deletedAt)))
    .where(and(
      eq(eventAgendaPrograms.eventId, eventId),
      eq(eventAgendaPrograms.agendaItemId, row.agendaItemId),
      eq(eventAgendaPrograms.tracksJson, row.tracksJson)
    ))
  const result = await database.insert(eventAgendaFavorites).select(candidate.getSQL()).onConflictDoUpdate({
    target: [eventAgendaFavorites.eventId, eventAgendaFavorites.userId, eventAgendaFavorites.sessionId],
    set: { sessionId }
  })

  if (!result.meta.changes) {
    throw new ApiError({ statusCode: 409, code: 'event_program_changed', message: 'This agenda changed. Refresh and try again.' })
  }

  return { saved }
}
