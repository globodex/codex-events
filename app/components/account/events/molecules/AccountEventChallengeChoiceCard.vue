<script setup lang="ts">
// One open track or challenge on the Overview tab: the title, "Show more" for its slides,
// materials and links, and the button that makes it the participant's choice.
import type { AccountEventEntryChallenge } from '#shared/domains/events/account-event-entry-page'
import { deckApiPath } from '#shared/domains/events/decks'

import AccountEventDeckContent from '~/components/account/events/molecules/AccountEventDeckContent.vue'
import EventStaffInstructions from '~/components/events/molecules/EventStaffInstructions.vue'

defineProps<{
  /** The event of the challenge, where its PDFs open. */
  eventId: string
  challenge: AccountEventEntryChallenge
  /** True when this is the participant's choice. */
  chosen: boolean
  /** False for a person who does not choose, for example event staff. */
  canChoose: boolean
  /** True while the choice on this card is being saved. */
  pending: boolean
  /** True while another card saves a choice. */
  disabled: boolean
}>()

const emit = defineEmits<{
  choose: []
  clear: []
}>()

const expanded = ref(false)
</script>

<template>
  <article
    class="flex h-full min-w-0 flex-col rounded-xl border p-4 transition-colors"
    :class="chosen ? 'border-primary bg-primary/5' : 'border-default bg-default'"
    :data-testid="`overview-challenge-${challenge.id}`"
  >
    <div class="flex items-start justify-between gap-3">
      <h3 class="min-w-0 break-words font-semibold leading-snug text-highlighted">
        {{ challenge.title }}
      </h3>
      <AppBadge
        v-if="chosen"
        color="primary"
        variant="soft"
        class="shrink-0"
      >
        Your choice
      </AppBadge>
    </div>

    <div
      v-if="expanded"
      class="mt-5 space-y-5 border-t border-black/8 pt-5 dark:border-white/[0.08]"
    >
      <AccountEventDeckContent
        :deck="challenge.deck"
        :api-path="deckApiPath(eventId, 'challenge', challenge.id)"
      />
      <!-- Only the event team receives staff instructions. -->
      <EventStaffInstructions
        v-if="challenge.staffInstructions?.trim()"
        :source="challenge.staffInstructions"
      />
    </div>

    <div class="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
      <AppButton
        color="neutral"
        variant="ghost"
        size="sm"
        :trailing-icon="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Show less' : 'Show more' }}
      </AppButton>
      <template v-if="canChoose">
        <AppButton
          v-if="chosen"
          color="neutral"
          variant="ghost"
          size="sm"
          :loading="pending"
          :disabled="disabled"
          @click="emit('clear')"
        >
          Clear choice
        </AppButton>
        <AppButton
          v-else
          color="primary"
          variant="outline"
          size="sm"
          :loading="pending"
          :disabled="disabled"
          @click="emit('choose')"
        >
          Choose
        </AppButton>
      </template>
    </div>
  </article>
</template>
