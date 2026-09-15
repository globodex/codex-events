<script setup lang="ts">
import { normalizeApiError, type ApiDataResponse } from '~/lib/api'
import type { EventFormState } from '~/domains/events/admin-event'
import type { EventRecord } from '~/domains/events/records'
import type {
  AccountEventSettingsCreditOffer,
  AccountEventSimplifiedClaimingStatus
} from '#shared/domains/events/account-event-settings-page'
import AccountEventSimplifiedClaimingPanel from '~/components/account/events/AccountEventSimplifiedClaimingPanel.vue'
import AdminBuilderRegularCreditsManager from './AdminBuilderRegularCreditsManager.vue'

const form = defineModel<EventFormState>('form', { required: true })

const props = defineProps<{
  mode: 'create' | 'edit'
  event: EventRecord | null
  offers: AccountEventSettingsCreditOffer[]
  simplifiedClaimingStatus: AccountEventSimplifiedClaimingStatus | null
}>()

const emit = defineEmits<{
  updated: []
}>()

const isMeetup = computed(() => form.value.eventType === 'meetup')
const isSimplified = computed(() => form.value.simplifiedClaimingEnabled)
const persistedIsSimplified = computed(() => props.event?.simplifiedClaimingEnabled ?? false)
const selectedMethodIsSaved = computed(() => Boolean(
  props.event
  && isSimplified.value === persistedIsSimplified.value
))
const claimingLocked = computed(() => props.simplifiedClaimingStatus?.locked ?? false)
const hasRegularClaims = computed(() => props.offers.some(offer => offer.claimedCount > 0))
const canChooseSimplified = computed(() => !claimingLocked.value && props.offers.length === 0)

const apiFetch = useApiClient()
const toast = useToast()
const connectLuma = shallowRef(Boolean(form.value.lumaEventApiId || form.value.lumaApiKey))
const importPending = shallowRef(false)
const importError = shallowRef('')
const savedLumaConnection = computed(() => Boolean(
  props.event?.simplifiedClaimingEnabled
  && props.event.lumaEventApiId
  && props.event.lumaApiKey
  && form.value.lumaEventApiId.trim() === props.event.lumaEventApiId
  && form.value.lumaApiKey.trim() === props.event.lumaApiKey
))
watch(() => [form.value.lumaEventApiId, form.value.lumaApiKey], ([id, key]) => {
  if (id || key) connectLuma.value = true
})

function toggleLuma(enabled: boolean) {
  connectLuma.value = enabled
  if (!enabled) {
    form.value.lumaEventApiId = ''
    form.value.lumaApiKey = ''
  }
}

async function importCheckIns() {
  importPending.value = true
  importError.value = ''
  try {
    const response = await apiFetch<ApiDataResponse<{ eligibleCount: number }>>(
      `/api/events/${props.event!.id}/simplified-claiming/attendees/import-check-ins`,
      { method: 'POST' }
    )
    toast.add({
      title: 'Luma check-ins imported',
      description: `${response.data.eligibleCount} eligible attendees added or refreshed.`,
      color: 'success'
    })
    emit('updated')
  } catch (error) {
    importError.value = normalizeApiError(error).message
  } finally {
    importPending.value = false
  }
}

function selectMethod(method: 'regular' | 'simplified') {
  if (method === 'simplified' && (!isMeetup.value || !canChooseSimplified.value)) {
    return
  }

  if (method === 'regular' && claimingLocked.value) {
    return
  }

  form.value.simplifiedClaimingEnabled = method === 'simplified'
}
</script>

<template>
  <div class="space-y-5">
    <div
      v-if="isMeetup"
      class="grid gap-2 sm:grid-cols-2"
      role="radiogroup"
      aria-label="Credits claiming method"
    >
      <button
        type="button"
        role="radio"
        :aria-checked="!isSimplified"
        :disabled="claimingLocked"
        class="relative rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        :class="!isSimplified
          ? 'border-black/25 bg-white/95 dark:border-white/[0.28] dark:bg-[#181818]'
          : 'border-black/8 bg-white/88 text-toned hover:border-black/20 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]'"
        @click="selectMethod('regular')"
      >
        <AppIcon
          v-if="!isSimplified"
          name="i-lucide-circle-check-big"
          class="absolute right-3 top-3 size-4 text-emerald-500"
        />
        <span class="block pr-6 text-sm font-semibold text-highlighted">Regular claiming</span>
        <span class="block text-[11px] text-dimmed">
          Approved participants sign in and claim one value from each offer.
        </span>
      </button>

      <button
        type="button"
        role="radio"
        :aria-checked="isSimplified"
        :disabled="!canChooseSimplified && !isSimplified"
        class="relative rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        :class="isSimplified
          ? 'border-black/25 bg-white/95 dark:border-white/[0.28] dark:bg-[#181818]'
          : 'border-black/8 bg-white/88 text-toned hover:border-black/20 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]'"
        @click="selectMethod('simplified')"
      >
        <AppIcon
          v-if="isSimplified"
          name="i-lucide-circle-check-big"
          class="absolute right-3 top-3 size-4 text-emerald-500"
        />
        <span class="block pr-6 text-sm font-semibold text-highlighted">Simplified claiming</span>
        <span class="block text-[11px] text-dimmed">
          Eligible attendees scan a QR and confirm their email.
        </span>
      </button>
    </div>

    <AppAlert
      v-if="isMeetup && !isSimplified && props.offers.length > 0"
      color="neutral"
      variant="soft"
      :title="hasRegularClaims ? 'Simplified claiming is unavailable' : 'Delete regular offers to change methods'"
      :description="hasRegularClaims
        ? 'This event already has credits claimed through participant accounts.'
        : 'Remove regular offers before switching to simplified giveaways.'"
    />

    <div
      v-if="isSimplified"
      class="space-y-3"
    >
      <AppCheckbox
        :model-value="connectLuma"
        label="Connect Luma"
        @update:model-value="toggleLuma"
      />
      <template v-if="connectLuma">
        <div class="grid gap-3 sm:grid-cols-2">
          <AppFormField
            name="simplified-luma-event-id"
            label="Luma event ID"
          >
            <AppInput
              id="simplified-luma-event-id"
              v-model="form.lumaEventApiId"
              placeholder="evt-…"
              size="sm"
            />
          </AppFormField>
          <AppFormField
            name="simplified-luma-api-key"
            label="Luma API key"
          >
            <AppInput
              id="simplified-luma-api-key"
              v-model="form.lumaApiKey"
              type="password"
              size="sm"
            />
          </AppFormField>
        </div>
        <p class="text-sm text-muted">
          New Luma check-ins add eligible attendees after you save. Import earlier check-ins with the button below.
        </p>
        <AppAlert
          v-if="savedLumaConnection && event?.lumaWebhookStatus !== 'configured'"
          color="warning"
          title="Luma check-ins are not connected"
          description="Check your credentials and save the event again to retry. CSV import remains available."
        />
        <AppButton
          type="button"
          color="neutral"
          variant="outline"
          :disabled="!savedLumaConnection"
          :loading="importPending"
          @click="importCheckIns"
        >
          Import existing check-ins
        </AppButton>
        <p
          v-if="!savedLumaConnection"
          class="text-sm text-muted"
        >
          Save the event and Luma credentials before importing check-ins.
        </p>
        <AppAlert
          v-if="importError"
          color="error"
          title="Check-ins could not be imported"
          :description="importError"
        />
      </template>
    </div>

    <AppAlert
      v-if="props.mode === 'create'"
      color="info"
      variant="soft"
      title="Create the event to upload credits"
      description="Your claiming method will be saved with the draft event."
    />

    <AppAlert
      v-else-if="!selectedMethodIsSaved"
      color="info"
      variant="soft"
      title="Save the event to change the claiming method"
      description="Credit uploads will be available after this setting is saved."
    />

    <AccountEventSimplifiedClaimingPanel
      v-else-if="isSimplified && event && simplifiedClaimingStatus"
      :event-id="event.id"
      :event-name="event.name"
      :initial-status="simplifiedClaimingStatus"
      variant="builder"
      @updated="emit('updated')"
    />

    <AdminBuilderRegularCreditsManager
      v-else-if="event"
      :event-id="event.id"
      :offers="offers"
      @updated="emit('updated')"
    />
  </div>
</template>
