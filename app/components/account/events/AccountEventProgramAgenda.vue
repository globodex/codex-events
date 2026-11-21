<script setup lang="ts">
import type { ParticipantEventProgram, ProgramSession } from '#shared/domains/events/program'

import AccountEventProgramFloorPlan from '~/components/account/events/AccountEventProgramFloorPlan.vue'
import AccountEventProgramTimeline from '~/components/account/events/AccountEventProgramTimeline.vue'

const props = defineProps<{
  program: ParticipantEventProgram
  pendingSessions: ReadonlySet<string>
}>()

defineEmits<{
  toggleFavorite: [sessionId: string]
}>()

const savedOnly = shallowRef(false)
const selectedSessionId = shallowRef<string | null>(null)
const details = useTemplateRef<HTMLElement>('details')

const visibleTracks = computed(() => {
  if (!savedOnly.value) {
    return props.program.tracks
  }

  const savedIds = new Set(props.program.savedSessionIds)
  return props.program.tracks.map(track => ({
    ...track,
    sessions: track.sessions.filter(session => savedIds.has(session.id))
  })).filter(track => track.sessions.length > 0)
})
const hasSessions = computed(() => visibleTracks.value.some(track => track.sessions.length > 0))
const selectedSession = computed(() => visibleTracks.value.flatMap(track => track.sessions)
  .find(session => session.id === selectedSessionId.value))
const selectedPlan = computed(() => {
  const location = selectedSession.value?.room
  return location
    ? props.program.floorPlans.find(plan => plan.id === location.floorPlanId)
    : props.program.floorPlans[0]
})
const selectedRoom = computed(() => selectedPlan.value?.rooms
  .find(room => room.id === selectedSession.value?.room?.roomId) ?? null)
const hasDetails = computed(() => Boolean(selectedPlan.value || selectedSession.value?.details))

async function selectSession(session: ProgramSession) {
  selectedSessionId.value = session.id
  if (!window.matchMedia('(min-width: 64rem)').matches && (session.room || session.details)) {
    await nextTick()
    details.value?.focus({ preventScroll: true })
    details.value?.scrollIntoView({ block: 'start' })
  }
}

function returnToSession() {
  const session = selectedSession.value
  if (session) {
    document.getElementById(`program-session-${encodeURIComponent(session.id)}`)?.focus()
  }
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="program.canSave"
      class="flex flex-wrap gap-2"
      role="group"
      aria-label="Agenda view"
    >
      <AppButton
        label="All sessions"
        color="neutral"
        :variant="savedOnly ? 'ghost' : 'solid'"
        :aria-pressed="!savedOnly"
        @click="savedOnly = false"
      />
      <AppButton
        label="My agenda"
        icon="i-lucide-bookmark"
        color="neutral"
        :variant="savedOnly ? 'solid' : 'ghost'"
        :aria-pressed="savedOnly"
        @click="savedOnly = true"
      />
    </div>

    <div
      class="grid items-start gap-5"
      :class="hasDetails ? 'lg:grid-cols-[minmax(0,3fr)_minmax(17rem,2fr)]' : ''"
    >
      <section
        class="min-w-0"
        aria-label="Sessions"
      >
        <AccountEventProgramTimeline
          v-if="hasSessions"
          :tracks="visibleTracks"
          :floor-plans="program.floorPlans"
          :starts-at="program.agendaItem.startsAt"
          :ends-at="program.agendaItem.endsAt"
          :selected-session-id="selectedSessionId"
          :can-save="program.canSave"
          :saved-only="savedOnly"
          :saved-session-ids="program.savedSessionIds"
          :pending-sessions="pendingSessions"
          @select="selectSession"
          @toggle-favorite="$emit('toggleFavorite', $event)"
        />
        <p
          v-else
          class="rounded-xl border border-default p-5 text-sm text-muted"
        >
          {{ savedOnly ? 'No saved sessions.' : 'No sessions scheduled.' }}
        </p>
      </section>

      <aside
        v-if="hasDetails"
        ref="details"
        class="min-w-0 scroll-mt-4 space-y-3 rounded-xl focus-visible:outline-2 focus-visible:outline-ring lg:sticky lg:top-4"
        tabindex="-1"
        aria-label="Session details"
      >
        <AppButton
          v-if="selectedSession?.room || selectedSession?.details"
          icon="i-lucide-arrow-up"
          label="Back to session"
          color="neutral"
          variant="ghost"
          class="lg:hidden"
          @click="returnToSession"
        />
        <div
          v-if="selectedSession?.details"
          class="space-y-1 rounded-xl border border-default p-4"
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
          :plan="selectedPlan"
          :selected-room="selectedRoom"
        />
      </aside>
    </div>
  </div>
</template>
