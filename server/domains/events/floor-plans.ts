import type { H3Event } from 'h3'
import { and, asc, eq, sql } from 'drizzle-orm'
import { getRequestWebStream } from 'h3'
import { z } from 'zod'

import { eventFloorPlanMetadataSchema, type EventFloorPlan } from '#shared/domains/events/program'
import { requirePlatformActor } from '#server/auth/actor'
import { buildAuditLogInsert, writeAuditLog } from '#server/database/audit-log'
import { getDatabase, type AppDatabase } from '#server/database/client'
import { eventAgendaPrograms, eventFloorPlans } from '#server/database/schema'
import { requireEventAdmin, routeIdParamsSchema } from '#server/domains/events'
import {
  assertValidEventImagePart,
  eventImageMaxBytes,
  getEventImageObject,
  getEventImagesBucket,
  privateEventImageCacheControl,
  putEventImageObject
} from '#server/domains/events/images'
import { ApiError } from '#server/http/api-error'
import { validateWithSchema } from '#server/http/validation'
import { readImageSize } from '#server/utils/image-signatures'
import { assertAuthenticatedUploadRateLimit } from '#server/utils/rate-limit'

export const eventFloorPlanParamsSchema = routeIdParamsSchema.extend({
  floorPlanId: z.string().trim().min(1)
})

type FloorPlanRecord = typeof eventFloorPlans.$inferSelect
type FloorPlanMetadata = z.infer<typeof eventFloorPlanMetadataSchema>

function floorPlanScope(eventId: string, floorPlanId: string) {
  return and(eq(eventFloorPlans.eventId, eventId), eq(eventFloorPlans.id, floorPlanId))
}

function serializeFloorPlan(plan: FloorPlanRecord): EventFloorPlan {
  const path = `/api/events/${encodeURIComponent(plan.eventId)}/floor-plans/${encodeURIComponent(plan.id)}/image`
  const metadata = eventFloorPlanMetadataSchema.parse({
    name: plan.name,
    rooms: JSON.parse(plan.roomsJson)
  })

  return {
    id: plan.id,
    imageUrl: `${path}?v=${plan.imageRevision}`,
    imageWidth: plan.imageWidth,
    imageHeight: plan.imageHeight,
    ...metadata
  }
}

export async function listEventFloorPlans(database: AppDatabase, eventId: string): Promise<EventFloorPlan[]> {
  const plans = await database.select()
    .from(eventFloorPlans)
    .where(eq(eventFloorPlans.eventId, eventId))
    .orderBy(asc(eventFloorPlans.name), asc(eventFloorPlans.id))

  return plans.map(serializeFloorPlan)
}

function floorPlanNotFound() {
  return new ApiError({ statusCode: 404, code: 'floor_plan_not_found', message: 'Floor plan not found.' })
}

async function getFloorPlan(database: AppDatabase, eventId: string, floorPlanId: string) {
  const [plan] = await database.select().from(eventFloorPlans).where(floorPlanScope(eventId, floorPlanId))
  if (!plan) {
    throw floorPlanNotFound()
  }
  return plan
}

async function requireFloorPlanEditor(h3Event: H3Event, eventId: string) {
  const actor = await requirePlatformActor(h3Event)
  await requireEventAdmin(h3Event, eventId)
  return { database: getDatabase(h3Event), actorUserId: actor.platformUser.id }
}

function floorPlanUploadError(overLimit: boolean) {
  return new ApiError({
    statusCode: overLimit ? 413 : 400,
    code: overLimit ? 'floor_plan_upload_too_large' : 'floor_plan_upload_invalid',
    message: overLimit ? 'Choose an image that is 5 MB or smaller.' : 'Choose a PNG or JPEG image.'
  })
}

async function readFloorPlanUpload(h3Event: H3Event, actorUserId: string) {
  await assertAuthenticatedUploadRateLimit(h3Event, `authenticated-upload:${actorUserId}`)

  // Bound the entire multipart request, including form fields and headers.
  let remaining = eventImageMaxBytes + 16 * 1024
  const body = getRequestWebStream(h3Event)?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      remaining -= chunk.byteLength
      if (remaining < 0) {
        throw floorPlanUploadError(true)
      }
      controller.enqueue(chunk)
    }
  }))
  const contentType = h3Event.headers.get('content-type') ?? ''
  const request = new Response(body, { headers: { 'content-type': contentType } })
  const form = await request.formData().catch(() => {
    throw floorPlanUploadError(remaining < 0)
  })
  const image = form.get('file')
  const data = image && typeof image !== 'string' ? new Uint8Array(await image.arrayBuffer()) : undefined
  const validImage = assertValidEventImagePart({ data })
  // The map needs the size of the plan image, so an image whose size cannot be read is refused.
  const size = readImageSize(validImage.data)
  if (!size) {
    throw floorPlanUploadError(false)
  }

  return { name: form.get('name'), image: validImage, size }
}

function newFloorPlanObjectKey(eventId: string, floorPlanId: string) {
  return `events/${eventId}/floor-plans/${floorPlanId}/${crypto.randomUUID()}`
}

async function deleteUnusedFloorPlanImage(h3Event: H3Event, key: string) {
  try {
    await getEventImagesBucket(h3Event).delete(key)
  } catch {
    console.warn('Could not remove an unused floor plan image.')
  }
}

function floorPlanAudit(actorUserId: string, eventId: string, floorPlanId: string, action: string) {
  return { actorUserId, entityType: 'event', entityId: eventId, action, metadata: { floorPlanId } }
}

export async function createEventFloorPlan(h3Event: H3Event, eventId: string) {
  const { database, actorUserId } = await requireFloorPlanEditor(h3Event, eventId)
  const upload = await readFloorPlanUpload(h3Event, actorUserId)
  const { name } = validateWithSchema(eventFloorPlanMetadataSchema, { name: upload.name, rooms: [] }, 'body')
  const id = crypto.randomUUID()
  const objectKey = newFloorPlanObjectKey(eventId, id)
  const plan = {
    id,
    eventId,
    name,
    objectKey,
    imageRevision: 1,
    imageWidth: upload.size.width,
    imageHeight: upload.size.height,
    roomsJson: '[]'
  }

  await putEventImageObject(h3Event, objectKey, upload.image)
  const audit = floorPlanAudit(actorUserId, eventId, id, 'event.floor_plan.created')
  await database.batch([
    database.insert(eventFloorPlans).values(plan),
    buildAuditLogInsert(database, audit).query
  ])

  return serializeFloorPlan(plan)
}

/**
 * SQL joins that list the rooms named by the sessions of a program, as rows called `place`.
 * Write them after `from` or `join`.
 *
 * A session names up to two rooms: its room, and its room for checked-in participants
 * (`afterCheckIn`). Every session gives two rows. `place.value` is `{ floorPlanId, roomId }`,
 * or JSON null where the session names no room.
 *
 * Every rule about session rooms reads them through these joins, so both rooms follow it.
 */
export function sessionRoomJoins(tracksJson: string | typeof eventAgendaPrograms.tracksJson) {
  return sql`json_each(${tracksJson}) as track
    join json_each(track.value, '$.sessions') as session
    join json_each(json_array(
      json_extract(session.value, '$.room'),
      json_extract(session.value, '$.afterCheckIn.room')
    )) as place`
}

/**
 * SQL joins that list the rooms of the public agenda blocks outside a program
 * (`agendaItemRooms`), as rows called `place` like `sessionRoomJoins`. `place.value` is
 * `{ floorPlanId, roomId }`. The rules about session rooms apply to these rooms too.
 */
export function agendaItemRoomJoins(agendaItemRoomsJson: string | typeof eventAgendaPrograms.agendaItemRoomsJson) {
  return sql`json_each(${agendaItemRoomsJson}) as item
    join json_each(json_array(json_extract(item.value, '$.room'))) as place`
}

function noRemovedRoomsInProgram(eventId: string, floorPlanId: string, roomsJson: string) {
  // A place on this floor plan whose room is not among the rooms being saved.
  const removedRoom = sql`json_extract(place.value, '$.floorPlanId') = ${floorPlanId}
    and not exists (
      select 1 from json_each(${roomsJson}) as room
      where json_extract(room.value, '$.id') = json_extract(place.value, '$.roomId')
    )`

  return sql`not exists (
    select 1
    from ${eventAgendaPrograms}
    join ${sessionRoomJoins(eventAgendaPrograms.tracksJson)}
    where ${eventAgendaPrograms.eventId} = ${eventId} and ${removedRoom}
  ) and not exists (
    select 1
    from ${eventAgendaPrograms}
    join ${agendaItemRoomJoins(eventAgendaPrograms.agendaItemRoomsJson)}
    where ${eventAgendaPrograms.eventId} = ${eventId} and ${removedRoom}
  )`
}

export async function updateEventFloorPlan(
  h3Event: H3Event,
  eventId: string,
  floorPlanId: string,
  metadata: FloorPlanMetadata
) {
  const { database, actorUserId } = await requireFloorPlanEditor(h3Event, eventId)
  const roomsJson = JSON.stringify(metadata.rooms)
  const [updated] = await database.update(eventFloorPlans)
    .set({ name: metadata.name, roomsJson })
    .where(and(floorPlanScope(eventId, floorPlanId), noRemovedRoomsInProgram(eventId, floorPlanId, roomsJson)))
    .returning()

  if (!updated) {
    await getFloorPlan(database, eventId, floorPlanId)
    throw new ApiError({ statusCode: 409, code: 'floor_plan_room_in_use', message: 'Remove the room from its sessions and agenda items first.' })
  }

  await writeAuditLog(database, floorPlanAudit(actorUserId, eventId, floorPlanId, 'event.floor_plan.updated'))
  return serializeFloorPlan(updated)
}

export async function replaceEventFloorPlanImage(h3Event: H3Event, eventId: string, floorPlanId: string) {
  const { database, actorUserId } = await requireFloorPlanEditor(h3Event, eventId)
  const current = await getFloorPlan(database, eventId, floorPlanId)
  const { image, size } = await readFloorPlanUpload(h3Event, actorUserId)
  const objectKey = newFloorPlanObjectKey(eventId, floorPlanId)

  await putEventImageObject(h3Event, objectKey, image)

  const [updated] = await database.update(eventFloorPlans)
    .set({ objectKey, imageRevision: current.imageRevision + 1, imageWidth: size.width, imageHeight: size.height })
    .where(and(floorPlanScope(eventId, floorPlanId), eq(eventFloorPlans.imageRevision, current.imageRevision)))
    .returning()

  if (!updated) {
    await deleteUnusedFloorPlanImage(h3Event, objectKey)
    throw new ApiError({ statusCode: 409, code: 'floor_plan_image_changed', message: 'The image changed. Try uploading it again.' })
  }

  await deleteUnusedFloorPlanImage(h3Event, current.objectKey)
  await writeAuditLog(database, floorPlanAudit(actorUserId, eventId, floorPlanId, 'event.floor_plan.image_replaced'))
  return serializeFloorPlan(updated)
}

export async function readEventFloorPlanImage(h3Event: H3Event, database: AppDatabase, eventId: string, floorPlanId: string) {
  const floorPlan = await getFloorPlan(database, eventId, floorPlanId)
  const image = await getEventImageObject(h3Event, floorPlan.objectKey)
  const contentType = image?.httpMetadata?.contentType

  if (!image || (contentType !== 'image/png' && contentType !== 'image/jpeg')) {
    throw floorPlanNotFound()
  }

  return new Response(image.body, {
    headers: {
      'content-type': contentType,
      'cache-control': privateEventImageCacheControl,
      'x-content-type-options': 'nosniff'
    }
  })
}
