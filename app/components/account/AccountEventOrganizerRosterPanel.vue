<script setup lang="ts">
import type { ApiListResponse } from '~/lib/api'
import type { EventRoleUserSummary } from '~/domains/events/access'

import { getApiSubjectKey } from '~/lib/api'
import { useApiClient } from '~/composables/useApiClient'
import { useApiResponse } from '~/composables/useApiData'
import { useSessionActor } from '~/composables/useSessionActor'

const actor = useSessionActor().actor
const eventOrganizerCandidatePageSize = 20

const subjectKey = computed(() => getApiSubjectKey(
  actor.value.isAuthenticated ? actor.value.sessionUser.sub : null
))
const apiFetch = useApiClient()
const currentOrganizers = useApiResponse<EventRoleUserSummary[]>('event-organizers', '/api/event-organizers')

const {
  mutationError,
  runRosterMutation,
  isPendingAction
} = useRosterMutationRunner()
const {
  candidateSearchInput,
  appliedCandidateSearch,
  candidateUsers,
  candidateUsersStatus,
  candidateUsersErrorMessage,
  isLoadingMoreCandidates,
  loadMoreCandidatesErrorMessage,
  hasMoreCandidates,
  loadCandidateUsers,
  loadMoreCandidates
} = useRosterCandidateSearch<EventRoleUserSummary>({
  pageSize: eventOrganizerCandidatePageSize,
  requestKey: 'event-organizer-candidates',
  resetKey: subjectKey,
  loadPage: async ({ page, pageSize, search, signal }) => await apiFetch<ApiListResponse<EventRoleUserSummary>>(
    '/api/event-organizers/candidates',
    {
      query: {
        page,
        page_size: pageSize,
        ...(search.length > 0
          ? {
              search
            }
          : {})
      },
      signal
    }
  )
})

const currentEventOrganizers = computed(() => currentOrganizers.data.value ?? [])
const currentEventOrganizerCount = computed(() => currentEventOrganizers.value.length)
const candidateRows = computed(() =>
  candidateUsers.value.filter(user => appliedCandidateSearch.value.length > 0 || !user.isEventOrganizer)
)
const candidateSkeletonRowCount = 3
const emptyCandidateMessage = computed(() =>
  appliedCandidateSearch.value.length > 0
    ? 'No people match this search.'
    : hasMoreCandidates.value
      ? 'No new people are in this batch. Load more to keep looking.'
      : 'No more active users are available to add right now.'
)

function isCandidateActionDisabled(user: EventRoleUserSummary) {
  return user.isEventOrganizer
}

function getCandidateActionLabel(user: EventRoleUserSummary) {
  return user.isEventOrganizer ? 'Already event organizer' : 'Add event organizer'
}

async function addEventOrganizer(user: EventRoleUserSummary) {
  await runRosterMutation({
    actionKey: user.id,
    action: async () => {
      await apiFetch(`/api/event-organizers/${user.id}`, {
        method: 'PUT'
      })
    },
    successTitle: 'Event organizer added',
    successDescription: `${user.displayName} can now create events and manage the events they create.`,
    afterSuccess: async () => {
      await Promise.all([
        currentOrganizers.refresh(),
        loadCandidateUsers()
      ])
    }
  })
}

async function removeEventOrganizer(user: EventRoleUserSummary) {
  const confirmed = window.confirm(`Remove event organizer access for ${user.displayName}?`)

  if (!confirmed) {
    return
  }

  await runRosterMutation({
    actionKey: user.id,
    action: async () => {
      await apiFetch(`/api/event-organizers/${user.id}`, {
        method: 'DELETE'
      })
    },
    successTitle: 'Event organizer removed',
    successDescription: user.isPlatformAdmin
      ? `${user.displayName} still has platform admin access.`
      : `${user.displayName} can no longer create events as an event organizer.`,
    afterSuccess: async () => {
      await Promise.all([
        currentOrganizers.refresh(),
        loadCandidateUsers()
      ])
    }
  })
}
</script>

<template>
  <AppCard class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
    <template #header>
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-highlighted dark:text-white">
          Event organizers
        </h2>
        <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
          Review who can create events without granting platform-wide admin access.
        </p>
      </div>
    </template>

    <div class="space-y-6">
      <AppAlert
        v-if="mutationError"
        color="error"
        variant="soft"
        title="Event organizer update failed"
        :description="mutationError"
      />

      <div class="space-y-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Current event organizers
          </h3>
          <p class="text-xs text-muted">
            {{ currentEventOrganizerCount }} current
          </p>
        </div>

        <AppAlert
          v-if="currentOrganizers.error.value"
          color="error"
          variant="soft"
          title="Unable to load event organizers"
          :description="currentOrganizers.error.value.message"
        />

        <AppAlert
          v-else-if="currentOrganizers.status.value === 'pending'"
          color="neutral"
          variant="soft"
          title="Loading event organizers"
          description="Fetching the current event-organizer roster."
        />

        <div
          v-else-if="currentEventOrganizers.length > 0"
          class="grid gap-3"
        >
          <AccountRosterUserRow
            v-for="user in currentEventOrganizers"
            :key="user.id"
            :display-name="user.displayName"
            :email="user.email"
          >
            <template #badges>
              <AppBadge
                color="primary"
                variant="soft"
                class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              >
                Event organizer
              </AppBadge>
              <AppBadge
                v-if="user.isPlatformAdmin"
                color="neutral"
                variant="soft"
                class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              >
                Platform admin
              </AppBadge>
            </template>

            <template #actions>
              <AppButton
                size="sm"
                color="error"
                variant="soft"
                class="shrink-0 self-start md:self-auto"
                :loading="isPendingAction(user.id)"
                @click="removeEventOrganizer(user)"
              >
                Remove access
              </AppButton>
            </template>
          </AccountRosterUserRow>
        </div>

        <p
          v-else
          class="text-sm text-muted"
        >
          No active event organizers are configured.
        </p>
      </div>

      <div class="space-y-4 border-t border-black/8 pt-6 dark:border-white/[0.08]">
        <div class="space-y-1">
          <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Add event organizers
          </h3>
          <p class="text-sm text-muted">
            Search by name, email, or user ID. Event organizers can create events and manage only the events they create or are assigned to.
          </p>
        </div>

        <AppInput
          v-model="candidateSearchInput"
          type="search"
          name="event-organizer-candidate-search"
          autocomplete="off"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          placeholder="Search users by name, email, or user ID"
        />

        <AppAlert
          v-if="candidateUsersStatus === 'error'"
          color="error"
          variant="soft"
          title="Unable to load candidate users"
          :description="candidateUsersErrorMessage"
        />

        <div
          v-else
          class="grid gap-3"
        >
          <template v-if="candidateUsersStatus === 'pending' && candidateUsers.length === 0">
            <AccountRosterUserRowSkeleton
              v-for="index in candidateSkeletonRowCount"
              :key="`event-organizer-candidate-skeleton-${index}`"
              action-width-class="w-32"
            />
          </template>

          <template v-else>
            <AccountRosterUserRow
              v-for="user in candidateRows"
              :key="user.id"
              :display-name="user.displayName"
              :email="user.email"
              name-class="mr-1"
            >
              <template #badges>
                <AppBadge
                  v-if="user.isEventOrganizer"
                  color="primary"
                  variant="soft"
                  class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                >
                  Event organizer
                </AppBadge>
                <AppBadge
                  v-if="user.isPlatformAdmin"
                  color="neutral"
                  variant="soft"
                  class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                >
                  Platform admin
                </AppBadge>
              </template>

              <template #actions>
                <AppButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  class="shrink-0 self-start md:self-auto"
                  :disabled="isCandidateActionDisabled(user)"
                  :loading="!isCandidateActionDisabled(user) && isPendingAction(user.id)"
                  @click="isCandidateActionDisabled(user) ? undefined : addEventOrganizer(user)"
                >
                  {{ getCandidateActionLabel(user) }}
                </AppButton>
              </template>
            </AccountRosterUserRow>

            <p
              v-if="candidateRows.length === 0"
              class="text-sm text-muted"
            >
              {{ emptyCandidateMessage }}
            </p>
          </template>
        </div>

        <div class="flex flex-col items-start gap-3">
          <AppButton
            v-if="hasMoreCandidates && candidateUsersStatus !== 'error'"
            color="neutral"
            variant="outline"
            :loading="isLoadingMoreCandidates"
            @click="loadMoreCandidates"
          >
            Load more
          </AppButton>

          <AppAlert
            v-if="loadMoreCandidatesErrorMessage"
            color="warning"
            variant="soft"
            title="More users unavailable"
            :description="loadMoreCandidatesErrorMessage"
          />
        </div>
      </div>
    </div>
  </AppCard>
</template>
