<script setup lang="ts">
import type { ProgramSession } from '#shared/domains/events/program'
import AdminBuilderRoomSelect from '~/components/admin/builder/molecules/AdminBuilderRoomSelect.vue'
import { toDateTimeLocalValue } from '~/domains/events/admin-event'
import { addMinutesToLocalValue } from '~/domains/events/builder'
import type { ProgramRoomOption } from '~/domains/events/program-map'

const props = defineProps<{
  session: ProgramSession
  startsAt: string
  endsAt: string
  roomOptions: ProgramRoomOption[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  update: [session: ProgramSession]
  remove: []
}>()

const titleId = computed(() => `program-session-${props.session.id}`)
const startId = useId()
const endId = useId()
const roomId = useId()
const detailsId = useId()
const afterCheckInTitleId = useId()
const afterCheckInRoomId = useId()

function timeInputValue(minutes: number) {
  return Number.isFinite(minutes) ? addMinutesToLocalValue(props.startsAt, minutes) : ''
}

const startValue = computed(() => timeInputValue(props.session.startsAfterMinutes))
const endValue = computed(() => timeInputValue(props.session.startsAfterMinutes + props.session.durationMinutes))
const latestTime = computed(() => toDateTimeLocalValue(props.endsAt))

function updateSession(changes: Partial<ProgramSession>) {
  emit('update', { ...props.session, ...changes })
}

// A session can have a second title and room that participants see once they are checked in.
// The second version starts with an empty title and the room of the session.
function setChangesAfterCheckIn(changes: boolean) {
  updateSession({ afterCheckIn: changes ? { title: '', room: props.session.room } : undefined })
}

function updateAfterCheckIn(changes: Partial<NonNullable<ProgramSession['afterCheckIn']>>) {
  if (props.session.afterCheckIn) {
    updateSession({ afterCheckIn: { ...props.session.afterCheckIn, ...changes } })
  }
}

function minutesAfterStart(value: string | number | undefined) {
  return Math.round((Date.parse(String(value)) - Date.parse(props.startsAt)) / 60_000)
}
</script>

<template>
  <li class="space-y-3 border-t border-default/70 py-4">
    <div class="flex items-end gap-2">
      <AppFormField
        :name="titleId"
        label="Session title"
        class="min-w-0 flex-1"
      >
        <AppInput
          :id="titleId"
          :model-value="session.title"
          :disabled="disabled"
          :maxlength="120"
          required
          @update:model-value="value => updateSession({ title: String(value ?? '') })"
        />
      </AppFormField>
      <AppButton
        :aria-label="session.title ? `Remove ${session.title}` : 'Remove session'"
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        :disabled="disabled"
        class="h-11 shrink-0"
        @click="emit('remove')"
      />
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <AppFormField
        :name="startId"
        label="Starts"
      >
        <AppInput
          :id="startId"
          type="datetime-local"
          :model-value="startValue"
          :min="toDateTimeLocalValue(startsAt)"
          :max="latestTime"
          :disabled="disabled"
          required
          @update:model-value="value => updateSession({ startsAfterMinutes: minutesAfterStart(value) })"
        />
      </AppFormField>
      <AppFormField
        :name="endId"
        label="Ends"
      >
        <AppInput
          :id="endId"
          type="datetime-local"
          :model-value="endValue"
          :min="startValue"
          :max="latestTime"
          :disabled="disabled || !startValue"
          required
          @update:model-value="value => updateSession({ durationMinutes: minutesAfterStart(value) - session.startsAfterMinutes })"
        />
      </AppFormField>
    </div>

    <AppFormField
      v-if="roomOptions.length"
      :name="roomId"
      label="Room"
    >
      <AdminBuilderRoomSelect
        :id="roomId"
        :room="session.room"
        :room-options="roomOptions"
        :disabled="disabled"
        @update:room="room => updateSession({ room })"
      />
    </AppFormField>

    <AppFormField
      :name="detailsId"
      label="Details"
    >
      <AppTextarea
        :id="detailsId"
        :model-value="session.details ?? ''"
        :rows="1"
        :maxlength="2000"
        :disabled="disabled"
        @update:model-value="value => updateSession({ details: value ? String(value) : null })"
      />
    </AppFormField>

    <!-- The public event page lists a marked session with its start time and title only. -->
    <AppCheckbox
      :model-value="session.isPublic ?? false"
      label="Show on the public event page"
      :disabled="disabled"
      @update:model-value="isPublic => updateSession({ isPublic })"
    />

    <AppCheckbox
      :model-value="Boolean(session.afterCheckIn)"
      label="Changes after check-in"
      :disabled="disabled"
      @update:model-value="setChangesAfterCheckIn"
    />

    <div
      v-if="session.afterCheckIn"
      class="grid gap-3 sm:grid-cols-2"
    >
      <AppFormField
        :name="afterCheckInTitleId"
        label="Title after check-in"
      >
        <AppInput
          :id="afterCheckInTitleId"
          :model-value="session.afterCheckIn.title"
          :disabled="disabled"
          :maxlength="120"
          required
          @update:model-value="value => updateAfterCheckIn({ title: String(value ?? '') })"
        />
      </AppFormField>
      <AppFormField
        v-if="roomOptions.length"
        :name="afterCheckInRoomId"
        label="Room after check-in"
      >
        <AdminBuilderRoomSelect
          :id="afterCheckInRoomId"
          :room="session.afterCheckIn.room"
          :room-options="roomOptions"
          :disabled="disabled"
          @update:room="room => updateAfterCheckIn({ room })"
        />
      </AppFormField>
    </div>
  </li>
</template>
