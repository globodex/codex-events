<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'

import type { EventFloorPlan, ParticipantEventProgram, ProgramSession, ProgramTrack } from '#shared/domains/events/program'

import AccountEventProgramAgendaItem from '~/components/account/events/molecules/AccountEventProgramAgendaItem.vue'
import AccountEventProgramSession from '~/components/account/events/molecules/AccountEventProgramSession.vue'
import { formatEventTime, getAgendaItemPresentation, type PublicEventAgendaItem } from '~/domains/events/presentation'
import { formatMinutes, getSessionPhase, type SessionPhase } from '~/domains/events/program-timeline'

const props = defineProps<{
  tracks: ProgramTrack[]
  floorPlans: EventFloorPlan[]
  /** Public agenda blocks before and after the program, for example "Networking starts". */
  outsideItems: PublicEventAgendaItem[]
  /** The rooms of the blocks before and after the program, for example the check-in. */
  agendaItemRooms: ParticipantEventProgram['agendaItemRooms']
  startsAt: string
  endsAt: string
  selectedSessionId: string | null
  selectedAgendaItemId: string | null
  /** The current time in milliseconds. */
  now: number
}>()

defineEmits<{
  select: [session: ProgramSession]
  selectAgendaItem: [agendaItemId: string]
}>()

const timeline = useTemplateRef<HTMLElement>('timeline')
const timelineGrid = useTemplateRef<HTMLElement>('timelineGrid')
// The times stay in view while parallel tracks scroll sideways, and only then need a background
// that hides the sessions passing under them. Otherwise they sit on the page like the rest.
const scrollsSideways = shallowRef(false)

useResizeObserver([timeline, timelineGrid], () => {
  scrollsSideways.value = Boolean(timeline.value && timeline.value.scrollWidth > timeline.value.clientWidth)
})

const minuteMs = 60_000
const baseTime = computed(() => Date.parse(props.startsAt))
const programMinutes = computed(() => (Date.parse(props.endsAt) - baseTime.value) / minuteMs)

// Minutes since the program started, like the session times. Negative before the start.
const nowMinutes = computed(() => (props.now - baseTime.value) / minuteMs)
// "Now" and "Next" appear from one hour before the program starts until it ends.
const isLive = computed(() => nowMinutes.value >= -60 && nowMinutes.value < programMinutes.value)

function atOffset(minutes: number) {
  return new Date(baseTime.value + minutes * minuteMs).toISOString()
}

// Column 1 holds the times and column 2 the rail, so the first track is column 3.
const trackSessions = computed(() => props.tracks.flatMap((track, index) =>
  track.sessions.map(session => ({ session, column: index + 3 }))
).sort((left, right) => left.session.startsAfterMinutes - right.session.startsAfterMinutes || left.column - right.column))

// The public blocks outside the program, grouped by their start in minutes since the program started.
// Blocks that start at the same time share one group, in display order.
const outsideGroups = computed(() => {
  const groups = new Map<number, PublicEventAgendaItem[]>()
  const items = [...props.outsideItems].sort((left, right) => left.displayOrder - right.displayOrder)
  for (const item of items) {
    const offset = (Date.parse(item.startsAt) - baseTime.value) / minuteMs
    groups.set(offset, [...(groups.get(offset) ?? []), item])
  }
  return groups
})

const nextStart = computed(() => Math.min(...trackSessions.value
  .map(({ session }) => session.startsAfterMinutes)
  .filter(start => start > nowMinutes.value)))

// Every moment a session or an outside block starts, or a session ends. Each boundary opens one grid row.
const boundaries = computed(() => {
  const starts = new Set([
    ...trackSessions.value.map(({ session }) => session.startsAfterMinutes),
    ...outsideGroups.value.keys()
  ])
  const offsets = new Set(starts)
  for (const { session } of trackSessions.value) {
    offsets.add(session.startsAfterMinutes + session.durationMinutes)
  }
  offsets.add(0)
  offsets.add(programMinutes.value)

  const sortedOffsets = [...offsets].sort((left, right) => left - right)
  return sortedOffsets.map(offset => ({
    offset,
    hasSession: starts.has(offset),
    hasStarted: isLive.value && offset <= nowMinutes.value,
    label: starts.has(offset) || offset === 0 || offset === sortedOffsets.at(-1)
      ? formatEventTime(atOffset(offset))
      : null
  }))
})

const gridStyle = computed(() => {
  // Longer sessions get taller rows. A row grows when a session's title needs more lines.
  const rowSizes = boundaries.value.slice(0, -1).map(({ offset, hasSession }, index) => {
    const duration = boundaries.value[index + 1]!.offset - offset
    return `minmax(${Math.max(hasSession ? 72 : 16, Math.min(duration * 1.2, 150))}px, auto)`
  })

  return {
    gridTemplateColumns: `4rem 1.25rem repeat(${props.tracks.length}, minmax(9.5rem, 1fr))`,
    gridTemplateRows: `auto ${rowSizes.join(' ')} auto`
  }
})

// The dot on the rail that marks the current time, placed inside the row that contains it.
// It moves from this row's time dot to the next row's time dot, which both sit 1.3125rem below their row top.
const nowMarker = computed(() => {
  const index = isLive.value ? boundaries.value.findLastIndex(({ offset }) => offset <= nowMinutes.value) : -1
  const start = boundaries.value[index]
  const end = boundaries.value[index + 1]
  if (!start || !end) {
    return null
  }

  const progress = (nowMinutes.value - start.offset) / (end.offset - start.offset)
  return { row: index + 2, top: `calc(${progress * 100}% + 1.3125rem)` }
})

function phaseLabel(phase: SessionPhase, session: ProgramSession) {
  if (phase === 'now') {
    return `Now · ${formatMinutes(session.startsAfterMinutes + session.durationMinutes - nowMinutes.value)} left`
  }
  if (phase === 'next') {
    return `Next · in ${formatMinutes(session.startsAfterMinutes - nowMinutes.value)}`
  }
  return undefined
}

// The grid row that starts at each boundary.
const rows = computed(() => new Map(boundaries.value.map(({ offset }, index) => [offset, index + 2])))

// The name of each room on the floor plans, by `floorPlanId/roomId`.
const roomNames = computed(() => new Map(props.floorPlans.flatMap(plan =>
  plan.rooms.map(room => [`${plan.id}/${room.id}`, room.name] as const)
)))

function roomName(room: ProgramSession['room']) {
  return room ? roomNames.value.get(`${room.floorPlanId}/${room.roomId}`) : undefined
}

// Each group of outside blocks spans all tracks. Its blocks are stacked in one grid cell.
const outsidePlacements = computed(() => [...outsideGroups.value].map(([offset, items]) => ({
  offset,
  blocks: items.map(item => ({
    item,
    // The time column shows when a block starts, so a block shows its time range only when it ends later.
    timeRange: item.endsAt && Date.parse(item.endsAt) > Date.parse(item.startsAt)
      ? getAgendaItemPresentation(item, false).timeLabel
      : null,
    roomName: roomName(props.agendaItemRooms.find(entry => entry.agendaItemId === item.id)?.room ?? null)
  })),
  style: { gridColumn: '3 / -1', gridRow: rows.value.get(offset) }
})))

const placements = computed(() => trackSessions.value.map(({ session, column }) => {
  const end = session.startsAfterMinutes + session.durationMinutes
  const phase = isLive.value ? getSessionPhase(session, nowMinutes.value, nextStart.value) : 'later'

  return {
    session,
    phase,
    phaseLabel: phaseLabel(phase, session),
    timeLabel: getAgendaItemPresentation({
      startsAt: atOffset(session.startsAfterMinutes),
      endsAt: atOffset(end)
    }, false).timeLabel,
    roomName: roomName(session.room),
    style: { gridColumn: column, gridRow: `${rows.value.get(session.startsAfterMinutes)} / ${rows.value.get(end)}` }
  }
}))
</script>

<template>
  <div
    ref="timeline"
    class="overflow-x-auto rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
    data-testid="program-timeline"
    role="region"
    aria-label="Agenda timeline"
    tabindex="0"
  >
    <div
      ref="timelineGrid"
      class="isolate grid"
      :style="gridStyle"
    >
      <template v-if="tracks.length > 1">
        <h2
          v-for="(track, index) in tracks"
          :key="track.id"
          class="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted"
          :style="{ gridColumn: index + 3, gridRow: 1 }"
        >
          {{ track.name }}
        </h2>
      </template>

      <div
        class="mx-auto w-px bg-accented"
        style="grid-column: 2; grid-row: 2 / -1"
        aria-hidden="true"
      />

      <template
        v-for="(boundary, index) in boundaries"
        :key="boundary.offset"
      >
        <time
          v-if="boundary.label"
          :datetime="atOffset(boundary.offset)"
          class="sticky left-0 z-10 pr-1 pt-3.5 text-right text-xs font-medium tabular-nums leading-tight"
          :class="[boundary.hasSession ? 'text-highlighted' : 'text-muted', { 'bg-bg': scrollsSideways }]"
          :style="{ gridColumn: 1, gridRow: index + 2 }"
        >
          {{ boundary.label }}
        </time>
        <span
          v-if="boundary.label"
          class="z-10 mx-auto mt-4 size-2.5 rounded-full border-2"
          :class="boundary.hasStarted ? 'border-highlighted bg-highlighted' : 'border-dimmed bg-bg'"
          :style="{ gridColumn: 2, gridRow: index + 2 }"
          aria-hidden="true"
        />
      </template>

      <div
        v-if="nowMarker"
        class="pointer-events-none relative z-20"
        :style="{ gridColumn: 2, gridRow: nowMarker.row }"
        data-testid="program-now-marker"
        aria-hidden="true"
      >
        <span
          class="absolute left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success ring-4 ring-success/25"
          :style="{ top: nowMarker.top }"
        />
      </div>

      <div
        v-for="group in outsidePlacements"
        :key="group.offset"
        class="m-1 flex flex-col gap-2"
        :style="group.style"
      >
        <AccountEventProgramAgendaItem
          v-for="block in group.blocks"
          :key="block.item.id"
          :item="block.item"
          :time-range="block.timeRange"
          :room-name="block.roomName"
          :selected="block.item.id === selectedAgendaItemId"
          @select="$emit('selectAgendaItem', $event)"
        />
      </div>

      <AccountEventProgramSession
        v-for="entry in placements"
        :key="entry.session.id"
        :session="entry.session"
        :time-label="entry.timeLabel"
        :room-name="entry.roomName"
        :selected="entry.session.id === selectedSessionId"
        :phase="entry.phase"
        :phase-label="entry.phaseLabel"
        :style="entry.style"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>
