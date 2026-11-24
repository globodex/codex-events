<script setup lang="ts">
// The event builder. It shows one level at a time: the event, when and where, the agenda, the
// registration, and the extras. The level bar at the top leads to every level, and the bar at the
// bottom moves one level back or forward and saves the event.
import type { EventBuilderTemplate } from '#shared/domains/events/builder-templates'
import type { TermsDocument, EventRecord, EventType } from '~/domains/events/records'
import type { EventBuilderApi } from '~/composables/useEventBuilder'
import {
  buildEventBuilderBasicsInput,
  eventBuilderBasicsSchema,
  eventBuilderLevels,
  getEventBuilderLevelBarItems
} from '~/domains/events/builder'
import type { EventBuilderChecklistItem, EventBuilderExtraId, EventBuilderLevelId } from '~/domains/events/builder'
import AdminBuilderLevelBar from '~/components/admin/builder/molecules/AdminBuilderLevelBar.vue'
import AdminBuilderLevelNav from '~/components/admin/builder/molecules/AdminBuilderLevelNav.vue'
import AdminBuilderAgendaTrack from '~/components/admin/builder/organisms/AdminBuilderAgendaTrack.vue'
import AdminBuilderBlockPalette from '~/components/admin/builder/organisms/AdminBuilderBlockPalette.vue'
import AdminBuilderEventForm from '~/components/admin/builder/organisms/AdminBuilderEventForm.vue'
import AdminBuilderExtrasBoard from '~/components/admin/builder/organisms/AdminBuilderExtrasBoard.vue'
import AdminBuilderRegistrationForm from '~/components/admin/builder/organisms/AdminBuilderRegistrationForm.vue'
import AdminBuilderScorePanel from '~/components/admin/builder/organisms/AdminBuilderScorePanel.vue'
import AdminBuilderTemplateGallery from '~/components/admin/builder/organisms/AdminBuilderTemplateGallery.vue'
import AdminBuilderWhenWhereForm from '~/components/admin/builder/organisms/AdminBuilderWhenWhereForm.vue'
import type { EvaluationCriterion } from '~/domains/judging/criteria-config'
import type { PrizeDefinition } from '~/domains/outcomes/prizes'
import type {
  AccountEventLumaGuestList,
  AccountEventSettingsCreditOffer,
  AccountEventSimplifiedClaimingStatus
} from '#shared/domains/events/account-event-settings-page'

const props = defineProps<{
  builder: EventBuilderApi
  mode: 'create' | 'edit'
  event?: EventRecord | null
  isSubmitting: boolean
  submitError: string
  /** The sessions in the rooms of the event. The tile "Rooms and sessions" shows the number. */
  sessionCount?: number
  /** The saved judging criteria and prizes of a Hackathon. */
  criteria?: EvaluationCriterion[]
  prizes?: PrizeDefinition[]
  backgroundImageUploadPending?: boolean
  backgroundImageUploadError?: string
  bannerImageUploadPending?: boolean
  bannerImageUploadError?: string
  currentApplicationTerms?: TermsDocument | null
  currentWinnerTerms?: TermsDocument | null
  savingTermsDocumentType?: TermsDocument['documentType'] | null
  initialSimplifiedClaimingStatus?: AccountEventSimplifiedClaimingStatus | null
  lumaGuestList?: AccountEventLumaGuestList | null
  creditOffers?: AccountEventSettingsCreditOffer[]
  hasExistingTalkProposal?: boolean
}>()

const emit = defineEmits<{
  submit: []
  uploadBackgroundImage: [file: File]
  removeBackgroundImage: []
  uploadBannerImage: [file: File]
  removeBannerImage: []
  saveTerms: [documentType: TermsDocument['documentType'], content: string]
  updated: []
  /** True while an extra with its own save button holds a change that is not saved. */
  extrasUnsavedChange: [unsaved: boolean]
}>()

defineSlots<{
  /** The editor of the extra "Rooms and sessions". The page owns it, because it loads and saves it. */
  rooms(): unknown
}>()

const currentLevelId = ref<EventBuilderLevelId>('event')
// A level is mounted when the organizer opens it for the first time, and it stays mounted.
// What they typed or opened on it is still there when they come back from another level.
const visitedLevelIds = ref<EventBuilderLevelId[]>(['event'])
const openExtraId = ref<EventBuilderExtraId | null>(null)
const topElement = useTemplateRef<HTMLElement>('top')

const levelBarItems = computed(() => getEventBuilderLevelBarItems({
  checklist: props.builder.checklist.value,
  mode: props.mode,
  visitedLevelIds: visitedLevelIds.value,
  eventTypeChosen: props.builder.state.eventTypeChosen
}))
const currentLevelIndex = computed(() => eventBuilderLevels.findIndex(level => level.id === currentLevelId.value))

/** Brings the level bar back into view, for example after the level changed far down a long page. */
async function scrollToTop() {
  await nextTick()
  topElement.value?.scrollIntoView({ block: 'nearest' })
}

async function openLevel(id: EventBuilderLevelId) {
  currentLevelId.value = id

  if (!visitedLevelIds.value.includes(id)) {
    visitedLevelIds.value.push(id)
  }

  await scrollToTop()
}

function openNeighbourLevel(direction: -1 | 1) {
  const level = eventBuilderLevels[currentLevelIndex.value + direction]

  if (level) {
    openLevel(level.id)
  }
}

// The tiles and an open extra have different heights, so the level bar comes back into view.
watch(openExtraId, scrollToTop)

// An extra with its own save button hides the bar at the bottom: "Save event" there would not
// save what the organizer typed into the extra.
const levelNavHidden = computed(() => currentLevelId.value === 'extras'
  && props.builder.extras.value.some(extra => extra.id === openExtraId.value && extra.hasOwnSave))

// The agenda level offers the templates while the agenda is empty. With blocks on the agenda
// the organizer opens them with a button, because a template replaces the blocks.
const templatesOpen = ref(false)
const showTemplates = computed(() => props.builder.state.blocks.length === 0 || templatesOpen.value)

// True while a palette tile is being dragged — the agenda track lights up as
// the drop zone for exactly that window.
const paletteDragActive = ref(false)

// The messages below the fields appear after the organizer tried to save.
const saveAttempted = ref(false)
// After a save that did not happen, the note next to the save button names every open step. It
// gets shorter while the organizer fills in what is missing.
const missingSteps = computed(() => saveAttempted.value
  ? props.builder.checklist.value.filter(item => !item.complete).map(item => item.label)
  : [])

const fieldErrors = computed<Record<string, string>>(() => {
  if (!saveAttempted.value) {
    return {}
  }

  const parsed = eventBuilderBasicsSchema.safeParse(buildEventBuilderBasicsInput(props.builder.state))

  if (parsed.success) {
    return {}
  }

  const errors: Record<string, string> = {}

  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? '')

    if (field && !errors[field]) {
      errors[field] = issue.message
    }
  }

  return errors
})

function onEventTypeSelect(eventType: EventType) {
  props.builder.setEventType(eventType)
}

function onApplyTemplate(template: EventBuilderTemplate) {
  if (props.builder.applyTemplate(template)) {
    templatesOpen.value = false
  }
}

/** Opens the level (and the extra) of a step and puts the cursor into its field. */
async function showStep(item: EventBuilderChecklistItem) {
  if (item.extra) {
    openExtraId.value = item.extra
  }

  await openLevel(item.level)

  if (!item.fieldRef) {
    return
  }

  const element = document.getElementById(item.fieldRef)

  element?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  if (element instanceof HTMLElement && 'focus' in element) {
    element.focus({ preventScroll: true })
  }
}

function onSubmit() {
  saveAttempted.value = true

  // An event with an open step is not saved: the organizer lands on the first open step instead.
  const openStep = props.builder.checklist.value.find(item => !item.complete)

  if (openStep) {
    showStep(openStep)
  } else {
    emit('submit')
  }
}
</script>

<template>
  <div class="space-y-6">
    <div
      ref="top"
      class="scroll-mt-4"
    >
      <AdminBuilderLevelBar
        :levels="levelBarItems"
        :current-id="currentLevelId"
        @select="openLevel"
      />
    </div>

    <AdminBuilderEventForm
      v-show="currentLevelId === 'event'"
      :form="builder.state.form"
      :event-type-chosen="builder.state.eventTypeChosen"
      :event-type-locked="mode === 'edit'"
      :errors="fieldErrors"
      @slug-edited="builder.markSlugEdited()"
      @select-event-type="onEventTypeSelect"
    />

    <AdminBuilderWhenWhereForm
      v-if="visitedLevelIds.includes('when-where')"
      v-show="currentLevelId === 'when-where'"
      :form="builder.state.form"
      :event-starts-at="builder.state.eventStartsAt"
      :location-chosen="builder.state.locationChosen"
      :errors="fieldErrors"
      @update:event-starts-at="value => builder.setEventStartsAt(value)"
      @choose-location="online => builder.setLocationMode(online)"
    />

    <section
      v-if="visitedLevelIds.includes('agenda')"
      v-show="currentLevelId === 'agenda'"
      class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]"
    >
      <AdminBuilderScorePanel
        class="lg:sticky lg:top-6 lg:order-2 lg:self-start"
        :report="builder.report.value"
        :blocks="builder.state.blocks"
      />

      <div class="min-w-0 space-y-6">
        <div
          v-if="builder.state.blocks.length > 0"
          class="flex justify-end"
        >
          <AppButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-layout-template"
            label="Templates"
            :aria-expanded="templatesOpen"
            data-testid="event-builder-templates-toggle"
            @click="templatesOpen = !templatesOpen"
          />
        </div>

        <AdminBuilderTemplateGallery
          v-if="showTemplates"
          :templates="builder.templates.value"
          @apply="onApplyTemplate"
        />

        <AdminBuilderAgendaTrack
          :blocks="builder.state.blocks"
          :schedule="builder.schedule.value"
          :receiving="paletteDragActive"
          @reorder="(oldIndex, newIndex) => builder.reorderBlocks(oldIndex, newIndex)"
          @insert="(type, index) => builder.addBlock(type, index)"
          @move="(id, direction) => builder.moveBlock(id, direction)"
          @remove="id => builder.removeBlock(id)"
          @update-title="(id, title) => builder.setBlockTitle(id, title)"
          @update-details="(id, details) => builder.setBlockDetails(id, details)"
          @clone="id => builder.cloneBlock(id)"
          @update-duration="(id, minutes) => builder.setBlockDuration(id, minutes)"
          @update-start="(id, startsAt) => builder.setBlockStartsAt(id, startsAt)"
          @update-end="(id, endsAt) => builder.setBlockEndsAt(id, endsAt)"
          @update-focus-cost="(id, value) => builder.setBlockFocusCost(id, value)"
          @update-energy-delta="(id, value) => builder.setBlockEnergyDelta(id, value)"
        />

        <AdminBuilderBlockPalette
          :types="builder.paletteTypes.value"
          @add="type => builder.addBlock(type)"
          @drag-start="paletteDragActive = true"
          @drag-end="paletteDragActive = false"
        />
      </div>
    </section>

    <AdminBuilderRegistrationForm
      v-if="visitedLevelIds.includes('registration')"
      v-show="currentLevelId === 'registration'"
      :form="builder.state.form"
      :required-application-field-count="builder.requiredApplicationFieldCount.value"
      :visible-application-field-count="builder.visibleApplicationFieldCount.value"
      :errors="fieldErrors"
    />

    <AdminBuilderExtrasBoard
      v-if="visitedLevelIds.includes('extras')"
      v-show="currentLevelId === 'extras'"
      v-model:open-id="openExtraId"
      :staged-credits="builder.state.credits"
      :form="builder.state.form"
      :extras="builder.extras.value"
      :saving="isSubmitting"
      :mode="mode"
      :event="event ?? null"
      :session-count="sessionCount"
      :criteria="criteria"
      :prizes="prizes"
      :background-image-upload-pending="backgroundImageUploadPending"
      :background-image-upload-error="backgroundImageUploadError"
      :banner-image-upload-pending="bannerImageUploadPending"
      :banner-image-upload-error="bannerImageUploadError"
      :current-application-terms="currentApplicationTerms"
      :current-winner-terms="currentWinnerTerms"
      :saving-terms-document-type="savingTermsDocumentType"
      :initial-simplified-claiming-status="initialSimplifiedClaimingStatus"
      :luma-guest-list="lumaGuestList"
      :credit-offers="creditOffers"
      :has-existing-talk-proposal="hasExistingTalkProposal"
      @update:staged-credits="builder.setStagedCredits"
      @save="onSubmit"
      @upload-background-image="file => emit('uploadBackgroundImage', file)"
      @remove-background-image="emit('removeBackgroundImage')"
      @upload-banner-image="file => emit('uploadBannerImage', file)"
      @remove-banner-image="emit('removeBannerImage')"
      @save-terms="(documentType, content) => emit('saveTerms', documentType, content)"
      @updated="emit('updated')"
      @unsaved-change="unsaved => emit('extrasUnsavedChange', unsaved)"
    >
      <template #rooms>
        <slot name="rooms" />
      </template>
    </AdminBuilderExtrasBoard>

    <AdminBuilderLevelNav
      v-show="!levelNavHidden"
      :can-go-back="currentLevelIndex > 0"
      :can-go-next="currentLevelIndex < eventBuilderLevels.length - 1"
      :next-locked="!builder.state.eventTypeChosen"
      :submit-label="mode === 'create' ? 'Create draft event' : 'Save event'"
      :ready-to-submit="builder.canSubmit.value"
      :missing-steps="missingSteps"
      :is-submitting="isSubmitting"
      :submit-error="submitError"
      @back="openNeighbourLevel(-1)"
      @next="openNeighbourLevel(1)"
      @submit="onSubmit"
    />
  </div>
</template>
