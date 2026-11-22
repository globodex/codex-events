<script setup lang="ts">
import { useElementSize } from '@vueuse/core'

import type { EventFloorPlan } from '#shared/domains/events/program'

import { roomAreaStyle, routeArrows } from '~/domains/events/program-map'

const props = defineProps<{
  plan: EventFloorPlan
  floors?: readonly Pick<EventFloorPlan, 'id' | 'name'>[]
  selectedRoom: EventFloorPlan['rooms'][number] | null
}>()

const emit = defineEmits<{
  selectFloor: [floorId: string]
  selectRoom: [roomId: string]
}>()

const map = useTemplateRef<HTMLElement>('map')
const { width, height } = useElementSize(map)
// Width divided by height of the plan image, known once the image has loaded.
const imageRatio = shallowRef<number>()

function setImageRatio(event: Event) {
  const image = event.target as HTMLImageElement
  imageRatio.value = image.naturalWidth / image.naturalHeight
}

// The route in screen pixels, so the line and its arrows keep the same size at every map width.
const route = computed(() => (props.selectedRoom?.route ?? []).map(point => ({
  x: point.x * width.value,
  y: point.y * height.value
})))
const routeLine = computed(() => route.value.map(point => `${point.x},${point.y}`).join(' '))
const arrows = computed(() => routeArrows(route.value, 28))

const pinStyle = computed(() => {
  const area = props.selectedRoom?.area
  return area && {
    left: `${(area.x + area.width / 2) * 100}%`,
    top: `${(area.y + area.height / 2) * 100}%`
  }
})

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
    <figcaption class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-default px-3 py-2">
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
        class="flex items-center gap-1.5 text-sm font-medium text-highlighted"
      >
        <AppIcon
          v-if="props.selectedRoom"
          name="i-lucide-map-pin"
          class="text-rose-600"
          aria-hidden="true"
        />
        {{ props.selectedRoom?.name }}
      </p>
    </figcaption>

    <!-- On larger screens a tall plan gets narrower, so the whole plan fits on the screen below the page header. -->
    <div
      ref="map"
      class="relative mx-auto w-full bg-white lg:max-w-[calc((100dvh_-_10rem)_*_var(--plan-ratio))]"
      :style="{ '--plan-ratio': imageRatio }"
    >
      <img
        :src="props.plan.imageUrl"
        :alt="`Floor plan for ${props.plan.name}`"
        class="block h-auto w-full"
        @load="setImageRatio"
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
          hover:bg-sky-400/20 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-sky-900
          aria-pressed:z-10 aria-pressed:border-sky-600 aria-pressed:bg-sky-400/30"
        @click="emit('selectRoom', room.id)"
      />

      <svg
        v-if="routeLine"
        class="pointer-events-none absolute inset-0 z-20 size-full"
        :viewBox="`0 0 ${width} ${height}`"
        role="img"
        :aria-label="`Route to ${props.selectedRoom?.name}`"
        data-testid="program-room-route"
      >
        <polyline
          :points="routeLine"
          class="fill-none stroke-white"
          stroke-width="10"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <polyline
          :points="routeLine"
          class="fill-none stroke-sky-600"
          stroke-width="6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <polyline
          v-for="(arrow, index) in arrows"
          :key="index"
          points="-3,-4 1,0 -3,4"
          :transform="`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`"
          :style="{ animationDelay: `${index * 0.12}s` }"
          class="route-arrow fill-none stroke-white"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle
          :cx="route[0]!.x"
          :cy="route[0]!.y"
          r="7"
          class="fill-white stroke-sky-600"
          stroke-width="4"
        />
      </svg>

      <span
        v-if="pinStyle"
        class="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full"
        :style="pinStyle"
      >
        <svg
          :key="props.selectedRoom?.id"
          viewBox="0 0 24 32"
          class="h-8 w-6 drop-shadow-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-3"
          aria-hidden="true"
        >
          <path
            d="M12 31S2 19.5 2 12a10 10 0 1 1 20 0c0 7.5-10 19-10 19Z"
            class="fill-rose-600 stroke-white"
            stroke-width="2"
          />
          <circle
            cx="12"
            cy="12"
            r="4"
            class="fill-white"
          />
        </svg>
      </span>
    </div>
  </figure>
</template>

<style scoped>
/* The arrows light up one after another, from the start of the route to the room. */
.route-arrow {
  animation: route-arrow 1.6s ease-in-out infinite;
}

@keyframes route-arrow {
  0%,
  100% {
    opacity: 0.35;
  }

  30% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .route-arrow {
    animation: none;
  }
}
</style>
