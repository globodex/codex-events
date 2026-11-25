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
const image = useTemplateRef<HTMLImageElement>('image')
const { height: imageHeight } = useElementSize(image)
// Width divided by height of the plan image. Until it is known, the map keeps the size of a plan
// with the placeholder shape and shows no rooms, because rooms are placed by fractions of the image.
const imageRatio = shallowRef<number>()
const placeholderRatio = 3 / 4

// The browser knows the size of the image from its first bytes, long before the image has loaded,
// and the image then gets its height. Reading the size at that moment gives the map its final size
// early. The load event covers a new floor, whose image replaces the old one only once it has loaded.
function readImageRatio() {
  if (image.value?.naturalWidth) {
    imageRatio.value = image.value.naturalWidth / image.value.naturalHeight
  }
}

watch(imageHeight, readImageRatio)

// Another floor shows another image, so its rooms wait for that image too.
watch(() => props.plan.imageUrl, () => {
  imageRatio.value = undefined
})

const visibleRooms = computed(() => imageRatio.value ? props.plan.rooms : [])
const selectedRoomIds = computed(() => new Set(props.selectedRooms.map(room => room.id)))
// The ways to a room are shown while that room alone is selected.
const routeRoom = computed(() => props.selectedRooms.length === 1 ? props.selectedRooms[0] : undefined)
// Each route in screen pixels, so the lines and their arrows keep the same size at every map width.
const routes = computed(() => (routeRoom.value?.routes ?? []).map((route) => {
  const points = route.map(point => ({ x: point.x * width.value, y: point.y * height.value }))
  return {
    start: points[0]!,
    line: points.map(point => `${point.x},${point.y}`).join(' '),
    arrows: routeArrows(points, 28)
  }
}))

function selectFloor(value: string | number | undefined) {
  if (typeof value === 'string') {
    emit('selectFloor', value)
  }
}
</script>

<template>
  <!-- On larger screens a tall plan gets a narrower card, so the whole plan fits on the screen below the page header.
       The plan image has a transparent background, so the card has its own surface instead of the event picture behind it. -->
  <figure
    class="flex min-w-0 flex-col overflow-hidden rounded-xl border border-default bg-accented
      lg:max-w-[calc((100dvh_-_10rem)_*_var(--plan-ratio))]"
    :style="{ '--plan-ratio': imageRatio ?? placeholderRatio }"
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
      :class="{ 'aspect-(--plan-ratio) animate-pulse bg-black/5 motion-reduce:animate-none dark:bg-white/5': !imageRatio }"
    >
      <!-- The dark theme swaps light and dark in the plan image and keeps its colors. -->
      <img
        ref="image"
        :src="props.plan.imageUrl"
        :alt="`Floor plan for ${props.plan.name}`"
        class="block h-auto w-full dark:invert dark:hue-rotate-180"
        @load="readImageRatio"
      >
      <!-- The routes are drawn below the rooms, so their names stay readable. -->
      <svg
        v-if="imageRatio && routes.length"
        class="pointer-events-none absolute inset-0 size-full"
        :viewBox="`0 0 ${width} ${height}`"
        role="img"
        :aria-label="`${routes.length > 1 ? 'Routes' : 'Route'} to ${routeRoom?.name}`"
      >
        <g
          v-for="(route, routeIndex) in routes"
          :key="routeIndex"
          data-testid="program-room-route"
        >
          <polyline
            :points="route.line"
            class="fill-none stroke-bg"
            stroke-width="10"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <polyline
            :points="route.line"
            class="fill-none stroke-primary"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <polyline
            v-for="(arrow, index) in route.arrows"
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
            :cx="route.start.x"
            :cy="route.start.y"
            r="7"
            class="fill-bg stroke-primary"
            stroke-width="4"
          />
        </g>
      </svg>

      <AppButton
        v-for="room in visibleRooms"
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

/* The arrows light up one after another, from the start of each route to the room. */
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
