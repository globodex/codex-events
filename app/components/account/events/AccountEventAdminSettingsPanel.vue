<script setup lang="ts">
import AccountEventAdminTermsCard from '~/components/account/events/AccountEventAdminTermsCard.vue'
import AdminEventCriteriaEditor from '~/components/admin/organisms/AdminEventCriteriaEditor.vue'
import AdminEventPrizesEditor from '~/components/admin/organisms/AdminEventPrizesEditor.vue'
import AdminEventVisibilityControl from '~/components/admin/organisms/AdminEventVisibilityControl.vue'

import type { ApiDataResponse } from '~/lib/api'
import type {
  EventRecord,
  TermsDocument
} from '~/domains/events/records'
import type {
  EventFormState
} from '~/domains/events/admin-event'
import type {
  AccountEventSettingsEvent,
  AccountEventSettingsPage,
  AccountEventSettingsPrize
} from '#shared/domains/events/account-event-settings-page'

import { normalizeApiError } from '~/lib/api'

import {
  buildEventConfigurationPatch,
  getTermsVersionPublishErrorMessage
} from '~/domains/events/admin-event'
import { formatEventTypeLabel } from '~/domains/events/presentation'
import { computeEventBalance } from '#shared/domains/events/builder-scoring'
import { createBuilderStateFromEvent, toEventBalanceInputFromState } from '~/domains/events/builder'
import { useApiClient } from '~/composables/useApiClient'

const props = withDefaults(defineProps<{
  eventId: string
  onCatalogSaved: (eventSlug: string) => Promise<void>
  page?: AccountEventSettingsPage | null
  eventData?: AccountEventSettingsEvent | null
  prizesData?: AccountEventSettingsPrize[]
  isLoading?: boolean
  loadErrorMessage?: string
  canManage?: boolean
  showProgramSettings?: boolean
  showTermsManagement?: boolean
  showCriteriaConfiguration?: boolean
  showPrizeConfiguration?: boolean
}>(), {
  page: null,
  eventData: null,
  prizesData: () => [],
  isLoading: false,
  loadErrorMessage: '',
  canManage: true,
  showProgramSettings: true,
  showTermsManagement: true,
  showCriteriaConfiguration: true,
  showPrizeConfiguration: true
})

const emit = defineEmits<{
  updated: [slug?: string]
}>()

const toast = useToast()
const apiFetch = useApiClient()
const { clearUpdatedEvent } = useEventConfiguration()
const eventId = computed(() => props.eventId.trim())

if (!eventId.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Event not found.'
  })
}

const settingsPage = computed(() => props.page ?? null)

const isSavingConfig = ref(false)
const isRetryingLumaConfiguration = ref(false)
const savingTermsDocumentType = ref<TermsDocument['documentType'] | null>(null)
const configMutationError = ref('')
const mutationError = ref('')
const imageMutationState = reactive({
  background: {
    pending: false,
    error: ''
  },
  banner: {
    pending: false,
    error: ''
  }
})

const currentEvent = computed(() => settingsPage.value?.event ?? props.eventData ?? null)

const builderBalance = computed(() => {
  const event = currentEvent.value

  if (!event || event.creationFlow !== 'builder') {
    return null
  }

  return computeEventBalance(toEventBalanceInputFromState(createBuilderStateFromEvent(event)))
})
const isEventHidden = computed(() => Boolean(currentEvent.value?.hiddenAt))
const isCompetitionEvent = computed(() => currentEvent.value?.eventType === 'hackathon')
const settingsOverviewGridClass = computed(() =>
  isCompetitionEvent.value
    ? 'md:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(0,1fr))]'
    : 'md:grid-cols-2 lg:grid-cols-[minmax(0,1.45fr)_repeat(3,minmax(0,1fr))]'
)
const eventTypeLabel = computed(() =>
  currentEvent.value ? formatEventTypeLabel(currentEvent.value.eventType) : ''
)
const canManage = computed(() => props.canManage)
const eventVisibilityCardTitle = computed(() => isEventHidden.value ? 'Event hidden' : 'Hide event')
const eventVisibilityCardDescription = computed(() =>
  isEventHidden.value
    ? 'Public pages and participant event lists are unavailable while admins fix the issue.'
    : 'Hide this event when public access needs to stop while admins fix a serious issue.'
)
const criteria = computed(() => settingsPage.value?.criteria ?? [])
const prizes = computed(() => settingsPage.value?.prizes ?? props.prizesData ?? [])
const roleAssignments = computed(() => settingsPage.value?.roles.assignments ?? [])
const applicationTerms = computed(() => settingsPage.value?.terms.application.versions ?? [])
const winnerTerms = computed(() => settingsPage.value?.terms.winner.versions ?? [])
const currentApplicationTerms = computed(() => settingsPage.value?.terms.application.current ?? null)
const currentWinnerTerms = computed(() => settingsPage.value?.terms.winner.current ?? null)
const creatorAssignment = computed(() =>
  roleAssignments.value.find(assignment => assignment.userId === currentEvent.value?.createdByUserId) ?? null
)
const creatorLabel = computed(() => {
  const creator = creatorAssignment.value?.user

  if (creator) {
    return creator.displayName || creator.email
  }

  return currentEvent.value?.createdByUserId ?? 'Platform admin'
})
const creatorMeta = computed(() => creatorAssignment.value?.user?.email ?? 'Platform admin')
const adminCount = computed(() => settingsPage.value?.roles.counts.admins ?? 0)
const staffCount = computed(() => settingsPage.value?.roles.counts.staff ?? 0)
const judgeCount = computed(() => settingsPage.value?.roles.counts.judges ?? 0)

async function saveConfiguration(configForm: EventFormState) {
  const event = currentEvent.value
  if (!event) {
    return
  }

  configMutationError.value = ''
  isSavingConfig.value = true

  try {
    const { data } = await apiFetch<ApiDataResponse<EventRecord>>(`/api/events/${event.id}`, {
      method: 'PATCH',
      body: buildEventConfigurationPatch(configForm, event.eventType)
    })

    toast.add({
      title: 'Configuration saved',
      description: 'Event settings now match the latest admin updates.',
      color: 'success'
    })

    if (props.eventId === event.id) {
      emit('updated', data.slug)
    }
    clearUpdatedEvent(event.slug, data.slug)
  } catch (error) {
    configMutationError.value = normalizeApiError(error).message
  } finally {
    isSavingConfig.value = false
  }
}

async function retryLumaConfiguration() {
  const event = currentEvent.value

  if (!event) {
    return
  }

  configMutationError.value = ''
  isRetryingLumaConfiguration.value = true

  try {
    await apiFetch<ApiDataResponse<EventRecord>>(`/api/events/${event.id}/luma/actions/retry-configuration`, {
      method: 'POST'
    })

    toast.add({
      title: 'Luma configuration retried',
      description: 'The latest Luma webhook status is shown in event settings.',
      color: 'success'
    })

    emit('updated')
  } catch (error) {
    configMutationError.value = normalizeApiError(error).message
  } finally {
    isRetryingLumaConfiguration.value = false
  }
}

type EventImageSlot = 'background' | 'banner'

async function uploadEventImage(slot: EventImageSlot, file: File) {
  const event = currentEvent.value

  if (!event) {
    return
  }

  const state = imageMutationState[slot]
  state.pending = true
  state.error = ''

  try {
    const formData = new FormData()
    formData.append('file', file)

    await apiFetch<ApiDataResponse<EventRecord>>(`/api/events/${event.id}/images/${slot}`, {
      method: 'POST',
      body: formData
    })

    emit('updated')
    toast.add({
      title: slot === 'background' ? 'Background image updated' : 'Banner image updated',
      description: slot === 'background'
        ? 'The event page now shows the latest background image.'
        : 'The event page now shows the latest banner image.',
      color: 'success'
    })
  } catch (error) {
    state.error = normalizeApiError(error).message
  } finally {
    state.pending = false
  }
}

async function removeEventImage(slot: EventImageSlot) {
  const event = currentEvent.value

  if (!event) {
    return
  }

  const state = imageMutationState[slot]
  state.pending = true
  state.error = ''

  try {
    await apiFetch<ApiDataResponse<EventRecord>>(`/api/events/${event.id}/images/${slot}`, {
      method: 'DELETE'
    })

    emit('updated')
    toast.add({
      title: slot === 'background' ? 'Background image removed' : 'Banner image removed',
      description: slot === 'background'
        ? 'The event page no longer shows a background image.'
        : 'The event page no longer shows a banner image.',
      color: 'success'
    })
  } catch (error) {
    state.error = normalizeApiError(error).message
  } finally {
    state.pending = false
  }
}

async function uploadBackgroundImage(file: File) {
  await uploadEventImage('background', file)
}

async function removeBackgroundImage() {
  await removeEventImage('background')
}

async function uploadBannerImage(file: File) {
  await uploadEventImage('banner', file)
}

async function removeBannerImage() {
  await removeEventImage('banner')
}

function getNextTermsVersion(documents: Array<Pick<TermsDocument, 'version'>>) {
  return documents.reduce((highest, document) => Math.max(highest, document.version), 0) + 1
}

function formatTermsTitle(documentType: TermsDocument['documentType'], version: number) {
  const label = documentType === 'application_terms' ? 'Application Terms' : 'Winner Terms'
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())

  return `${label} v${version} (${date})`
}

async function saveTerms(documentType: TermsDocument['documentType'], draft: string) {
  const event = currentEvent.value

  if (!event) {
    return
  }

  mutationError.value = ''
  savingTermsDocumentType.value = documentType

  const content = draft.trim()
  const version = getNextTermsVersion(documentType === 'application_terms' ? applicationTerms.value : winnerTerms.value)
  const title = formatTermsTitle(documentType, version)
  const validationError = getTermsVersionPublishErrorMessage(title, content)

  if (validationError) {
    mutationError.value = validationError
    savingTermsDocumentType.value = null
    return
  }

  try {
    const createdDocument = await apiFetch<ApiDataResponse<TermsDocument>>(`/api/events/${event.id}/terms/${documentType}/versions`, {
      method: 'POST',
      body: {
        title,
        content
      }
    })

    await apiFetch(`/api/events/${event.id}/terms/${documentType}/actions/set-current`, {
      method: 'POST',
      body: {
        eventTermsDocumentId: createdDocument.data.id
      }
    })

    toast.add({
      title: documentType === 'application_terms' ? 'Application terms updated' : 'Winner terms updated',
      description: documentType === 'application_terms'
        ? 'A new application terms version is now current for registration.'
        : 'A new winner terms version is now current for prize redemption.',
      color: 'success'
    })
    emit('updated')
  } catch (error) {
    mutationError.value = normalizeApiError(error).message
  } finally {
    savingTermsDocumentType.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <AppAlert
      v-if="mutationError"
      color="error"
      variant="soft"
      title="Admin action failed"
      :description="mutationError"
    />

    <AppAlert
      v-if="props.loadErrorMessage"
      color="error"
      variant="soft"
      title="Unable to load event"
      :description="props.loadErrorMessage"
    />

    <AppAlert
      v-else-if="currentEvent && !canManage"
      color="warning"
      variant="soft"
      title="Admin access required"
      description="You can see this event, but only its admins can change these settings."
    />

    <div
      v-else-if="props.isLoading && !currentEvent"
      class="rounded-xl border border-dashed border-black/10 px-5 py-8 text-center text-sm text-muted dark:border-white/[0.08]"
    >
      Loading event settings…
    </div>

    <template v-else-if="currentEvent">
      <section
        v-if="props.showProgramSettings"
        class="grid gap-4"
        :class="settingsOverviewGridClass"
      >
        <div class="min-w-0 rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Created by
          </p>
          <p
            class="mt-2 min-w-0 truncate text-xl font-semibold text-highlighted"
            :title="creatorLabel"
          >
            {{ creatorLabel }}
          </p>
          <p
            class="mt-1 min-w-0 truncate text-sm text-muted"
            :title="creatorMeta"
          >
            {{ creatorMeta }}
          </p>
        </div>

        <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Event type
          </p>
          <p class="mt-2 text-xl font-semibold text-highlighted">
            {{ eventTypeLabel }}
          </p>
        </div>

        <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Admins
          </p>
          <p class="mt-2 text-xl font-semibold text-highlighted">
            {{ adminCount }}
          </p>
        </div>

        <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Staff
          </p>
          <p class="mt-2 text-xl font-semibold text-highlighted">
            {{ staffCount }}
          </p>
        </div>

        <div
          v-if="isCompetitionEvent"
          class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5"
        >
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Judges
          </p>
          <p class="mt-2 text-xl font-semibold text-highlighted">
            {{ judgeCount }}
          </p>
        </div>
      </section>

      <section
        v-if="props.showProgramSettings"
        class="space-y-6"
      >
        <div
          data-testid="event-builder-settings-banner"
          class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-black/8 bg-white/78 p-4 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] dark:border-white/[0.08] dark:bg-[#151515]/64"
        >
          <AppButton
            color="neutral"
            variant="solid"
            size="sm"
            :to="`/admin/events/builder/${currentEvent.slug}`"
            data-testid="event-builder-open-in-builder"
          >
            Open event builder
            <template #trailing>
              <AppIcon
                name="i-lucide-arrow-right"
                class="size-3.5"
              />
            </template>
          </AppButton>
          <AppBadge
            v-if="builderBalance"
            :color="builderBalance.score >= 80 ? 'success' : builderBalance.score >= 60 ? 'info' : 'warning'"
            variant="soft"
            class="tabular-nums"
          >
            Balance {{ builderBalance.score }} · {{ builderBalance.band.label }}
          </AppBadge>
        </div>

        <LazyAdminEventCreateEditForm
          :key="currentEvent.id"
          :initial-event="currentEvent"
          :initial-simplified-claiming-status="settingsPage?.simplifiedClaiming ?? null"
          :has-existing-talk-proposal="settingsPage?.talkProposals.hasExistingProposal ?? false"
          :can-upload-managed-images="true"
          :is-submitting="isSavingConfig"
          mode="settings"
          :background-image-upload-pending="imageMutationState.background.pending"
          :background-image-upload-error="imageMutationState.background.error"
          :banner-image-upload-pending="imageMutationState.banner.pending"
          :banner-image-upload-error="imageMutationState.banner.error"
          :is-retrying-luma-configuration="isRetryingLumaConfiguration"
          submit-label="Save Configuration"
          helper-text="Save changes."
          :submit-error="configMutationError"
          @submit="saveConfiguration"
          @upload-background-image="uploadBackgroundImage"
          @remove-background-image="removeBackgroundImage"
          @upload-banner-image="uploadBannerImage"
          @remove-banner-image="removeBannerImage"
          @retry-luma-configuration="retryLumaConfiguration"
          @updated="emit('updated')"
        />
      </section>

      <section class="space-y-6">
        <AccountEventAdminTermsCard
          v-if="props.showTermsManagement"
          :key="currentEvent.id"
          :current-application-terms="currentApplicationTerms"
          :current-winner-terms="currentWinnerTerms"
          :saving-terms-document-type="savingTermsDocumentType"
          :show-winner-terms="isCompetitionEvent"
          @save-terms="saveTerms"
        />

        <AppCard
          v-if="props.showCriteriaConfiguration && isCompetitionEvent"
          class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
        >
          <template #header>
            <div class="space-y-1">
              <h2 class="text-lg font-semibold text-highlighted">
                Judging Criteria
              </h2>
              <p class="text-sm text-muted">
                Set how judges score submissions.
              </p>
            </div>
          </template>

          <AdminEventCriteriaEditor
            :event-id="currentEvent.id"
            :criteria="criteria"
            @saved="props.onCatalogSaved(currentEvent.slug)"
          />
        </AppCard>

        <AppCard
          v-if="props.showPrizeConfiguration && isCompetitionEvent"
          class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
        >
          <template #header>
            <div class="space-y-1">
              <h2 class="text-lg font-semibold text-highlighted">
                Prize Configuration
              </h2>
              <p class="text-sm text-muted">
                Set prizes and placement ranges.
              </p>
            </div>
          </template>

          <AdminEventPrizesEditor
            :event-id="currentEvent.id"
            :prizes="prizes"
            @saved="props.onCatalogSaved(currentEvent.slug)"
          />
        </AppCard>
      </section>

      <AppCard
        v-if="props.showProgramSettings"
        class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
      >
        <template #header>
          <div class="space-y-1">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Emergency visibility
            </p>
            <h2 class="text-lg font-semibold text-highlighted">
              {{ eventVisibilityCardTitle }}
            </h2>
            <p class="max-w-3xl text-sm text-muted">
              {{ eventVisibilityCardDescription }}
            </p>
          </div>
        </template>

        <AdminEventVisibilityControl
          :event="currentEvent"
          @updated="emit('updated')"
        />
      </AppCard>
    </template>
  </div>
</template>
