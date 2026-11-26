import { z } from 'zod'

import { isHttpsCouponUrl } from '#shared/domains/credits/simplified-giveaways'

// A deck is what the page of a workshop or a challenge shows on the Agenda tab: Markdown slides,
// then materials and links. A workshop is a program session with staff (`staffIds` in
// `program.ts`); a challenge is an entry of the event's challenge list (`challenges.ts`). Their
// staff and the event admins edit the deck on that page. A material or link is a link, or a PDF
// that they upload.

export const deckSubjectKinds = ['workshop', 'challenge'] as const

export type DeckSubjectKind = typeof deckSubjectKinds[number]

/** The part of the API path, and of the storage key of an uploaded PDF, that names the kind of deck. */
export const deckCollections: Record<DeckSubjectKind, string> = {
  workshop: 'workshops',
  challenge: 'challenges'
}

export const deckResourceKinds = ['material', 'link'] as const

export type DeckResourceKind = typeof deckResourceKinds[number]

/** The largest PDF that the editors of a deck can upload. */
export const deckPdfMaxBytes = 20 * 1024 * 1024

const itemId = z.string().trim().min(1).max(100)

export const deckSlideSchema = z.object({
  id: itemId,
  /** Markdown, shown with `AppMarkdownRenderer`. */
  markdown: z.string().trim()
    .min(1, 'Write something on every slide, or remove it.')
    .max(20_000, 'Keep every slide under 20,000 characters.')
})

export const deckResourceSchema = z.object({
  id: itemId,
  kind: z.enum(deckResourceKinds),
  title: z.string().trim()
    .min(1, 'Give every item a title.')
    .max(120, 'Use titles of 120 characters or fewer.'),
  // A link, or an uploaded PDF of this deck by its file id and name. Never both.
  url: z.string().trim()
    .max(2048, 'Use links of 2,048 characters or fewer.')
    .refine(isHttpsCouponUrl, 'Every link needs to start with https://.')
    .optional(),
  file: z.object({
    id: itemId,
    name: z.string().trim().min(1).max(200)
  }).optional()
}).refine(resource => Boolean(resource.url) !== Boolean(resource.file), {
  message: 'Add a link or a PDF to every item.'
})

/** The slides, in order, and the materials and links of a deck. */
export const deckSchema = z.object({
  slides: z.array(deckSlideSchema).max(30, 'Use 30 slides or fewer.'),
  resources: z.array(deckResourceSchema).max(30, 'Use 30 items or fewer.')
})

/** True when no two slides or items of a deck share an id. */
function hasUniqueIds(deck: { slides: Array<{ id: string }>, resources: Array<{ id: string }> }) {
  const ids = [...deck.slides, ...deck.resources].map(item => item.id)
  return new Set(ids).size === ids.length
}

/** A deck as its editors save it. */
export const deckContentSchema = deckSchema.refine(hasUniqueIds, { message: 'Every slide and item needs its own ID.' })

export type DeckSlide = z.infer<typeof deckSlideSchema>
export type DeckResource = z.infer<typeof deckResourceSchema>
export type Deck = z.infer<typeof deckSchema>

export const emptyDeck: Deck = { slides: [], resources: [] }

/**
 * The API of one deck, for example `/api/events/<eventId>/challenges/<challengeId>`. A PUT saves the
 * deck, and its uploaded PDFs are under `/files`.
 */
export function deckApiPath(eventId: string, kind: DeckSubjectKind, subjectId: string) {
  return `/api/events/${encodeURIComponent(eventId)}/${deckCollections[kind]}/${encodeURIComponent(subjectId)}`
}

/** Where a material or link opens: its link, or its uploaded PDF. Only readers of the page open a PDF. */
export function deckResourceHref(apiPath: string, resource: DeckResource) {
  return resource.file ? `${apiPath}/files/${encodeURIComponent(resource.file.id)}` : resource.url!
}
