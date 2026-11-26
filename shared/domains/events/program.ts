import { z } from 'zod'

import { eventChallengeSchema } from '#shared/domains/events/challenges'
import { deckSchema } from '#shared/domains/events/decks'

const id = z.string().trim().min(1).max(100)
const name = z.string().trim().min(1).max(120)
const coordinate = z.number().min(0).max(1)
const maxProgramMinutes = 31 * 24 * 60

export const floorPlanRoomAreaSchema = z.object({
  x: coordinate,
  y: coordinate,
  width: coordinate.positive(),
  height: coordinate.positive(),
  // Degrees the rectangle is turned clockwise around its center. An upright rectangle has 0.
  rotation: z.number().min(-180).max(180).default(0)
}).refine(({ x, y, width, height }) =>
  x + width <= 1 + Number.EPSILON && y + height <= 1 + Number.EPSILON,
{ message: 'Keep the room area inside the floor plan.' })

const floorPlanPointSchema = z.object({ x: coordinate, y: coordinate })
// The way to a room, as points on the floor plan image from a starting point, such as an
// entrance, to the room.
const floorPlanRouteSchema = z.array(floorPlanPointSchema).min(2).max(40)
export const maxRoomRoutes = 4

export const programRoomSchema = z.object({
  id,
  name,
  // The room's number at the venue, as its door sign or the venue's own map shows it. The
  // participant map writes it under the room name.
  number: z.string().trim().min(1).max(30).optional(),
  // The challenge that takes place in the room, by its id in the event's challenge list
  // (`shared/domains/events/challenges.ts`). The Agenda tab names this room on the card of that
  // challenge, and selecting the card shows the room on the map. Several rooms can name one
  // challenge. An id that names no published challenge shows nothing.
  challengeId: z.string().trim().min(1).max(64).optional(),
  area: floorPlanRoomAreaSchema,
  // The ways to the room, one from each starting point. A room that people reach from two
  // entrances can have a route from each entrance.
  routes: z.array(floorPlanRouteSchema).min(1).max(maxRoomRoutes).optional()
})

export const eventFloorPlanMetadataSchema = z.object({
  name,
  rooms: z.array(programRoomSchema).max(100)
}).refine(({ rooms }) => new Set(rooms.map(room => room.id)).size === rooms.length, {
  path: ['rooms'],
  message: 'Room IDs must be unique within a floor plan.'
})

// A room on one of the event's floor plans.
const sessionRoomSchema = z.object({ floorPlanId: id, roomId: id })

const programSessionSchema = z.object({
  id,
  title: name,
  details: z.string().trim().max(2000).nullable(),
  startsAfterMinutes: z.int().min(0).max(maxProgramMinutes),
  durationMinutes: z.int().min(1).max(maxProgramMinutes),
  room: sessionRoomSchema.nullable(),
  // A second title and room for participants who are checked in. A checked-in participant sees
  // them in place of the title and room above and sees no details. Nobody else sees them.
  // Example: "Doors open and check-in" becomes "Breakfast" in the breakfast room.
  afterCheckIn: z.object({
    title: z.string().trim().min(1, 'Enter the title after check-in.').max(120),
    room: sessionRoomSchema.nullable()
  }).optional(),
  // True when the public event page lists this session under its agenda block, with its start
  // time and its title. A session without this mark is for people who read the program only.
  // The room, the details and the version after check-in are never public.
  isPublic: z.boolean().optional(),
  // The members of the event staff who run this session, by user id. A session with staff is a
  // workshop: it has its own page on the Agenda tab, where its staff and the event admins add a
  // description, slides, materials and links (`workshops.ts`).
  staffIds: z.array(id).max(10)
    .refine(ids => new Set(ids).size === ids.length, 'Pick each staff member once.')
    .optional()
})

const programTrackSchema = z.object({
  id,
  name,
  sessions: z.array(programSessionSchema).max(100)
}).refine(({ sessions }) => {
  const ordered = sessions.toSorted((left, right) => left.startsAfterMinutes - right.startsAfterMinutes)
  return ordered.every((session, index) => {
    const previous = ordered[index - 1]
    return !previous || previous.startsAfterMinutes + previous.durationMinutes <= session.startsAfterMinutes
  })
}, { path: ['sessions'], message: 'Sessions in the same track cannot overlap.' })

// The room of a public agenda block outside the program, for example the check-in before it.
// Selecting the block on the Agenda tab shows the room and the routes to it. Like the rooms of
// sessions, it is private to the people who read the program.
const agendaItemRoomSchema = z.object({ agendaItemId: id, room: sessionRoomSchema })

export const eventProgramSchema = z.object({
  agendaItemId: id,
  tracks: z.array(programTrackSchema).min(1).max(16),
  // An entry whose agenda block is gone or holds the program shows nothing.
  agendaItemRooms: z.array(agendaItemRoomSchema).max(50).default([])
}).superRefine(({ tracks, agendaItemRooms }, context) => {
  const sessions = tracks.flatMap(track => track.sessions)
  if (new Set(tracks.map(track => track.id)).size !== tracks.length) {
    context.addIssue({ code: 'custom', path: ['tracks'], message: 'Track IDs must be unique.' })
  }
  if (new Set(sessions.map(session => session.id)).size !== sessions.length) {
    context.addIssue({ code: 'custom', path: ['tracks'], message: 'Session IDs must be unique.' })
  }
  if (!sessions.length || sessions.length > 320) {
    context.addIssue({ code: 'custom', path: ['tracks'], message: 'Add between 1 and 320 sessions.' })
  }
  if (new Set(agendaItemRooms.map(entry => entry.agendaItemId)).size !== agendaItemRooms.length) {
    context.addIssue({ code: 'custom', path: ['agendaItemRooms'], message: 'An agenda item can have one room.' })
  }
})

export type EventProgram = z.infer<typeof eventProgramSchema>

/** The sessions in all rooms of an event. An event without a program has none. */
export function countProgramSessions(program: Pick<EventProgram, 'tracks'> | null) {
  return program?.tracks.reduce((total, track) => total + track.sessions.length, 0) ?? 0
}
export type ProgramTrack = z.infer<typeof programTrackSchema>
export type ProgramSession = z.infer<typeof programSessionSchema>
export type ProgramRoom = z.infer<typeof programRoomSchema>

// The size of the plan image in pixels gives the map its shape before the image has loaded. It is null
// for an image stored before sizes were recorded.
const eventFloorPlanSchema = eventFloorPlanMetadataSchema.safeExtend({
  id,
  imageUrl: z.string(),
  imageWidth: z.number().int().positive().nullable(),
  imageHeight: z.number().int().positive().nullable()
})

export type EventFloorPlan = z.infer<typeof eventFloorPlanSchema>

export interface AdminEventProgram {
  program: EventProgram | null
  floorPlans: EventFloorPlan[]
}

// A staff member as the Agenda tab names them: with the profile icon, or the initials of the name
// when there is no icon.
const agendaStaffMemberSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  profileIconRevision: z.number().int().nullable()
})

// The deck of a workshop or a challenge as its page shows it. `canEdit` is true for the event admins
// and for the staff of that workshop or challenge.
export const agendaDeckSchema = deckSchema.extend({ canEdit: z.boolean() })

export type AgendaDeck = z.infer<typeof agendaDeckSchema>

// A workshop as the Agenda tab shows it: its staff and its deck.
export const agendaWorkshopSchema = z.object({
  sessionId: id,
  staff: z.array(agendaStaffMemberSchema),
  deck: agendaDeckSchema
})

export type AgendaWorkshop = z.infer<typeof agendaWorkshopSchema>

export const participantEventProgramSchema = z.object({
  eventId: id,
  eventName: z.string(),
  agendaItem: z.object({ id, title: z.string(), startsAt: z.string(), endsAt: z.string() }),
  tracks: z.array(programTrackSchema),
  agendaItemRooms: z.array(agendaItemRoomSchema),
  floorPlans: z.array(eventFloorPlanSchema),
  workshops: z.array(agendaWorkshopSchema)
})

export type ParticipantEventProgram = z.infer<typeof participantEventProgramSchema>

// The sessions that the organizer marked as public, in the order of their start, with the
// public agenda block that they belong to. The public event page and the Agenda tab of a person
// who does not read the program list them under that block.
export const publicProgramSessionsSchema = z.object({
  agendaItemId: id,
  sessions: z.array(z.object({ id, title: z.string(), startsAt: z.string() }))
})

export type PublicProgramSessions = z.infer<typeof publicProgramSessionsSchema>

/** Event admins, event staff and confirmed participants read the program. */
export function canViewEventProgram(reader: { isEventAdmin: boolean, isStaff: boolean, approved: boolean }) {
  return reader.isEventAdmin || reader.isStaff || reader.approved
}

/** A challenge as the Agenda tab shows it: with the staff members who support it, and its deck. */
export const agendaChallengeSchema = eventChallengeSchema.extend({
  staff: z.array(agendaStaffMemberSchema),
  deck: agendaDeckSchema
})
export type AgendaChallenge = z.infer<typeof agendaChallengeSchema>

// The page behind the Agenda tab.
export const accountEventAgendaPageSchema = z.object({
  // Null when the event has no program, and for people who may not read it. They see the
  // public agenda blocks instead.
  program: participantEventProgramSchema.nullable(),
  // For a caller who does not get the program: the sessions that the organizer made public.
  // Null for a caller who gets the program, and when the event has no public session.
  publicSessions: publicProgramSessionsSchema.nullable(),
  // The published challenges that the caller may read, in display order. Empty for a caller who
  // may not read them (`canReadEventChallenges`). A room of a floor plan names its challenge.
  challenges: z.array(agendaChallengeSchema),
  // True for a confirmed participant of an event with the check-in flow who is not checked in yet,
  // until the event is completed. Their Agenda tab reads this page again every few seconds, so it
  // shows the sessions for checked-in participants as soon as the event team checks them in.
  waitingForCheckIn: z.boolean()
})

export type AccountEventAgendaPage = z.infer<typeof accountEventAgendaPageSchema>
