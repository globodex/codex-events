<script setup lang="ts">
import type Sortable from 'sortablejs'

import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'

import AccountEventSimplifiedClaimingControl from '~/components/account/events/AccountEventSimplifiedClaimingControl.vue'
import AdminEditorRowShell from '~/components/admin/AdminEditorRowShell.vue'
import EventConfigApplicationFieldsTable from '~/components/admin/EventConfigApplicationFieldsTable.vue'
import EventConfigProgramIdentitySection from '~/components/admin/EventConfigProgramIdentitySection.vue'
import EventTalkProposalControl from '~/components/admin/EventTalkProposalControl.vue'

import type { EventFormState } from '~/domains/events/admin-event'
import type { EventRecord } from '~/domains/events/records'
import type { EventImageVersions } from '~/domains/events/presentation'
import type { EventProgramSettingsMode } from '~/domains/events/program-settings'
import type { AccountEventSimplifiedClaimingStatus } from '#shared/domains/events/account-event-settings-page'

import {
  applyEventTypeApplicationFieldDefaults,
  createEventSlug,
  eventDetailsFormSchema,
  formatParticipantsLimitInput,
  getAgendaItemEndAfterStartChange,
  getNextAgendaItemDefaultTimes,
  eventConfigFormSchema,
  parseParticipantsLimitInput
} from '~/domains/events/admin-event'
import { cloneFormValues } from '~/utils/form-values'
import { getEventConfigFormModeView } from '~/domains/events/program-settings'
import { moveListItemByIndex } from '~/utils/reorder-list'

const form = defineModel<EventFormState>('form', {
  required: true
})

const emit = defineEmits<{
  submit: []
  uploadBackgroundImage: [file: File]
  removeBackgroundImage: []
  uploadBannerImage: [file: File]
  removeBannerImage: []
  retryLumaConfiguration: []
  updated: []
}>()

type AgendaFormItem = EventFormState['agendaItems'][number]
type TrackFormItem = EventFormState['tracks'][number]
type DescriptionFieldType = 'textarea' | 'markdown'
type SortableInstance = Sortable
type SortableConstructor = typeof Sortable

const props = defineProps<{
  isSubmitting?: boolean
  submitLabel: string
  helperText?: string
  submitError?: string
  submitErrorTitle?: string
  mode?: EventProgramSettingsMode
  autoGenerateSlug?: boolean
  canUploadManagedImages?: boolean
  backgroundImageUploadPending?: boolean
  backgroundImageUploadError?: string
  bannerImageUploadPending?: boolean
  bannerImageUploadError?: string
  imageVersion?: string | number | EventImageVersions | null
  eventId?: string | null
  persistedSimplifiedClaimingEnabled?: boolean
  initialSimplifiedClaimingStatus?: AccountEventSimplifiedClaimingStatus | null
  hasExistingTalkProposal?: boolean
  lumaWebhookUrl?: string | null
  lumaWebhookStatus?: EventRecord['lumaWebhookStatus'] | null
  lumaWebhookError?: string | null
  lumaWebhookRegisteredAt?: string | null
  isRetryingLumaConfiguration?: boolean
  trackDescriptionFieldType?: DescriptionFieldType
}>()

const toast = useToast()
const formMode = computed<EventProgramSettingsMode>(() => props.mode ?? 'full')
const formModeView = computed(() => getEventConfigFormModeView(formMode.value))
const showBasicInformationFields = computed(() => formModeView.value.showBasicInformationFields)
const showAgendaItemsSection = computed(() => formModeView.value.showAgendaItemsSection)
const showProgramIdentitySection = computed(() => formModeView.value.showProgramIdentitySection)
const showProgramSettingsSections = computed(() => formModeView.value.showProgramSettingsSections)
const isHackathon = computed(() => form.value.eventType === 'hackathon')
const isBuildEvent = computed(() => form.value.eventType === 'build')
const isMeetup = computed(() => form.value.eventType === 'meetup')
const showEventTypeField = computed(() => formMode.value === 'full' && showBasicInformationFields.value)
const showTracksSection = computed(() => formMode.value !== 'details' && (isHackathon.value || isBuildEvent.value))
const showInlineDetailsActions = computed(() => formMode.value === 'details')
const isSettingsMode = computed(() => formMode.value === 'settings')
const isLumaApiKeyRevealed = ref(false)
const lumaApiKeyInputType = computed(() => isLumaApiKeyRevealed.value ? 'text' : 'password')
const hasLumaSyncFields = computed(() =>
  Boolean(form.value.lumaEventApiId.trim() || form.value.lumaApiKey.trim())
)
const lumaSyncEnabled = computed({
  get: () => hasLumaSyncFields.value || (form.value.applicationLumaEmailVisible && form.value.requireLumaEmail),
  set: (enabled: boolean) => {
    setLumaSyncEnabled(enabled)
  }
})
const lumaWebhookStatusLabel = computed(() => {
  switch (props.lumaWebhookStatus) {
    case 'configured':
      return 'Webhook ready'
    case 'failed':
      return 'Webhook setup failed'
    default:
      return 'Webhook not configured'
  }
})
const lumaWebhookStatusDescription = computed(() => {
  if (props.lumaWebhookStatus === 'configured') {
    return 'Luma can send guest updates to this event.'
  }

  if (props.lumaWebhookStatus === 'failed') {
    return props.lumaWebhookError
      || 'Check the Luma event API ID and API key, then retry.'
  }

  return 'Save a Luma event API ID and API key to register the webhook.'
})
const lumaWebhookStatusDotClass = computed(() => {
  switch (props.lumaWebhookStatus) {
    case 'configured':
      return 'bg-emerald-500'
    case 'failed':
      return 'bg-red-500'
    default:
      return 'bg-zinc-400'
  }
})
const trackSectionDescription = computed(() => isHackathon.value
  ? 'Add the submission tracks participants can choose from. Add resource links when a track needs supporting material.'
  : 'Add build tracks and resource links participants can use before or during the event.'
)
const trackDescriptionFieldType = computed(() => props.trackDescriptionFieldType ?? 'textarea')
const showLumaRetryButton = computed(() =>
  Boolean(
    props.lumaWebhookUrl
    && (
      props.lumaWebhookStatus !== 'not_configured'
      || form.value.lumaEventApiId.trim()
      || form.value.lumaApiKey.trim()
    )
  )
)
const basicsHeading = computed(() => formModeView.value.basicsHeading)
const basicsDescription = computed(() => formModeView.value.basicsDescription)
const programIdentityDescription = computed(() => formModeView.value.programIdentityDescription)
const eventTypeOptions = [
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'build', label: 'Build' }
] as const

const hasManuallyEditedSlug = ref(false)
const isProgrammaticSlugUpdate = ref(false)
const activeAgendaDragId = ref<string | null>(null)
const agendaDropTargetId = ref<string | null>(null)
const agendaListElement = ref<HTMLElement | null>(null)
const activeTrackDragId = ref<string | null>(null)
const trackDropTargetId = ref<string | null>(null)
const trackListElement = ref<HTMLElement | null>(null)
let agendaSortable: SortableInstance | null = null
let trackSortable: SortableInstance | null = null
let sortableConstructor: SortableConstructor | null = null

const validationSchema = computed(() =>
  formMode.value === 'details'
    ? eventDetailsFormSchema
    : eventConfigFormSchema
)

const participantsLimitInput = computed({
  get: () => formatParticipantsLimitInput(form.value.participantsLimit),
  set: (value) => {
    form.value.participantsLimit = parseParticipantsLimitInput(value)
  }
})

function updateParticipantsLimitInput(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) {
    return
  }

  participantsLimitInput.value = event.target.value
}

function requireLumaRegistrationEmail() {
  if (form.value.simplifiedClaimingEnabled) {
    return
  }
  form.value.applicationLumaEmailVisible = true
  form.value.requireLumaEmail = true
}

function setLumaSyncEnabled(enabled: boolean) {
  if (enabled) {
    requireLumaRegistrationEmail()
    return
  }

  form.value.lumaEventApiId = ''
  form.value.lumaApiKey = ''
  form.value.applicationLumaEmailVisible = false
  form.value.requireLumaEmail = false
}

async function copyLumaWebhookUrl() {
  if (!props.lumaWebhookUrl) {
    return
  }

  try {
    await navigator.clipboard.writeText(props.lumaWebhookUrl)
    toast.add({
      title: 'Webhook URL copied',
      description: 'The Luma webhook URL was copied to your clipboard.',
      color: 'success'
    })
  } catch {
    toast.add({
      title: 'Copy failed',
      description: 'This browser could not copy the webhook URL right now.',
      color: 'error'
    })
  }
}

function createAgendaItemId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `agenda-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function createTrackId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `track-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function createTrackResourceId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `resource-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function nextAgendaDisplayOrder() {
  return form.value.agendaItems.length + 1
}

function nextTrackDisplayOrder() {
  return form.value.tracks.length + 1
}

function nextTrackResourceDisplayOrder(track: TrackFormItem) {
  return track.resources.length + 1
}

function applyAgendaOrderFromList(items: AgendaFormItem[]) {
  form.value.agendaItems = items.map((item, index) => ({
    ...item,
    displayOrder: index + 1
  }))
}

function applyTrackOrderFromList(items: TrackFormItem[]) {
  form.value.tracks = items.map((item, index) => ({
    ...item,
    displayOrder: index + 1
  }))
}

function applyTrackResourceOrderFromList(track: TrackFormItem, resources: TrackFormItem['resources']) {
  track.resources = resources.map((resource, index) => ({
    ...resource,
    displayOrder: index + 1
  }))
}

function addAgendaItem() {
  const previousItem = form.value.agendaItems[form.value.agendaItems.length - 1] ?? null
  const { startsAt, endsAt } = getNextAgendaItemDefaultTimes(previousItem)

  form.value.agendaItems.push({
    id: createAgendaItemId(),
    startsAt,
    endsAt,
    title: '',
    details: '',
    displayOrder: nextAgendaDisplayOrder()
  })
}

function updateAgendaItemStart(item: AgendaFormItem, startsAt: string | undefined) {
  const nextStartsAt = startsAt ?? ''

  item.startsAt = nextStartsAt
  item.endsAt = getAgendaItemEndAfterStartChange(nextStartsAt, item.endsAt)
}

function addTrack() {
  form.value.tracks.push({
    id: createTrackId(),
    name: '',
    shortDescription: '',
    fullDescription: '',
    staffInstructions: '',
    resources: [],
    displayOrder: nextTrackDisplayOrder()
  })
}

function addTrackResource(track: TrackFormItem) {
  track.resources.push({
    id: createTrackResourceId(),
    title: '',
    url: '',
    description: '',
    displayOrder: nextTrackResourceDisplayOrder(track)
  })
}

function removeAgendaItem(itemId: string) {
  applyAgendaOrderFromList(form.value.agendaItems.filter(item => item.id !== itemId))
}

function removeTrack(trackId: string) {
  applyTrackOrderFromList(form.value.tracks.filter(track => track.id !== trackId))
}

function removeTrackResource(track: TrackFormItem, resourceId: string) {
  applyTrackResourceOrderFromList(track, track.resources.filter(resource => resource.id !== resourceId))
}

function moveAgendaItem(itemId: string, direction: -1 | 1) {
  const currentIndex = form.value.agendaItems.findIndex(item => item.id === itemId)

  if (currentIndex < 0) {
    return
  }

  const nextIndex = currentIndex + direction

  if (nextIndex < 0 || nextIndex >= form.value.agendaItems.length) {
    return
  }

  applyAgendaOrderFromList(moveListItemByIndex(form.value.agendaItems, currentIndex, nextIndex))
}

function moveTrack(trackId: string, direction: -1 | 1) {
  const currentIndex = form.value.tracks.findIndex(track => track.id === trackId)

  if (currentIndex < 0) {
    return
  }

  const nextIndex = currentIndex + direction

  if (nextIndex < 0 || nextIndex >= form.value.tracks.length) {
    return
  }

  applyTrackOrderFromList(moveListItemByIndex(form.value.tracks, currentIndex, nextIndex))
}

function moveTrackResource(track: TrackFormItem, resourceId: string, direction: -1 | 1) {
  const currentIndex = track.resources.findIndex(resource => resource.id === resourceId)

  if (currentIndex < 0) {
    return
  }

  const nextIndex = currentIndex + direction

  if (nextIndex < 0 || nextIndex >= track.resources.length) {
    return
  }

  applyTrackResourceOrderFromList(track, moveListItemByIndex(track.resources, currentIndex, nextIndex))
}

function destroyAgendaSortable() {
  agendaSortable?.destroy()
  agendaSortable = null
  activeAgendaDragId.value = null
  agendaDropTargetId.value = null
}

function destroyTrackSortable() {
  trackSortable?.destroy()
  trackSortable = null
  activeTrackDragId.value = null
  trackDropTargetId.value = null
}

async function loadSortableConstructor() {
  if (!sortableConstructor) {
    const module = await import('sortablejs')
    sortableConstructor = module.default
  }

  return sortableConstructor
}

async function initializeAgendaSortable() {
  if (!import.meta.client || !showAgendaItemsSection.value || !agendaListElement.value || form.value.agendaItems.length === 0) {
    destroyAgendaSortable()
    return
  }

  const Sortable = await loadSortableConstructor()

  if (!showAgendaItemsSection.value || !agendaListElement.value || form.value.agendaItems.length === 0) {
    destroyAgendaSortable()
    return
  }

  destroyAgendaSortable()

  agendaSortable = Sortable.create(agendaListElement.value, {
    animation: 180,
    handle: '[data-agenda-sort-handle]',
    draggable: '[data-agenda-row]',
    dataIdAttr: 'data-agenda-id',
    ghostClass: 'opacity-45',
    chosenClass: 'cursor-grabbing',
    dragClass: 'cursor-grabbing',
    onChoose(event) {
      activeAgendaDragId.value = event.item.dataset.agendaId ?? null
      agendaDropTargetId.value = null
    },
    onMove(event) {
      const relatedId = event.related?.dataset.agendaId ?? null
      agendaDropTargetId.value = relatedId !== activeAgendaDragId.value ? relatedId : null
      return true
    },
    onEnd(event) {
      const oldIndex = event.oldDraggableIndex ?? event.oldIndex
      const newIndex = event.newDraggableIndex ?? event.newIndex

      if (oldIndex !== undefined && newIndex !== undefined) {
        applyAgendaOrderFromList(moveListItemByIndex(form.value.agendaItems, oldIndex, newIndex))
      }

      activeAgendaDragId.value = null
      agendaDropTargetId.value = null
    }
  })
}

async function initializeTrackSortable() {
  if (!import.meta.client || !showTracksSection.value || !trackListElement.value || form.value.tracks.length === 0) {
    destroyTrackSortable()
    return
  }

  const Sortable = await loadSortableConstructor()

  if (!showTracksSection.value || !trackListElement.value || form.value.tracks.length === 0) {
    destroyTrackSortable()
    return
  }

  destroyTrackSortable()

  trackSortable = Sortable.create(trackListElement.value, {
    animation: 180,
    handle: '[data-track-sort-handle]',
    draggable: '[data-track-row]',
    dataIdAttr: 'data-track-id',
    ghostClass: 'opacity-45',
    chosenClass: 'cursor-grabbing',
    dragClass: 'cursor-grabbing',
    onChoose(event) {
      activeTrackDragId.value = event.item.dataset.trackId ?? null
      trackDropTargetId.value = null
    },
    onMove(event) {
      const relatedId = event.related?.dataset.trackId ?? null
      trackDropTargetId.value = relatedId !== activeTrackDragId.value ? relatedId : null
      return true
    },
    onEnd(event) {
      const oldIndex = event.oldDraggableIndex ?? event.oldIndex
      const newIndex = event.newDraggableIndex ?? event.newIndex

      if (oldIndex !== undefined && newIndex !== undefined) {
        applyTrackOrderFromList(moveListItemByIndex(form.value.tracks, oldIndex, newIndex))
      }

      activeTrackDragId.value = null
      trackDropTargetId.value = null
    }
  })
}

const {
  errors,
  submitCount,
  setValues,
  handleSubmit
} = useForm({
  validationSchema: computed(() => toTypedSchema(validationSchema.value)),
  initialValues: cloneFormValues(form.value)
})

watch(() => form.value, (nextForm) => {
  setValues(cloneFormValues(nextForm), false)
}, {
  deep: true,
  immediate: true
})

watch(() => form.value.eventType, (nextEventType, previousEventType) => {
  if (!showEventTypeField.value || !previousEventType || nextEventType === previousEventType) {
    return
  }

  applyEventTypeApplicationFieldDefaults(form.value, nextEventType)

  if (nextEventType !== 'meetup') {
    form.value.simplifiedClaimingEnabled = false
  }
})

watch(lumaSyncEnabled, (enabled) => {
  if (!enabled) {
    return
  }

  requireLumaRegistrationEmail()
}, {
  immediate: true
})

watch(() => form.value.name, (nextName) => {
  if (!props.autoGenerateSlug || hasManuallyEditedSlug.value) {
    return
  }

  const generatedSlug = createEventSlug(nextName)

  if (form.value.slug === generatedSlug) {
    return
  }

  isProgrammaticSlugUpdate.value = true
  form.value.slug = generatedSlug
})

watch(() => form.value.slug, (nextSlug) => {
  const normalizedSlug = createEventSlug(nextSlug)
  const generatedSlugFromName = createEventSlug(form.value.name)
  const cameFromUserEdit = !isProgrammaticSlugUpdate.value

  if (normalizedSlug !== nextSlug) {
    isProgrammaticSlugUpdate.value = true
    form.value.slug = normalizedSlug

    if (
      props.autoGenerateSlug
      && cameFromUserEdit
      && !hasManuallyEditedSlug.value
      && normalizedSlug !== generatedSlugFromName
    ) {
      hasManuallyEditedSlug.value = true
    }

    return
  }

  if (!props.autoGenerateSlug) {
    return
  }

  if (isProgrammaticSlugUpdate.value) {
    isProgrammaticSlugUpdate.value = false
    return
  }

  if (!hasManuallyEditedSlug.value && normalizedSlug !== generatedSlugFromName) {
    hasManuallyEditedSlug.value = true
  }
})

const validationErrorMessages = computed(() => {
  if (submitCount.value === 0) {
    return []
  }

  return [...new Set(Object.values(errors.value).filter((value): value is string => Boolean(value)))]
})

const agendaItemsOrderKey = computed(() => form.value.agendaItems.map(item => item.id).join('|'))
const tracksOrderKey = computed(() => form.value.tracks.map(track => track.id).join('|'))

watch([agendaItemsOrderKey, showAgendaItemsSection], async () => {
  await nextTick()
  await initializeAgendaSortable()
}, {
  immediate: true,
  flush: 'post'
})

watch([tracksOrderKey, showTracksSection], async () => {
  await nextTick()
  await initializeTrackSortable()
}, {
  immediate: true,
  flush: 'post'
})

onBeforeUnmount(() => {
  destroyAgendaSortable()
  destroyTrackSortable()
})

const submitConfigForm = handleSubmit(() => {
  emit('submit')
})
</script>

<template>
  <form
    class="space-y-6"
    @submit.prevent="submitConfigForm"
  >
    <section
      id="admin-config-basics"
      class="space-y-6"
    >
      <AppCard class="scroll-mt-28 rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
        <template #header>
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-highlighted">
              {{ basicsHeading }}
            </h2>
            <p class="text-sm text-muted">
              {{ basicsDescription }}
            </p>
          </div>
        </template>

        <div class="grid grid-cols-1 gap-5">
          <template v-if="showBasicInformationFields">
            <label
              v-if="showEventTypeField"
              class="grid gap-2"
            >
              <span class="text-sm font-medium text-toned">Event type</span>
              <AppSelect
                v-model="form.eventType"
                required
              >
                <option
                  v-for="option in eventTypeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </AppSelect>
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-medium text-toned">Event name</span>
              <AppInput
                v-model="form.name"
                type="text"
                placeholder="Codex Spring Builders 2026"
                required
              />
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-medium text-toned">Slug</span>
              <AppInput
                v-model="form.slug"
                type="text"
                placeholder="codex-spring-builders-2026"
                required
              />
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-medium text-toned">Discord server URL</span>
              <AppInput
                v-model="form.discordServerUrl"
                type="url"
                placeholder="https://discord.gg/your-invite"
              />
              <span class="text-xs text-muted">Shown only in the account workspace for approved participants, judges, staff, and admins.</span>
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-medium text-toned">Luma event URL</span>
              <AppInput
                v-model="form.lumaEventUrl"
                type="url"
                placeholder="https://lu.ma/your-event"
              />
              <span class="text-xs text-muted">Optional public Luma link.</span>
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-medium text-toned">Slides URL</span>
              <AppInput
                v-model="form.slidesUrl"
                type="url"
                placeholder="https://docs.google.com/presentation/..."
              />
              <span class="text-xs text-muted">Shown in the account workspace for approved participants, judges, staff, and admins.</span>
            </label>

            <section class="grid gap-4 border-t border-black/8 pt-5 dark:border-white/[0.08]">
              <div class="space-y-1">
                <h3 class="text-base font-semibold text-highlighted">
                  Luma Sync
                </h3>
                <p class="text-sm text-muted">
                  Keep participant approval, cancellation, and attendance updates aligned with this Luma event.
                </p>
              </div>

              <label class="flex items-center gap-3 rounded-lg border border-black/8 px-4 py-3 text-sm text-toned dark:border-white/[0.08]">
                <input
                  v-model="lumaSyncEnabled"
                  type="checkbox"
                  class="size-4 rounded border-black/20 dark:border-white/[0.3]"
                >
                <span class="grid gap-0.5">
                  <span>Enable Luma Sync</span>
                  <span class="text-xs text-muted">Register event webhooks and sync Codex participant decisions with Luma guests.</span>
                </span>
              </label>

              <div
                v-if="lumaSyncEnabled"
                class="grid gap-5"
                :class="lumaWebhookUrl ? 'md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.9fr)] md:items-start' : ''"
              >
                <div class="grid gap-5">
                  <label class="grid gap-2">
                    <span class="text-sm font-medium text-toned">Luma event API ID</span>
                    <AppInput
                      v-model="form.lumaEventApiId"
                      type="text"
                      placeholder="evt-FSlTqAmG9QanU4s"
                      required
                    />
                    <span class="text-xs text-muted">Use the Luma API ID, not the public URL.</span>
                  </label>

                  <div class="grid gap-2">
                    <label
                      for="event-luma-api-key"
                      class="text-sm font-medium text-toned"
                    >
                      Luma API key
                    </label>
                    <span class="relative">
                      <AppInput
                        id="event-luma-api-key"
                        v-model="form.lumaApiKey"
                        :type="lumaApiKeyInputType"
                        placeholder="luma_..."
                        class="pr-12"
                        required
                      />
                      <AppButton
                        type="button"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        :icon="isLumaApiKeyRevealed ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                        class="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 gap-0 px-0"
                        :aria-label="isLumaApiKeyRevealed ? 'Hide Luma API key' : 'Show Luma API key'"
                        :aria-pressed="isLumaApiKeyRevealed"
                        :title="isLumaApiKeyRevealed ? 'Hide key' : 'Show key'"
                        @click="isLumaApiKeyRevealed = !isLumaApiKeyRevealed"
                      >
                        <span class="sr-only">
                          {{ isLumaApiKeyRevealed ? 'Hide Luma API key' : 'Show Luma API key' }}
                        </span>
                      </AppButton>
                    </span>
                    <span class="text-xs text-muted">Use a key that can manage this Luma event.</span>
                  </div>

                  <label class="flex items-center gap-3 rounded-lg border border-black/8 px-4 py-3 text-sm text-toned dark:border-white/[0.08]">
                    <input
                      type="checkbox"
                      class="size-4 rounded border-black/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/[0.3]"
                      checked
                      disabled
                    >
                    <span class="grid gap-0.5">
                      <span>Require Luma email during registration</span>
                      <span class="text-xs text-muted">Luma Sync needs the participant's Luma email to match Codex users with Luma guests.</span>
                    </span>
                  </label>
                </div>

                <div
                  v-if="lumaWebhookUrl"
                  class="grid gap-3 md:border-l md:border-black/8 md:pl-5 md:dark:border-white/[0.08]"
                >
                  <div class="flex items-start gap-3">
                    <span
                      class="mt-1.5 size-2.5 rounded-full"
                      :class="lumaWebhookStatusDotClass"
                      aria-hidden="true"
                    />
                    <div class="min-w-0 space-y-1">
                      <p class="text-sm font-medium text-highlighted">
                        {{ lumaWebhookStatusLabel }}
                      </p>
                      <p class="text-xs text-muted">
                        {{ lumaWebhookStatusDescription }}
                      </p>
                      <p
                        v-if="lumaWebhookRegisteredAt && lumaWebhookStatus === 'configured'"
                        class="text-xs text-muted"
                      >
                        Last registered at {{ lumaWebhookRegisteredAt }}.
                      </p>
                    </div>
                  </div>

                  <div class="grid gap-2">
                    <span class="text-sm font-medium text-toned">Webhook URL</span>
                    <code class="min-w-0 break-all rounded-lg bg-black/[0.04] px-3 py-2 font-mono text-xs text-highlighted dark:bg-white/[0.06]">
                      {{ lumaWebhookUrl }}
                    </code>
                    <div class="flex flex-wrap gap-2">
                      <AppButton
                        type="button"
                        color="neutral"
                        variant="soft"
                        size="sm"
                        icon="i-lucide-copy"
                        @click="copyLumaWebhookUrl"
                      >
                        Copy webhook URL
                      </AppButton>

                      <AppButton
                        v-if="showLumaRetryButton"
                        type="button"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        icon="i-lucide-refresh-cw"
                        :loading="isRetryingLumaConfiguration"
                        :disabled="isRetryingLumaConfiguration || isSubmitting"
                        @click="emit('retryLumaConfiguration')"
                      >
                        Retry Luma configuration
                      </AppButton>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <LazyAdminMarkdownEditorField
              v-model="form.description"
              name="event-description-editor"
              editor-id="event-description-editor"
              label="Description"
              description="Shown on the public event page."
              placeholder="Describe the event, focus areas, and expectations for participants."
              required
            />
          </template>

          <section
            v-if="showTracksSection"
            class="grid grid-cols-1 gap-3 border-t border-black/8 pt-5 dark:border-white/[0.08]"
          >
            <div class="space-y-1">
              <h3 class="text-base font-semibold text-highlighted">
                Tracks
              </h3>
              <p class="text-sm text-muted">
                {{ trackSectionDescription }}
              </p>
            </div>

            <div
              v-if="form.tracks.length === 0"
              class="grid gap-3 rounded-xl border border-dashed border-black/10 px-4 py-4 text-sm text-muted dark:border-white/[0.08]"
            >
              <p>No tracks yet.</p>
            </div>

            <div
              v-else
              ref="trackListElement"
              class="grid grid-cols-1 gap-3"
            >
              <article
                v-for="(track, index) in form.tracks"
                :key="track.id"
                :data-track-id="track.id"
                data-track-row
                class="rounded-xl border border-black/8 bg-white/88 p-3 dark:border-white/[0.08] dark:bg-[#111111]"
              >
                <AdminEditorRowShell>
                  <template #controls>
                    <button
                      type="button"
                      class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/8 bg-white text-toned transition hover:border-black/20 hover:text-highlighted disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]"
                      :aria-label="`Move ${track.name || `track ${index + 1}`} up`"
                      :disabled="index === 0"
                      @click="moveTrack(track.id, -1)"
                    >
                      <AppIcon
                        name="i-lucide-arrow-up"
                        class="size-4"
                      />
                    </button>

                    <button
                      type="button"
                      data-track-sort-handle
                      class="group inline-flex h-11 w-11 cursor-grab items-center justify-center rounded-xl border border-black/8 bg-white text-toned transition hover:border-black/20 hover:text-highlighted active:cursor-grabbing dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]"
                      :aria-label="`Drag to reorder ${track.name || `track ${index + 1}`}`"
                    >
                      <AppIcon
                        name="i-lucide-grip-vertical"
                        class="size-4.5 transition group-hover:scale-105"
                      />
                    </button>

                    <button
                      type="button"
                      class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/8 bg-white text-toned transition hover:border-black/20 hover:text-highlighted disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]"
                      :aria-label="`Move ${track.name || `track ${index + 1}`} down`"
                      :disabled="index === form.tracks.length - 1"
                      @click="moveTrack(track.id, 1)"
                    >
                      <AppIcon
                        name="i-lucide-arrow-down"
                        class="size-4"
                      />
                    </button>
                  </template>

                  <div class="grid grid-cols-1 gap-3">
                    <label class="grid gap-2">
                      <span class="text-xs font-medium text-toned">Track name</span>
                      <AppInput
                        v-model="track.name"
                        type="text"
                        placeholder="Best AI Agent"
                        required
                      />
                    </label>

                    <LazyAdminMarkdownEditorField
                      v-if="trackDescriptionFieldType === 'markdown'"
                      v-model="track.shortDescription"
                      :name="`event-track-${track.id}-short-description`"
                      :editor-id="`event-track-${track.id}-short-description-editor`"
                      label="Short description"
                      placeholder="Summarize who this track is for."
                      height="180px"
                      required
                    />

                    <label
                      v-else
                      class="grid gap-2"
                    >
                      <span class="text-xs font-medium text-toned">Short description</span>
                      <AppTextarea
                        v-model="track.shortDescription"
                        rows="1"
                        placeholder="Summarize who this track is for."
                        required
                      />
                    </label>

                    <LazyAdminMarkdownEditorField
                      v-if="trackDescriptionFieldType === 'markdown'"
                      v-model="track.fullDescription"
                      :name="`event-track-${track.id}-full-description`"
                      :editor-id="`event-track-${track.id}-full-description-editor`"
                      label="Full description"
                      placeholder="Add track guidelines, requirements, and judging notes participants should read after choosing this track."
                      height="360px"
                    />

                    <label
                      v-else
                      class="grid gap-2"
                    >
                      <span class="text-xs font-medium text-toned">Full description</span>
                      <AppTextarea
                        v-model="track.fullDescription"
                        rows="6"
                        placeholder="Add track guidelines, requirements, and judging notes participants should read after choosing this track."
                      />
                    </label>

                    <LazyAdminMarkdownEditorField
                      v-if="trackDescriptionFieldType === 'markdown'"
                      v-model="track.staffInstructions"
                      :name="`event-track-${track.id}-staff-instructions`"
                      :editor-id="`event-track-${track.id}-staff-instructions-editor`"
                      label="Staff instructions"
                      placeholder="Add internal notes for staff and admins supporting this track."
                      height="260px"
                    />

                    <label
                      v-else
                      class="grid gap-2"
                    >
                      <span class="text-xs font-medium text-toned">Staff instructions</span>
                      <AppTextarea
                        v-model="track.staffInstructions"
                        rows="4"
                        placeholder="Add internal notes for staff and admins supporting this track."
                      />
                    </label>

                    <div class="grid gap-3 border-t border-black/8 pt-3 dark:border-white/[0.08]">
                      <div class="flex flex-wrap items-center justify-between gap-3">
                        <div class="min-w-0">
                          <p class="text-xs font-medium text-toned">
                            Resources
                          </p>
                          <p class="mt-1 text-xs text-muted">
                            Add links participants should have for this track.
                          </p>
                        </div>

                        <AppButton
                          type="button"
                          color="neutral"
                          variant="soft"
                          size="xs"
                          @click="addTrackResource(track)"
                        >
                          <AppIcon
                            name="i-lucide-plus"
                            class="size-3.5"
                          />
                          Add resource
                        </AppButton>
                      </div>

                      <p
                        v-if="track.resources.length === 0"
                        class="text-xs text-muted"
                      >
                        No resources yet.
                      </p>

                      <div
                        v-else
                        class="divide-y divide-black/8 dark:divide-white/[0.08]"
                      >
                        <div
                          v-for="(resource, resourceIndex) in track.resources"
                          :key="resource.id"
                          class="grid gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <span class="text-xs font-medium text-muted">
                              Resource {{ resourceIndex + 1 }}
                            </span>

                            <div class="flex items-center gap-1.5">
                              <button
                                type="button"
                                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/8 bg-white text-toned transition hover:border-black/20 hover:text-highlighted disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]"
                                :aria-label="`Move ${resource.title || `resource ${resourceIndex + 1}`} up`"
                                :disabled="resourceIndex === 0"
                                @click="moveTrackResource(track, resource.id, -1)"
                              >
                                <AppIcon
                                  name="i-lucide-arrow-up"
                                  class="size-3.5"
                                />
                              </button>

                              <button
                                type="button"
                                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/8 bg-white text-toned transition hover:border-black/20 hover:text-highlighted disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]"
                                :aria-label="`Move ${resource.title || `resource ${resourceIndex + 1}`} down`"
                                :disabled="resourceIndex === track.resources.length - 1"
                                @click="moveTrackResource(track, resource.id, 1)"
                              >
                                <AppIcon
                                  name="i-lucide-arrow-down"
                                  class="size-3.5"
                                />
                              </button>

                              <button
                                type="button"
                                class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/8 bg-white text-toned transition hover:border-red-400/50 hover:text-red-600 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-red-400/40 dark:hover:text-red-300"
                                :aria-label="`Delete ${resource.title || `resource ${resourceIndex + 1}`}`"
                                @click="removeTrackResource(track, resource.id)"
                              >
                                <AppIcon
                                  name="i-lucide-trash-2"
                                  class="size-3.5"
                                />
                              </button>
                            </div>
                          </div>

                          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <label class="grid gap-2">
                              <span class="text-xs font-medium text-toned">Title</span>
                              <AppInput
                                v-model="resource.title"
                                type="text"
                                placeholder="Starter guide"
                                required
                              />
                            </label>

                            <label class="grid gap-2">
                              <span class="text-xs font-medium text-toned">Link</span>
                              <AppInput
                                v-model="resource.url"
                                type="url"
                                placeholder="https://example.com/guide"
                                required
                              />
                            </label>
                          </div>

                          <label class="grid gap-2">
                            <span class="text-xs font-medium text-toned">Description</span>
                            <AppTextarea
                              v-model="resource.description"
                              rows="1"
                              placeholder="Optional note about when to use this resource."
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <template #actions>
                    <button
                      type="button"
                      class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/8 bg-white text-toned transition hover:border-red-400/50 hover:text-red-600 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-red-400/40 dark:hover:text-red-300"
                      :aria-label="`Delete ${track.name || `track ${index + 1}`}`"
                      @click="removeTrack(track.id)"
                    >
                      <AppIcon
                        name="i-lucide-trash-2"
                        class="size-4"
                      />
                    </button>
                  </template>
                </AdminEditorRowShell>
              </article>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3">
              <AppButton
                type="button"
                color="neutral"
                variant="soft"
                size="sm"
                class="w-fit"
                @click="addTrack"
              >
                {{ form.tracks.length === 0 ? 'Add first track' : 'Add track' }}
              </AppButton>
            </div>
          </section>

          <div
            v-if="showAgendaItemsSection"
            class="grid grid-cols-1 gap-3"
          >
            <div
              v-if="form.agendaItems.length === 0"
              class="grid gap-3 rounded-xl border border-dashed border-black/10 px-4 py-4 text-sm text-muted dark:border-white/[0.08]"
            >
              <p>No agenda items yet.</p>
            </div>

            <div
              v-else
              ref="agendaListElement"
              class="grid grid-cols-1 gap-3"
            >
              <article
                v-for="(item, index) in form.agendaItems"
                :key="item.id"
                :data-agenda-id="item.id"
                data-agenda-row
                class="rounded-xl border bg-white/88 p-3 transition-all dark:bg-[#111111]"
                :class="[
                  agendaDropTargetId === item.id
                    ? 'border-dashed border-black/30 ring-2 ring-black/6 dark:border-white/[0.32] dark:ring-white/[0.08]'
                    : 'border-black/8 dark:border-white/[0.08]',
                  activeAgendaDragId === item.id
                    ? 'shadow-[0_16px_40px_-34px_rgba(15,23,42,0.55)]'
                    : ''
                ]"
              >
                <div
                  v-if="agendaDropTargetId === item.id"
                  class="mb-3 rounded-lg border border-dashed border-black/18 bg-black/[0.03] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted dark:border-white/[0.14] dark:bg-white/[0.03]"
                >
                  Drop agenda item here
                </div>

                <AdminEditorRowShell>
                  <template #controls>
                    <button
                      type="button"
                      class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/8 bg-white text-toned transition hover:border-black/20 hover:text-highlighted disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]"
                      :aria-label="`Move ${item.title || `agenda item ${index + 1}`} up`"
                      :disabled="index === 0"
                      @click="moveAgendaItem(item.id, -1)"
                    >
                      <AppIcon
                        name="i-lucide-arrow-up"
                        class="size-4"
                      />
                    </button>

                    <button
                      type="button"
                      data-agenda-sort-handle
                      class="group inline-flex h-11 w-11 cursor-grab items-center justify-center rounded-xl border border-black/8 bg-white text-toned transition hover:border-black/20 hover:text-highlighted active:cursor-grabbing dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]"
                      :aria-label="`Drag to reorder ${item.title || `agenda item ${index + 1}`}`"
                    >
                      <AppIcon
                        name="i-lucide-grip-vertical"
                        class="size-4.5 transition group-hover:scale-105"
                      />
                    </button>

                    <button
                      type="button"
                      class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/8 bg-white text-toned transition hover:border-black/20 hover:text-highlighted disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]"
                      :aria-label="`Move ${item.title || `agenda item ${index + 1}`} down`"
                      :disabled="index === form.agendaItems.length - 1"
                      @click="moveAgendaItem(item.id, 1)"
                    >
                      <AppIcon
                        name="i-lucide-arrow-down"
                        class="size-4"
                      />
                    </button>
                  </template>

                  <div class="grid grid-cols-1 gap-3">
                    <label class="grid gap-2">
                      <span class="text-xs font-medium text-toned">Title</span>
                      <AppInput
                        v-model="item.title"
                        type="text"
                        placeholder="Opening workshop"
                        required
                      />
                    </label>

                    <label class="grid gap-2">
                      <span class="text-xs font-medium text-toned">Description</span>
                      <AppTextarea
                        v-model="item.details"
                        rows="1"
                        class="min-h-10"
                        placeholder="Optional notes for this agenda item."
                      />
                    </label>

                    <div class="grid gap-3 pb-2 md:grid-cols-2">
                      <label class="grid gap-2">
                        <span class="text-xs font-medium text-toned">Starts at</span>
                        <AppDateTimeInput
                          :model-value="item.startsAt"
                          picker-aria-label="Choose agenda start date and time"
                          required
                          @update:model-value="updateAgendaItemStart(item, $event)"
                        />
                      </label>

                      <label class="grid gap-2">
                        <span class="text-xs font-medium text-toned">Ends at</span>
                        <AppDateTimeInput
                          v-model="item.endsAt"
                          picker-aria-label="Choose agenda end date and time"
                        />
                      </label>
                    </div>
                  </div>

                  <template #actions>
                    <button
                      type="button"
                      class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/8 bg-white text-toned transition hover:border-red-400/50 hover:text-red-600 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-red-400/40 dark:hover:text-red-300"
                      :aria-label="`Delete ${item.title || `agenda item ${index + 1}`}`"
                      @click="removeAgendaItem(item.id)"
                    >
                      <AppIcon
                        name="i-lucide-trash-2"
                        class="size-4"
                      />
                    </button>
                  </template>
                </AdminEditorRowShell>
              </article>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3">
              <AppButton
                type="button"
                color="neutral"
                variant="soft"
                size="sm"
                class="w-fit"
                @click="addAgendaItem"
              >
                {{ form.agendaItems.length === 0 ? 'Add first item' : 'Add item' }}
              </AppButton>
            </div>
          </div>

          <template v-if="showProgramSettingsSections && isSettingsMode">
            <section class="border-t border-black/8 pt-6 dark:border-white/[0.08]">
              <div class="space-y-1">
                <h3 class="text-lg font-semibold text-highlighted">
                  Timeline
                </h3>
                <p class="text-sm text-muted">
                  {{ isHackathon ? 'Set the registration and submission window.' : 'Set the registration window.' }}
                </p>
              </div>

              <div class="mt-5 grid gap-5 md:grid-cols-2">
                <label class="grid gap-2">
                  <span class="text-sm font-medium text-toned">Registration opens</span>
                  <AppDateTimeInput
                    v-model="form.registrationOpensAt"
                    picker-aria-label="Choose registration open date and time"
                    required
                  />
                </label>

                <label class="grid gap-2">
                  <span class="text-sm font-medium text-toned">Registration closes</span>
                  <AppDateTimeInput
                    v-model="form.registrationClosesAt"
                    picker-aria-label="Choose registration close date and time"
                    required
                  />
                </label>

                <label
                  v-if="isHackathon"
                  class="grid gap-2"
                >
                  <span class="text-sm font-medium text-toned">Submission opens</span>
                  <AppDateTimeInput
                    v-model="form.submissionOpensAt"
                    picker-aria-label="Choose submission open date and time"
                    required
                  />
                </label>

                <label
                  v-if="isHackathon"
                  class="grid gap-2"
                >
                  <span class="text-sm font-medium text-toned">Submission closes</span>
                  <AppDateTimeInput
                    v-model="form.submissionClosesAt"
                    picker-aria-label="Choose submission close date and time"
                    required
                  />
                </label>
              </div>
            </section>

            <section
              v-if="isHackathon"
              class="border-t border-black/8 pt-6 dark:border-white/[0.08]"
            >
              <div class="space-y-1">
                <h3 class="text-lg font-semibold text-highlighted">
                  Judging
                </h3>
                <p class="text-sm text-muted">
                  Set blind reviews per submission, pitch review, and score weighting.
                </p>
              </div>

              <div class="mt-5 grid grid-cols-1 gap-5">
                <div class="grid gap-5 md:grid-cols-2 md:items-start">
                  <label class="grid gap-2">
                    <span class="text-sm font-medium text-toned">Blind reviews per submission</span>
                    <AppInput
                      v-model.number="form.blindReviewCount"
                      type="number"
                      min="0"
                      max="2"
                      required
                    />
                    <span class="text-xs text-muted">Use 0 to disable blind review.</span>
                  </label>

                  <label class="grid gap-2">
                    <span class="text-sm font-medium text-toned">Blind score weight (%)</span>
                    <AppInput
                      v-model.number="form.blindScoreWeightPercent"
                      type="number"
                      min="0"
                      max="100"
                      required
                    />
                  </label>
                </div>

                <div class="grid gap-5 md:grid-cols-2 md:items-start">
                  <div class="grid gap-2">
                    <span class="text-sm font-medium text-toned">Pitch review</span>

                    <label class="flex items-center gap-3 rounded-lg border border-black/8 px-4 py-3 text-sm text-toned dark:border-white/[0.08]">
                      <input
                        v-model="form.pitchReviewEnabled"
                        type="checkbox"
                        class="size-4 rounded border-black/20 dark:border-white/[0.3]"
                      >
                      Enable pitch review
                    </label>
                  </div>

                  <label
                    v-if="form.pitchReviewEnabled"
                    class="grid gap-2"
                  >
                    <span class="text-sm font-medium text-toned">Pitch score weight (%)</span>
                    <AppInput
                      v-model.number="form.pitchScoreWeightPercent"
                      type="number"
                      min="0"
                      max="100"
                      required
                    />
                  </label>

                  <label
                    v-if="form.pitchReviewEnabled && form.blindReviewCount > 0"
                    class="grid gap-2 md:max-w-[16rem]"
                  >
                    <span class="text-sm font-medium text-toned">Preselected finalists</span>
                    <AppInput
                      v-model.number="form.shortlistFinalistCount"
                      type="number"
                      min="1"
                      required
                    />
                    <span class="text-xs text-muted">When shortlist starts, the top ranked blind submissions appear as the default finalist boundary up to this count until shortlist is saved.</span>
                  </label>
                </div>

                <p class="text-xs text-muted">
                  Enable blind review, pitch review, or both. If both are enabled, the score weights must add up to 100.
                </p>
              </div>
            </section>

            <section class="border-t border-black/8 pt-6 dark:border-white/[0.08]">
              <div class="space-y-1">
                <h3 class="text-lg font-semibold text-highlighted">
                  Participation Rules
                </h3>
                <p class="text-sm text-muted">
                  {{ isHackathon ? 'Set team limits plus registration and submission requirements.' : 'Set participant limits and registration requirements.' }}
                </p>
              </div>

              <div class="mt-5 grid grid-cols-1 gap-5">
                <div class="grid gap-5 md:grid-cols-2 md:items-start">
                  <label
                    v-if="isHackathon"
                    class="grid gap-2"
                  >
                    <span class="text-sm font-medium text-toned">Maximum team members</span>
                    <AppInput
                      v-model.number="form.maxTeamMembers"
                      type="number"
                      min="1"
                      required
                    />
                  </label>

                  <label class="grid gap-2">
                    <span class="text-sm font-medium text-toned">Participants limit</span>
                    <input
                      :value="participantsLimitInput"
                      type="number"
                      min="1"
                      placeholder="Leave empty for no limit"
                      class="w-full rounded-lg border border-black/8 bg-white px-4 py-3 text-sm text-highlighted outline-none transition disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.08] dark:bg-[#111111] focus:border-black/25 dark:focus:border-white/[0.25]"
                      @input="updateParticipantsLimitInput"
                    >
                  </label>
                </div>

                <div class="grid grid-cols-1 gap-3">
                  <label class="flex items-center gap-3 rounded-lg border border-black/8 px-4 py-3 text-sm text-toned dark:border-white/[0.08]">
                    <input
                      v-model="form.autoApproveApplications"
                      type="checkbox"
                      class="size-4 rounded border-black/20 dark:border-white/[0.3]"
                    >
                    <span class="grid gap-0.5">
                      <span>Approve applications automatically</span>
                      <span class="text-xs text-muted">New applications are approved immediately after required checks pass.</span>
                    </span>
                  </label>

                  <label class="flex items-center gap-3 rounded-lg border border-black/8 px-4 py-3 text-sm text-toned dark:border-white/[0.08]">
                    <input
                      v-model="form.inPersonEvent"
                      type="checkbox"
                      class="size-4 rounded border-black/20 dark:border-white/[0.3]"
                    >
                    In-person event
                  </label>

                  <AccountEventSimplifiedClaimingControl
                    v-if="isMeetup"
                    v-model="form.simplifiedClaimingEnabled"
                    :event-name="form.name"
                    :event-id="props.eventId"
                    :persisted-enabled="props.persistedSimplifiedClaimingEnabled"
                    :initial-status="props.initialSimplifiedClaimingStatus ?? null"
                    @updated="emit('updated')"
                  />

                  <EventTalkProposalControl
                    v-if="isMeetup"
                    v-model:enabled="form.talkProposalsEnabled"
                    v-model:opens-at="form.talkProposalOpensAt"
                    v-model:closes-at="form.talkProposalClosesAt"
                    v-model:questions="form.talkProposalQuestions"
                    :has-existing-proposal="props.hasExistingTalkProposal"
                  />

                  <EventConfigApplicationFieldsTable
                    v-model:form="form"
                    class="mt-2"
                  />

                  <label
                    v-if="isHackathon"
                    class="flex items-center gap-3 rounded-lg border border-black/8 px-4 py-3 text-sm text-toned dark:border-white/[0.08]"
                  >
                    <input
                      v-model="form.requireSubmissionSummary"
                      type="checkbox"
                      class="size-4 rounded border-black/20 dark:border-white/[0.3]"
                    >
                    Require submission summary
                  </label>

                  <label
                    v-if="isHackathon"
                    class="flex items-center gap-3 rounded-lg border border-black/8 px-4 py-3 text-sm text-toned dark:border-white/[0.08]"
                  >
                    <input
                      v-model="form.requireSubmissionRepositoryUrl"
                      type="checkbox"
                      class="size-4 rounded border-black/20 dark:border-white/[0.3]"
                    >
                    Require repository URL
                  </label>

                  <label
                    v-if="isHackathon"
                    class="flex items-center gap-3 rounded-lg border border-black/8 px-4 py-3 text-sm text-toned dark:border-white/[0.08]"
                  >
                    <input
                      v-model="form.requireSubmissionDemoUrl"
                      type="checkbox"
                      class="size-4 rounded border-black/20 dark:border-white/[0.3]"
                    >
                    Require demo URL
                  </label>
                </div>
              </div>
            </section>

            <div class="border-t border-black/8 pt-6 dark:border-white/[0.08]">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="max-w-3xl space-y-3">
                  <p class="text-sm text-muted">
                    {{ helperText ?? 'Save your changes to update this event.' }}
                  </p>

                  <AppAlert
                    v-if="submitError"
                    color="error"
                    variant="soft"
                    :title="submitErrorTitle ?? 'Unable to save changes'"
                    :description="submitError"
                  />

                  <AppAlert
                    v-if="validationErrorMessages.length > 0"
                    color="error"
                    variant="soft"
                    title="Form validation failed"
                    :description="validationErrorMessages[0]"
                  />
                </div>

                <AppButton
                  type="submit"
                  :loading="isSubmitting"
                  :disabled="isSubmitting"
                  color="primary"
                  size="lg"
                  class="justify-center"
                >
                  {{ submitLabel }}
                </AppButton>
              </div>
            </div>
          </template>
        </div>
      </AppCard>

      <EventConfigProgramIdentitySection
        v-if="showProgramIdentitySection"
        v-model:form="form"
        :description="programIdentityDescription"
        :can-upload-managed-images="props.canUploadManagedImages"
        :background-image-upload-pending="props.backgroundImageUploadPending"
        :background-image-upload-error="props.backgroundImageUploadError"
        :banner-image-upload-pending="props.bannerImageUploadPending"
        :banner-image-upload-error="props.bannerImageUploadError"
        :image-version="props.imageVersion"
        @upload-background-image="emit('uploadBackgroundImage', $event)"
        @remove-background-image="emit('removeBackgroundImage')"
        @upload-banner-image="emit('uploadBannerImage', $event)"
        @remove-banner-image="emit('removeBannerImage')"
      />

      <AppCard
        v-if="showProgramIdentitySection && showInlineDetailsActions"
        class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="max-w-3xl space-y-3">
            <p class="text-sm text-muted">
              {{ helperText ?? 'Save your changes to update this event.' }}
            </p>

            <AppAlert
              v-if="submitError"
              color="error"
              variant="soft"
              :title="submitErrorTitle ?? 'Unable to save changes'"
              :description="submitError"
            />

            <AppAlert
              v-if="validationErrorMessages.length > 0"
              color="error"
              variant="soft"
              title="Form validation failed"
              :description="validationErrorMessages[0]"
            />
          </div>

          <AppButton
            type="submit"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            color="primary"
            size="lg"
            class="justify-center"
          >
            {{ submitLabel }}
          </AppButton>
        </div>
      </AppCard>
    </section>

    <section
      v-if="showProgramSettingsSections && !isSettingsMode"
      class="space-y-6"
    >
      <AppCard
        id="admin-config-timeline"
        class="scroll-mt-28 rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
      >
        <template #header>
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-highlighted">
              Timeline
            </h2>
            <p class="text-sm text-muted">
              {{ isHackathon ? 'Set the registration and submission window.' : 'Set the registration window.' }}
            </p>
          </div>
        </template>

        <div class="grid gap-5 md:grid-cols-2">
          <label class="grid gap-2">
            <span class="text-sm font-medium text-toned">Registration opens</span>
            <AppDateTimeInput
              v-model="form.registrationOpensAt"
              picker-aria-label="Choose registration open date and time"
              required
            />
          </label>

          <label class="grid gap-2">
            <span class="text-sm font-medium text-toned">Registration closes</span>
            <AppDateTimeInput
              v-model="form.registrationClosesAt"
              picker-aria-label="Choose registration close date and time"
              required
            />
          </label>

          <label
            v-if="isHackathon"
            class="grid gap-2"
          >
            <span class="text-sm font-medium text-toned">Submission opens</span>
            <AppDateTimeInput
              v-model="form.submissionOpensAt"
              picker-aria-label="Choose submission open date and time"
              required
            />
          </label>

          <label
            v-if="isHackathon"
            class="grid gap-2"
          >
            <span class="text-sm font-medium text-toned">Submission closes</span>
            <AppDateTimeInput
              v-model="form.submissionClosesAt"
              picker-aria-label="Choose submission close date and time"
              required
            />
          </label>
        </div>
      </AppCard>

      <AppCard
        v-if="isHackathon"
        id="admin-config-judging"
        class="scroll-mt-28 rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
      >
        <template #header>
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-highlighted">
              Judging
            </h2>
            <p class="text-sm text-muted">
              Set blind reviews per submission, pitch review, and score weighting.
            </p>
          </div>
        </template>

        <div class="grid grid-cols-1 gap-5">
          <div class="grid gap-5 md:grid-cols-2 md:items-start">
            <label class="grid gap-2">
              <span class="text-sm font-medium text-toned">Blind reviews per submission</span>
              <AppInput
                v-model.number="form.blindReviewCount"
                type="number"
                min="0"
                max="2"
                required
              />
              <span class="text-xs text-muted">Use 0 to disable blind review.</span>
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-medium text-toned">Blind score weight (%)</span>
              <AppInput
                v-model.number="form.blindScoreWeightPercent"
                type="number"
                min="0"
                max="100"
                required
              />
            </label>
          </div>

          <div class="grid gap-5 md:grid-cols-2 md:items-start">
            <div class="grid gap-2">
              <span class="text-sm font-medium text-toned">Pitch review</span>

              <label class="flex items-center gap-3 rounded-lg border border-black/8 px-4 py-3 text-sm text-toned dark:border-white/[0.08]">
                <input
                  v-model="form.pitchReviewEnabled"
                  type="checkbox"
                  class="size-4 rounded border-black/20 dark:border-white/[0.3]"
                >
                Enable pitch review
              </label>
            </div>

            <label
              v-if="form.pitchReviewEnabled"
              class="grid gap-2"
            >
              <span class="text-sm font-medium text-toned">Pitch score weight (%)</span>
              <AppInput
                v-model.number="form.pitchScoreWeightPercent"
                type="number"
                min="0"
                max="100"
                required
              />
            </label>

            <label
              v-if="form.pitchReviewEnabled && form.blindReviewCount > 0"
              class="grid gap-2 md:max-w-[16rem]"
            >
              <span class="text-sm font-medium text-toned">Preselected finalists</span>
              <AppInput
                v-model.number="form.shortlistFinalistCount"
                type="number"
                min="1"
                required
              />
              <span class="text-xs text-muted">When shortlist starts, the top ranked blind submissions appear as the default finalist boundary up to this count until shortlist is saved.</span>
            </label>
          </div>

          <p class="text-xs text-muted">
            Enable blind review, pitch review, or both. If both are enabled, the score weights must add up to 100.
          </p>
        </div>
      </AppCard>

      <AppCard
        id="admin-config-rules"
        class="scroll-mt-28 rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
      >
        <template #header>
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-highlighted">
              Participation Rules
            </h2>
            <p class="text-sm text-muted">
              {{ isHackathon ? 'Set team limits plus registration and submission requirements.' : 'Set participant limits and registration requirements.' }}
            </p>
          </div>
        </template>

        <div class="grid grid-cols-1 gap-5">
          <div class="grid gap-5 md:grid-cols-2 md:items-start">
            <label
              v-if="isHackathon"
              class="grid gap-2"
            >
              <span class="text-sm font-medium text-toned">Maximum team members</span>
              <AppInput
                v-model.number="form.maxTeamMembers"
                type="number"
                min="1"
                required
              />
            </label>

            <label class="grid gap-2">
              <span class="text-sm font-medium text-toned">Participants limit</span>
              <input
                :value="participantsLimitInput"
                type="number"
                min="1"
                placeholder="Leave empty for no limit"
                class="w-full rounded-lg border border-black/8 bg-white px-4 py-3 text-sm text-highlighted outline-none transition disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.08] dark:bg-[#111111] focus:border-black/25 dark:focus:border-white/[0.25]"
                @input="updateParticipantsLimitInput"
              >
            </label>
          </div>

          <div class="grid grid-cols-1 gap-3">
            <label class="flex items-center gap-3 rounded-lg border border-black/8 px-4 py-3 text-sm text-toned dark:border-white/[0.08]">
              <input
                v-model="form.autoApproveApplications"
                type="checkbox"
                class="size-4 rounded border-black/20 dark:border-white/[0.3]"
              >
              <span class="grid gap-0.5">
                <span>Approve applications automatically</span>
                <span class="text-xs text-muted">New applications are approved immediately after required checks pass.</span>
              </span>
            </label>

            <label class="flex items-center gap-3 rounded-lg border border-black/8 px-4 py-3 text-sm text-toned dark:border-white/[0.08]">
              <input
                v-model="form.inPersonEvent"
                type="checkbox"
                class="size-4 rounded border-black/20 dark:border-white/[0.3]"
              >
              In-person event
            </label>

            <AccountEventSimplifiedClaimingControl
              v-if="isMeetup"
              v-model="form.simplifiedClaimingEnabled"
              :event-name="form.name"
              :event-id="props.eventId"
              :persisted-enabled="props.persistedSimplifiedClaimingEnabled"
              :initial-status="props.initialSimplifiedClaimingStatus ?? null"
              @updated="emit('updated')"
            />

            <EventTalkProposalControl
              v-if="isMeetup"
              v-model:enabled="form.talkProposalsEnabled"
              v-model:opens-at="form.talkProposalOpensAt"
              v-model:closes-at="form.talkProposalClosesAt"
              v-model:questions="form.talkProposalQuestions"
              :has-existing-proposal="props.hasExistingTalkProposal"
            />

            <EventConfigApplicationFieldsTable
              v-model:form="form"
              class="mt-2"
            />

            <label
              v-if="isHackathon"
              class="flex items-center gap-3 rounded-lg border border-black/8 px-4 py-3 text-sm text-toned dark:border-white/[0.08]"
            >
              <input
                v-model="form.requireSubmissionSummary"
                type="checkbox"
                class="size-4 rounded border-black/20 dark:border-white/[0.3]"
              >
              Require submission summary
            </label>

            <label
              v-if="isHackathon"
              class="flex items-center gap-3 rounded-lg border border-black/8 px-4 py-3 text-sm text-toned dark:border-white/[0.08]"
            >
              <input
                v-model="form.requireSubmissionRepositoryUrl"
                type="checkbox"
                class="size-4 rounded border-black/20 dark:border-white/[0.3]"
              >
              Require repository URL
            </label>

            <label
              v-if="isHackathon"
              class="flex items-center gap-3 rounded-lg border border-black/8 px-4 py-3 text-sm text-toned dark:border-white/[0.08]"
            >
              <input
                v-model="form.requireSubmissionDemoUrl"
                type="checkbox"
                class="size-4 rounded border-black/20 dark:border-white/[0.3]"
              >
              Require demo URL
            </label>
          </div>
        </div>
      </AppCard>
    </section>

    <div
      v-if="!showInlineDetailsActions && !isSettingsMode"
      class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 flex flex-col gap-4 rounded-xl px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="max-w-3xl space-y-3">
        <p class="text-sm text-muted">
          {{ helperText ?? 'Save your changes to update this event.' }}
        </p>

        <AppAlert
          v-if="submitError"
          color="error"
          variant="soft"
          :title="submitErrorTitle ?? 'Unable to save changes'"
          :description="submitError"
        />

        <AppAlert
          v-if="validationErrorMessages.length > 0"
          color="error"
          variant="soft"
          title="Form validation failed"
          :description="validationErrorMessages[0]"
        />
      </div>

      <AppButton
        type="submit"
        :loading="isSubmitting"
        :disabled="isSubmitting"
        color="primary"
        size="lg"
        class="justify-center"
      >
        {{ submitLabel }}
      </AppButton>
    </div>
  </form>
</template>
