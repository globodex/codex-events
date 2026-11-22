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
  // True while the server is still searching all registrations for the typed text.
  isSearching?: boolean
  errorMessage?: string
  refreshPage: () => Promise<unknown> | unknown
}>(), {
  isLoading: false,
  isSearching: false,
  errorMessage: ''
})

// Text of the participant search box. The page owns it, because it is part of the page request.
const search = defineModel<string>('search', { required: true })

const applications = ref<AdminApplicationRecord[]>([])
const pendingActionKey = ref<string | null>(null)
const event = computed(() => props.page?.event ?? null)

watch(() => props.page, (page) => {
  applications.value = (page?.applications ?? []) as AdminApplicationRecord[]
}, { immediate: true })

// Shows the check-in in the list at once. The list is then read again for its counts.
const checkInParticipant = useParticipantCheckIn({
  pendingActionKey,
  onCheckedIn: (checkedInApplication) => {
    applications.value = applications.value.map(application =>
      application.id === checkedInApplication.id
        ? { ...application, ...checkedInApplication }
        : application
    )
  },
  refreshList: () => props.refreshPage()
})
</script>

<template>
  <LazyAccountEventParticipantsPanel
    v-model:search="search"
    :event-id="props.eventId"
    :applications="applications"
    :is-loading="props.isLoading"
    :is-searching="props.isSearching"
    :error-message="props.errorMessage"
    :pending-action-key="pendingActionKey"
    read-only
    :show-ai-knowledge="event?.applicationAiKnowledgeVisible ?? false"
    :tracks="event?.tracks ?? []"
    :participants-limit="event?.participantsLimit ?? null"
    :auto-approve-applications="event?.autoApproveApplications ?? false"
    :event-state="event?.state ?? 'draft'"
    :status-counts="props.page?.statusCounts"
    :checked-in-count="props.page?.checkedInCount"
    :pagination="props.page?.pagination"
    @check-in="checkInParticipant"
  />
</template>
