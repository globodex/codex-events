<script setup lang="ts">
// One open track or challenge on the Overview tab: the title, "Show more" for the instructions
// and links, and the button that makes it the participant's choice.
import type { EventChallenge } from '#shared/domains/events/challenges'

import EventStaffInstructions from '~/components/events/molecules/EventStaffInstructions.vue'
import EventTrackDetails from '~/components/events/molecules/EventTrackDetails.vue'

const props = defineProps<{
  challenge: EventChallenge
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

// The links of the challenge in the shape of the shared details block, in the saved order.
const detailResources = computed(() => props.challenge.resources.map((resource, index) => ({
  title: resource.label,
  url: resource.url,
  description: null,
  displayOrder: index
})))
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

    <EventTrackDetails
      v-if="expanded"
      :description="challenge.instructions"
      :resources="detailResources"
    >
      <!-- Only the event team receives staff instructions. -->
      <EventStaffInstructions
        v-if="challenge.staffInstructions?.trim()"
        :source="challenge.staffInstructions"
      />
    </EventTrackDetails>

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
