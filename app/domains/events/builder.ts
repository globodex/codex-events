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

export interface EventBuilderChecklistItem {
  id: string
  label: string
  complete: boolean
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
    return { id: list.checklistId, label: problem.message, complete: false }
  }

  return {
    id: list.checklistId,
    label: `${list.entryName} ${position + 1}: ${problem.message}`,
    complete: false,
    fieldRef: `${list.fieldIdPrefix}${list.entries[position]!.id}`
  }
}

/**
 * Checklist lines for what the organizer wrote in "More settings" and has not finished: an
 * incomplete challenge, and an incomplete question for after check-in. The save button stays
 * off while the checklist has an open line, so the event is never sent with such an entry.
 *
 * This is the one place that tells the organizer about unfinished list entries.
 */
function getUnfinishedEntryChecklistItems(form: EventFormState) {
  return [
    getUnfinishedEntryChecklistItem({
      checklistId: 'challenges',
      entryName: 'Challenge',
      entries: form.challenges,
      schema: eventChallengesSchema,
      fieldIdPrefix: eventBuilderChallengeTitleIdPrefix
    }),
    // The questions are sent only while the next step is on (see `buildPatchBody` in `useEventBuilder`).
    form.checkInFlowEnabled
      ? getUnfinishedEntryChecklistItem({
          checklistId: 'questionnaire-questions',
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

  // The slug rides with the name: it auto-derives from it, so a broken slug
  // reopens the "name" step instead of earning its own checklist line.
  const items: EventBuilderChecklistItem[] = [
    {
      id: 'name',
      label: 'Name the event',
      complete: fieldValid('name') && fieldValid('slug'),
      fieldRef: 'event-builder-name'
    },
    { id: 'event-type', label: 'Pick the event type', complete: state.eventTypeChosen, fieldRef: 'event-builder-event-type' },
    {
      id: 'agenda',
      label: 'Add at least one agenda block',
      complete: state.blocks.length > 0,
      fieldRef: 'event-builder-block-palette'
    },
    { id: 'event-start', label: 'Set the event start', complete: fieldValid('eventStartsAt'), fieldRef: 'event-builder-event-starts-at' },
    {
      id: 'location',
      label: 'Set the location or go online',
      complete: state.locationChosen
        && (basics.isOnline || (fieldValid('city') && fieldValid('country') && fieldValid('address'))),
      fieldRef: 'event-builder-location'
    },
    { id: 'description', label: 'Describe the event', complete: fieldValid('description'), fieldRef: 'event-builder-description' },
    {
      id: 'registration-window',
      label: 'Set a valid registration window',
      complete: fieldValid('registrationOpensAt') && fieldValid('registrationClosesAt') && !issuePaths.has('registrationClosesAt'),
      fieldRef: 'event-builder-registration-opens-at'
    }
  ]

  if (basics.isHackathon && state.eventTypeChosen) {
    items.push({
      id: 'submission-window',
      label: 'Set a valid submission window',
      complete: Boolean(basics.submissionOpensAt) && Boolean(basics.submissionClosesAt)
        && !issuePaths.has('submissionOpensAt') && !issuePaths.has('submissionClosesAt'),
      fieldRef: 'event-builder-submission-opens-at'
    })
  }

  items.push(...getUnfinishedEntryChecklistItems(state.form))

  return items
}

export type EventBuilderSettingsGroupId
  = | 'communication'
    | 'application-form'
    | 'capacity'
    | 'judging'
    | 'team-size'
    | 'tracks'
    | 'call-for-talks'
    | 'submission-requirements'
    | 'luma-sync'
    | 'credits'
    | 'after-check-in'
    | 'challenges'
    | 'images'
    | 'terms'

export interface EventBuilderSettingsGroupDefinition {
  id: EventBuilderSettingsGroupId
  icon: string
  title: string
  description: string
  appliesTo: readonly EventType[]
  /** Parity groups embed the classic controls instead of builder-native ones. */
  parity: boolean
  /** Group only appears when editing an existing event. */
  editOnly: boolean
  isComplete: (form: EventFormState, event: EventRecord | null) => boolean
}

const allTypes: readonly EventType[] = ['hackathon', 'meetup', 'build']

export const eventBuilderSettingsGroupDefinitions: readonly EventBuilderSettingsGroupDefinition[] = [
  {
    id: 'communication',
    icon: 'i-lucide-link',
    title: 'Discord, Luma & slides links',
    description: 'Where participants find the community, the ticket page, and the slides.',
    appliesTo: allTypes,
    parity: false,
    editOnly: false,
    isComplete: form => [form.discordServerUrl, form.lumaEventUrl, form.slidesUrl]
      .some(value => value.trim().length > 0)
  },
  {
    id: 'application-form',
    icon: 'i-lucide-clipboard-list',
    title: 'Application form',
    description: 'What applicants must provide. Every extra required field costs sign-ups.',
    appliesTo: allTypes,
    parity: false,
    editOnly: false,
    isComplete: (form) => {
      const requiredCount = [
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

      return requiredCount <= 6
    }
  },
  {
    id: 'capacity',
    icon: 'i-lucide-users-round',
    title: 'Capacity & approvals',
    description: 'Participant limit and automatic application approval.',
    appliesTo: allTypes,
    parity: false,
    editOnly: false,
    isComplete: form => form.participantsLimit !== null
  },
  {
    id: 'judging',
    icon: 'i-lucide-scale',
    title: 'Judging',
    description: 'Blind reviews, live pitches, and how their scores combine.',
    appliesTo: ['hackathon'],
    parity: false,
    editOnly: false,
    isComplete: form => form.blindReviewCount > 0 || form.pitchReviewEnabled
  },
  {
    id: 'team-size',
    icon: 'i-lucide-users',
    title: 'Team size',
    description: 'How many people can join one team.',
    appliesTo: ['hackathon'],
    parity: false,
    editOnly: false,
    isComplete: form => form.maxTeamMembers >= 1
  },
  {
    id: 'tracks',
    icon: 'i-lucide-git-branch',
    title: 'Tracks',
    description: 'Themed tracks give participants direction and judges structure.',
    appliesTo: ['hackathon', 'build'],
    parity: false,
    editOnly: false,
    isComplete: form => form.tracks.length > 0
  },
  {
    id: 'call-for-talks',
    icon: 'i-lucide-megaphone',
    title: 'Call for talks',
    description: 'Let community members propose their own talks.',
    appliesTo: ['meetup'],
    parity: false,
    editOnly: false,
    isComplete: form => form.talkProposalsEnabled
  },
  {
    id: 'submission-requirements',
    icon: 'i-lucide-clipboard-check',
    title: 'Submission requirements',
    description: 'What a complete project submission needs.',
    appliesTo: ['hackathon'],
    parity: false,
    editOnly: false,
    isComplete: () => true
  },
  {
    id: 'luma-sync',
    icon: 'i-lucide-refresh-cw',
    title: 'Luma connection',
    description: 'Connect your Luma event.',
    appliesTo: allTypes,
    parity: true,
    editOnly: false,
    isComplete: (form, event) => Boolean(event?.lumaWebhookStatus === 'configured'
      && form.lumaEventApiId.trim() === event.lumaEventApiId
      && form.lumaApiKey.trim() === event.lumaApiKey)
  },
  {
    id: 'credits',
    icon: 'i-lucide-ticket-check',
    title: 'Credits',
    description: 'Upload credit codes or links and choose how participants claim them.',
    appliesTo: allTypes,
    parity: true,
    editOnly: false,
    isComplete: (_form, event) => event !== null
  },
  {
    id: 'after-check-in',
    icon: 'i-lucide-list-checks',
    title: 'After check-in',
    description: 'Tell participants what to do when they arrive, ask them a few questions, and let them add photos.',
    appliesTo: allTypes,
    parity: false,
    // These settings are saved with an event update, so the group needs an existing event.
    editOnly: true,
    isComplete: form => form.checkInFlowEnabled || form.participantPhotosEnabled
  },
  {
    id: 'challenges',
    icon: 'i-lucide-target',
    title: 'Challenges',
    description: 'Practical tasks for participants. They read published challenges after check-in.',
    appliesTo: allTypes,
    parity: false,
    // Challenges are saved with an event update, so the group needs an existing event.
    editOnly: true,
    isComplete: form => form.challenges.some(challenge => challenge.isPublished)
  },
  {
    id: 'images',
    icon: 'i-lucide-image',
    title: 'Background & banner images',
    description: 'The images on the public event page.',
    appliesTo: allTypes,
    parity: true,
    editOnly: true,
    isComplete: (_form, event) => Boolean(event?.backgroundImageUrl || event?.bannerImageUrl)
  },
  {
    id: 'terms',
    icon: 'i-lucide-file-check',
    title: 'Terms documents',
    description: 'Event-specific terms participants accept when applying.',
    appliesTo: allTypes,
    parity: true,
    editOnly: true,
    isComplete: (_form, event) => Boolean(event?.currentApplicationTermsDocumentId)
  }
]

export function getEventBuilderSettingsGroups(eventType: EventType, mode: 'create' | 'edit') {
  return eventBuilderSettingsGroupDefinitions.filter(group =>
    group.appliesTo.includes(eventType) && (mode === 'edit' || !group.editOnly)
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
