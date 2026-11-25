<script setup lang="ts">
import type { ProgramSession } from '#shared/domains/events/program'

import { roomOptionKey, type ProgramRoomOption } from '~/domains/events/program-map'

type Room = ProgramSession['room']

// A select of the rooms on the event's floor plans, with "No room" first. The event builder uses
// it for the room of a session and for the room of an agenda item.
const props = defineProps<{
  id: string
  room: Room
  roomOptions: ProgramRoomOption[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:room': [room: Room]
}>()

function selectRoom(key: string | number | undefined) {
  emit('update:room', props.roomOptions.find(option => option.key === key)?.room ?? null)
}
</script>

<template>
  <AppSelect
    :id="props.id"
    :model-value="props.room ? roomOptionKey(props.room) : ''"
    :disabled="props.disabled"
    @update:model-value="selectRoom"
  >
    <option value="">
      No room
    </option>
    <option
      v-for="option in props.roomOptions"
      :key="option.key"
      :value="option.key"
    >
      {{ option.label }}
    </option>
  </AppSelect>
</template>
