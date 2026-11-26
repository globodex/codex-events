<script setup lang="ts">
import { deckApiPath } from '#shared/domains/events/decks'
import type { AgendaChallenge, ProgramRoom } from '#shared/domains/events/program'
import AccountEventDeckPanel from '~/components/account/events/organisms/AccountEventDeckPanel.vue'
import EventStaffInstructions from '~/components/events/molecules/EventStaffInstructions.vue'

// The page of a challenge on the Agenda tab: its rooms, its staff and its deck, and for the event team
// its staff instructions. The Details button of the challenge card opens it.
const props = defineProps<{
  eventId: string
  challenge: AgendaChallenge
  /** The rooms that name this challenge on the event's floor plans. */
  rooms: ProgramRoom[]
  /** Reads the Agenda tab again after a save. */
  refreshPage: () => Promise<unknown>
}>()

const emit = defineEmits<{
  close: []
}>()

const roomNames = computed(() => props.rooms.map(room => room.name).join(', ') || undefined)
</script>

<template>
  <AccountEventDeckPanel
    :event-id="eventId"
    :title="challenge.title"
    :summary="roomNames"
    :staff="challenge.staff"
    :deck="challenge.deck"
    :api-path="deckApiPath(eventId, 'challenge', challenge.id)"
    :refresh-page="refreshPage"
    @close="emit('close')"
  >
    <!-- Only the event team receives staff instructions. -->
    <EventStaffInstructions
      v-if="challenge.staffInstructions?.trim()"
      :source="challenge.staffInstructions"
    />
  </AccountEventDeckPanel>
</template>
