<script setup lang="ts">
import { useElementSize } from '@vueuse/core'

import type { EventFloorPlan } from '#shared/domains/events/program'

import { roomAreaStyle, roomLabel, routeArrows } from '~/domains/events/program-map'

const props = defineProps<{
  plan: EventFloorPlan
  floors?: readonly Pick<EventFloorPlan, 'id' | 'name'>[]
  /** The rooms of this plan that the map highlights. A challenge can have several rooms. */
  selectedRooms: EventFloorPlan['rooms']
  /** Shown in place of the room names while no room is selected. */
  roomHint?: string
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

const selectedRoomIds = computed(() => new Set(props.selectedRooms.map(room => room.id)))
// The way to a room is shown while that room alone is selected.
const routeRoom = computed(() => props.selectedRooms.length === 1 ? props.selectedRooms[0] : undefined)
// The route in screen pixels, so the line and its arrows keep the same size at every map width.
const route = computed(() => (routeRoom.value?.route ?? []).map(point => ({
  x: point.x * width.value,
  y: point.y * height.value
})))
const routeLine = computed(() => route.value.map(point => `${point.x},${point.y}`).join(' '))
const arrows = computed(() => routeArrows(route.value, 28))

function selectFloor(value: string | number | undefined) {
  if (typeof value === 'string') {
    emit('selectFloor', value)
  }
}
</script>

<template>
  <!-- On larger screens a tall plan gets a narrower card, so the whole plan fits on the screen below the page header. -->
  <figure
    class="flex min-w-0 flex-col overflow-hidden rounded-xl border border-default
      lg:max-w-[calc((100dvh_-_10rem)_*_var(--plan-ratio))]"
    :style="{ '--plan-ratio': imageRatio }"
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
        class="text-sm"
        :class="props.selectedRooms.length ? 'font-medium text-highlighted' : 'text-muted'"
      >
        {{ props.selectedRooms.length ? props.selectedRooms.map(roomLabel).join(', ') : props.roomHint }}
      </p>
    </figcaption>

    <div
      ref="map"
      class="@container relative"
    >
      <!-- The dark theme swaps light and dark in the plan image and keeps its colors. -->
      <img
        :src="props.plan.imageUrl"
        :alt="`Floor plan for ${props.plan.name}`"
        class="block h-auto w-full dark:invert dark:hue-rotate-180"
        @load="setImageRatio"
      >
      <!-- The route is drawn below the rooms, so their names stay readable. -->
      <svg
        v-if="routeLine"
        class="pointer-events-none absolute inset-0 size-full"
        :viewBox="`0 0 ${width} ${height}`"
        role="img"
        :aria-label="`Route to ${routeRoom?.name}`"
        data-testid="program-room-route"
      >
        <polyline
          :points="routeLine"
          class="fill-none stroke-bg"
          stroke-width="10"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <polyline
          :points="routeLine"
          class="fill-none stroke-primary"
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
          class="route-arrow fill-none stroke-primary-foreground"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle
          :cx="route[0]!.x"
          :cy="route[0]!.y"
          r="7"
          class="fill-bg stroke-primary"
          stroke-width="4"
        />
      </svg>

      <AppButton
        v-for="room in props.plan.rooms"
        :key="room.id"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-pressed="selectedRoomIds.has(room.id)"
        :data-testid="selectedRoomIds.has(room.id) ? 'program-room-highlight' : undefined"
        :style="roomAreaStyle(room.area)"
        class="group absolute rounded-none bg-transparent p-0 hover:bg-primary/10
          focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-primary
          aria-pressed:z-10 aria-pressed:bg-primary aria-pressed:hover:bg-primary"
        @click="emit('selectRoom', room.id)"
      >
        <!-- The name stays level when the room area is turned. The venue's room number stands under it. -->
        <span
          :style="{ rotate: `${-room.area.rotation}deg` }"
          class="room-name flex flex-col items-center rounded px-1 py-0.5 text-[0.625rem] leading-none text-highlighted
            group-aria-pressed:bg-primary group-aria-pressed:text-primary-foreground @md:text-xs"
        >
          {{ room.name }}
          <span
            v-if="room.number"
            class="mt-0.5 text-[0.5625rem] font-normal opacity-80 @md:text-[0.625rem]"
          >{{ room.number }}</span>
        </span>
      </AppButton>
    </div>
  </figure>
</template>

<style scoped>
/* An edge in the page color keeps a room name readable where it crosses a wall or the route. */
.room-name {
  text-shadow:
    0 0 2px var(--surface-bg),
    0 0 2px var(--surface-bg),
    0 0 3px var(--surface-bg),
    0 0 3px var(--surface-bg),
    0 0 4px var(--surface-bg);
}

/* The selected room has its own background, so its name needs no edge. */
[aria-pressed='true'] > .room-name {
  text-shadow: none;
}

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
