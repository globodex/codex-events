<script setup lang="ts">
import type { ParticipantEventProgram, ProgramSession } from '#shared/domains/events/program'

import AccountEventProgramFloorPlan from '~/components/account/events/AccountEventProgramFloorPlan.vue'
import AccountEventProgramTimeline from '~/components/account/events/AccountEventProgramTimeline.vue'

const props = defineProps<{
  program: ParticipantEventProgram
}>()

const selectedSessionId = shallowRef<string | null>(null)
const mapSelection = shallowRef<{ floorPlanId: string, roomId: string | null } | null>(null)
const details = useTemplateRef<HTMLElement>('details')

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
const hasDetails = computed(() => Boolean(selectedPlan.value || selectedSession.value?.details))

async function selectSession(session: ProgramSession) {
  mapSelection.value = null
  selectedSessionId.value = session.id
  if (!window.matchMedia('(min-width: 64rem)').matches && (session.room || session.details)) {
    await nextTick()
    details.value?.focus({ preventScroll: true })
    details.value?.scrollIntoView({ block: 'start' })
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
    :class="hasDetails ? 'lg:grid-cols-[clamp(16rem,29%,22rem)_minmax(0,1fr)]' : ''"
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
      v-if="hasDetails"
      ref="details"
      class="flex min-w-0 scroll-mt-4 flex-col gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-ring lg:sticky lg:top-4"
      tabindex="-1"
      aria-label="Session details"
    >
      <AppButton
        v-if="selectedSession?.room || selectedSession?.details"
        icon="i-lucide-arrow-up"
        label="Back to session"
        color="neutral"
        variant="ghost"
        class="self-start lg:hidden"
        @click="returnToSession"
      />
      <div
        v-if="selectedSession?.details"
        class="space-y-1 border-b border-default pb-3 lg:border-b-0 lg:border-t lg:pb-0 lg:pt-3"
      >
        <h2 class="text-base font-semibold text-highlighted">
          {{ selectedSession.title }}
        </h2>
        <p class="whitespace-pre-wrap break-words text-sm text-muted">
          {{ selectedSession.details }}
        </p>
      </div>
      <AccountEventProgramFloorPlan
        v-if="selectedPlan"
        class="lg:order-first"
        :plan="selectedPlan"
        :floors="program.floorPlans"
        :selected-room="selectedRoom"
        @select-floor="selectMapLocation"
        @select-room="selectMapLocation(selectedPlan.id, $event)"
      />
    </aside>
  </div>
</template>
