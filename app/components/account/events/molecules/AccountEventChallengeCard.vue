<script setup lang="ts">
import type { AgendaChallenge, ProgramRoom } from '#shared/domains/events/program'

import AppButton from '~/components/AppButton.vue'
import AccountEventDetailsDialog from '~/components/account/events/molecules/AccountEventDetailsDialog.vue'
import EventStaffInstructions from '~/components/events/molecules/EventStaffInstructions.vue'
import EventTrackDetails from '~/components/events/molecules/EventTrackDetails.vue'
import { roomLabel } from '~/domains/events/program-map'

// One challenge on the Agenda tab. The card looks like an agenda session: the title, the staff
// members and the rooms of the challenge, and a Details button for its instructions and links.
const props = defineProps<{
  challenge: AgendaChallenge
  /** The rooms that name this challenge on the event's floor plans. */
  rooms: ProgramRoom[]
  /** True while the map shows the rooms of this challenge. */
  selected: boolean
}>()

const emit = defineEmits<{
  /** Only a challenge with a room can be selected. */
  select: [challengeId: string]
}>()

// A challenge with rooms is a button: selecting it shows its rooms on the map.
// A challenge without a room has nothing to show on the map, so it is plain text.
const summaryElement = computed(() => props.rooms.length ? AppButton : 'div')
const summaryAttributes = computed(() => props.rooms.length
  ? {
      'color': 'neutral',
      'variant': 'ghost',
      'class': 'h-auto w-full min-w-0 flex-col items-start justify-start gap-1 whitespace-normal rounded-xl px-3 py-2.5 text-left hover:bg-primary/5 focus-visible:ring-inset',
      'aria-pressed': props.selected,
      'onClick': () => emit('select', props.challenge.id)
    }
  : { class: 'flex min-w-0 flex-col items-start gap-1 px-3 py-2.5 font-medium' })

// The resources of the challenge in the shape of the shared details block, in the saved order.
const detailResources = computed(() => props.challenge.resources.map((resource, index) => ({
  title: resource.label,
  url: resource.url,
  description: null,
  displayOrder: index
})))
</script>

<template>
  <div
    class="relative flex min-w-0 flex-col rounded-xl border transition-colors"
    :class="selected ? 'border-primary bg-primary/5' : 'border-default bg-default'"
  >
    <component
      :is="summaryElement"
      v-bind="summaryAttributes"
      :data-testid="`program-challenge-${challenge.id}`"
    >
      <span class="break-words text-sm font-semibold leading-snug text-highlighted">{{ challenge.title }}</span>
      <span
        v-if="challenge.staffNames.length > 0"
        class="break-words text-xs leading-tight text-toned"
        data-testid="program-challenge-staff"
      >
        Staff: {{ challenge.staffNames.join(', ') }}
      </span>
      <!--
        The rooms by their names, like on a session. The Details button sits in the bottom right
        corner of the card: the last room is as high as the button and keeps its right end free,
        and a card without rooms keeps that height free.
      -->
      <span class="flex min-h-6 w-full min-w-0 flex-col justify-end gap-0.5 text-xs leading-tight text-toned">
        <span
          v-for="(room, index) in rooms"
          :key="room.id"
          class="flex min-w-0 items-center gap-1"
          :class="{ 'min-h-6 pr-16': index === rooms.length - 1 }"
        >
          <AppIcon
            name="i-lucide-map-pin"
            class="size-3 shrink-0"
          />
          <span class="truncate">{{ room.name }}</span>
        </span>
      </span>
    </component>

    <AccountEventDetailsDialog
      :title="challenge.title"
      :summary="rooms.map(roomLabel).join(', ')"
    >
      <EventTrackDetails
        :description="challenge.instructions"
        :resources="detailResources"
        :separated="false"
      >
        <!-- Only the event team receives staff instructions. -->
        <EventStaffInstructions
          v-if="challenge.staffInstructions?.trim()"
          :source="challenge.staffInstructions"
        />
      </EventTrackDetails>
    </AccountEventDetailsDialog>
  </div>
</template>
