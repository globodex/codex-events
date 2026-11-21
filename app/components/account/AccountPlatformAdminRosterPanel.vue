<script setup lang="ts">
import type { ApiListResponse } from '~/lib/api'
import type { EventRoleUserSummary } from '~/domains/events/access'

import { getApiSubjectKey } from '~/lib/api'
import { useApiClient } from '~/composables/useApiClient'
import { useApiResponse } from '~/composables/useApiData'
import { useSessionActor } from '~/composables/useSessionActor'

const actor = useSessionActor().actor
const platformAdminCandidatePageSize = 20

const subjectKey = computed(() => getApiSubjectKey(
  actor.value.isAuthenticated ? actor.value.sessionUser.sub : null
))
const apiFetch = useApiClient()
const currentAdmins = useApiResponse<EventRoleUserSummary[]>('platform-admins', '/api/platform-admins')

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
  pageSize: platformAdminCandidatePageSize,
  requestKey: 'platform-admin-candidates',
  resetKey: subjectKey,
  loadPage: async ({ page, pageSize, search, signal }) => await apiFetch<ApiListResponse<EventRoleUserSummary>>(
    '/api/platform-admins/candidates',
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

const currentPlatformAdmins = computed(() => currentAdmins.data.value ?? [])
const currentPlatformAdminCount = computed(() => currentPlatformAdmins.value.length)
const candidateRows = computed(() =>
  candidateUsers.value.filter(user => appliedCandidateSearch.value.length > 0 || !user.isPlatformAdmin)
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
  return user.isPlatformAdmin
}

function getCandidateActionLabel(user: EventRoleUserSummary) {
  return user.isPlatformAdmin ? 'Already platform admin' : 'Add platform admin'
}

async function addPlatformAdmin(user: EventRoleUserSummary) {
  await runRosterMutation({
    actionKey: user.id,
    action: async () => {
      await apiFetch(`/api/platform-admins/${user.id}`, {
        method: 'PUT'
      })
    },
    successTitle: 'Platform admin added',
    successDescription: `${user.displayName} can now manage the platform and every event.`,
    afterSuccess: async () => {
      await Promise.all([
        currentAdmins.refresh(),
        loadCandidateUsers()
      ])
    }
  })
}

async function removePlatformAdmin(user: EventRoleUserSummary) {
  const confirmed = window.confirm(
    `Remove platform admin access for ${user.displayName}? Their event-specific access will stay in place.`
  )

  if (!confirmed) {
    return
  }

  await runRosterMutation({
    actionKey: user.id,
    action: async () => {
      await apiFetch(`/api/platform-admins/${user.id}`, {
        method: 'DELETE'
      })
    },
    successTitle: 'Platform admin removed',
    successDescription: `${user.displayName} no longer has platform-wide admin access. Event-specific access was left unchanged.`,
    afterSuccess: async () => {
      await Promise.all([
        currentAdmins.refresh(),
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
          Platform admins
        </h2>
        <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
          Review the current platform admins and grant platform-wide admin access to other active users.
        </p>
      </div>
    </template>

    <div class="space-y-6">
      <AppAlert
        v-if="mutationError"
        color="error"
        variant="soft"
        title="Platform admin update failed"
        :description="mutationError"
      />

      <div class="space-y-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Current platform admins
          </h3>
          <p class="text-xs text-muted">
            {{ currentPlatformAdminCount }} current
          </p>
        </div>

        <AppAlert
          v-if="currentAdmins.error.value"
          color="error"
          variant="soft"
          title="Unable to load platform admins"
          :description="currentAdmins.error.value.message"
        />

        <AppAlert
          v-else-if="currentAdmins.status.value === 'pending'"
          color="neutral"
          variant="soft"
          title="Loading platform admins"
          description="Fetching the current platform-admin roster."
        />

        <div
          v-else-if="currentPlatformAdmins.length > 0"
          class="grid gap-3"
        >
          <AccountRosterUserRow
            v-for="user in currentPlatformAdmins"
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
                @click="removePlatformAdmin(user)"
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
          No active platform admins are configured.
        </p>
      </div>

      <div class="space-y-4 border-t border-black/8 pt-6 dark:border-white/[0.08]">
        <div class="space-y-1">
          <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Add platform admins
          </h3>
          <p class="text-sm text-muted">
            Search by name, email, or user ID. Promoting someone gives them platform-wide admin access across the existing events too.
          </p>
        </div>

        <AppInput
          v-model="candidateSearchInput"
          type="search"
          name="platform-admin-candidate-search"
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
              :key="`platform-admin-candidate-skeleton-${index}`"
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
                  v-if="user.isPlatformAdmin"
                  color="primary"
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
                  @click="isCandidateActionDisabled(user) ? undefined : addPlatformAdmin(user)"
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
