<script setup lang="ts">
import type { EventFloorPlan, ProgramSession, ProgramTrack } from '#shared/domains/events/program'

import AccountEventProgramSession from '~/components/account/events/AccountEventProgramSession.vue'
import { formatEventTime, getAgendaItemPresentation } from '~/domains/events/presentation'

const props = defineProps<{
  tracks: ProgramTrack[]
  floorPlans: EventFloorPlan[]
  startsAt: string
  endsAt: string
  savedOnly: boolean
  canSave: boolean
  selectedSessionId: string | null
  savedSessionIds: readonly string[]
  pendingSessions: ReadonlySet<string>
}>()

defineEmits<{
  select: [session: ProgramSession]
  toggleFavorite: [sessionId: string]
}>()

const baseTime = computed(() => Date.parse(props.startsAt))

function atOffset(minutes: number) {
  return new Date(baseTime.value + minutes * 60_000).toISOString()
}

const trackSessions = computed(() => props.tracks.flatMap((track, column) =>
  track.sessions.map(session => ({ session, column: column + 2 }))
).sort((left, right) => left.session.startsAfterMinutes - right.session.startsAfterMinutes || left.column - right.column))

const boundaries = computed(() => {
  const starts = new Set(trackSessions.value.map(({ session }) => session.startsAfterMinutes))
  const offsets = new Set(starts)
  for (const { session } of trackSessions.value) {
    offsets.add(session.startsAfterMinutes + session.durationMinutes)
  }
  if (!props.savedOnly) {
    offsets.add(0)
    offsets.add((Date.parse(props.endsAt) - baseTime.value) / 60_000)
  }

  const sortedOffsets = [...offsets].sort((left, right) => left - right)
  return sortedOffsets.map(offset => ({
    offset,
    hasSession: starts.has(offset),
    label: starts.has(offset) || offset === 0 || offset === sortedOffsets.at(-1)
      ? formatEventTime(atOffset(offset))
      : null
  }))
})

const gridStyle = computed(() => {
  const rowSizes = boundaries.value.slice(0, -1).map(({ offset, hasSession }, index) => {
    const duration = boundaries.value[index + 1]!.offset - offset
    return `${Math.max(hasSession ? 106 : 22, Math.min(duration * 1.5, 152))}px`
  })

  return {
    gridTemplateColumns: `3.5rem repeat(${props.tracks.length}, minmax(8.75rem, 1fr))`,
    gridTemplateRows: `auto ${rowSizes.join(' ')} auto`
  }
})

const placements = computed(() => {
  const rows = new Map(boundaries.value.map(({ offset }, index) => [offset, index + 2]))
  const rooms = new Map(props.floorPlans.flatMap(plan =>
    plan.rooms.map(room => [`${plan.id}/${room.id}`, room.name] as const)
  ))

  return trackSessions.value.map(({ session, column }) => {
    const startsAt = atOffset(session.startsAfterMinutes)
    const end = session.startsAfterMinutes + session.durationMinutes
    const endsAt = atOffset(end)

    return {
      session,
      timeLabel: getAgendaItemPresentation({ startsAt, endsAt }, false).timeLabel,
      roomName: session.room ? rooms.get(`${session.room.floorPlanId}/${session.room.roomId}`) : undefined,
      style: { gridColumn: column, gridRow: `${rows.get(session.startsAfterMinutes)} / ${rows.get(end)}` }
    }
  })
})
</script>

<template>
  <div
    class="overflow-x-auto rounded-xl border border-default focus-visible:outline-2 focus-visible:outline-ring"
    data-testid="program-timeline"
    role="region"
    aria-label="Agenda timeline"
    tabindex="0"
  >
    <div
      class="isolate grid"
      :style="gridStyle"
    >
      <div class="sticky left-0 z-20 border-b border-default bg-elevated" />
      <h2
        v-for="track in tracks"
        :key="track.id"
        class="border-b border-l border-default bg-elevated px-2.5 py-2.5 text-sm font-semibold text-highlighted"
      >
        {{ track.name }}
      </h2>

      <template
        v-for="(boundary, index) in boundaries"
        :key="boundary.offset"
      >
        <div
          v-if="boundary.label"
          class="sticky left-0 z-10 border-t border-default/65 bg-default p-1.5 text-right text-[10px] font-medium tabular-nums leading-tight text-muted"
          :style="{ gridColumn: 1, gridRow: index + 2 }"
        >
          <time :datetime="atOffset(boundary.offset)">{{ boundary.label }}</time>
        </div>
        <div
          v-if="boundary.label"
          class="border-t border-default/65"
          :style="{ gridColumn: '2 / -1', gridRow: index + 2 }"
          aria-hidden="true"
        />
      </template>

      <AccountEventProgramSession
        v-for="entry in placements"
        :key="entry.session.id"
        :session="entry.session"
        :time-label="entry.timeLabel"
        :room-name="entry.roomName"
        :can-save="canSave"
        :selected="entry.session.id === selectedSessionId"
        :saved="savedSessionIds.includes(entry.session.id)"
        :pending="pendingSessions.has(entry.session.id)"
        :style="entry.style"
        @select="$emit('select', $event)"
        @toggle-favorite="$emit('toggleFavorite', $event)"
      />
    </div>
  </div>
</template>
