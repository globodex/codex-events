<script setup lang="ts">
import type { ProgramSession } from '#shared/domains/events/program'
import { toDateTimeLocalValue } from '~/domains/events/admin-event'
import { addMinutesToLocalValue } from '~/domains/events/builder'

const props = defineProps<{
  session: ProgramSession
  startsAt: string
  endsAt: string
  roomOptions: { key: string, label: string, room: NonNullable<ProgramSession['room']> }[]
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

function timeInputValue(minutes: number) {
  return Number.isFinite(minutes) ? addMinutesToLocalValue(props.startsAt, minutes) : ''
}

const startValue = computed(() => timeInputValue(props.session.startsAfterMinutes))
const endValue = computed(() => timeInputValue(props.session.startsAfterMinutes + props.session.durationMinutes))
const latestTime = computed(() => toDateTimeLocalValue(props.endsAt))
const roomValue = computed(() => {
  const room = props.session.room
  return room ? JSON.stringify([room.floorPlanId, room.roomId]) : ''
})

function updateSession(changes: Partial<ProgramSession>) {
  emit('update', { ...props.session, ...changes })
}

function minutesAfterStart(value: string | number | undefined) {
  return Math.round((Date.parse(String(value)) - Date.parse(props.startsAt)) / 60_000)
}

function updateRoom(value: string | number | undefined) {
  const room = props.roomOptions.find(option => option.key === value)?.room ?? null
  updateSession({ room })
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
      <AppSelect
        :id="roomId"
        :model-value="roomValue"
        :disabled="disabled"
        @update:model-value="updateRoom"
      >
        <option value="">
          No room
        </option>
        <option
          v-for="option in roomOptions"
          :key="option.key"
          :value="option.key"
        >
          {{ option.label }}
        </option>
      </AppSelect>
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
  </li>
</template>
