<script setup lang="ts">
import type { EventFloorPlan } from '#shared/domains/events/program'

import { roomAreaStyle } from '~/domains/events/program-map'

const props = defineProps<{
  plan: EventFloorPlan
  floors?: readonly Pick<EventFloorPlan, 'id' | 'name'>[]
  selectedRoom: EventFloorPlan['rooms'][number] | null
}>()

const emit = defineEmits<{
  selectFloor: [floorId: string]
  selectRoom: [roomId: string]
}>()

function selectFloor(value: string | number | undefined) {
  if (typeof value === 'string') {
    emit('selectFloor', value)
  }
}
</script>

<template>
  <figure
    class="flex min-w-0 flex-col overflow-hidden rounded-xl border border-default"
    data-testid="program-floor-plan"
  >
    <figcaption class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-default px-3 py-2">
      <AppSelect
        v-if="props.floors && props.floors.length > 1"
        aria-label="Floor"
        size="sm"
        :model-value="props.plan.id"
        @update:model-value="selectFloor"
      >
        <option
          v-for="floor in props.floors"
          :key="floor.id"
          :value="floor.id"
        >
          {{ floor.name }}
        </option>
      </AppSelect>
      <h2
        v-else
        class="font-semibold text-highlighted"
      >
        {{ props.plan.name }}
      </h2>
      <p
        aria-live="polite"
        class="flex items-center gap-1.5 text-sm text-highlighted"
      >
        <AppIcon
          v-if="props.selectedRoom"
          name="i-lucide-map-pin"
          aria-hidden="true"
        />
        {{ props.selectedRoom?.name }}
      </p>
    </figcaption>

    <div class="flex flex-1 items-center bg-elevated">
      <div class="relative w-full">
        <img
          :src="props.plan.imageUrl"
          :alt="`Floor plan for ${props.plan.name}`"
          class="block h-auto w-full"
        >
        <AppButton
          v-for="room in props.plan.rooms"
          :key="room.id"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="room.name"
          :aria-pressed="room.id === props.selectedRoom?.id"
          :title="room.name"
          :data-testid="room.id === props.selectedRoom?.id ? 'program-room-highlight' : undefined"
          :style="roomAreaStyle(room.area)"
          class="absolute rounded-none border-2 border-transparent bg-transparent p-0
            hover:bg-sky-300/20 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-sky-900
            aria-pressed:z-10 aria-pressed:border-sky-700 aria-pressed:bg-sky-300/25"
          @click="emit('selectRoom', room.id)"
        />
      </div>
    </div>
  </figure>
</template>
