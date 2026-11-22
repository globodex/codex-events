<script setup lang="ts">
import type { AccountEventTeamsPage } from '#shared/domains/events/account-event-teams-page'

import { LazyAccountEventsAccountEventParticipantTeamPanel as LazyAccountEventParticipantTeamPanel } from '#components'
import { useAccountEventPageRequest } from '~/composables/useAccountEventPageRequest'
import { normalizeTeamSlugQueryValue } from '~/domains/teams/query'

definePageMeta({
  middleware: ['require-platform-account']
})

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? '').trim())
const selectedTeamSlug = computed(() => normalizeTeamSlugQueryValue(route.params.teamSlug || route.query.team))

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
      v-if="pageRequest.isLoading.value && !pageRequest.data.value"
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
      :refresh-teams="pageRequest.refreshFor"
      :page="pageRequest.data.value.page"
      :selected-team-slug="selectedTeamSlug"
    />
  </div>
</template>
