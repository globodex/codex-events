<script setup lang="ts">
import type { ApiListResponse } from '~/lib/api'
import type { EventRoleUserSummary } from '~/domains/events/access'

import { useApiClient } from '~/composables/useApiClient'
import { useApiResponse } from '~/composables/useApiData'

const props = defineProps<{
  role: 'platform-admin' | 'event-organizer'
}>()

const roles = {
  'platform-admin': {
    label: 'Platform admin',
    flag: 'isPlatformAdmin',
    description: 'Review the current platform admins and grant platform-wide admin access to other active users.',
    addHint: 'Promoting someone gives them platform-wide admin access across the existing events too.',
    addedDescription: 'can now manage the platform and every event.',
    removeHint: ' Their event-specific access will stay in place.',
    removedDescription: (user: EventRoleUserSummary) =>
      `${user.displayName} no longer has platform-wide admin access. Event-specific access was left unchanged.`
  },
  'event-organizer': {
    label: 'Event organizer',
    flag: 'isEventOrganizer',
    description: 'Review who can create events without granting platform-wide admin access.',
    addHint: 'Event organizers can create events and manage only the events they create or are assigned to.',
    addedDescription: 'can now create events and manage the events they create.',
    removeHint: '',
    removedDescription: (user: EventRoleUserSummary) => user.isPlatformAdmin
      ? `${user.displayName} still has platform admin access.`
      : `${user.displayName} can no longer create events as an event organizer.`
  }
} as const

const role = computed(() => roles[props.role])
const roleNoun = computed(() => role.value.label.toLowerCase())
const endpoint = computed(() => `/api/${props.role}s`)
const apiFetch = useApiClient()
const currentRoster = useApiResponse<EventRoleUserSummary[]>(() => `${props.role}s`, endpoint)
const { mutationError, runRosterMutation, isPendingAction } = useRosterMutationRunner()

const {
  candidateSearchInput,
  appliedCandidateSearch,
  candidateUsers,
  candidateUsersStatus,
  showCandidateSkeletons,
  candidateUsersErrorMessage,
  isLoadingMoreCandidates,
  loadMoreCandidatesErrorMessage,
  hasMoreCandidates,
  loadCandidateUsers,
  loadMoreCandidates
} = useRosterCandidateSearch<EventRoleUserSummary>({
  pageSize: 20,
  requestKey: () => `${props.role}-candidates`,
  resetKey: () => props.role,
  loadPage: ({ page, pageSize, search, signal }) => apiFetch<ApiListResponse<EventRoleUserSummary>>(
    `${endpoint.value}/candidates`,
    {
      query: { page, page_size: pageSize, search: search || undefined },
      signal
    }
  )
})

function hasRole(user: EventRoleUserSummary) {
  return user[role.value.flag] === true
}

const currentUsers = computed(() => currentRoster.data.value ?? [])
const candidateRows = computed(() => candidateUsers.value.filter(user =>
  appliedCandidateSearch.value.length > 0 || !hasRole(user)
))
const emptyCandidateMessage = computed(() =>
  appliedCandidateSearch.value.length > 0
    ? 'No people match this search.'
    : hasMoreCandidates.value
      ? 'No new people are in this batch. Load more to keep looking.'
      : 'No more active users are available to add right now.'
)

async function updateAccess(user: EventRoleUserSummary, action: 'add' | 'remove') {
  const isAdding = action === 'add'
  if (!isAdding && !window.confirm(`Remove ${roleNoun.value} access for ${user.displayName}?${role.value.removeHint}`)) {
    return
  }

  await runRosterMutation({
    actionKey: user.id,
    action: async () => {
      await apiFetch(`${endpoint.value}/${user.id}`, { method: isAdding ? 'PUT' : 'DELETE' })
    },
    successTitle: `${role.value.label} ${isAdding ? 'added' : 'removed'}`,
    successDescription: isAdding
      ? `${user.displayName} ${role.value.addedDescription}`
      : role.value.removedDescription(user),
    afterSuccess: async () => {
      await Promise.all([currentRoster.refresh(), loadCandidateUsers()])
    }
  })
}
</script>

<template>
  <AppCard class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
    <template #header>
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-highlighted dark:text-white">
          {{ role.label }}s
        </h2>
        <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
          {{ role.description }}
        </p>
      </div>
    </template>

    <div class="space-y-6">
      <AppAlert
        v-if="mutationError"
        color="error"
        variant="soft"
        :title="`${role.label} update failed`"
        :description="mutationError"
      />

      <div class="space-y-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Current {{ roleNoun }}s
          </h3>
          <p
            v-if="currentRoster.status.value === 'success'"
            class="text-xs text-muted"
          >
            {{ currentUsers.length }} current
          </p>
        </div>

        <AppAlert
          v-if="currentRoster.error.value"
          color="error"
          variant="soft"
          :title="`Unable to load ${roleNoun}s`"
          :description="currentRoster.error.value.message"
        />

        <AppAlert
          v-else-if="currentRoster.status.value !== 'success'"
          color="neutral"
          variant="soft"
          :title="`Loading ${roleNoun}s`"
          :description="`Fetching the current ${props.role} roster.`"
        />

        <div
          v-else-if="currentUsers.length > 0"
          class="grid gap-3"
        >
          <AccountRosterUserRow
            v-for="user in currentUsers"
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
                {{ role.label }}
              </AppBadge>
              <AppBadge
                v-if="props.role === 'event-organizer' && user.isPlatformAdmin"
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
                @click="updateAccess(user, 'remove')"
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
          No active {{ roleNoun }}s are configured.
        </p>
      </div>

      <div class="space-y-4 border-t border-black/8 pt-6 dark:border-white/[0.08]">
        <div class="space-y-1">
          <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Add {{ roleNoun }}s
          </h3>
          <p class="text-sm text-muted">
            Search by name, email, or user ID. {{ role.addHint }}
          </p>
        </div>

        <AppInput
          v-model="candidateSearchInput"
          type="search"
          :name="`${props.role}-candidate-search`"
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
          <template v-if="showCandidateSkeletons">
            <AccountRosterUserRowSkeleton
              v-for="index in 3"
              :key="`candidate-skeleton-${index}`"
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
                  v-if="hasRole(user)"
                  color="primary"
                  variant="soft"
                  class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                >
                  {{ role.label }}
                </AppBadge>
                <AppBadge
                  v-if="props.role === 'event-organizer' && user.isPlatformAdmin"
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
                  :disabled="hasRole(user)"
                  :loading="!hasRole(user) && isPendingAction(user.id)"
                  @click="updateAccess(user, 'add')"
                >
                  {{ hasRole(user) ? `Already ${roleNoun}` : `Add ${roleNoun}` }}
                </AppButton>
              </template>
            </AccountRosterUserRow>

            <p
              v-if="candidateUsersStatus === 'success' && candidateRows.length === 0"
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
