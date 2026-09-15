<script setup lang="ts">
import type { AccountEventSimplifiedClaimingStatus } from '#shared/domains/events/account-event-settings-page'
import { normalizeApiError } from '~/lib/api'
import AccountEventSimplifiedClaimingStep from '../AccountEventSimplifiedClaimingStep.vue'
import SimplifiedGiveawayEditor from '../molecules/SimplifiedGiveawayEditor.vue'
import SimplifiedGiveawayEmailPreview from '../molecules/SimplifiedGiveawayEmailPreview.vue'

type Offer = AccountEventSimplifiedClaimingStatus['offers'][number]
const props = defineProps<{ eventId: string, eventName: string, offers: Offer[], locked: boolean }>()
const emit = defineEmits<{ updated: [] }>()
const apiFetch = useApiClient()
const toast = useToast()
const expandedId = shallowRef<string | null>(null)
const creating = shallowRef(false)
const pending = shallowRef(false)
const error = shallowRef('')
async function perform(action: () => Promise<void>) {
  pending.value = true
  error.value = ''
  try {
    await action()
    emit('updated')
    toast.add({ title: 'Giveaways updated', color: 'success' })
  } catch (caught) {
    error.value = normalizeApiError(caught).message
  } finally {
    pending.value = false
  }
}
async function save(value: { name: string, description: string, file: File | null }, offer?: Offer) {
  await perform(async () => {
    if (offer) await apiFetch(`/api/events/${props.eventId}/simplified-claiming/rewards/${offer.id}`, {
      method: 'PATCH', body: { name: value.name, description: value.description, redirectOnClaim: offer.redirectOnClaim }
    })
    if (value.file) {
      const body = new FormData()
      body.append('file', value.file)
      if (offer) body.append('creditId', offer.id)
      else {
        body.append('name', value.name)
        body.append('description', value.description)
      }
      await apiFetch(`/api/events/${props.eventId}/simplified-claiming/rewards/import`, { method: 'POST', body })
    }
    creating.value = false
    expandedId.value = null
  })
}
async function selectRedirect(offer: Offer) {
  await perform(async () => {
    await apiFetch(`/api/events/${props.eventId}/simplified-claiming/rewards/${offer.id}`, {
      method: 'PATCH', body: { name: offer.name, description: offer.description, redirectOnClaim: true }
    })
  })
}
async function deleteOffer(offer: Offer) {
  if (!window.confirm(`Delete ${offer.name} and its unclaimed credits?`)) return
  await perform(async () => {
    await apiFetch(`/api/events/${props.eventId}/credits/${offer.id}`, { method: 'DELETE' })
  })
}
</script>

<template>
  <AccountEventSimplifiedClaimingStep
    :number="2"
    title="Giveaways"
    data-testid="simplified-giveaways"
  >
    <template #status>
      <SimplifiedGiveawayEmailPreview
        :offers="offers"
        :event-name="eventName"
      />
    </template>
    <p class="text-sm text-muted">
      All available giveaways are emailed. Choose one link giveaway to open after claiming.
    </p>
    <div class="divide-y divide-black/10 dark:divide-white/10">
      <div
        v-for="offer in offers"
        :key="offer.id"
        class="py-4"
      >
        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left"
            :aria-expanded="expandedId === offer.id"
            @click="expandedId = expandedId === offer.id ? null : offer.id"
          >
            <AppIcon
              :name="expandedId === offer.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              class="size-4 shrink-0"
            />
            <span><span class="block text-sm font-medium">{{ offer.name }}</span><span class="text-xs text-muted">{{ offer.linkCount }} {{ offer.linkCount === 1 ? 'link' : 'links' }} · {{ offer.codeCount }} {{ offer.codeCount === 1 ? 'code' : 'codes' }} · {{ offer.availableCount }} available</span></span>
          </button>
          <label
            v-if="offer.linkCount > 0 && offer.codeCount === 0"
            class="flex items-center gap-2 text-xs"
          >
            <input
              type="radio"
              :name="`giveaway-redirect-${eventId}`"
              :checked="offer.redirectOnClaim"
              :disabled="pending || locked"
              :aria-label="`Open ${offer.name} after claiming`"
              @change="selectRedirect(offer)"
            >
            Open after claiming
          </label>
          <AppButton
            v-if="offer.claimedCount === 0 && !(locked && offer.redirectOnClaim)"
            type="button"
            color="error"
            variant="ghost"
            size="sm"
            icon="i-lucide-trash-2"
            :aria-label="`Delete ${offer.name}`"
            :disabled="pending"
            @click="deleteOffer(offer)"
          />
        </div>
        <SimplifiedGiveawayEditor
          v-if="expandedId === offer.id"
          :key="offer.id"
          :name="offer.name"
          :description="offer.description"
          :pending="pending"
          @save="save($event, offer)"
        />
      </div>
    </div>
    <SimplifiedGiveawayEditor
      v-if="creating"
      name=""
      description=""
      creating
      :pending="pending"
      @save="save"
    />
    <AppButton
      type="button"
      color="neutral"
      variant="outline"
      :disabled="pending || (!creating && offers.length >= 20)"
      @click="creating = !creating"
    >
      {{ creating ? 'Cancel' : 'Add giveaway' }}
    </AppButton>
    <AppAlert
      v-if="error"
      color="error"
      title="Giveaway could not be updated"
      :description="error"
    />
  </AccountEventSimplifiedClaimingStep>
</template>
