<script setup lang="ts">
// The credits of the event on the Overview tab: one row per offer that this person can claim
// or already claimed. The server sends no other offer (`listEventCreditOffersForOverview`), so
// an offer without a claimed code can be claimed while it has a free code.
import type { AccountEventEntryParticipantCreditOffer } from '#shared/domains/events/account-event-entry-page'
import type { EventCreditApiDataResponse } from '~/domains/credits'

import { useApiClient } from '~/composables/useApiClient'
import { isEventCreditLink, normalizeEventCreditApiError } from '~/domains/credits'
import { formatEventDate, formatEventTime } from '~/domains/events/presentation'

const props = defineProps<{
  eventId: string
  offers: AccountEventEntryParticipantCreditOffer[]
}>()
const emit = defineEmits<{
  /** Asks the page to read its data again, so the offers and their free codes are current. */
  updated: []
}>()

const apiFetch = useApiClient()
const toast = useToast()
// The offers as shown. A claim writes its answer here right away, and the page data follows.
const shownOffers = shallowRef(props.offers)
const claimPendingById = reactive<Record<string, boolean>>({})
const claimErrorById = reactive<Record<string, string>>({})
// A claimed code is hidden until the person asks to see it.
const revealedCodeIds = ref(new Set<string>())
const hiddenCode = '•••• •••• ••••'

watch(() => props.offers, (offers) => {
  shownOffers.value = offers
})

function formatClaimedAt(value: string) {
  return `${formatEventDate(value)} at ${formatEventTime(value)}`
}

function toggleCodeVisibility(codeId: string) {
  const codeIds = new Set(revealedCodeIds.value)

  if (!codeIds.delete(codeId)) {
    codeIds.add(codeId)
  }

  revealedCodeIds.value = codeIds
}

async function claimOffer(offerId: string) {
  claimErrorById[offerId] = ''
  claimPendingById[offerId] = true

  try {
    const response = await apiFetch<EventCreditApiDataResponse<AccountEventEntryParticipantCreditOffer>>(
      `/api/events/${props.eventId}/credits/${offerId}/actions/claim`,
      { method: 'POST' }
    )

    shownOffers.value = shownOffers.value.map(offer => offer.id === offerId ? response.data : offer)
    toast.add({ title: 'Credit claimed', color: 'success' })
  } catch (error) {
    claimErrorById[offerId] = normalizeEventCreditApiError(error).message
  } finally {
    // Read the page again after a refused claim too: the page was out of date, for example
    // because another participant took the last code a moment earlier.
    emit('updated')
    claimPendingById[offerId] = false
  }
}

async function copyCode(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({
      title: 'Code copied',
      description: 'The code was copied to your clipboard.',
      color: 'success'
    })
  } catch {
    toast.add({
      title: 'Copy failed',
      description: 'This browser could not copy the code right now.',
      color: 'error'
    })
  }
}
</script>

<template>
  <AppCard data-testid="participant-credits">
    <template #header>
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 class="text-lg font-semibold text-highlighted">
          Claim credits
        </h2>
        <p class="text-sm text-muted">
          One per person. Your code stays here after you claim it.
        </p>
      </div>
    </template>

    <!--
      The offers are parts of this card, not cards of their own: one below the other with a line
      between them, and side by side on a wide screen.
    -->
    <div
      class="grid gap-4 lg:gap-x-8"
      :class="{ 'lg:grid-cols-2': shownOffers.length > 1 }"
    >
      <article
        v-for="offer in shownOffers"
        :key="offer.id"
        :data-testid="`participant-credit-offer-${offer.id}`"
        class="min-w-0 space-y-3 border-t border-black/8 pt-4 first:border-t-0 first:pt-0 lg:border-t-0 lg:pt-0 lg:even:border-l lg:even:pl-8 dark:border-white/[0.08]"
      >
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-base font-semibold text-highlighted">
            {{ offer.name }}
          </h3>
          <AppBadge
            v-if="offer.claimedCode"
            color="primary"
            variant="soft"
          >
            Claimed
          </AppBadge>
          <AppBadge
            v-else-if="offer.availableCount === 0"
            color="neutral"
            variant="soft"
          >
            No credits left
          </AppBadge>
          <AppBadge
            v-else
            color="success"
            variant="soft"
          >
            Available
          </AppBadge>
          <!-- The button stays after a refused claim, so the person can try again. -->
          <AppButton
            v-if="!offer.claimedCode && offer.availableCount > 0"
            color="primary"
            size="sm"
            class="ml-auto"
            :loading="claimPendingById[offer.id]"
            @click="claimOffer(offer.id)"
          >
            Claim credit
          </AppButton>
        </div>

        <AppMarkdownRenderer :source="offer.description" />

        <div
          v-if="offer.claimedCode"
          class="space-y-2"
        >
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            {{ isEventCreditLink(offer.claimedCode.value) ? 'Your link' : 'Your code' }}
          </p>

          <AppButton
            v-if="isEventCreditLink(offer.claimedCode.value)"
            :to="offer.claimedCode.value"
            color="neutral"
            variant="soft"
            external
            trailing-icon="i-lucide-external-link"
          >
            Open link
          </AppButton>

          <div
            v-else
            class="flex flex-wrap items-center gap-3"
          >
            <code class="min-w-0 break-all font-mono text-sm text-highlighted">
              {{ revealedCodeIds.has(offer.claimedCode.id) ? offer.claimedCode.value : hiddenCode }}
            </code>

            <div class="flex shrink-0 items-center gap-2">
              <AppButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-lucide-copy"
                @click="copyCode(offer.claimedCode.value)"
              >
                Copy code
              </AppButton>

              <AppButton
                type="button"
                color="neutral"
                variant="ghost"
                size="sm"
                :icon="revealedCodeIds.has(offer.claimedCode.id) ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                class="h-8 w-8 gap-0 px-0"
                :aria-label="revealedCodeIds.has(offer.claimedCode.id) ? 'Hide code' : 'Show code'"
                :aria-pressed="revealedCodeIds.has(offer.claimedCode.id)"
                :title="revealedCodeIds.has(offer.claimedCode.id) ? 'Hide code' : 'Show code'"
                @click="toggleCodeVisibility(offer.claimedCode.id)"
              />
            </div>
          </div>

          <p
            v-if="offer.claimedCode.claimedAt"
            class="text-sm text-muted"
          >
            Claimed {{ formatClaimedAt(offer.claimedCode.claimedAt) }}
          </p>
        </div>

        <AppAlert
          v-else-if="claimErrorById[offer.id]"
          color="error"
          variant="soft"
          title="Credit could not be claimed"
          :description="claimErrorById[offer.id]"
        />
      </article>
    </div>
  </AppCard>
</template>
