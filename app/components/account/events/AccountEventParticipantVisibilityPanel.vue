<script setup lang="ts">
import type { AccountEventParticipantsPage } from '#shared/domains/events/account-event-participants-page'
import type { AdminApplicationRecord } from '~/domains/applications/admin-application-record'

import {
  LazyAccountEventsAccountEventParticipantsPanel as LazyAccountEventParticipantsPanel
} from '#components'
import { useParticipantCheckIn } from '~/composables/useParticipantCheckIn'

const props = withDefaults(defineProps<{
  eventId: string
  eventSlug: string
  page: AccountEventParticipantsPage | null
  isLoading?: boolean
  // True while the server is still searching all registrations for the typed text.
  isSearching?: boolean
  // True from "Load more" until the longer list has arrived.
  isLoadingMore?: boolean
  errorMessage?: string
  refreshPage: (eventSlug: string) => Promise<unknown>
}>(), {
  isLoading: false,
  isSearching: false,
  isLoadingMore: false,
  errorMessage: ''
})

const emit = defineEmits<{
  loadMore: []
}>()

// Text of the participant search box. The page owns it, because it is part of the page request.
const search = defineModel<string>('search', { required: true })

const applications = computed(() => (props.page?.applications ?? []) as AdminApplicationRecord[])
const pendingActionKey = ref<string | null>(null)
const event = computed(() => props.page?.event ?? null)
const checkInParticipant = useParticipantCheckIn(pendingActionKey, props.refreshPage)
</script>

<template>
  <LazyAccountEventParticipantsPanel
    v-model:search="search"
    :event-id="props.eventId"
    :applications="applications"
    :is-loading="props.isLoading"
    :is-searching="props.isSearching"
    :is-loading-more="props.isLoadingMore"
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
    :challenge-choices="props.page?.challengeChoices"
    :pagination="props.page?.pagination"
    @check-in="application => checkInParticipant(application, props.eventSlug)"
    @load-more="emit('loadMore')"
  />
</template>
