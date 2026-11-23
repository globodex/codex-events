<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'

import type { AgendaChallenge, ParticipantEventProgram, ProgramSession } from '#shared/domains/events/program'

import AccountEventProgramFloorPlan from '~/components/account/events/molecules/AccountEventProgramFloorPlan.vue'
import AccountEventChallengeList from '~/components/account/events/organisms/AccountEventChallengeList.vue'
import AccountEventProgramTimeline from '~/components/account/events/organisms/AccountEventProgramTimeline.vue'
import type { PublicEventAgendaItem } from '~/domains/events/presentation'

const props = defineProps<{
  program: ParticipantEventProgram
  /** The event's public agenda blocks. One of them holds the program. */
  agendaItems: PublicEventAgendaItem[]
  /** The published challenges that this person may read. A room of a floor plan names its challenge. */
  challenges: AgendaChallenge[]
}>()

// The public agenda blocks before and after the program's block. The sessions cover the block itself.
const outsideItems = computed(() => {
  const programStart = Date.parse(props.program.agendaItem.startsAt)
  const programEnd = Date.parse(props.program.agendaItem.endsAt)

  return props.agendaItems.filter((item) => {
    const start = Date.parse(item.startsAt)
    return item.id !== props.program.agendaItem.id && (start < programStart || start >= programEnd)
  })
})

// One thing is selected at a time: a session, a challenge, or a place on the map itself.
const selectedSessionId = shallowRef<string | null>(null)
const selectedChallengeId = shallowRef<string | null>(null)
const mapSelection = shallowRef<{ floorPlanId: string, roomId: string | null } | null>(null)
const mapPanel = useTemplateRef<HTMLElement>('mapPanel')
const floorPlan = useTemplateRef<InstanceType<typeof AccountEventProgramFloorPlan>>('floorPlan')
// The timeline uses the current time to mark the running and the next session.
const now = useNow({ scheduler: callback => useIntervalFn(callback, 30_000) })

const hasSessions = computed(() => props.program.tracks.some(track => track.sessions.length > 0))
const selectedSession = computed(() => props.program.tracks.flatMap(track => track.sessions)
  .find(session => session.id === selectedSessionId.value))
// The rooms that name the selected challenge, each with its floor plan. A challenge can have several.
const selectedChallengePlaces = computed(() => props.program.floorPlans.flatMap(plan => plan.rooms
  .filter(room => room.challengeId === selectedChallengeId.value)
  .map(room => ({ floorPlanId: plan.id, roomId: room.id }))))
// The places that the selection shows on the map: the room of a session, the rooms of a
// challenge, or the floor or room that the person chose on the map.
const selectedPlaces = computed(() => {
  if (selectedSession.value?.room) {
    return [selectedSession.value.room]
  }
  if (selectedChallengeId.value) {
    return selectedChallengePlaces.value
  }

  return mapSelection.value ? [mapSelection.value] : []
})
// The map shows the floor of the first selected place. Without a selection it shows the first floor.
const selectedPlan = computed(() => {
  const floorPlanId = selectedPlaces.value[0]?.floorPlanId
  return props.program.floorPlans.find(plan => plan.id === floorPlanId) ?? props.program.floorPlans[0]
})
const selectedRooms = computed(() => {
  const plan = selectedPlan.value
  const roomIds = new Set(selectedPlaces.value.filter(place => place.floorPlanId === plan?.id).map(place => place.roomId))

  return plan?.rooms.filter(room => roomIds.has(room.id)) ?? []
})
// The map explains how to find a room while no room is selected. Only a session with a room can be selected.
const roomHint = computed(() => props.program.tracks.some(track => track.sessions.some(session => session.room))
  ? 'Tap a session to see its room'
  : undefined)

function clearSelection() {
  selectedSessionId.value = null
  selectedChallengeId.value = null
  mapSelection.value = null
}

async function selectSession(session: ProgramSession) {
  clearSelection()
  selectedSessionId.value = session.id

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
  clearSelection()
  mapSelection.value = { floorPlanId, roomId }
}

// A challenge shows its rooms on the map, like a session that has a room.
async function selectChallenge(challengeId: string) {
  clearSelection()
  selectedChallengeId.value = challengeId

  await nextTick()
  // On a narrow screen the challenges stand below the map. Scroll just enough to show the whole map.
  floorPlan.value?.$el.scrollIntoView({ block: 'nearest' })
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
    :class="selectedPlan || challenges.length ? 'lg:grid-cols-[clamp(17rem,36%,26rem)_minmax(0,1fr)]' : ''"
  >
    <section
      class="min-w-0"
      aria-label="Sessions"
    >
      <AccountEventProgramTimeline
        v-if="hasSessions"
        :tracks="program.tracks"
        :floor-plans="program.floorPlans"
        :outside-items="outsideItems"
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
      v-if="selectedPlan || challenges.length"
      ref="mapPanel"
      class="flex min-w-0 scroll-my-4 flex-col gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-ring lg:sticky lg:top-4"
      tabindex="-1"
      :aria-label="selectedPlan ? 'Map and challenges' : 'Challenges'"
    >
      <AppButton
        v-if="selectedSession"
        icon="i-lucide-arrow-up"
        label="Back to session"
        color="neutral"
        variant="ghost"
        class="self-start lg:hidden"
        @click="returnToSession"
      />
      <!--
        The challenges stand beside the map where this panel is wide enough, and below the map
        otherwise. Beside each other the map grows first, up to its own width limit, and the
        challenges take the space that is left, but never less than 13rem.
      -->
      <div class="@container">
        <div class="flex flex-col gap-4 @xl:flex-row @xl:items-start">
          <AccountEventProgramFloorPlan
            v-if="selectedPlan"
            ref="floorPlan"
            class="@xl:flex-[100_1_0%]"
            :plan="selectedPlan"
            :floors="program.floorPlans"
            :selected-rooms="selectedRooms"
            :room-hint="roomHint"
            @select-floor="selectMapLocation"
            @select-room="selectMapLocation(selectedPlan.id, $event)"
          />
          <AccountEventChallengeList
            v-if="challenges.length"
            class="@xl:min-w-52 @xl:flex-1"
            :challenges="challenges"
            :floor-plans="program.floorPlans"
            :selected-challenge-id="selectedChallengeId"
            @select="selectChallenge"
          />
        </div>
      </div>
    </aside>
  </div>
</template>
