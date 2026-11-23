import type { StagedCredit } from '#shared/domains/credits/draft-credits'
import { z } from 'zod'

import type { EventBuilderBlockType, EventBuilderEventType } from '#shared/domains/events/builder-blocks'
import {
  eventBuilderBlockDefinitions,
  getEventBuilderPaletteBlockTypes,
  resolveEventBuilderBlockType
} from '#shared/domains/events/builder-blocks'
import type { EventBalanceScoringInput } from '#shared/domains/events/builder-scoring'
import { computeEventBalance } from '#shared/domains/events/builder-scoring'
import type { EventBuilderApplicationFieldKey, EventBuilderTemplate } from '#shared/domains/events/builder-templates'
import { eventBuilderApplicationFieldKeys } from '#shared/domains/events/builder-templates'
import { eventChallengesSchema } from '#shared/domains/events/challenges'
import { customQuestionsSchema } from '#shared/domains/events/custom-questions'
import type { EventFormAgendaItem, EventFormState } from '~/domains/events/admin-event'
import {
  createEmptyEventFormState,
  createEventFormState,
  fromDateTimeLocalValue,
  slugSchema,
  toDateTimeLocalValue,
  toEventAgendaPayload
} from '~/domains/events/admin-event'
import type { EventRecord, EventType } from '~/domains/events/records'
import { cloneFormValues } from '~/utils/form-values'
import { moveListItemByIndex } from '~/utils/reorder-list'

export interface EventBuilderBlockInstance {
  id: string
  type: EventBuilderBlockType
  title: string
  /** Public agenda description shown to participants, empty when unset. */
  details: string
  durationMinutes: number | null
  gapBeforeMs: number
  /** True for agenda items that did not originate from a builder block (classic edits). */
  custom: boolean
  /** Organizer-declared focus cost, custom blocks only (absolute, no duration scaling). */
  focusCost?: number
  /** Organizer-declared energy delta, custom blocks only (absolute, no duration scaling). */
  energyDelta?: number
}

export interface EventBuilderState {
  credits: StagedCredit[]
  /** The first agenda block's start instant, or the organizer's local input. */
  eventStartsAt: string
  blocks: EventBuilderBlockInstance[]
  /**
   * The classic form state is the single field store: basics and every settings
   * slice live here so submit paths reuse the classic mappers unchanged.
   * `form.agendaItems` is derived from `blocks` at submit time.
   */
  form: EventFormState
  slugEdited: boolean
  appliedTemplateId: string | null
  /**
   * The form always carries an event type, but the builder starts with none
   * chosen: type-dependent sections unlock once the organizer picks one.
   */
  eventTypeChosen: boolean
  /**
   * Onsite vs online starts unchosen so the location checklist step needs an
   * explicit pick; the underlying inPersonEvent flag only counts once chosen.
   */
  locationChosen: boolean
}

export const eventBuilderBlockIcons: Record<EventBuilderBlockType, string> = {
  welcome: 'i-lucide-door-open',
  keynote: 'i-lucide-mic',
  talk: 'i-lucide-presentation',
  lightning_talk: 'i-lucide-zap',
  panel: 'i-lucide-messages-square',
  workshop: 'i-lucide-wrench',
  demos: 'i-lucide-screen-share',
  hacking: 'i-lucide-terminal',
  build: 'i-lucide-hammer',
  team_formation: 'i-lucide-handshake',
  demos_judging: 'i-lucide-monitor-play',
  awards_closing: 'i-lucide-trophy',
  break: 'i-lucide-coffee',
  food: 'i-lucide-utensils',
  networking: 'i-lucide-users',
  custom: 'i-lucide-puzzle'
}

export const eventBuilderMinBlockDurationMinutes = 1
export const eventBuilderMaxBlockDurationMinutes = 480

export function parseEventBuilderDurationMinutes(raw: string) {
  if (!/^\d+$/.test(raw)) {
    return null
  }

  return Math.min(
    eventBuilderMaxBlockDurationMinutes,
    Math.max(eventBuilderMinBlockDurationMinutes, Number(raw))
  )
}

export function getNextEventBuilderDurationMinutes(currentMinutes: number, direction: -1 | 1) {
  const current = Math.min(
    eventBuilderMaxBlockDurationMinutes,
    Math.max(eventBuilderMinBlockDurationMinutes, Math.round(currentMinutes))
  )

  if (direction === 1) {
    const next = current < 10
      ? current + 1
      : Math.ceil((current + 1) / 5) * 5

    return Math.min(eventBuilderMaxBlockDurationMinutes, next)
  }

  const next = current <= 10
    ? current - 1
    : Math.max(10, Math.floor((current - 1) / 5) * 5)

  return Math.max(eventBuilderMinBlockDurationMinutes, next)
}

export function createEmptyEventBuilderState(): EventBuilderState {
  const form = createEmptyEventFormState()

  // Underlying default is a venue event, but the basics section renders the
  // onsite/online pick as unchosen until the organizer commits to one.
  form.inPersonEvent = true

  return {
    credits: [],
    eventStartsAt: '',
    blocks: [],
    form,
    slugEdited: false,
    appliedTemplateId: null,
    eventTypeChosen: false,
    locationChosen: false
  }
}

export function createBlockInstance(type: EventBuilderBlockType): EventBuilderBlockInstance {
  const definition = eventBuilderBlockDefinitions[type]
  const custom = type === 'custom'

  return {
    id: crypto.randomUUID(),
    type,
    title: definition.label,
    details: '',
    durationMinutes: definition.defaultDurationMinutes,
    gapBeforeMs: 0,
    custom,
    // Custom blocks start as a mild talk; the organizer dials the real values.
    ...(custom ? { focusCost: 10, energyDelta: -8 } : {})
  }
}

export function addMinutesToLocalValue(localValue: string, minutes: number) {
  const parsed = new Date(localValue)

  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  const shifted = new Date(parsed.getTime() + minutes * 60_000)
  const local = new Date(shifted.getTime() - (shifted.getTimezoneOffset() * 60_000))

  return local.toISOString().slice(0, 16)
}

export interface EventBuilderScheduleEntry {
  id: string
  startsAt: string
  endsAt: string
}

export function computeBlockSchedule(
  eventStartsAt: string,
  blocks: EventBuilderBlockInstance[]
): EventBuilderScheduleEntry[] {
  let cursor = Date.parse(eventStartsAt)

  if (Number.isNaN(cursor)) {
    return blocks.map(block => ({ id: block.id, startsAt: '', endsAt: '' }))
  }

  return blocks.map((block) => {
    cursor += block.gapBeforeMs
    const startsAt = new Date(cursor).toISOString()
    cursor += Math.round((block.durationMinutes ?? 0) * 60_000)

    return {
      id: block.id,
      startsAt,
      endsAt: block.durationMinutes === null ? '' : new Date(cursor).toISOString()
    }
  })
}

export function reorderAgendaBlocks(blocks: EventBuilderBlockInstance[], oldIndex: number, newIndex: number) {
  const reordered = moveListItemByIndex(blocks, oldIndex, newIndex)

  if (reordered === blocks) {
    return blocks
  }

  // Gaps belong to the timeline positions. Durations move with the sessions.
  return reordered.map((block, index) => ({ ...block, gapBeforeMs: blocks[index]!.gapBeforeMs }))
}

/**
 * The blocks after the organizer set an exact start for one block.
 *
 * The start of a block is stored as the gap after the block before it. So the block keeps its
 * duration, and the blocks after it move with it and keep their durations and gaps. The first
 * block starts with the event: its start is the event start, which is not set here.
 *
 * `startsAt` and the schedule hold times that `Date.parse` reads.
 */
export function setBlockStart(
  blocks: EventBuilderBlockInstance[],
  schedule: EventBuilderScheduleEntry[],
  blockId: string,
  startsAt: string
) {
  const previous = schedule[blocks.findIndex(block => block.id === blockId) - 1]
  const start = Date.parse(startsAt)

  if (!previous || Number.isNaN(start)) {
    return blocks
  }

  // A block without an end takes no time, so the block after it is measured from its start.
  const previousEnd = Date.parse(previous.endsAt || previous.startsAt)

  return blocks.map(block => block.id === blockId ? { ...block, gapBeforeMs: start - previousEnd } : block)
}

/**
 * How the pause before the next block changes when a block gets or loses its end, so that the
 * blocks after it keep their times.
 */
function getPauseChangeAfterBlock(
  block: EventBuilderBlockInstance,
  next: EventBuilderBlockInstance | undefined,
  durationMs: number | null
) {
  if (!next) {
    return 0
  }

  // The block loses its end: the time it took becomes a pause.
  if (durationMs === null) {
    return Math.round((block.durationMinutes ?? 0) * 60_000)
  }

  // The block had no end and gets one: its time comes out of the pause, as far as the pause reaches.
  return block.durationMinutes === null ? -Math.min(durationMs, Math.max(0, next.gapBeforeMs)) : 0
}

/**
 * The blocks after the organizer set an exact end for one block, or removed its end with `null`.
 *
 * - A block with an end gets another end: its duration changes, and the blocks after it move
 *   with it, as with the duration buttons.
 * - A block loses its end: the blocks after it keep their times.
 * - A block without an end gets one: the blocks after it keep their times as long as the pause
 *   after the block is long enough, and move by the rest otherwise.
 *
 * An end that is not after the start of the block changes nothing.
 */
export function setBlockEnd(
  blocks: EventBuilderBlockInstance[],
  schedule: EventBuilderScheduleEntry[],
  blockId: string,
  endsAt: string | null
) {
  const index = blocks.findIndex(block => block.id === blockId)
  const block = blocks[index]
  const durationMs = endsAt === null ? null : Date.parse(endsAt) - Date.parse(schedule[index]?.startsAt ?? '')

  // The comparison is false for a missing start and for an unreadable end as well.
  if (!block || (durationMs !== null && !(durationMs > 0))) {
    return blocks
  }

  const pauseChangeMs = getPauseChangeAfterBlock(block, blocks[index + 1], durationMs)

  return blocks.map((entry, position) => {
    if (position === index) {
      return { ...entry, durationMinutes: durationMs === null ? null : durationMs / 60_000 }
    }

    return position === index + 1 ? { ...entry, gapBeforeMs: entry.gapBeforeMs + pauseChangeMs } : entry
  })
}

export function getBlockDurationMinutes(block: EventBuilderBlockInstance) {
  return Math.round(block.durationMinutes ?? eventBuilderBlockDefinitions[block.type].defaultDurationMinutes)
}

export function blocksToFormAgendaItems(state: EventBuilderState): EventFormAgendaItem[] {
  const schedule = computeBlockSchedule(state.eventStartsAt, state.blocks)

  return state.blocks.map((block, index) => ({
    id: block.id,
    startsAt: schedule[index]?.startsAt ?? '',
    endsAt: schedule[index]?.endsAt ?? '',
    title: block.title,
    details: block.details,
    displayOrder: index,
    // Custom blocks stay type-unannotated but carry their declared dials.
    ...(block.custom ? {} : { builderBlockType: block.type }),
    ...(block.custom && block.focusCost !== undefined ? { builderFocusCost: block.focusCost } : {}),
    ...(block.custom && block.energyDelta !== undefined ? { builderEnergyDelta: block.energyDelta } : {})
  }))
}

export function toEventBuilderFormState(state: EventBuilderState): EventFormState {
  return {
    ...cloneFormValues(state.form),
    agendaItems: blocksToFormAgendaItems(state)
  }
}

export function createBuilderStateFromEvent(event: EventRecord): EventBuilderState {
  const form = createEventFormState({ ...event, agendaItems: [] })
  const sortedItems = [...event.agendaItems]
    .sort((left, right) => left.displayOrder - right.displayOrder || left.startsAt.localeCompare(right.startsAt))
  const eventStartsAt = sortedItems[0]?.startsAt ?? ''
  let previousEnd = Date.parse(eventStartsAt)

  const blocks = sortedItems.map((item) => {
    const type = resolveEventBuilderBlockType(item.builderBlockType)
    const start = Date.parse(item.startsAt)
    const end = Date.parse(item.endsAt ?? item.startsAt)
    const gapBeforeMs = start - previousEnd
    const custom = type === 'custom'
    previousEnd = end

    return {
      id: item.id,
      type,
      title: item.title,
      details: item.details ?? '',
      durationMinutes: item.endsAt === null ? null : (end - start) / 60_000,
      gapBeforeMs,
      custom,
      ...(custom && item.builderFocusCost !== undefined ? { focusCost: item.builderFocusCost } : {}),
      ...(custom && item.builderEnergyDelta !== undefined ? { energyDelta: item.builderEnergyDelta } : {})
    }
  })

  return {
    credits: [],
    eventStartsAt,
    blocks,
    form,
    slugEdited: true,
    appliedTemplateId: null,
    eventTypeChosen: true,
    locationChosen: true
  }
}

const applicationFieldFlagMap: Record<
  EventBuilderApplicationFieldKey,
  { visible: keyof EventFormState, required: keyof EventFormState }
> = {
  xProfile: { visible: 'applicationXProfileVisible', required: 'requireXProfile' },
  linkedinProfile: { visible: 'applicationLinkedinProfileVisible', required: 'requireLinkedinProfile' },
  githubProfile: { visible: 'applicationGithubProfileVisible', required: 'requireGithubProfile' },
  chatgptEmail: { visible: 'applicationChatgptEmailVisible', required: 'requireChatgptEmail' },
  openaiOrgId: { visible: 'applicationOpenaiOrgIdVisible', required: 'requireOpenaiOrgId' },
  lumaEmail: { visible: 'applicationLumaEmailVisible', required: 'requireLumaEmail' },
  whyThisEvent: { visible: 'applicationWhyThisEventVisible', required: 'requireWhyThisEvent' },
  proofOfExecution: { visible: 'applicationProofOfExecutionVisible', required: 'requireProofOfExecution' },
  teamIntent: { visible: 'applicationTeamIntentVisible', required: 'requireTeamIntent' },
  aiKnowledge: { visible: 'applicationAiKnowledgeVisible', required: 'requireAiKnowledge' }
}

export function applyTemplateToState(state: EventBuilderState, template: EventBuilderTemplate): EventBuilderState {
  const form = cloneFormValues(state.form)

  // Templates carry a full application-form preset for their format.
  for (const key of eventBuilderApplicationFieldKeys) {
    const flags = applicationFieldFlagMap[key]
    const required = template.applicationFields.required.includes(key)
    const visible = required || template.applicationFields.visible.includes(key)

    ;(form[flags.visible] as boolean) = visible
    ;(form[flags.required] as boolean) = required
  }

  return {
    ...state,
    form,
    blocks: template.blocks.map(block => ({
      id: crypto.randomUUID(),
      type: block.builderBlockType,
      title: block.title,
      details: '',
      durationMinutes: block.durationMinutes,
      gapBeforeMs: 0,
      custom: false
    })),
    appliedTemplateId: template.id
  }
}

export function pruneBlocksForEventType(blocks: EventBuilderBlockInstance[], eventType: EventType) {
  const allowed = new Set<EventBuilderBlockType>([...getEventBuilderPaletteBlockTypes(eventType), 'custom'])
  const kept = blocks.filter(block => allowed.has(block.type))

  return {
    kept,
    removed: blocks.filter(block => !allowed.has(block.type))
  }
}

const dayMinutes = 24 * 60

export function deriveScheduleDefaults(eventStartsAt: string, blocks: EventBuilderBlockInstance[], eventType: EventType) {
  if (!eventStartsAt.trim()) {
    return {}
  }

  const totalDurationMinutes = getTotalAgendaDurationMinutes(blocks)
  const localEventStart = toDateTimeLocalValue(eventStartsAt)
  const defaults: Partial<Pick<
    EventFormState,
    'registrationOpensAt' | 'registrationClosesAt' | 'submissionOpensAt' | 'submissionClosesAt'
  >> = {
    registrationOpensAt: addMinutesToLocalValue(eventStartsAt, -14 * dayMinutes),
    registrationClosesAt: localEventStart
  }

  if (eventType === 'hackathon') {
    // Mirrors the server rule: regOpen < regClose <= subOpen < subClose.
    defaults.submissionOpensAt = localEventStart
    defaults.submissionClosesAt = addMinutesToLocalValue(
      eventStartsAt,
      Math.max(totalDurationMinutes, 60)
    )
  }

  return defaults
}

/** Deterministic stand-in start so block durations reach the scorer before a real start is picked. */
const eventBuilderScoringFallbackStart = '2030-01-01T09:00'

export function toEventBalanceInputFromState(state: EventBuilderState): EventBalanceScoringInput {
  const form = state.form
  const agendaPayload = toEventAgendaPayload(blocksToFormAgendaItems(
    state.eventStartsAt.trim() ? state : { ...state, eventStartsAt: eventBuilderScoringFallbackStart }
  ))
  const visibilityFlags = [
    form.applicationXProfileVisible,
    form.applicationLinkedinProfileVisible,
    form.applicationGithubProfileVisible,
    form.applicationChatgptEmailVisible,
    form.applicationOpenaiOrgIdVisible,
    form.applicationLumaEmailVisible,
    form.applicationWhyThisEventVisible,
    form.applicationProofOfExecutionVisible,
    form.applicationTeamIntentVisible,
    form.applicationAiKnowledgeVisible
  ]
  const requirementFlags = [
    form.requireXProfile,
    form.requireLinkedinProfile,
    form.requireGithubProfile,
    form.requireChatgptEmail,
    form.requireOpenaiOrgId,
    form.requireLumaEmail,
    form.requireWhyThisEvent,
    form.requireProofOfExecution,
    form.requireTeamIntent,
    form.requireAiKnowledge
  ]

  return {
    eventType: form.eventType as EventBuilderEventType,
    agendaItems: agendaPayload.map(item => ({
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      builderBlockType: item.builderBlockType ?? null,
      focusCost: item.builderFocusCost ?? null,
      energyDelta: item.builderEnergyDelta ?? null
    })),
    registrationOpensAt: fromDateTimeLocalValue(form.registrationOpensAt) || null,
    registrationClosesAt: fromDateTimeLocalValue(form.registrationClosesAt) || null,
    visibleApplicationFieldCount: visibilityFlags.filter(Boolean).length,
    requiredApplicationFieldCount: requirementFlags.filter(Boolean).length
  }
}

export const eventBuilderBasicsSchema = z.object({
  name: z.string().trim().min(1, 'Give the event a name.'),
  slug: slugSchema,
  description: z.string().trim().min(1, 'Describe the event for participants.'),
  city: z.string().trim(),
  country: z.string().trim(),
  address: z.string().trim(),
  isOnline: z.boolean(),
  locationChosen: z.boolean(),
  eventStartsAt: z.string().trim().min(1, 'Set when the event starts.'),
  registrationOpensAt: z.string().trim().min(1, 'Set when registration opens.'),
  registrationClosesAt: z.string().trim().min(1, 'Set when registration closes.'),
  submissionOpensAt: z.string().trim(),
  submissionClosesAt: z.string().trim(),
  isHackathon: z.boolean()
}).superRefine((input, context) => {
  // Location is a deliberate step: pick onsite or online first, then venue
  // events need a findable place while online events skip location entirely.
  if (!input.locationChosen) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['location'], message: 'Choose onsite or online.' })
  } else if (!input.isOnline) {
    if (!input.city) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['city'], message: 'City is required for venue events.' })
    }

    if (!input.country) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['country'], message: 'Country is required for venue events.' })
    }

    if (!input.address) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['address'], message: 'Address is required for venue events.' })
    }
  }

  const registrationOpensAt = Date.parse(input.registrationOpensAt)
  const registrationClosesAt = Date.parse(input.registrationClosesAt)

  if (!Number.isNaN(registrationOpensAt) && !Number.isNaN(registrationClosesAt)
    && registrationOpensAt >= registrationClosesAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['registrationClosesAt'],
      message: 'Registration must close after it opens.'
    })
  }

  if (!input.isHackathon) {
    return
  }

  if (!input.submissionOpensAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['submissionOpensAt'],
      message: 'Set when submissions open.'
    })
  }

  if (!input.submissionClosesAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['submissionClosesAt'],
      message: 'Set when submissions close.'
    })
  }

  const submissionOpensAt = Date.parse(input.submissionOpensAt)
  const submissionClosesAt = Date.parse(input.submissionClosesAt)

  if ([registrationOpensAt, registrationClosesAt, submissionOpensAt, submissionClosesAt].some(Number.isNaN)) {
    return
  }

  if (!(registrationOpensAt < registrationClosesAt
    && registrationClosesAt <= submissionOpensAt
    && submissionOpensAt < submissionClosesAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['submissionClosesAt'],
      message: 'Schedule must satisfy registration open < registration close <= submission open < submission close.'
    })
  }
})

export function buildEventBuilderBasicsInput(state: EventBuilderState) {
  return {
    name: state.form.name,
    slug: state.form.slug,
    description: state.form.description,
    city: state.form.city,
    country: state.form.country,
    address: state.form.address,
    isOnline: !state.form.inPersonEvent,
    locationChosen: state.locationChosen,
    eventStartsAt: state.eventStartsAt,
    registrationOpensAt: state.form.registrationOpensAt,
    registrationClosesAt: state.form.registrationClosesAt,
    submissionOpensAt: state.form.submissionOpensAt,
    submissionClosesAt: state.form.submissionClosesAt,
    isHackathon: state.form.eventType === 'hackathon'
  }
}

/** The builder shows one level at a time. */
export type EventBuilderLevelId = 'event' | 'when-where' | 'agenda' | 'registration' | 'extras'

export interface EventBuilderLevelDefinition {
  id: EventBuilderLevelId
  icon: string
  title: string
}

/** The levels in the order of the level bar. */
export const eventBuilderLevels: readonly EventBuilderLevelDefinition[] = [
  { id: 'event', icon: 'i-lucide-flag', title: 'Event' },
  { id: 'when-where', icon: 'i-lucide-map-pin', title: 'When and where' },
  { id: 'agenda', icon: 'i-lucide-layout-list', title: 'Agenda' },
  { id: 'registration', icon: 'i-lucide-user-check', title: 'Registration' },
  { id: 'extras', icon: 'i-lucide-sparkles', title: 'Extras' }
]

/**
 * How the level bar shows a level.
 * - done: every step of the level is complete.
 * - open: the level still needs something.
 * - ahead: a level of a new event that the organizer has not opened yet.
 */
export type EventBuilderLevelStatus = 'done' | 'open' | 'ahead'

export interface EventBuilderLevelBarItem extends EventBuilderLevelDefinition {
  status: EventBuilderLevelStatus
  /** A locked level cannot be opened yet. */
  locked: boolean
}

/**
 * One step the event needs before it can be saved, for example "Set the event start".
 * A level is done when all of its steps are complete.
 */
export interface EventBuilderChecklistItem {
  id: string
  label: string
  complete: boolean
  /** The level that shows the field of this step. */
  level: EventBuilderLevelId
  /** The extra that holds the field, for a step on the extras level. */
  extra?: EventBuilderExtraId
  fieldRef?: string
}

/** The element id of the title field of a challenge in the builder. The checklist focuses it. */
export const eventBuilderChallengeTitleIdPrefix = 'event-builder-challenge-title-'
/** The element id of the text field of a question in the builder. The checklist focuses it. */
export const eventBuilderQuestionIdPrefix = 'event-builder-question-'

/**
 * The checklist line for the first entry of an organizer-written list that cannot be saved yet,
 * for example "Challenge 2: Add a title." Returns null when the whole list can be saved.
 *
 * The list schema owns the rules and the wording of every problem. A problem of one entry has a
 * path that starts with the position of the entry in the list.
 */
function getUnfinishedEntryChecklistItem(list: {
  checklistId: string
  /** The extra that holds the list. */
  extra: EventBuilderExtraId
  /** What the organizer calls one entry, for example "Challenge". */
  entryName: string
  entries: Array<{ id: string }>
  schema: z.ZodTypeAny
  /** The element id of an entry's first field: this prefix followed by the entry id. */
  fieldIdPrefix: string
}): EventBuilderChecklistItem | null {
  const result = list.schema.safeParse(list.entries)

  if (result.success) {
    return null
  }

  const problem = result.error.issues[0]!
  const position = problem.path[0]

  // A problem of the list itself, for example too many entries, points at no entry.
  if (typeof position !== 'number') {
    return { id: list.checklistId, label: problem.message, complete: false, level: 'extras', extra: list.extra }
  }

  return {
    id: list.checklistId,
    label: `${list.entryName} ${position + 1}: ${problem.message}`,
    complete: false,
    level: 'extras',
    extra: list.extra,
    fieldRef: `${list.fieldIdPrefix}${list.entries[position]!.id}`
  }
}

/**
 * Steps for what the organizer wrote in an extra and has not finished: an incomplete challenge,
 * and an incomplete question for after check-in. The event is not saved while a step is open,
 * so it is never sent with such an entry.
 *
 * This is the one place that tells the organizer about unfinished list entries.
 */
function getUnfinishedEntryChecklistItems(form: EventFormState) {
  return [
    getUnfinishedEntryChecklistItem({
      checklistId: 'challenges',
      extra: 'challenges',
      entryName: 'Challenge',
      entries: form.challenges,
      schema: eventChallengesSchema,
      fieldIdPrefix: eventBuilderChallengeTitleIdPrefix
    }),
    // The questions are sent only while the next step is on (see `buildPatchBody` in `useEventBuilder`).
    form.checkInFlowEnabled
      ? getUnfinishedEntryChecklistItem({
          checklistId: 'questionnaire-questions',
          extra: 'check-in',
          entryName: 'Question',
          entries: form.questionnaireQuestions,
          schema: customQuestionsSchema,
          fieldIdPrefix: eventBuilderQuestionIdPrefix
        })
      : null
  ].filter(item => item !== null)
}

export function getBuilderChecklist(state: EventBuilderState): EventBuilderChecklistItem[] {
  const basics = buildEventBuilderBasicsInput(state)
  const parsed = eventBuilderBasicsSchema.safeParse(basics)
  const issuePaths = new Set(
    parsed.success ? [] : parsed.error.issues.map(issue => String(issue.path[0] ?? ''))
  )
  const fieldValid = (field: keyof typeof basics) => {
    const value = basics[field]

    return typeof value === 'string' ? value.trim().length > 0 && !issuePaths.has(field) : true
  }

  // The steps follow the order of the levels: saving with open steps opens the first one.
  // The slug rides with the name: it auto-derives from it, so a broken slug
  // reopens the "name" step instead of earning its own step.
  const items: EventBuilderChecklistItem[] = [
    {
      id: 'name',
      label: 'Name the event',
      complete: fieldValid('name') && fieldValid('slug'),
      level: 'event',
      fieldRef: 'event-builder-name'
    },
    {
      id: 'event-type',
      label: 'Pick the event type',
      complete: state.eventTypeChosen,
      level: 'event',
      fieldRef: 'event-builder-event-type'
    },
    {
      id: 'description',
      label: 'Describe the event',
      complete: fieldValid('description'),
      level: 'event',
      fieldRef: 'event-builder-description'
    },
    {
      id: 'event-start',
      label: 'Set the event start',
      complete: fieldValid('eventStartsAt'),
      level: 'when-where',
      fieldRef: 'event-builder-event-starts-at'
    },
    {
      id: 'location',
      label: 'Set the location or go online',
      complete: state.locationChosen
        && (basics.isOnline || (fieldValid('city') && fieldValid('country') && fieldValid('address'))),
      level: 'when-where',
      fieldRef: 'event-builder-location'
    }
  ]

  if (basics.isHackathon && state.eventTypeChosen) {
    items.push({
      id: 'submission-window',
      label: 'Set a valid submission window',
      complete: Boolean(basics.submissionOpensAt) && Boolean(basics.submissionClosesAt)
        && !issuePaths.has('submissionOpensAt') && !issuePaths.has('submissionClosesAt'),
      level: 'when-where',
      fieldRef: 'event-builder-submission-opens-at'
    })
  }

  items.push(
    {
      id: 'agenda',
      label: 'Add at least one agenda block',
      complete: state.blocks.length > 0,
      level: 'agenda',
      fieldRef: 'event-builder-block-palette'
    },
    {
      id: 'registration-window',
      label: 'Set a valid registration window',
      complete: fieldValid('registrationOpensAt') && fieldValid('registrationClosesAt') && !issuePaths.has('registrationClosesAt'),
      level: 'registration',
      fieldRef: 'event-builder-registration-opens-at'
    }
  )

  items.push(...getUnfinishedEntryChecklistItems(state.form))

  return items
}

function getLevelStatus(seen: boolean, hasOpenStep: boolean): EventBuilderLevelStatus {
  if (!seen) {
    return 'ahead'
  }

  return hasOpenStep ? 'open' : 'done'
}

/** What the level bar shows for every level. */
export function getEventBuilderLevelBarItems(input: {
  checklist: EventBuilderChecklistItem[]
  mode: 'create' | 'edit'
  /** The levels the organizer has opened in this visit. */
  visitedLevelIds: readonly EventBuilderLevelId[]
  eventTypeChosen: boolean
}): EventBuilderLevelBarItem[] {
  return eventBuilderLevels.map((level, index) => {
    const hasOpenStep = input.checklist.some(item => item.level === level.id && !item.complete)
    // A saved event shows the state of every level at once. A new event starts with nothing
    // done: a level counts after the organizer opened it, so the bar fills up from the left.
    const seen = input.mode === 'edit' || input.visitedLevelIds.includes(level.id)

    return {
      ...level,
      status: getLevelStatus(seen, hasOpenStep),
      // Every level after the first depends on the event type.
      locked: index > 0 && !input.eventTypeChosen
    }
  })
}

export type EventBuilderExtraId
  = | 'tracks'
    | 'challenges'
    | 'rooms'
    | 'credits'
    | 'check-in'
    | 'photos'
    | 'talks'
    | 'judging'
    | 'criteria'
    | 'submissions'
    | 'prizes'
    | 'links'
    | 'images'
    | 'terms'
    | 'luma'
    | 'visibility'

/** What a tile reads to describe its option. */
export interface EventBuilderExtraContext {
  form: EventFormState
  event: EventRecord | null
  /** The credit codes and links of the event: uploaded for a saved event, staged for a new one. */
  creditCount: number
  /** The sessions in the rooms of the event. */
  sessionCount: number
  /** The saved judging criteria of the event. */
  criteriaCount: number
  /** The saved prizes of the event. */
  prizeCount: number
}

/** One optional part of an event. The extras level shows it as a tile. */
export interface EventBuilderExtraDefinition {
  id: EventBuilderExtraId
  icon: string
  title: string
  /** The tile is shown only for these event types. */
  appliesTo: readonly EventType[]
  /** True for an option that needs a saved event, so the tile is not shown for a new event. */
  editOnly: boolean
  /**
   * True for an extra that saves what the organizer types with its own button, not with the
   * event. The builder hides its own save bar while such an extra is open, so the organizer
   * does not save the event and believe that the extra was saved with it.
   */
  hasOwnSave?: boolean
  /**
   * The state the tile shows while the option is in use, for example "3 codes".
   * Null while the option is not in use.
   */
  summary: (context: EventBuilderExtraContext) => string | null
}

const allTypes: readonly EventType[] = ['hackathon', 'meetup', 'build']

/** "3", or "3 codes" with a noun. Null for none: a tile shows no state for an unused option. */
function describeCount(count: number, noun?: string) {
  if (count === 0) {
    return null
  }

  return noun ? `${count} ${noun}${count === 1 ? '' : 's'}` : String(count)
}

function countFilled(values: Array<string | null | undefined>) {
  return values.filter(value => value?.trim()).length
}

function describeJudging(form: EventFormState) {
  const blind = form.blindReviewCount > 0

  if (blind && form.pitchReviewEnabled) {
    return 'Blind + pitch'
  }

  if (blind) {
    return 'Blind review'
  }

  return form.pitchReviewEnabled ? 'Live pitch' : null
}

function describeLumaConnection(event: EventRecord | null) {
  if (event?.lumaWebhookStatus === 'configured') {
    return 'Connected'
  }

  return event?.lumaWebhookStatus === 'failed' ? 'Not connected' : null
}

/** The extras in the order of their tiles. */
const eventBuilderExtraDefinitions: readonly EventBuilderExtraDefinition[] = [
  {
    id: 'tracks',
    icon: 'i-lucide-git-branch',
    title: 'Tracks',
    appliesTo: ['hackathon', 'build'],
    editOnly: false,
    summary: ({ form }) => describeCount(form.tracks.length)
  },
  {
    id: 'challenges',
    icon: 'i-lucide-target',
    title: 'Challenges',
    appliesTo: allTypes,
    // Challenges are saved with an event update.
    editOnly: true,
    summary: ({ form }) => describeCount(form.challenges.length)
  },
  {
    id: 'rooms',
    icon: 'i-lucide-map',
    title: 'Rooms and sessions',
    appliesTo: allTypes,
    // Rooms and sessions are saved with their own request.
    editOnly: true,
    hasOwnSave: true,
    summary: ({ sessionCount }) => describeCount(sessionCount, 'session')
  },
  {
    id: 'credits',
    icon: 'i-lucide-ticket-check',
    title: 'Credits',
    appliesTo: allTypes,
    editOnly: false,
    summary: ({ creditCount }) => describeCount(creditCount, 'code')
  },
  {
    id: 'check-in',
    icon: 'i-lucide-list-checks',
    title: 'Check-in',
    appliesTo: allTypes,
    // The next step and its questions are saved with an event update.
    editOnly: true,
    summary: ({ form }) => form.checkInFlowEnabled
      ? describeCount(form.questionnaireQuestions.length, 'question') ?? 'On'
      : null
  },
  {
    id: 'photos',
    icon: 'i-lucide-camera',
    title: 'Photos',
    appliesTo: allTypes,
    // The photo setting is saved with an event update.
    editOnly: true,
    summary: ({ form }) => form.participantPhotosEnabled ? 'On' : null
  },
  {
    id: 'talks',
    icon: 'i-lucide-megaphone',
    title: 'Call for talks',
    appliesTo: ['meetup'],
    editOnly: false,
    summary: ({ form }) => form.talkProposalsEnabled ? 'On' : null
  },
  {
    id: 'judging',
    icon: 'i-lucide-scale',
    title: 'Judging',
    appliesTo: ['hackathon'],
    editOnly: false,
    summary: ({ form }) => describeJudging(form)
  },
  {
    id: 'criteria',
    icon: 'i-lucide-sliders-horizontal',
    title: 'Judging criteria',
    appliesTo: ['hackathon'],
    // Each criterion is saved with its own request.
    editOnly: true,
    hasOwnSave: true,
    summary: ({ criteriaCount }) => describeCount(criteriaCount)
  },
  {
    id: 'submissions',
    icon: 'i-lucide-clipboard-check',
    title: 'Submissions',
    appliesTo: ['hackathon'],
    editOnly: false,
    summary: ({ form }) => describeCount([
      form.requireSubmissionSummary,
      form.requireSubmissionRepositoryUrl,
      form.requireSubmissionDemoUrl
    ].filter(Boolean).length, 'required field')
  },
  {
    id: 'prizes',
    icon: 'i-lucide-trophy',
    title: 'Prizes',
    appliesTo: ['hackathon'],
    // Each prize is saved with its own request.
    editOnly: true,
    hasOwnSave: true,
    summary: ({ prizeCount }) => describeCount(prizeCount)
  },
  {
    id: 'links',
    icon: 'i-lucide-link',
    title: 'Links',
    appliesTo: allTypes,
    editOnly: false,
    summary: ({ form }) => describeCount(countFilled([form.discordServerUrl, form.lumaEventUrl, form.slidesUrl]))
  },
  {
    id: 'images',
    icon: 'i-lucide-image',
    title: 'Images',
    appliesTo: allTypes,
    // An image is uploaded to a saved event.
    editOnly: true,
    summary: ({ event }) => describeCount(countFilled([event?.backgroundImageUrl, event?.bannerImageUrl]))
  },
  {
    id: 'terms',
    icon: 'i-lucide-file-check',
    title: 'Terms',
    appliesTo: allTypes,
    // Terms are published for a saved event.
    editOnly: true,
    hasOwnSave: true,
    summary: ({ event }) => event?.currentApplicationTermsDocumentId ? 'On' : null
  },
  {
    id: 'luma',
    icon: 'i-lucide-refresh-cw',
    title: 'Luma',
    appliesTo: allTypes,
    editOnly: false,
    summary: ({ event }) => describeLumaConnection(event)
  },
  {
    id: 'visibility',
    icon: 'i-lucide-eye-off',
    title: 'Hide event',
    appliesTo: allTypes,
    // Hiding is an action on a saved event, with its own button.
    editOnly: true,
    hasOwnSave: true,
    summary: ({ event }) => event?.hiddenAt ? 'Hidden' : null
  }
]

export function getEventBuilderExtras(eventType: EventType, mode: 'create' | 'edit') {
  return eventBuilderExtraDefinitions.filter(extra =>
    extra.appliesTo.includes(eventType) && (mode === 'edit' || !extra.editOnly)
  )
}

export function getRequiredApplicationFieldCount(form: EventFormState) {
  return [
    form.requireXProfile,
    form.requireLinkedinProfile,
    form.requireGithubProfile,
    form.requireChatgptEmail,
    form.requireOpenaiOrgId,
    form.requireLumaEmail,
    form.requireWhyThisEvent,
    form.requireProofOfExecution,
    form.requireTeamIntent,
    form.requireAiKnowledge
  ].filter(Boolean).length
}

export function getVisibleApplicationFieldCount(form: EventFormState) {
  return [
    form.applicationXProfileVisible,
    form.applicationLinkedinProfileVisible,
    form.applicationGithubProfileVisible,
    form.applicationChatgptEmailVisible,
    form.applicationOpenaiOrgIdVisible,
    form.applicationLumaEmailVisible,
    form.applicationWhyThisEventVisible,
    form.applicationProofOfExecutionVisible,
    form.applicationTeamIntentVisible,
    form.applicationAiKnowledgeVisible
  ].filter(Boolean).length
}

export function getTotalAgendaDurationMinutes(blocks: EventBuilderBlockInstance[]) {
  return Math.round(blocks.reduce((total, block) => total + (block.durationMinutes ?? 0), 0))
}

/** Agenda-only balance projection for template previews — deterministic fixed base date. */
export function projectTemplateBalance(template: EventBuilderTemplate) {
  let cursor = Date.parse('2030-01-01T09:00:00.000Z')
  const agendaItems = template.blocks.map((block) => {
    const startsAt = new Date(cursor).toISOString()

    cursor += block.durationMinutes * 60_000

    return {
      startsAt,
      endsAt: new Date(cursor).toISOString(),
      builderBlockType: block.builderBlockType
    }
  })

  return computeEventBalance({
    eventType: template.eventType,
    agendaItems,
    registrationOpensAt: null,
    registrationClosesAt: null,
    visibleApplicationFieldCount: 0,
    requiredApplicationFieldCount: 0
  })
}
