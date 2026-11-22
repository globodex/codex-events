<script setup lang="ts">
import type { AccountEventTeamsPage } from '#shared/domains/events/account-event-teams-page'

import { LazyAccountEventsAccountEventParticipantTeamPanel as LazyAccountEventParticipantTeamPanel } from '#components'
import { useAccountEventPageRequest } from '~/composables/useAccountEventPageRequest'

definePageMeta({
  middleware: ['require-platform-account']
})

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? '').trim())
const selectedTeamSlug = computed(() => String(route.query.team ?? '').trim().toLowerCase() || null)

if (!slug.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Event not found.'
  })
}

const pageRequest = useAccountEventPageRequest<AccountEventTeamsPage>(slug, 'teams', {
  query: computed(() => ({ selectedTeamSlug: selectedTeamSlug.value }))
})
</script>

<template>
  <div class="space-y-6">
    <AppAlert
      v-if="pageRequest.isLoading.value"
      color="neutral"
      variant="soft"
      title="Loading teams"
      description="The event team directory is loading."
    />

    <AppAlert
      v-else-if="pageRequest.errorMessage.value"
      color="error"
      variant="soft"
      title="Teams unavailable"
      :description="pageRequest.errorMessage.value"
    />

    <LazyAccountEventParticipantTeamPanel
      v-else-if="pageRequest.data.value"
      :event="pageRequest.data.value.page.event"
      :page="pageRequest.data.value.page"
      :selected-team-slug="selectedTeamSlug"
    />
  </div>
</template>
