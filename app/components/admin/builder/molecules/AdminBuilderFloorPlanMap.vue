<script setup lang="ts">
import type { EventFloorPlan, ProgramRoom } from '#shared/domains/events/program'

import { roomAreaStyle } from '~/domains/events/program-map'

const props = defineProps<{
  imageUrl: string
  name: string
  rooms: EventFloorPlan['rooms']
  activeRoomId: string | null
  marking: boolean
}>()

const emit = defineEmits<{
  marked: [area: ProgramRoom['area']]
}>()

type Point = Pick<ProgramRoom['area'], 'x' | 'y'>

interface RoomDrag {
  pointerId: number
  bounds: DOMRect
  start: Point
  end: Point
}

const drag = shallowRef<RoomDrag | null>(null)
const preview = computed(() => drag.value && areaBetween(drag.value.start, drag.value.end))

watch([() => props.marking, () => props.activeRoomId], () => {
  drag.value = null
})

function pointOnPlan(event: PointerEvent, bounds: DOMRect): Point {
  return {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
  }
}

function areaBetween(start: Point, end: Point): ProgramRoom['area'] {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x),
    height: Math.abs(start.y - end.y)
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
</script>

<template>
  <div
    class="relative ring-1 ring-black/10 dark:ring-white/15"
    :class="{ 'touch-none cursor-crosshair': props.marking }"
    data-testid="admin-floor-plan-map"
    @pointerdown="startMark"
    @pointermove="updateMark"
    @pointerup="finishMark"
    @pointercancel="cancelMark"
    @lostpointercapture="cancelMark"
  >
    <img
      :src="props.imageUrl"
      :alt="`Floor plan for ${props.name}`"
      loading="lazy"
      draggable="false"
      class="block h-auto w-full select-none"
    >
    <span
      v-for="room in props.rooms"
      :key="room.id"
      :style="roomAreaStyle(room.area)"
      aria-hidden="true"
      class="pointer-events-none absolute border-sky-700 ring-white"
      :class="room.id === props.activeRoomId
        ? 'z-10 border-2 bg-sky-300/35 ring-2'
        : 'border bg-sky-300/10 ring-1'"
    />
    <span
      v-if="preview"
      :style="roomAreaStyle(preview)"
      aria-hidden="true"
      class="pointer-events-none absolute z-20 border-2 border-dashed border-sky-700 bg-sky-300/40"
    />
  </div>
</template>
