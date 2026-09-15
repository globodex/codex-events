<script setup lang="ts">
import type { EventBuilderTemplate } from '#shared/domains/events/builder-templates'
import type { TermsDocument, EventRecord, EventType } from '~/domains/events/records'
import type { EventBuilderApi } from '~/composables/useEventBuilder'
import type { EventImageVersions } from '~/domains/events/presentation'
import { eventBuilderBasicsSchema, buildEventBuilderBasicsInput } from '~/domains/events/builder'
import type { EventBuilderChecklistItem } from '~/domains/events/builder'
import AdminBuilderAgendaTrack from '~/components/admin/builder/organisms/AdminBuilderAgendaTrack.vue'
import AdminBuilderBasicsForm from '~/components/admin/builder/organisms/AdminBuilderBasicsForm.vue'
import AdminBuilderBlockPalette from '~/components/admin/builder/organisms/AdminBuilderBlockPalette.vue'
import AdminBuilderEventTypePicker from '~/components/admin/builder/organisms/AdminBuilderEventTypePicker.vue'
import AdminBuilderNameHero from '~/components/admin/builder/molecules/AdminBuilderNameHero.vue'
import AdminBuilderSettingsBoard from '~/components/admin/builder/organisms/AdminBuilderSettingsBoard.vue'
import AdminBuilderSidePanel from '~/components/admin/builder/organisms/AdminBuilderSidePanel.vue'
import AdminBuilderTemplateGallery from '~/components/admin/builder/organisms/AdminBuilderTemplateGallery.vue'
import type {
  AccountEventSettingsCreditOffer,
  AccountEventSimplifiedClaimingStatus
} from '#shared/domains/events/account-event-settings-page'

const props = defineProps<{
  builder: EventBuilderApi
  mode: 'create' | 'edit'
  event?: EventRecord | null
  isSubmitting: boolean
  submitError: string
  backgroundImageUploadPending?: boolean
  backgroundImageUploadError?: string
  bannerImageUploadPending?: boolean
  bannerImageUploadError?: string
  imageVersion?: string | number | EventImageVersions | null
  currentApplicationTerms?: TermsDocument | null
  currentWinnerTerms?: TermsDocument | null
  savingTermsDocumentType?: TermsDocument['documentType'] | null
  initialSimplifiedClaimingStatus?: AccountEventSimplifiedClaimingStatus | null
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
}>()

const submitAttempted = ref(false)

// Staged reveal: naming the event surfaces the type picker; picking a type
// surfaces the rest. Once the type is chosen the picker never hides again.
const showTypePicker = computed(() =>
  props.builder.state.form.name.trim().length > 0 || props.builder.state.eventTypeChosen
)

// True while a palette tile is being dragged — the agenda track lights up as
// the drop zone for exactly that window.
const paletteDragActive = ref(false)

const fieldErrors = computed<Record<string, string>>(() => {
  if (!submitAttempted.value) {
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
  props.builder.applyTemplate(template)
}

function focusChecklistField(item: EventBuilderChecklistItem) {
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
  submitAttempted.value = true

  if (props.builder.canSubmit.value) {
    emit('submit')
  }
}
</script>

<template>
  <div>
    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,23rem)]">
      <div class="min-w-0 space-y-7">
        <AdminBuilderNameHero
          :form="builder.state.form"
          :name-error="fieldErrors.name"
          :slug-error="fieldErrors.slug"
          @slug-edited="builder.markSlugEdited()"
        />

        <!-- Light separators mirror the checklist steps: name, type, agenda, details. -->
        <div
          v-if="showTypePicker"
          class="space-y-7 animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none"
        >
          <div
            aria-hidden="true"
            class="border-t border-black/5 dark:border-white/[0.05]"
          />

          <AdminBuilderEventTypePicker
            :model-value="builder.state.eventTypeChosen ? builder.state.form.eventType : null"
            :disabled="mode === 'edit'"
            @select="onEventTypeSelect"
          />
        </div>

        <!-- Templates, blocks, and settings all derive from the event type. -->
        <div
          v-if="builder.state.eventTypeChosen"
          class="space-y-7 animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none"
        >
          <div
            aria-hidden="true"
            class="border-t border-black/5 dark:border-white/[0.05]"
          />

          <AdminBuilderTemplateGallery
            :templates="builder.templates.value"
            @apply="onApplyTemplate"
          />

          <AdminBuilderBlockPalette
            :types="builder.paletteTypes.value"
            @add="type => builder.addBlock(type)"
            @drag-start="paletteDragActive = true"
            @drag-end="paletteDragActive = false"
          />

          <AdminBuilderAgendaTrack
            :blocks="builder.state.blocks"
            :schedule="builder.schedule.value"
            :non-sequential-warning="builder.state.hydratedNonSequential"
            :receiving="paletteDragActive"
            @reorder="(oldIndex, newIndex) => builder.reorderBlocks(oldIndex, newIndex)"
            @insert="(type, index) => builder.addBlock(type, index)"
            @move="(id, direction) => builder.moveBlock(id, direction)"
            @remove="id => builder.removeBlock(id)"
            @update-title="(id, title) => builder.setBlockTitle(id, title)"
            @update-details="(id, details) => builder.setBlockDetails(id, details)"
            @clone="id => builder.cloneBlock(id)"
            @update-duration="(id, minutes) => builder.setBlockDuration(id, minutes)"
            @update-focus-cost="(id, value) => builder.setBlockFocusCost(id, value)"
            @update-energy-delta="(id, value) => builder.setBlockEnergyDelta(id, value)"
          />

          <div
            aria-hidden="true"
            class="border-t border-black/5 dark:border-white/[0.05]"
          />

          <AdminBuilderBasicsForm
            :form="builder.state.form"
            :event-starts-at="builder.state.eventStartsAt"
            :location-chosen="builder.state.locationChosen"
            :errors="fieldErrors"
            @update:event-starts-at="value => builder.setEventStartsAt(value)"
            @choose-location="online => builder.setLocationMode(online)"
          />

          <div
            aria-hidden="true"
            class="border-t border-black/5 dark:border-white/[0.05]"
          />

          <AdminBuilderSettingsBoard
            :staged-credits="builder.state.credits"
            :saving="isSubmitting"
            :form="builder.state.form"
            :groups="builder.settingsGroups.value"
            :mode="mode"
            :event="event ?? null"
            :required-application-field-count="builder.requiredApplicationFieldCount.value"
            :visible-application-field-count="builder.visibleApplicationFieldCount.value"
            :background-image-upload-pending="backgroundImageUploadPending"
            :background-image-upload-error="backgroundImageUploadError"
            :banner-image-upload-pending="bannerImageUploadPending"
            :banner-image-upload-error="bannerImageUploadError"
            :image-version="imageVersion"
            :current-application-terms="currentApplicationTerms"
            :current-winner-terms="currentWinnerTerms"
            :saving-terms-document-type="savingTermsDocumentType"
            :initial-simplified-claiming-status="initialSimplifiedClaimingStatus"
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
          />
        </div>
      </div>

      <AdminBuilderSidePanel
        :checklist="builder.checklist.value"
        :report="builder.report.value"
        :blocks="builder.state.blocks"
        :event-starts-at="builder.state.eventStartsAt"
        :can-submit="builder.canSubmit.value"
        :is-submitting="isSubmitting"
        :submit-error="submitError"
        :submit-label="mode === 'create' ? 'Create draft event' : 'Save event'"
        @submit="onSubmit"
        @focus-field="focusChecklistField"
      />
    </div>

    <!-- Mobile companion: live score + submit, one sticky strip. -->
    <div class="sticky bottom-0 z-40 -mx-4 mt-5 border-t border-black/8 bg-white/90 px-4 py-2.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#111111]/90 lg:hidden">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-baseline gap-2">
          <span class="text-xl font-semibold tabular-nums text-highlighted">
            {{ builder.state.blocks.length === 0 ? '—' : builder.report.value.score }}
          </span>
          <span class="text-xs text-muted">
            {{ builder.state.blocks.length === 0 ? 'Add blocks' : builder.report.value.band.label }}
          </span>
        </div>
        <AppButton
          color="neutral"
          variant="solid"
          size="sm"
          :disabled="!builder.canSubmit.value || isSubmitting"
          :loading="isSubmitting"
          @click="onSubmit"
        >
          {{ mode === 'create' ? 'Create draft' : 'Save' }}
        </AppButton>
      </div>
    </div>
  </div>
</template>
