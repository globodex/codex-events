<script setup lang="ts">
import type { EventFloorPlan } from '#shared/domains/events/program'

import { roomAreaStyle } from '~/domains/events/program-map'

const props = defineProps<{
  plan: EventFloorPlan
  selectedRoom: EventFloorPlan['rooms'][number] | null
}>()
</script>

<template>
  <figure
    class="space-y-3"
    data-testid="program-floor-plan"
  >
    <figcaption class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 class="font-semibold text-highlighted">
        {{ props.plan.name }}
      </h2>
      <p
        aria-live="polite"
        class="flex items-center gap-1.5 text-sm text-highlighted"
      >
        <template v-if="props.selectedRoom">
          <AppIcon
            name="i-lucide-map-pin"
            aria-hidden="true"
          />
          {{ props.selectedRoom.name }}
        </template>
      </p>
    </figcaption>

    <div class="relative ring-1 ring-black/10 dark:ring-white/15">
      <img
        :src="props.plan.imageUrl"
        :alt="`Floor plan for ${props.plan.name}`"
        class="block h-auto w-full"
      >
      <span
        v-if="props.selectedRoom"
        aria-hidden="true"
        class="pointer-events-none absolute border-2 border-sky-700 bg-sky-300/35 ring-2 ring-white"
        data-testid="program-room-highlight"
        :style="roomAreaStyle(props.selectedRoom.area)"
      />
    </div>
  </figure>
</template>
