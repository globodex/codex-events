import { z } from 'zod'

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

export const programRoomSchema = z.object({
  id,
  name,
  area: floorPlanRoomAreaSchema,
  // The way to the room, as points on the floor plan image from the starting point to the room.
  route: z.array(floorPlanPointSchema).min(2).max(40).optional()
})

export const eventFloorPlanMetadataSchema = z.object({
  name,
  rooms: z.array(programRoomSchema).max(100)
}).refine(({ rooms }) => new Set(rooms.map(room => room.id)).size === rooms.length, {
  path: ['rooms'],
  message: 'Room IDs must be unique within a floor plan.'
})

const programSessionSchema = z.object({
  id,
  title: name,
  details: z.string().trim().max(2000).nullable(),
  startsAfterMinutes: z.int().min(0).max(maxProgramMinutes),
  durationMinutes: z.int().min(1).max(maxProgramMinutes),
  room: z.object({ floorPlanId: id, roomId: id }).nullable()
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

export const eventProgramSchema = z.object({
  agendaItemId: id,
  tracks: z.array(programTrackSchema).min(1).max(16)
}).superRefine(({ tracks }, context) => {
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
})

export type EventProgram = z.infer<typeof eventProgramSchema>
export type ProgramTrack = z.infer<typeof programTrackSchema>
export type ProgramSession = z.infer<typeof programSessionSchema>
export type ProgramRoom = z.infer<typeof programRoomSchema>

const eventFloorPlanSchema = eventFloorPlanMetadataSchema.safeExtend({ id, imageUrl: z.string() })

export type EventFloorPlan = z.infer<typeof eventFloorPlanSchema>

export interface AdminEventProgram {
  program: EventProgram | null
  floorPlans: EventFloorPlan[]
}

export const participantEventProgramSchema = z.object({
  eventId: id,
  eventName: z.string(),
  agendaItem: z.object({ id, title: z.string(), startsAt: z.string(), endsAt: z.string() }),
  tracks: z.array(programTrackSchema),
  floorPlans: z.array(eventFloorPlanSchema)
})

export type ParticipantEventProgram = z.infer<typeof participantEventProgramSchema>

// The page behind the Agenda tab. `program` is null when the event has no program, and for
// people who may not read it. They see the public agenda blocks instead.
export const accountEventAgendaPageSchema = z.object({
  program: participantEventProgramSchema.nullable()
})

export type AccountEventAgendaPage = z.infer<typeof accountEventAgendaPageSchema>
