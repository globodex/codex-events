<script setup lang="ts">
import AppButton from '~/components/AppButton.vue'
import type { PublicEventAgendaItem } from '~/domains/events/presentation'

// A public agenda item before or after the program on the Agenda tab, for example the check-in.
// Like a session, an item with a room is a button: selecting it shows the room on the map.
const props = defineProps<{
  item: PublicEventAgendaItem
  /** The start and end time. Only an item that ends later than it starts has one. */
  timeRange: string | null
  roomName?: string
  selected: boolean
}>()

const emit = defineEmits<{
  /** Only an item with a room can be selected. */
  select: [agendaItemId: string]
}>()

const summaryElement = computed(() => props.roomName ? AppButton : 'div')
const summaryAttributes = computed(() => props.roomName
  ? {
      'color': 'neutral',
      'variant': 'ghost',
      'class': 'h-auto w-full min-w-0 flex-col items-start justify-start gap-1 whitespace-normal rounded-xl px-3 py-2.5 text-left font-normal hover:bg-primary/5 focus-visible:ring-inset',
      'aria-pressed': props.selected,
      'onClick': () => emit('select', props.item.id)
    }
  : { class: 'flex min-w-0 flex-col items-start gap-1 px-3 py-2.5' })
</script>

<template>
  <div
    class="flex min-w-0 flex-col rounded-xl border transition-colors"
    :class="selected ? 'border-primary bg-primary/5' : 'border-default bg-default'"
  >
    <component
      :is="summaryElement"
      v-bind="summaryAttributes"
      :id="`program-agenda-item-${encodeURIComponent(item.id)}`"
      :data-testid="`program-agenda-item-${item.id}`"
    >
      <span class="break-words text-sm font-semibold leading-snug text-highlighted">{{ item.title }}</span>
      <span
        v-if="timeRange || roomName"
        class="flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-tight text-muted"
      >
        <span
          v-if="timeRange"
          class="tabular-nums"
        >{{ timeRange }}</span>
        <span
          v-if="roomName"
          class="flex min-w-0 items-center gap-1 text-toned"
        >
          <AppIcon
            name="i-lucide-map-pin"
            class="size-3"
          />
          <span class="truncate">{{ roomName }}</span>
        </span>
      </span>
    </component>
    <!-- The details stay outside the button, so the button keeps a short name. -->
    <p
      v-if="item.details"
      class="-mt-1 whitespace-pre-line break-words px-3 pb-2.5 text-xs text-muted"
    >
      {{ item.details }}
    </p>
  </div>
</template>
