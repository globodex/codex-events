<script setup lang="ts">
import type { EventFloorPlan, ProgramSession, ProgramTrack } from '#shared/domains/events/program'
import AdminBuilderProgramSession from '~/components/admin/builder/molecules/AdminBuilderProgramSession.vue'
import { programRoomOptions } from '~/domains/events/program-map'

const props = defineProps<{
  track: ProgramTrack
  startsAt: string
  endsAt: string
  floorPlans: EventFloorPlan[]
  /** The staff of the event, who can run a session as a workshop. */
  staffOptions: Array<{ id: string, name: string }>
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:track': [track: ProgramTrack]
  'remove': []
}>()

const trackNameId = useId()
const roomOptions = computed(() => programRoomOptions(props.floorPlans))

const availableSlot = computed(() => {
  const totalMinutes = Math.floor((Date.parse(props.endsAt) - Date.parse(props.startsAt)) / 60_000)
  if (!Number.isFinite(totalMinutes) || totalMinutes < 1) {
    return null
  }

  const sessions = props.track.sessions.filter(session =>
    Number.isFinite(session.startsAfterMinutes) && session.durationMinutes > 0
  ).sort((left, right) => left.startsAfterMinutes - right.startsAfterMinutes)

  let start = 0
  for (const session of sessions) {
    const gap = Math.min(totalMinutes, session.startsAfterMinutes) - start
    if (gap > 0) {
      return { start, duration: Math.min(30, gap) }
    }
    start = Math.max(start, session.startsAfterMinutes + session.durationMinutes)
  }

  const remainingMinutes = totalMinutes - start
  return remainingMinutes > 0 ? { start, duration: Math.min(30, remainingMinutes) } : null
})

function updateSessions(sessions: ProgramSession[]) {
  emit('update:track', { ...props.track, sessions })
}

async function addSession() {
  const slot = availableSlot.value
  if (!slot) {
    return
  }

  const id = crypto.randomUUID()
  updateSessions([...props.track.sessions, {
    id,
    title: '',
    details: null,
    startsAfterMinutes: slot.start,
    durationMinutes: slot.duration,
    room: null
  }])
  await nextTick()
  document.getElementById(`program-session-${id}`)?.focus()
}

function updateSession(session: ProgramSession) {
  updateSessions(props.track.sessions.map(candidate => candidate.id === session.id ? session : candidate))
}

function removeSession(id: string) {
  updateSessions(props.track.sessions.filter(session => session.id !== id))
}
</script>

<template>
  <section
    :aria-label="track.name || 'Track'"
    class="min-w-0 space-y-3 border-t border-default py-4"
  >
    <div class="flex items-end gap-2">
      <AppFormField
        :name="trackNameId"
        label="Track name"
        class="min-w-0 flex-1"
      >
        <AppInput
          :id="trackNameId"
          :model-value="track.name"
          :disabled="disabled"
          :maxlength="120"
          required
          @update:model-value="value => emit('update:track', { ...track, name: String(value ?? '') })"
        />
      </AppFormField>
      <AppButton
        aria-label="Remove track"
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        :disabled="disabled"
        class="h-11 shrink-0"
        @click="emit('remove')"
      />
    </div>

    <ul v-if="track.sessions.length">
      <AdminBuilderProgramSession
        v-for="session in track.sessions"
        :key="session.id"
        :session="session"
        :starts-at="startsAt"
        :ends-at="endsAt"
        :room-options="roomOptions"
        :staff-options="staffOptions"
        :disabled="disabled"
        @update="updateSession"
        @remove="removeSession(session.id)"
      />
    </ul>

    <AppButton
      label="Add session"
      icon="i-lucide-plus"
      color="neutral"
      variant="outline"
      size="sm"
      :disabled="disabled || !availableSlot"
      @click="addSession"
    />
    <p
      v-if="!availableSlot"
      class="text-sm text-muted"
    >
      Move or shorten a session to make room.
    </p>
  </section>
</template>
