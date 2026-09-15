<script setup lang="ts">
import qrcode from 'qrcode-generator'
import SimplifiedGiveawaysManager from './organisms/SimplifiedGiveawaysManager.vue'

import AccountEventSimplifiedClaimingStep from './AccountEventSimplifiedClaimingStep.vue'
import type { ApiDataResponse } from '~/lib/api'
import { normalizeApiError } from '~/lib/api'
import type { AccountEventSimplifiedClaimingStatus } from '#shared/domains/events/account-event-settings-page'
import { useApiClient } from '~/composables/useApiClient'

const props = withDefaults(defineProps<{
  eventId: string
  eventName: string
  initialStatus: AccountEventSimplifiedClaimingStatus
  variant?: 'workspace' | 'builder'
}>(), {
  variant: 'workspace'
})
const emit = defineEmits<{
  lockChange: [locked: boolean]
  updated: []
}>()

const apiFetch = useApiClient()
const toast = useToast()
const isAttendeeUploadPending = shallowRef(false)
const attendeeUploadError = shallowRef('')
const attendeeFileInput = useTemplateRef<HTMLInputElement>('attendeeFileInput')
const claimStatus = shallowRef(props.initialStatus)
watch(() => props.initialStatus, (status) => {
  claimStatus.value = status
}, { immediate: true })
watch(() => claimStatus.value.locked, locked => emit('lockChange', locked), { immediate: true })
const rewardReady = computed(() => Boolean(
  claimStatus.value?.offers.length
  && claimStatus.value.totalInventoryCount > 0
  && !claimStatus.value.issues.some(issue => issue.code === 'inventory_invalid' || issue.code === 'redirect_missing')
))
const completedStepCount = computed(() => {
  if (!claimStatus.value) {
    return 0
  }

  return Number(Boolean(claimStatus.value.redemptionUrl))
    + Number(rewardReady.value)
    + Number(claimStatus.value.attendeeCount > 0)
})
const qrDataUrl = computed(() => {
  if (!claimStatus.value?.redemptionUrl) {
    return ''
  }

  const qr = qrcode(0, 'M')
  qr.addData(claimStatus.value.redemptionUrl)
  qr.make()
  return qr.createDataURL(6, 3)
})

function chooseAttendeeFile() {
  attendeeFileInput.value?.click()
}

async function importAttendees(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }

  isAttendeeUploadPending.value = true
  attendeeUploadError.value = ''
  try {
    const body = new FormData()
    body.append('file', file)
    const response = await apiFetch<ApiDataResponse<{
      eligibleCount: number
      attendeeCount: number
    }>>(`/api/events/${props.eventId}/simplified-claiming/attendees/import`, {
      method: 'POST',
      body
    })
    toast.add({
      title: 'Approved attendees imported',
      description: `${response.data.eligibleCount} unique attendee${response.data.eligibleCount === 1 ? '' : 's'} added or refreshed.`,
      color: 'success'
    })
    emit('updated')
  } catch (caught) {
    attendeeUploadError.value = normalizeApiError(caught).message
  } finally {
    isAttendeeUploadPending.value = false
  }
}

async function copyRedemptionUrl() {
  if (!claimStatus.value?.redemptionUrl) {
    return
  }
  await navigator.clipboard.writeText(claimStatus.value.redemptionUrl)
  toast.add({ title: 'Redemption link copied', color: 'success' })
}

function downloadQrSvg() {
  if (!claimStatus.value?.redemptionUrl) {
    return
  }

  const qr = qrcode(0, 'M')
  qr.addData(claimStatus.value.redemptionUrl)
  qr.make()
  const blob = new Blob([qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true })], {
    type: 'image/svg+xml'
  })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = 'event-redemption-qr.svg'
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}
</script>

<template>
  <section
    data-testid="simplified-claiming-settings-panel"
    class="min-w-0"
    :class="props.variant === 'workspace' ? 'px-4 pb-2 sm:px-5' : ''"
  >
    <div class="flex flex-col gap-3 border-b border-primary/15 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div class="space-y-1">
        <h3 class="text-lg font-semibold text-highlighted">
          Attendee claiming setup
        </h3>
        <p class="text-sm text-muted">
          Add giveaways and eligible attendees, then share the QR.
        </p>
      </div>
      <AppBadge
        v-if="claimStatus"
        color="primary"
        variant="soft"
        class="shrink-0"
      >
        {{ completedStepCount }} of 3 prepared
      </AppBadge>
    </div>

    <div class="py-4">
      <AppAlert
        v-if="claimStatus.locked"
        color="info"
        variant="soft"
        title="Claiming is active"
        description="The event URL, claiming method, and redirect giveaway are locked. You can add giveaways, credits, and eligible attendees; new giveaways apply to new claims."
      />
      <AppAlert
        v-else-if="!claimStatus.ready"
        color="warning"
        variant="soft"
        title="Redemption is not available yet"
        :description="claimStatus.issues.map(issue => issue.message).join(' ')"
      />
      <AppAlert
        v-else
        color="success"
        variant="soft"
        title="Ready for attendees"
        description="Eligible attendees can redeem while event registration is open."
      />

      <div class="mt-1 divide-y divide-primary/15">
        <AccountEventSimplifiedClaimingStep
          :number="1"
          title="Redemption QR"
        >
          <template #status>
            <AppBadge
              color="success"
              variant="soft"
            >
              Ready
            </AppBadge>
          </template>

          <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem] md:items-center">
            <div class="min-w-0">
              <p class="break-all text-sm text-muted">
                {{ claimStatus.redemptionUrl }}
              </p>
              <p class="mt-2 text-sm text-toned">
                Prepare or share this QR now. Redemption stays unavailable until rewards and eligible attendees are ready.
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <AppButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  @click="copyRedemptionUrl"
                >
                  Copy link
                </AppButton>
                <AppButton
                  type="button"
                  color="neutral"
                  variant="outline"
                  @click="downloadQrSvg"
                >
                  Download QR as SVG
                </AppButton>
              </div>
            </div>
            <img
              v-if="qrDataUrl"
              :src="qrDataUrl"
              alt="Redemption QR code"
              class="mx-auto size-40 rounded-lg bg-white p-2"
            >
          </div>
        </AccountEventSimplifiedClaimingStep>

        <SimplifiedGiveawaysManager
          :event-id="eventId"
          :event-name="eventName"
          :offers="claimStatus.offers"
          :locked="claimStatus.locked"
          @updated="emit('updated')"
        />

        <AccountEventSimplifiedClaimingStep
          :number="3"
          title="Eligible attendees"
        >
          <template #status>
            <AppBadge
              :color="claimStatus.attendeeCount > 0 ? 'success' : 'warning'"
              variant="soft"
            >
              {{ claimStatus.attendeeCount > 0 ? `${claimStatus.attendeeCount} eligible` : 'Not uploaded' }}
            </AppBadge>
          </template>

          <p class="text-sm text-muted">
            Luma check-ins and approved attendees imported by CSV share one list. CSV import remains available at any time; duplicate emails are treated as one attendee.
          </p>
          <input
            ref="attendeeFileInput"
            type="file"
            accept=".csv,text/csv"
            class="sr-only"
            @change="importAttendees"
          >
          <div>
            <AppButton
              type="button"
              color="neutral"
              variant="outline"
              :loading="isAttendeeUploadPending"
              @click="chooseAttendeeFile"
            >
              Import attendees CSV
            </AppButton>
          </div>
          <AppAlert
            v-if="attendeeUploadError"
            color="error"
            variant="soft"
            title="Attendees could not be imported"
            :description="attendeeUploadError"
          />
        </AccountEventSimplifiedClaimingStep>
      </div>
    </div>
  </section>
</template>
