<script setup lang="ts">
import type { EventFloorPlan, ProgramRoom } from '#shared/domains/events/program'

import { roomAreaStyle } from '~/domains/events/program-map'

type Point = Pick<ProgramRoom['area'], 'x' | 'y'>

const props = defineProps<{
  imageUrl: string
  name: string
  rooms: EventFloorPlan['rooms']
  activeRoomId: string | null
  marking: boolean
  /** The route of the active room, drawn over the plan. */
  route: Point[]
  /** While true, each click on the plan adds a point to the route. */
  drawing: boolean
}>()

const emit = defineEmits<{
  marked: [area: ProgramRoom['area']]
  routePoint: [point: Point]
}>()

interface RoomDrag {
  pointerId: number
  bounds: DOMRect
  start: Point
  end: Point
}

const drag = shallowRef<RoomDrag | null>(null)
const preview = computed(() => drag.value && areaBetween(drag.value.start, drag.value.end))
const routeLine = computed(() => props.route.map(point => `${point.x},${point.y}`).join(' '))

watch([() => props.marking, () => props.activeRoomId], () => {
  drag.value = null
})

function pointOnPlan(event: MouseEvent, bounds: DOMRect): Point {
  return {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
  }
}

// A newly marked area is upright. The admin turns it with the rotation field.
function areaBetween(start: Point, end: Point): ProgramRoom['area'] {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x),
    height: Math.abs(start.y - end.y),
    rotation: 0
  }
}

function startMark(event: PointerEvent) {
  if (!props.marking || event.button !== 0 || drag.value) return

  const plan = event.currentTarget as HTMLElement
  const bounds = plan.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return

  const start = pointOnPlan(event, bounds)
  plan.setPointerCapture(event.pointerId)
  drag.value = { pointerId: event.pointerId, bounds, start, end: start }
}

function updateMark(event: PointerEvent) {
  if (drag.value?.pointerId === event.pointerId) {
    drag.value = { ...drag.value, end: pointOnPlan(event, drag.value.bounds) }
  }
}

function finishMark(event: PointerEvent) {
  const current = drag.value
  if (current?.pointerId !== event.pointerId) return

  drag.value = null
  const area = areaBetween(current.start, pointOnPlan(event, current.bounds))
  const minimumSidePixels = 4
  if (area.width * current.bounds.width >= minimumSidePixels
    && area.height * current.bounds.height >= minimumSidePixels) {
    emit('marked', area)
  }
}

function cancelMark(event: PointerEvent) {
  if (drag.value?.pointerId === event.pointerId) {
    drag.value = null
  }
}

function addRoutePoint(event: MouseEvent) {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (props.drawing && bounds.width && bounds.height) {
    emit('routePoint', pointOnPlan(event, bounds))
  }
}
</script>

<template>
  <div
    class="relative ring-1 ring-black/10 dark:ring-white/15"
    :class="{ 'touch-none': props.marking, 'cursor-crosshair': props.marking || props.drawing }"
    data-testid="admin-floor-plan-map"
    @click="addRoutePoint"
    @pointerdown="startMark"
    @pointermove="updateMark"
    @pointerup="finishMark"
    @pointercancel="cancelMark"
    @lostpointercapture="cancelMark"
  >
    <!-- The dark theme swaps light and dark in the plan image, as on the participant map. -->
    <img
      :src="props.imageUrl"
      :alt="`Floor plan for ${props.name}`"
      loading="lazy"
      draggable="false"
      class="block h-auto w-full select-none dark:invert dark:hue-rotate-180"
    >
    <span
      v-for="room in props.rooms"
      :key="room.id"
      :style="roomAreaStyle(room.area)"
      aria-hidden="true"
      class="pointer-events-none absolute border-primary"
      :class="room.id === props.activeRoomId
        ? 'z-10 border-2 bg-primary/25'
        : 'border bg-primary/5'"
    />
    <svg
      v-if="routeLine"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      class="pointer-events-none absolute inset-0 z-20 size-full"
      aria-hidden="true"
    >
      <polyline
        :points="routeLine"
        class="fill-none stroke-primary"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <span
      v-for="(point, index) in props.route"
      :key="index"
      :style="{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }"
      aria-hidden="true"
      class="pointer-events-none absolute z-20 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg"
      :class="index === 0 ? 'bg-success' : 'bg-primary'"
    />
    <span
      v-if="preview"
      :style="roomAreaStyle(preview)"
      aria-hidden="true"
      class="pointer-events-none absolute z-20 border-2 border-dashed border-primary bg-primary/25"
    />
  </div>
</template>
