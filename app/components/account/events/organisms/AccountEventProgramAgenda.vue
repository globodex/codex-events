<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'

import type { ParticipantEventProgram, ProgramSession } from '#shared/domains/events/program'

import AccountEventProgramFloorPlan from '~/components/account/events/molecules/AccountEventProgramFloorPlan.vue'
import AccountEventProgramTimeline from '~/components/account/events/organisms/AccountEventProgramTimeline.vue'

const props = defineProps<{
  program: ParticipantEventProgram
}>()

const selectedSessionId = shallowRef<string | null>(null)
const mapSelection = shallowRef<{ floorPlanId: string, roomId: string | null } | null>(null)
const mapPanel = useTemplateRef<HTMLElement>('mapPanel')
// The timeline uses the current time to mark the running and the next session.
const now = useNow({ scheduler: callback => useIntervalFn(callback, 30_000) })

const hasSessions = computed(() => props.program.tracks.some(track => track.sessions.length > 0))
const selectedSession = computed(() => props.program.tracks.flatMap(track => track.sessions)
  .find(session => session.id === selectedSessionId.value))
const selectedLocation = computed(() => selectedSession.value?.room ?? mapSelection.value)
const selectedPlan = computed(() => {
  const location = selectedLocation.value
  return location
    ? props.program.floorPlans.find(plan => plan.id === location.floorPlanId)
    : props.program.floorPlans[0]
})
const selectedRoom = computed(() => selectedPlan.value?.rooms
  .find(room => room.id === selectedLocation.value?.roomId) ?? null)

async function selectSession(session: ProgramSession) {
  mapSelection.value = null
  selectedSessionId.value = session.id
  if (!session.room) {
    return
  }

  await nextTick()
  if (window.matchMedia('(min-width: 64rem)').matches) {
    // The map is beside the sessions: scroll just enough to show the whole map.
    mapPanel.value?.scrollIntoView({ block: 'nearest' })
  } else {
    // The map is below the sessions: move to it.
    mapPanel.value?.focus({ preventScroll: true })
    mapPanel.value?.scrollIntoView({ block: 'start' })
  }
}

function selectMapLocation(floorPlanId: string, roomId: string | null = null) {
  selectedSessionId.value = null
  mapSelection.value = { floorPlanId, roomId }
}

function returnToSession() {
  const session = selectedSession.value
  if (session) {
    document.getElementById(`program-session-${encodeURIComponent(session.id)}`)?.focus()
  }
}
</script>

<template>
  <div
    class="grid items-start gap-4 lg:gap-6"
    :class="selectedPlan ? 'lg:grid-cols-[clamp(17rem,36%,26rem)_minmax(0,1fr)]' : ''"
  >
    <section
      class="min-w-0"
      aria-label="Sessions"
    >
      <AccountEventProgramTimeline
        v-if="hasSessions"
        :tracks="program.tracks"
        :floor-plans="program.floorPlans"
        :starts-at="program.agendaItem.startsAt"
        :ends-at="program.agendaItem.endsAt"
        :selected-session-id="selectedSessionId"
        :now="now.getTime()"
        @select="selectSession"
      />
      <p
        v-else
        class="rounded-xl border border-default p-4 text-sm text-muted"
      >
        No sessions scheduled.
      </p>
    </section>

    <aside
      v-if="selectedPlan"
      ref="mapPanel"
      class="flex min-w-0 scroll-my-4 flex-col gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-ring lg:sticky lg:top-4"
      tabindex="-1"
      aria-label="Map"
    >
      <AppButton
        v-if="selectedSession?.room"
        icon="i-lucide-arrow-up"
        label="Back to session"
        color="neutral"
        variant="ghost"
        class="self-start lg:hidden"
        @click="returnToSession"
      />
      <AccountEventProgramFloorPlan
        :plan="selectedPlan"
        :floors="program.floorPlans"
        :selected-room="selectedRoom"
        @select-floor="selectMapLocation"
        @select-room="selectMapLocation(selectedPlan.id, $event)"
      />
    </aside>
  </div>
</template>
