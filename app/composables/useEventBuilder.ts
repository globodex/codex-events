import { validateDraftCredits, draftCreditLimits, jsonByteLength, type StagedCredit } from '#shared/domains/credits/draft-credits'
import { computed, reactive, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'

import type { EventBuilderBlockType, EventBuilderEventType } from '#shared/domains/events/builder-blocks'
import { getEventBuilderPaletteBlockTypes } from '#shared/domains/events/builder-blocks'
import { computeEventBalance } from '#shared/domains/events/builder-scoring'
import type { EventBuilderTemplate } from '#shared/domains/events/builder-templates'
import { getEventBuilderTemplates } from '#shared/domains/events/builder-templates'
import {
  applyEventTypeApplicationFieldDefaults,
  buildEventCreateBody,
  buildEventConfigurationPatch,
  createEventSlug
} from '~/domains/events/admin-event'
import {
  applyTemplateToState,
  createBlockInstance,
  createBuilderStateFromEvent,
  createEmptyEventBuilderState,
  computeBlockSchedule,
  deriveScheduleDefaults,
  getBuilderChecklist,
  getEventBuilderExtras,
  getRequiredApplicationFieldCount,
  getVisibleApplicationFieldCount,
  pruneBlocksForEventType,
  reorderAgendaBlocks,
  setBlockEnd,
  setBlockStart,
  toEventBalanceInputFromState,
  toEventBuilderFormState
} from '~/domains/events/builder'
import type { EventRecord, EventType } from '~/domains/events/records'

export interface UseEventBuilderOptions {
  mode: 'create' | 'edit'
  initialEvent?: MaybeRefOrGetter<EventRecord | null | undefined>
}

export function useEventBuilder(options: UseEventBuilderOptions) {
  const state = reactive(createEmptyEventBuilderState())
  const justSubmitted = ref(false)
  const draftSnapshot = computed(() => JSON.stringify(state))
  const savedSnapshot = shallowRef(draftSnapshot.value)
  const isDirty = computed(() => !justSubmitted.value && draftSnapshot.value !== savedSnapshot.value)

  function markSaved(snapshot: string) {
    savedSnapshot.value = snapshot
  }

  if (options.initialEvent) {
    watch(() => toValue(options.initialEvent), (event, previous) => {
      if (event && (event.id !== previous?.id || !isDirty.value)) {
        Object.assign(state, createBuilderStateFromEvent(event))
        markSaved(draftSnapshot.value)
      }
    }, { immediate: true })
  }

  // Slug follows the name until the organizer edits the slug manually.
  watch(() => state.form.name, (name) => {
    if (!state.slugEdited) {
      state.form.slug = createEventSlug(name)
    }
  })

  const schedule = computed(() => computeBlockSchedule(state.eventStartsAt, state.blocks))
  const report = computed(() => computeEventBalance(toEventBalanceInputFromState(state)))
  const checklist = computed(() => getBuilderChecklist(state))
  const canSubmit = computed(() => checklist.value.every(item => item.complete))
  const paletteTypes = computed(() =>
    getEventBuilderPaletteBlockTypes(state.form.eventType as EventBuilderEventType)
  )
  const templates = computed(() =>
    getEventBuilderTemplates(state.form.eventType as EventBuilderEventType)
  )
  const extras = computed(() => getEventBuilderExtras(state.form.eventType, options.mode))
  const requiredApplicationFieldCount = computed(() => getRequiredApplicationFieldCount(state.form))
  const visibleApplicationFieldCount = computed(() => getVisibleApplicationFieldCount(state.form))

  function addBlock(type: EventBuilderBlockType, index?: number) {
    const block = createBlockInstance(type)

    if (index === undefined || index >= state.blocks.length) {
      state.blocks.push(block)
    } else {
      state.blocks.splice(Math.max(0, index), 0, block)
    }

    return block.id
  }

  function removeBlock(id: string) {
    state.blocks = state.blocks.filter(block => block.id !== id)

    if (state.blocks[0]) {
      state.blocks[0].gapBeforeMs = 0
    }
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const index = state.blocks.findIndex(block => block.id === id)
    reorderBlocks(index, index + direction)
  }

  function reorderBlocks(oldIndex: number, newIndex: number) {
    state.blocks = reorderAgendaBlocks(state.blocks, oldIndex, newIndex)
  }

  function setBlockDuration(id: string, minutes: number) {
    const block = state.blocks.find(entry => entry.id === id)

    if (block) {
      block.durationMinutes = minutes
    }
  }

  function setBlockTitle(id: string, title: string) {
    const block = state.blocks.find(entry => entry.id === id)

    if (block) {
      block.title = title
    }
  }

  function cloneBlock(id: string) {
    const index = state.blocks.findIndex(entry => entry.id === id)

    if (index !== -1) {
      state.blocks.splice(index + 1, 0, { ...state.blocks[index]!, id: crypto.randomUUID(), gapBeforeMs: 0 })
    }
  }

  function setLocationMode(online: boolean) {
    state.form.inPersonEvent = !online
    state.locationChosen = true
  }

  function setBlockDetails(id: string, details: string) {
    const block = state.blocks.find(entry => entry.id === id)

    if (block) {
      block.details = details
    }
  }

  function setBlockFocusCost(id: string, value: number) {
    const block = state.blocks.find(entry => entry.id === id)

    if (block?.custom) {
      block.focusCost = Math.round(Math.min(99, Math.max(0, value)))
    }
  }

  function setBlockEnergyDelta(id: string, value: number) {
    const block = state.blocks.find(entry => entry.id === id)

    if (block?.custom) {
      block.energyDelta = Math.round(Math.min(99, Math.max(-99, value)))
    }
  }

  function applyTemplate(template: EventBuilderTemplate) {
    if (state.blocks.length > 0
      && !window.confirm(`Replace your current ${state.blocks.length} block${state.blocks.length === 1 ? '' : 's'} with "${template.name}"?`)) {
      return false
    }

    Object.assign(state, applyTemplateToState(state, template))

    return true
  }

  function setEventType(eventType: EventType) {
    if (eventType === state.form.eventType && state.eventTypeChosen) {
      return true
    }

    const { kept, removed } = pruneBlocksForEventType(state.blocks, eventType)

    if (removed.length > 0
      && !window.confirm(`Switching removes ${removed.length} block${removed.length === 1 ? '' : 's'} that only fit the current event type (${removed.map(block => block.title).join(', ')}). Continue?`)) {
      return false
    }

    state.blocks = kept

    if (state.blocks[0]) {
      state.blocks[0].gapBeforeMs = 0
    }

    state.form.eventType = eventType
    // Every event type has its own sign-up form. A Build or a Meetup
    // does not ask for the ChatGPT email and the OpenAI org ID that a Hackathon requires.
    applyEventTypeApplicationFieldDefaults(state.form, eventType)
    state.eventTypeChosen = true
    state.appliedTemplateId = null

    return true
  }

  function markSlugEdited() {
    state.slugEdited = true
  }

  // A chosen event start fills window fields with sane defaults. Fields keep
  // following the derived value until the organizer edits them by hand, so a
  // segmented start being typed digit by digit settles on the final defaults.
  const derivedWindowDefaults: Record<string, string> = {}

  function setEventStartsAt(eventStartsAt: string) {
    state.eventStartsAt = eventStartsAt
    if (!eventStartsAt) {
      return
    }

    const defaults = deriveScheduleDefaults(eventStartsAt, state.blocks, state.form.eventType)

    for (const [field, value] of Object.entries(defaults)) {
      const key = field as keyof typeof defaults

      if (!state.form[key] || state.form[key] === derivedWindowDefaults[key]) {
        state.form[key] = value as string
        derivedWindowDefaults[key] = value as string
      }
    }
  }

  function setBlockStartsAt(id: string, startsAt: string) {
    // The first block starts with the event.
    if (state.blocks[0]?.id === id) {
      setEventStartsAt(startsAt)
    } else {
      state.blocks = setBlockStart(state.blocks, schedule.value, id, startsAt)
    }
  }

  /** Sets the end of a block. `null` removes the end. */
  function setBlockEndsAt(id: string, endsAt: string | null) {
    state.blocks = setBlockEnd(state.blocks, schedule.value, id, endsAt)
  }

  function markSubmitted() {
    justSubmitted.value = true
  }

  function setStagedCredits(credits: StagedCredit[]) {
    state.credits = credits
  }

  function buildCreateBody() {
    const body = {
      ...buildEventCreateBody(toEventBuilderFormState(state)),
      credits: validateDraftCredits(state.credits.map(offer => ({
        ...offer, redirectOnClaim: state.form.simplifiedClaimingEnabled && offer.redirectOnClaim
      })), state.form.simplifiedClaimingEnabled)
    }
    if (jsonByteLength(body) > draftCreditLimits.maxRequestBytes) throw new Error('The draft request must be 8 MB or smaller.')
    return body
  }

  function buildPatchBody() {
    const form = toEventBuilderFormState(state)

    return buildEventConfigurationPatch(form, form.eventType)
  }

  return {
    state,
    schedule,
    report,
    checklist,
    canSubmit,
    paletteTypes,
    templates,
    extras,
    requiredApplicationFieldCount,
    visibleApplicationFieldCount,
    isDirty,
    addBlock,
    removeBlock,
    moveBlock,
    reorderBlocks,
    setBlockDuration,
    setBlockTitle,
    setBlockDetails,
    cloneBlock,
    setLocationMode,
    setBlockFocusCost,
    setBlockEnergyDelta,
    applyTemplate,
    setEventType,
    markSlugEdited,
    setEventStartsAt,
    setBlockStartsAt,
    setBlockEndsAt,
    markSubmitted,
    draftSnapshot,
    markSaved,
    setStagedCredits,
    buildCreateBody,
    buildPatchBody
  }
}

export type EventBuilderApi = ReturnType<typeof useEventBuilder>
