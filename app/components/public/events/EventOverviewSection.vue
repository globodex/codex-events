<script setup lang="ts">
import type { PublicEvent } from '~/domains/events/presentation'
import EventAgendaPanel from './EventAgendaPanel.vue'
import EventOverviewPanel from './EventOverviewPanel.vue'
import EventTalkProposalCallout from './EventTalkProposalCallout.vue'
import EventTracksPanel from './organisms/EventTracksPanel.vue'

defineProps<{
  event: PublicEvent
  talkProposalWindow?: { isOpen: boolean, opensAt: string, closesAt: string } | null
  talkProposalAction?: { to: string, label: string } | null
}>()
</script>

<template>
  <section class="space-y-7">
    <EventTalkProposalCallout
      v-if="talkProposalWindow"
      v-bind="talkProposalWindow"
      :action-href="talkProposalAction?.to"
      :action-label="talkProposalAction?.label"
    />
    <EventOverviewPanel :description="event.description" />
    <EventTracksPanel
      :event-type="event.eventType"
      :tracks="event.tracks ?? []"
    />
    <EventAgendaPanel
      :agenda-items="event.agendaItems"
      :public-sessions="event.publicSessions"
    />
  </section>
</template>
