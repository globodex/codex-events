<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'

import { deckApiPath } from '#shared/domains/events/decks'
import type { AgendaChallenge, ParticipantEventProgram, ProgramSession } from '#shared/domains/events/program'

import AccountEventProgramFloorPlan from '~/components/account/events/molecules/AccountEventProgramFloorPlan.vue'
import AccountEventChallengeList from '~/components/account/events/organisms/AccountEventChallengeList.vue'
import AccountEventProgramTimeline from '~/components/account/events/organisms/AccountEventProgramTimeline.vue'
import AccountEventChallengePage from '~/components/account/events/organisms/AccountEventChallengePage.vue'
import AccountEventDeckPanel from '~/components/account/events/organisms/AccountEventDeckPanel.vue'
import { getAgendaItemPresentation, type PublicEventAgendaItem } from '~/domains/events/presentation'
import { agendaItemsOutsideProgram } from '~/domains/events/program-timeline'

const props = defineProps<{
  program: ParticipantEventProgram
  /** The event's public agenda blocks. One of them holds the program. */
  agendaItems: PublicEventAgendaItem[]
  /** The published challenges that this person may read. A room of a floor plan names its challenge. */
  challenges: AgendaChallenge[]
  /**
   * The session or agenda block that the link to this tab names: its id, or `first` for the earliest
   * session or agenda block with a room. "How to get there" on the Overview tab links to `first`.
   */
  linkedSession?: string | null
  /** The session of the workshop page that the link to this tab opens, by its id. */
  linkedWorkshop?: string | null
  /** The challenge whose page the link to this tab opens, by its id. */
  linkedChallenge?: string | null
  /** Reads the Agenda tab again, for example after the staff of a workshop saved its page. */
  refreshPage: () => Promise<unknown>
}>()

const emit = defineEmits<{
  /** The workshop or challenge page closes, and the Agenda tab shows the map again. */
  closePage: []
  /**
   * The id of the selected session or agenda block, or `null` while something else is selected. The page
   * puts it in its address, so a shared link opens the same selection. It also closes an open workshop or
   * challenge page.
   */
  linkSelection: [id: string | null]
}>()

// The public agenda blocks before and after the program's block. The sessions cover the block itself.
const outsideItems = computed(() => agendaItemsOutsideProgram(props.agendaItems, props.program.agendaItem))

// One thing is selected at a time: a session, an agenda block, a challenge, or a place on the map itself.
const selectedSessionId = shallowRef<string | null>(null)
const selectedAgendaItemId = shallowRef<string | null>(null)
const selectedChallengeId = shallowRef<string | null>(null)
const mapSelection = shallowRef<{ floorPlanId: string, roomId: string | null } | null>(null)
const mapPanel = useTemplateRef<HTMLElement>('mapPanel')
const floorPlan = useTemplateRef<InstanceType<typeof AccountEventProgramFloorPlan>>('floorPlan')
// The timeline uses the current time to mark the running and the next session.
const now = useNow({ scheduler: callback => useIntervalFn(callback, 30_000) })

const hasSessions = computed(() => props.program.tracks.some(track => track.sessions.length > 0))
// The workshop page that the link opens, with its session. It takes the place of the map and the
// challenges beside the agenda.
const openWorkshop = computed(() => props.program.workshops.find(workshop => workshop.sessionId === props.linkedWorkshop))
const openWorkshopSession = computed(() => props.program.tracks.flatMap(track => track.sessions)
  .find(session => session.id === openWorkshop.value?.sessionId))
// The time and the room of the workshop, for example "11:10 AM - 11:40 AM · Main room". The room is
// named as on the agenda, without its number.
const openWorkshopSummary = computed(() => {
  const session = openWorkshopSession.value
  if (!session) {
    return ''
  }
  const programStart = Date.parse(props.program.agendaItem.startsAt)
  const { timeLabel } = getAgendaItemPresentation({
    startsAt: new Date(programStart + session.startsAfterMinutes * 60_000).toISOString(),
    endsAt: new Date(programStart + (session.startsAfterMinutes + session.durationMinutes) * 60_000).toISOString()
  }, false)
  const roomName = props.program.floorPlans.find(plan => plan.id === session.room?.floorPlanId)?.rooms
    .find(room => room.id === session.room?.roomId)?.name
  return [timeLabel, roomName].filter(Boolean).join(' · ')
})
// The challenge page that the link opens, with the rooms that name the challenge. Like a workshop
// page, it takes the place of the map and the challenges.
const openChallenge = computed(() => openWorkshop.value
  ? undefined
  : props.challenges.find(challenge => challenge.id === props.linkedChallenge))
const openChallengeRooms = computed(() => props.program.floorPlans
  .flatMap(plan => plan.rooms.filter(room => room.challengeId === openChallenge.value?.id)))
const selectedSession = computed(() => props.program.tracks.flatMap(track => track.sessions)
  .find(session => session.id === selectedSessionId.value))
const selectedAgendaItemRoom = computed(() => props.program.agendaItemRooms
  .find(entry => entry.agendaItemId === selectedAgendaItemId.value)?.room)
// The rooms that name the selected challenge, each with its floor plan. A challenge can have several.
const selectedChallengePlaces = computed(() => props.program.floorPlans.flatMap(plan => plan.rooms
  .filter(room => room.challengeId === selectedChallengeId.value)
  .map(room => ({ floorPlanId: plan.id, roomId: room.id }))))
// The places that the selection shows on the map: the room of a session or an agenda block, the
// rooms of a challenge, or the floor or room that the person chose on the map.
const selectedPlaces = computed(() => {
  if (selectedSession.value?.room) {
    return [selectedSession.value.room]
  }
  if (selectedAgendaItemRoom.value) {
    return [selectedAgendaItemRoom.value]
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
  selectedAgendaItemId.value = null
  selectedChallengeId.value = null
  mapSelection.value = null
}

async function selectSession(session: ProgramSession) {
  clearSelection()
  selectedSessionId.value = session.id
  emit('linkSelection', session.id)
  await revealMap()
}

// An agenda block with a room shows that room on the map, like a session.
async function selectAgendaItem(agendaItemId: string) {
  clearSelection()
  selectedAgendaItemId.value = agendaItemId
  emit('linkSelection', agendaItemId)
  await revealMap()
}

async function revealMap() {
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
  emit('linkSelection', null)
}

// A challenge shows its rooms on the map, like a session that has a room.
async function selectChallenge(challengeId: string) {
  clearSelection()
  selectedChallengeId.value = challengeId
  emit('linkSelection', null)

  await nextTick()
  // On a narrow screen the challenges stand below the map. Scroll just enough to show the whole map.
  floorPlan.value?.$el.scrollIntoView({ block: 'nearest' })
}

// The tab opens with the linked session or agenda block selected, so the map shows its room and the way
// there. `first` selects the earliest session or agenda block with a room, which is usually the check-in.
onMounted(() => {
  const linkedId = props.linkedSession
  const sessionsWithRoom = props.program.tracks.flatMap(track => track.sessions).filter(session => session.room)
  if (linkedId !== 'first') {
    const linked = sessionsWithRoom.find(session => session.id === linkedId)
    if (linked) {
      selectSession(linked)
    } else if (linkedId && props.program.agendaItemRooms.some(entry => entry.agendaItemId === linkedId)) {
      selectAgendaItem(linkedId)
    }
    return
  }

  const programStart = Date.parse(props.program.agendaItem.startsAt)
  const firstSession = sessionsWithRoom.toSorted((left, right) => left.startsAfterMinutes - right.startsAfterMinutes)[0]
  const firstItem = outsideItems.value
    .filter(item => props.program.agendaItemRooms.some(entry => entry.agendaItemId === item.id))
    .toSorted((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))[0]
  if (firstItem && (!firstSession || Date.parse(firstItem.startsAt) < programStart + firstSession.startsAfterMinutes * 60_000)) {
    selectAgendaItem(firstItem.id)
  } else if (firstSession) {
    selectSession(firstSession)
  }
})

// On a narrow screen the map stands below the agenda. This button leads back to the selection.
function returnToAgenda() {
  const elementId = selectedSessionId.value
    ? `program-session-${encodeURIComponent(selectedSessionId.value)}`
    : `program-agenda-item-${encodeURIComponent(selectedAgendaItemId.value ?? '')}`
  document.getElementById(elementId)?.focus()
}
</script>

<template>
  <div
    class="grid items-start gap-4 lg:gap-6"
    :class="openWorkshop || openChallenge || selectedPlan || challenges.length ? 'lg:grid-cols-[clamp(17rem,36%,26rem)_minmax(0,1fr)]' : ''"
  >
    <section
      class="min-w-0"
      aria-label="Sessions"
    >
      <AccountEventProgramTimeline
        v-if="hasSessions"
        :event-id="program.eventId"
        :tracks="program.tracks"
        :workshops="program.workshops"
        :floor-plans="program.floorPlans"
        :outside-items="outsideItems"
        :agenda-item-rooms="program.agendaItemRooms"
        :starts-at="program.agendaItem.startsAt"
        :ends-at="program.agendaItem.endsAt"
        :selected-session-id="openWorkshop?.sessionId ?? selectedSessionId"
        :selected-agenda-item-id="selectedAgendaItemId"
        :now="now.getTime()"
        @select="selectSession"
        @select-agenda-item="selectAgendaItem"
      />
      <p
        v-else
        class="rounded-xl border border-default p-4 text-sm text-muted"
      >
        No sessions scheduled.
      </p>
    </section>

    <!-- On a phone a workshop or challenge page comes first, above the agenda. -->
    <AccountEventDeckPanel
      v-if="openWorkshop && openWorkshopSession"
      class="order-first min-w-0 lg:order-none"
      :event-id="program.eventId"
      :title="openWorkshopSession.title"
      :summary="openWorkshopSummary"
      :staff="openWorkshop.staff"
      :deck="openWorkshop.deck"
      :api-path="deckApiPath(program.eventId, 'workshop', openWorkshop.sessionId)"
      :refresh-page="refreshPage"
      @close="emit('closePage')"
    />
    <AccountEventChallengePage
      v-else-if="openChallenge"
      class="order-first min-w-0 lg:order-none"
      :event-id="program.eventId"
      :challenge="openChallenge"
      :rooms="openChallengeRooms"
      :refresh-page="refreshPage"
      @close="emit('closePage')"
    />
    <aside
      v-else-if="selectedPlan || challenges.length"
      ref="mapPanel"
      class="flex min-w-0 scroll-my-4 flex-col gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-ring lg:sticky lg:top-4"
      tabindex="-1"
      :aria-label="selectedPlan ? 'Map and challenges' : 'Challenges'"
    >
      <AppButton
        v-if="selectedSession || selectedAgendaItemRoom"
        icon="i-lucide-arrow-up"
        label="Back to agenda"
        color="neutral"
        variant="ghost"
        class="self-start lg:hidden"
        @click="returnToAgenda"
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
            :event-id="program.eventId"
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
