<script setup lang="ts">
// One open step of the current level, for example "Set the event start". A click takes the
// organizer to the field of the step.
import type { EventBuilderChecklistItem } from '~/domains/events/builder'

const props = defineProps<{
  item: EventBuilderChecklistItem
  /** True after the organizer tried to save: the step then stands out. */
  urgent: boolean
}>()

const emit = defineEmits<{
  focusField: [item: EventBuilderChecklistItem]
}>()
</script>

<template>
  <li>
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      :class="urgent
        ? 'border-amber-500/50 bg-amber-500/12 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300'
        : 'border-black/10 text-muted hover:border-black/25 hover:text-highlighted dark:border-white/[0.12] dark:hover:border-white/[0.3]'"
      :data-testid="`event-builder-step-${item.id}`"
      @click="emit('focusField', props.item)"
    >
      <AppIcon
        name="i-lucide-circle-dashed"
        class="size-3.5 shrink-0"
      />
      {{ item.label }}
    </button>
  </li>
</template>
