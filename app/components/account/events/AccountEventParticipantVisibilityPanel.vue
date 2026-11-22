<script setup lang="ts">
import type { AccountEventParticipantsPage } from '#shared/domains/events/account-event-participants-page'
import type { AdminApplicationRecord } from '~/domains/applications/admin-application-record'

import {
  LazyAccountEventsAccountEventParticipantsPanel as LazyAccountEventParticipantsPanel
} from '#components'
import { useParticipantCheckIn } from '~/composables/useParticipantCheckIn'

const props = withDefaults(defineProps<{
  eventId: string
  page: AccountEventParticipantsPage | null
  isLoading?: boolean
  errorMessage?: string
}>(), {
  isLoading: false,
  errorMessage: ''
})

const applications = ref<AdminApplicationRecord[]>([])
const pendingActionKey = ref<string | null>(null)
const event = computed(() => props.page?.event ?? null)

watch(() => props.page, (page) => {
  applications.value = (page?.applications ?? []) as AdminApplicationRecord[]
}, { immediate: true })

// Shows the check-in in the list at once, without loading the page again.
const checkInParticipant = useParticipantCheckIn({
  pendingActionKey,
  onCheckedIn: (checkedInApplication) => {
    applications.value = applications.value.map(application =>
      application.id === checkedInApplication.id
        ? { ...application, ...checkedInApplication }
        : application
    )
  }
})
</script>

<template>
  <LazyAccountEventParticipantsPanel
    :event-id="props.eventId"
    :applications="applications"
    :is-loading="props.isLoading"
    :error-message="props.errorMessage"
    :pending-action-key="pendingActionKey"
    read-only
    :show-ai-knowledge="event?.applicationAiKnowledgeVisible ?? false"
    :tracks="event?.tracks ?? []"
    :participants-limit="event?.participantsLimit ?? null"
    :auto-approve-applications="event?.autoApproveApplications ?? false"
    :event-state="event?.state ?? 'draft'"
    :status-counts="props.page?.statusCounts"
    @check-in="checkInParticipant"
  />
</template>
