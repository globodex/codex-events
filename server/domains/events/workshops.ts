import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'
import { getRequestWebStream } from 'h3'

import type { AgendaWorkshop, EventProgram } from '#shared/domains/events/program'
import { workshopPdfMaxBytes, type WorkshopContent, type WorkshopResource } from '#shared/domains/events/workshops'
import { requirePlatformActor } from '#server/auth/actor'
import { resolveEventAuthorization } from '#server/auth/authorization'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase, type AppDatabase } from '#server/database/client'
import { eventAgendaPrograms, eventWorkshops } from '#server/database/schema'
import { listPublishedEventRosterMembers } from '#server/domains/events'
import {
  getEventImageObject,
  getEventImagesBucket,
  privateEventImageCacheControl,
  putEventImageObject
} from '#server/domains/events/images'
import { ApiError } from '#server/http/api-error'
import { assertAuthenticatedUploadRateLimit } from '#server/utils/rate-limit'

// A workshop is a program session with staff. Its page holds a description and slides, materials
// and links that its staff and the event admins edit (`shared/domains/events/workshops.ts`).
// The uploaded PDFs are private: only people who read the program open them.

function workshopNotFound() {
  return new ApiError({ statusCode: 404, code: 'workshop_not_found', message: 'Workshop not found.' })
}

/** The program session with this id, when it is a workshop: a session with staff. */
async function findWorkshopSession(database: AppDatabase, eventId: string, sessionId: string) {
  const row = await database.select({ tracksJson: eventAgendaPrograms.tracksJson })
    .from(eventAgendaPrograms)
    .where(eq(eventAgendaPrograms.eventId, eventId))
    .get()
  const tracks = row ? JSON.parse(row.tracksJson) as EventProgram['tracks'] : []
  const session = tracks.flatMap(track => track.sessions).find(candidate => candidate.id === sessionId)

  if (!session?.staffIds?.length) {
    throw workshopNotFound()
  }
  return { ...session, staffIds: session.staffIds }
}

function findWorkshopRow(database: AppDatabase, eventId: string, sessionId: string) {
  return database.select()
    .from(eventWorkshops)
    .where(and(eq(eventWorkshops.eventId, eventId), eq(eventWorkshops.sessionId, sessionId)))
    .get()
}

function readWorkshopResources(resourcesJson: string) {
  return JSON.parse(resourcesJson) as WorkshopResource[]
}

function workshopFileKey(eventId: string, sessionId: string, fileId: string) {
  return `events/${eventId}/workshops/${sessionId}/${fileId}`
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

  const [rows, roster] = await Promise.all([
    database.select().from(eventWorkshops).where(eq(eventWorkshops.eventId, eventId)),
    listPublishedEventRosterMembers(database, eventId, 'staff')
  ])
  const rowsBySession = new Map(rows.map(row => [row.sessionId, row]))
  const rosterById = new Map(roster.map(member => [member.id, member]))

  return sessions.map((session) => {
    const row = rowsBySession.get(session.id)
    const staff = (session.staffIds ?? []).flatMap((staffId) => {
      const member = rosterById.get(staffId)
      return member ? [{ id: member.id, fullName: member.fullName, profileIconRevision: member.profileIconRevision }] : []
    })

    return {
      sessionId: session.id,
      staff,
      description: row?.description ?? '',
      resources: row ? readWorkshopResources(row.resourcesJson) : [],
      canEdit: viewer.isEventAdmin || staff.some(member => member.id === viewer.userId)
    }
  })
}

/** An event admin, or a member of the staff of the workshop who is still on the event staff. */
async function requireWorkshopEditor(h3Event: H3Event, eventId: string, sessionId: string) {
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

/** Saves the description and the resources of a workshop, and removes the PDFs that it no longer names. */
export async function saveWorkshopContent(h3Event: H3Event, eventId: string, sessionId: string, content: WorkshopContent) {
  const { database, actorUserId } = await requireWorkshopEditor(h3Event, eventId, sessionId)
  const previous = await findWorkshopRow(database, eventId, sessionId)
  const resourcesJson = JSON.stringify(content.resources)
  const updatedAt = new Date().toISOString()

  await database.insert(eventWorkshops)
    .values({ eventId, sessionId, description: content.description, resourcesJson, updatedAt })
    .onConflictDoUpdate({
      target: [eventWorkshops.eventId, eventWorkshops.sessionId],
      set: { description: content.description, resourcesJson, updatedAt }
    })
  await writeAuditLog(database, {
    actorUserId,
    entityType: 'event',
    entityId: eventId,
    action: 'event.workshop_updated',
    metadata: { sessionId }
  })

  // Nobody can open a PDF that no item names, so its bytes go.
  const keptFileIds = new Set(content.resources.flatMap(resource => resource.file ? [resource.file.id] : []))
  const removedFileIds = (previous ? readWorkshopResources(previous.resourcesJson) : [])
    .flatMap(resource => resource.file && !keptFileIds.has(resource.file.id) ? [resource.file.id] : [])
  await Promise.all(removedFileIds.map(fileId =>
    getEventImagesBucket(h3Event).delete(workshopFileKey(eventId, sessionId, fileId))
      .catch(() => console.warn('Could not remove an unused workshop PDF.'))
  ))

  return content
}

function workshopUploadError(overLimit: boolean) {
  return new ApiError({
    statusCode: overLimit ? 413 : 400,
    code: overLimit ? 'workshop_file_too_large' : 'workshop_file_invalid',
    message: overLimit ? 'Choose a PDF that is 20 MB or smaller.' : 'Choose a PDF file.'
  })
}

/**
 * Stores an uploaded PDF of a workshop and returns its id and name. The editor adds it to an item,
 * and readers can open it once the workshop is saved with that item.
 */
export async function uploadWorkshopFile(h3Event: H3Event, eventId: string, sessionId: string) {
  const { database, actorUserId } = await requireWorkshopEditor(h3Event, eventId, sessionId)
  await assertAuthenticatedUploadRateLimit(h3Event, `authenticated-upload:${actorUserId}`)

  // Bound the entire multipart request, including form fields and headers.
  let remaining = workshopPdfMaxBytes + 16 * 1024
  const body = getRequestWebStream(h3Event)?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      remaining -= chunk.byteLength
      if (remaining < 0) {
        throw workshopUploadError(true)
      }
      controller.enqueue(chunk)
    }
  }))
  const request = new Response(body, { headers: { 'content-type': h3Event.headers.get('content-type') ?? '' } })
  const form = await request.formData().catch(() => {
    throw workshopUploadError(remaining < 0)
  })
  const file = form.get('file')
  if (!file || typeof file === 'string') {
    throw workshopUploadError(false)
  }

  const data = new Uint8Array(await file.arrayBuffer())
  if (data.byteLength > workshopPdfMaxBytes) {
    throw workshopUploadError(true)
  }
  // Every PDF file starts with "%PDF-".
  if (new TextDecoder().decode(data.subarray(0, 5)) !== '%PDF-') {
    throw workshopUploadError(false)
  }

  const id = crypto.randomUUID()
  const name = file.name.trim().slice(0, 200) || 'slides.pdf'
  // The event image bucket also holds the private PDFs of workshops.
  await putEventImageObject(h3Event, workshopFileKey(eventId, sessionId, id), { contentType: 'application/pdf', data })
  await writeAuditLog(database, {
    actorUserId,
    entityType: 'event',
    entityId: eventId,
    action: 'event.workshop_file_uploaded',
    metadata: { sessionId, fileId: id }
  })

  return { id, name }
}

/** Opens an uploaded PDF of a workshop for a reader of the program, while an item of the workshop names it. */
export async function readWorkshopFile(h3Event: H3Event, database: AppDatabase, eventId: string, sessionId: string, fileId: string) {
  await findWorkshopSession(database, eventId, sessionId)
  const row = await findWorkshopRow(database, eventId, sessionId)
  const file = row && readWorkshopResources(row.resourcesJson).find(resource => resource.file?.id === fileId)?.file
  const object = file && await getEventImageObject(h3Event, workshopFileKey(eventId, sessionId, fileId))

  if (!file || !object) {
    throw new ApiError({ statusCode: 404, code: 'workshop_file_not_found', message: 'File not found.' })
  }

  return new Response(object.body, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'cache-control': privateEventImageCacheControl,
      'x-content-type-options': 'nosniff'
    }
  })
}
