import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'
import { getRequestWebStream } from 'h3'

import { deckCollections, deckPdfMaxBytes, type Deck, type DeckSubjectKind } from '#shared/domains/events/decks'
import { writeAuditLog } from '#server/database/audit-log'
import type { AppDatabase } from '#server/database/client'
import { eventDecks } from '#server/database/schema'
import {
  getEventImageObject,
  getEventImagesBucket,
  privateEventImageCacheControl,
  putEventImageObject
} from '#server/domains/events/images'
import { ApiError } from '#server/http/api-error'
import { assertAuthenticatedUploadRateLimit } from '#server/utils/rate-limit'

// The deck of a workshop or a challenge (`shared/domains/events/decks.ts`): its Markdown slides,
// materials and links. This file saves and serves decks. Who may edit or read one is the rule of
// the workshop (`workshops.ts`) or the challenge (`challenges.ts`): each route checks it first and
// passes the editor in. The uploaded PDFs are private.

/** One deck: its event, its kind, and the id of its program session or challenge. */
export interface DeckSubject {
  eventId: string
  kind: DeckSubjectKind
  subjectId: string
}

/** A person whom the workshop or challenge rule allows to edit the deck. */
export interface DeckEditor {
  database: AppDatabase
  actorUserId: string
}

function readDeck(row: { slidesJson: string, resourcesJson: string }): Deck {
  return { slides: JSON.parse(row.slidesJson), resources: JSON.parse(row.resourcesJson) }
}

async function findDeck(database: AppDatabase, subject: DeckSubject) {
  const row = await database.select({ slidesJson: eventDecks.slidesJson, resourcesJson: eventDecks.resourcesJson })
    .from(eventDecks)
    .where(and(
      eq(eventDecks.eventId, subject.eventId),
      eq(eventDecks.subjectKind, subject.kind),
      eq(eventDecks.subjectId, subject.subjectId)
    ))
    .get()
  return row ? readDeck(row) : null
}

// For example `events/<eventId>/workshops/<sessionId>/<fileId>`.
function deckFileKey(subject: DeckSubject, fileId: string) {
  return `events/${subject.eventId}/${deckCollections[subject.kind]}/${subject.subjectId}/${fileId}`
}

/** The decks of one kind in an event, by the id of their session or challenge. */
export async function loadEventDecks(database: AppDatabase, eventId: string, kind: DeckSubjectKind) {
  const rows = await database.select()
    .from(eventDecks)
    .where(and(eq(eventDecks.eventId, eventId), eq(eventDecks.subjectKind, kind)))
  return new Map(rows.map(row => [row.subjectId, readDeck(row)]))
}

/** Saves the slides and the materials and links of a deck, and removes the PDFs that it no longer names. */
export async function saveDeck(h3Event: H3Event, subject: DeckSubject, editor: DeckEditor, deck: Deck) {
  const { database, actorUserId } = editor
  const previous = await findDeck(database, subject)
  const values = {
    slidesJson: JSON.stringify(deck.slides),
    resourcesJson: JSON.stringify(deck.resources),
    updatedAt: new Date().toISOString()
  }

  await database.insert(eventDecks)
    .values({ eventId: subject.eventId, subjectKind: subject.kind, subjectId: subject.subjectId, ...values })
    .onConflictDoUpdate({ target: [eventDecks.eventId, eventDecks.subjectKind, eventDecks.subjectId], set: values })
  await writeAuditLog(database, {
    actorUserId,
    entityType: 'event',
    entityId: subject.eventId,
    action: 'event.deck_updated',
    metadata: { kind: subject.kind, subjectId: subject.subjectId }
  })

  // Nobody can open a PDF that no item names, so its bytes go.
  const keptFileIds = new Set(deck.resources.flatMap(resource => resource.file ? [resource.file.id] : []))
  const removedFileIds = (previous?.resources ?? [])
    .flatMap(resource => resource.file && !keptFileIds.has(resource.file.id) ? [resource.file.id] : [])
  await Promise.all(removedFileIds.map(fileId =>
    getEventImagesBucket(h3Event).delete(deckFileKey(subject, fileId))
      .catch(() => console.warn('Could not remove an unused deck PDF.'))
  ))

  return deck
}

function deckUploadError(overLimit: boolean) {
  return new ApiError({
    statusCode: overLimit ? 413 : 400,
    code: overLimit ? 'deck_file_too_large' : 'deck_file_invalid',
    message: overLimit ? 'Choose a PDF that is 20 MB or smaller.' : 'Choose a PDF file.'
  })
}

/**
 * Stores an uploaded PDF of a deck and returns its id and name. The editor adds it to an item, and
 * readers can open it once the deck is saved with that item.
 */
export async function uploadDeckFile(h3Event: H3Event, subject: DeckSubject, editor: DeckEditor) {
  const { database, actorUserId } = editor
  await assertAuthenticatedUploadRateLimit(h3Event, `authenticated-upload:${actorUserId}`)

  // Bound the entire multipart request, including form fields and headers.
  let remaining = deckPdfMaxBytes + 16 * 1024
  const body = getRequestWebStream(h3Event)?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      remaining -= chunk.byteLength
      if (remaining < 0) {
        throw deckUploadError(true)
      }
      controller.enqueue(chunk)
    }
  }))
  const request = new Response(body, { headers: { 'content-type': h3Event.headers.get('content-type') ?? '' } })
  const form = await request.formData().catch(() => {
    throw deckUploadError(remaining < 0)
  })
  const file = form.get('file')
  if (!file || typeof file === 'string') {
    throw deckUploadError(false)
  }

  const data = new Uint8Array(await file.arrayBuffer())
  if (data.byteLength > deckPdfMaxBytes) {
    throw deckUploadError(true)
  }
  // Every PDF file starts with "%PDF-".
  if (new TextDecoder().decode(data.subarray(0, 5)) !== '%PDF-') {
    throw deckUploadError(false)
  }

  const id = crypto.randomUUID()
  const name = file.name.trim().slice(0, 200) || 'material.pdf'
  // The event image bucket also holds the private PDFs of decks.
  await putEventImageObject(h3Event, deckFileKey(subject, id), { contentType: 'application/pdf', data })
  await writeAuditLog(database, {
    actorUserId,
    entityType: 'event',
    entityId: subject.eventId,
    action: 'event.deck_file_uploaded',
    metadata: { kind: subject.kind, subjectId: subject.subjectId, fileId: id }
  })

  return { id, name }
}

/** Opens an uploaded PDF of a deck for a reader of its page, while an item of the deck names it. */
export async function readDeckFile(h3Event: H3Event, database: AppDatabase, subject: DeckSubject, fileId: string) {
  const deck = await findDeck(database, subject)
  const file = deck?.resources.find(resource => resource.file?.id === fileId)?.file
  const object = file && await getEventImageObject(h3Event, deckFileKey(subject, fileId))

  if (!file || !object) {
    throw new ApiError({ statusCode: 404, code: 'deck_file_not_found', message: 'File not found.' })
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
