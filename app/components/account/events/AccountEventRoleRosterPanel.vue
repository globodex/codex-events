<script setup lang="ts">
import type { ApiListResponse } from '~/lib/api'
import type {
  EventRoleAssignment,
  EventRoleUserSummary,
  EventStaffScope
} from '~/domains/events/access'
import type {
  EventRoleRosterBadge,
  EventRoleRosterRow,
  EventRosterRole
} from '~/domains/events/role-roster'
import type { AccountEventRostersPage } from '#shared/domains/events/account-event-rosters-page'

import {
  buildAssignedRoleRosterRows,
  buildRoleRosterRows,
  deriveAdminCapableRoleFlags,
  isAdminCapableEventUser,
  listEventRoleRosterBadges
} from '~/domains/events/role-roster'
import { keepStaffScope, wholeEventStaffScope } from '~/domains/events/access'
import { useApiClient } from '~/composables/useApiClient'

const props = withDefaults(defineProps<{
  eventId: string
  role: EventRosterRole
  title: string
  description: string
  emptyAssignedMessage: string
  page: AccountEventRostersPage | null
  loadErrorMessage?: string
  refreshPage?: () => Promise<unknown> | unknown
}>(), {
  loadErrorMessage: ''
})

const { actor } = useAccountBootstrap()
const apiFetch = useApiClient()
const roleCandidatePageSize = 20

const {
  mutationError,
  pendingActionKey,
  runRosterMutation
} = useRosterMutationRunner()
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
  loadMoreCandidates
} = useRosterCandidateSearch<EventRoleUserSummary>({
  pageSize: roleCandidatePageSize,
  requestKey: () => `event-role-candidates:${props.eventId}`,
  resetKey: () => `${props.eventId}:${props.role}`,
  loadPage: async ({ page, pageSize, search, signal }) => await apiFetch<ApiListResponse<EventRoleUserSummary>>(
    `/api/events/${props.eventId}/roles/candidates`,
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

const roleAssignments = computed(() => (props.page?.roleAssignments ?? []) as EventRoleAssignment[])
const assignedRows = computed(() =>
  buildAssignedRoleRosterRows(roleAssignments.value, props.role)
)
const candidateRows = computed(() =>
  buildRoleRosterRows(
    candidateUsers.value,
    roleAssignments.value,
    props.role,
    ''
  ).filter(row => appliedCandidateSearch.value.length > 0 || !row.isAssigned)
)
const adminJudgeRows = computed(() =>
  props.role === 'judge'
    ? assignedRows.value.filter(row => row.isEventAdmin)
    : []
)
const reviewOnlyJudgeRows = computed(() =>
  props.role === 'judge'
    ? assignedRows.value.filter(row => !row.isEventAdmin)
    : []
)
const currentAssignmentsTitle = computed(() => {
  if (props.role === 'judge') {
    return 'Current judges'
  }

  if (props.role === 'staff') {
    return 'Current staff'
  }

  return 'Current admins'
})
const roleLabel = computed(() => {
  if (props.role === 'judge') {
    return 'judge access'
  }

  if (props.role === 'staff') {
    return 'staff access'
  }

  return 'admin access'
})
const addSectionTitle = computed(() =>
  props.role === 'judge'
    ? 'Add judges or enable judging'
    : props.role === 'staff'
      ? 'Add staff access'
      : 'Add admins'
)
const addSectionDescription = computed(() =>
  props.role === 'judge'
    ? 'Search by name, email, or user ID. Admins can also review submissions when judging is enabled for their admin assignment.'
    : props.role === 'staff'
      ? 'Search by name, email, or user ID. Staff and judge access stay separate unless the person is already an event admin.'
      : 'Search by name, email, or user ID. Promoting a judge or staff member to admin keeps their current event capability on the admin assignment.'
)
const emptyCandidateMessage = computed(() =>
  appliedCandidateSearch.value.length > 0
    ? 'No people match this search.'
    : hasMoreCandidates.value
      ? 'No new people in this batch. Load more to keep looking.'
      : 'No more people are available to add right now.'
)
const candidateSkeletonRowCount = 3
const roleBadgeLabels: Record<EventRoleRosterBadge, string> = {
  admin: 'Admin',
  staff: 'Staff',
  judge: 'Judge',
  platform_admin: 'Platform admin'
}
const currentPlatformUserId = computed(() =>
  actor.value?.kind === 'platform_user' ? actor.value.platformUser.id : null
)

function getAssignmentActionKey(prefix: 'assign' | 'remove' | 'toggle', userId: string) {
  return `${props.role}:${prefix}:${userId}`
}

function findRoleAssignment(userId: string) {
  return roleAssignments.value.find(assignment => assignment.userId === userId) ?? null
}

function findCandidateUser(userId: string) {
  return candidateUsers.value.find(user => user.id === userId) ?? null
}

function isPlatformAdminTarget(userId: string) {
  return findRoleAssignment(userId)?.user?.isPlatformAdmin === true
    || findCandidateUser(userId)?.isPlatformAdmin === true
}

function isAdminLikeAssignment(assignment: EventRoleAssignment | null) {
  return isAdminCapableEventUser(assignment, assignment?.user)
}

async function normalizeAdminCapableAssignment(
  userId: string,
  overrides: Partial<Pick<EventRoleAssignment, 'isInJudgePool' | 'isStaff'>>,
  successTitle: string,
  successDescription: string
) {
  const assignment = findRoleAssignment(userId)
  const nextFlags = deriveAdminCapableRoleFlags(assignment, overrides)

  await putRoleAssignment(
    userId,
    'event_admin',
    nextFlags.isInJudgePool,
    nextFlags.isStaff,
    keepStaffScope(assignment, nextFlags.isStaff),
    successTitle,
    successDescription
  )
}

function getCandidateActionLabel(row: EventRoleRosterRow) {
  if (props.role === 'admin') {
    if (row.isAssigned) {
      return 'Already admin'
    }

    if (row.assignment?.role === 'judge') {
      return 'Replace judge with admin'
    }

    if (row.assignment?.role === 'staff') {
      return 'Replace staff with admin'
    }

    return 'Add admin'
  }

  if (props.role === 'staff') {
    if (row.isAssigned) {
      return row.isEventAdmin ? 'Already on staff' : 'Already staff'
    }

    if (row.isEventAdmin) {
      return 'Grant staff access'
    }

    return row.assignment?.role === 'judge' ? 'Replace judge with staff' : 'Add staff'
  }

  if (row.isAssigned) {
    return row.isEventAdmin ? 'Already judging' : 'Already a judge'
  }

  if (row.isEventAdmin) {
    return 'Enable judging'
  }

  return row.assignment?.role === 'staff' ? 'Replace staff with judge' : 'Add judge'
}

function isCandidateActionDisabled(row: EventRoleRosterRow) {
  return row.isAssigned
}

function isAssignedActionDisabled(row: EventRoleRosterRow) {
  return props.role === 'admin' && row.isPlatformAdmin
}

function getAssignedActionLabel(row: EventRoleRosterRow) {
  if (props.role === 'judge') {
    return row.isEventAdmin ? 'Stop judging' : 'Remove from judges'
  }

  if (props.role === 'staff') {
    return 'Remove staff access'
  }

  if (row.isPlatformAdmin) {
    return 'Platform admin'
  }

  return 'Remove from admins'
}

function getRoleBadges(row: EventRoleRosterRow) {
  return listEventRoleRosterBadges(row)
}

function isCurrentPlatformUser(userId: string) {
  return currentPlatformUserId.value === userId
}

function isPendingAction(
  userId: string,
  prefixes: Array<'assign' | 'remove' | 'toggle'> = ['assign', 'remove', 'toggle']
) {
  return prefixes.some(prefix => pendingActionKey.value === getAssignmentActionKey(prefix, userId))
}

async function runMutation(
  actionKey: string,
  action: () => Promise<void>,
  successTitle: string,
  successDescription: string
) {
  await runRosterMutation({
    actionKey,
    action,
    successTitle,
    successDescription,
    afterSuccess: async () => {
      await props.refreshPage?.()
    }
  })
}

async function putRoleAssignment(
  userId: string,
  role: EventRoleAssignment['role'],
  isInJudgePool: boolean,
  isStaff: boolean,
  staffScope: EventStaffScope,
  successTitle: string,
  successDescription: string
) {
  await runMutation(
    getAssignmentActionKey('assign', userId),
    async () => {
      await apiFetch(`/api/events/${props.eventId}/roles/${userId}`, {
        method: 'PUT',
        body: {
          role,
          isInJudgePool,
          isStaff,
          ...staffScope
        }
      })
    },
    successTitle,
    successDescription
  )
}

async function patchRoleCapabilities(
  userId: string,
  updates: Partial<EventStaffScope> & {
    isInJudgePool?: boolean
    isStaff?: boolean
  },
  successTitle: string,
  successDescription: string
) {
  await runMutation(
    getAssignmentActionKey('toggle', userId),
    async () => {
      await apiFetch(`/api/events/${props.eventId}/roles/${userId}`, {
        method: 'PATCH',
        body: updates
      })
    },
    successTitle,
    successDescription
  )
}

async function deleteRoleAssignment(
  userId: string,
  successTitle: string,
  successDescription: string
) {
  await runMutation(
    getAssignmentActionKey('remove', userId),
    async () => {
      await apiFetch(`/api/events/${props.eventId}/roles/${userId}`, {
        method: 'DELETE'
      })
    },
    successTitle,
    successDescription
  )
}

async function assignRole(userId: string) {
  const trimmedUserId = userId.trim()

  if (!trimmedUserId) {
    mutationError.value = `Pick a registered user before assigning ${roleLabel.value}.`
    return
  }

  const existingAssignment = findRoleAssignment(trimmedUserId)
  const isPlatformAdmin = isPlatformAdminTarget(trimmedUserId)

  if (props.role === 'admin') {
    const nextFlags = deriveAdminCapableRoleFlags(existingAssignment)

    await putRoleAssignment(
      trimmedUserId,
      'event_admin',
      nextFlags.isInJudgePool,
      nextFlags.isStaff,
      keepStaffScope(existingAssignment, nextFlags.isStaff),
      existingAssignment ? 'Admin access granted' : 'Admin added',
      existingAssignment?.role === 'judge'
        ? 'Judging stayed enabled on the new admin assignment.'
        : existingAssignment?.role === 'staff'
          ? 'Staff visibility stayed enabled on the new admin assignment.'
          : 'The admin roster was updated for this event.'
    )
    return
  }

  if (props.role === 'staff') {
    if (existingAssignment?.role === 'event_admin') {
      await patchRoleCapabilities(
        trimmedUserId,
        {
          isStaff: true
        },
        'Staff access granted',
        'This admin can now see participant and team data through the staff surface.'
      )
      return
    }

    if (isPlatformAdmin) {
      await normalizeAdminCapableAssignment(
        trimmedUserId,
        {
          isStaff: true
        },
        'Staff access granted',
        deriveAdminCapableRoleFlags(existingAssignment, { isStaff: true }).isInJudgePool
          ? 'This platform admin now has staff visibility and still has judging enabled.'
          : 'This platform admin now has staff visibility through the admin assignment.'
      )
      return
    }

    await putRoleAssignment(
      trimmedUserId,
      'staff',
      false,
      true,
      wholeEventStaffScope,
      existingAssignment?.role === 'judge' ? 'Staff access granted' : 'Staff member added',
      existingAssignment?.role === 'judge'
        ? 'Judge access was replaced with staff access.'
        : 'The staff roster was updated for this event.'
    )
    return
  }

  if (existingAssignment?.role === 'event_admin') {
    await patchRoleCapabilities(
      trimmedUserId,
      {
        isInJudgePool: true
      },
      'Judging enabled',
      'This admin can now review submissions through judge assignments.'
    )
    return
  }

  if (isPlatformAdmin) {
    await normalizeAdminCapableAssignment(
      trimmedUserId,
      {
        isInJudgePool: true
      },
      'Judging enabled',
      deriveAdminCapableRoleFlags(existingAssignment, { isInJudgePool: true }).isStaff
        ? 'This platform admin can now review submissions and still has staff visibility.'
        : 'This platform admin can now review submissions through the admin assignment.'
    )
    return
  }

  await putRoleAssignment(
    trimmedUserId,
    'judge',
    true,
    false,
    wholeEventStaffScope,
    'Judge added',
    existingAssignment?.role === 'staff'
      ? 'Staff access was replaced with judge access.'
      : 'The judges roster was updated for this event.'
  )
}

async function removeRoleAssignment(assignment: EventRoleAssignment) {
  if (props.role === 'admin') {
    await deleteRoleAssignment(
      assignment.userId,
      'Admin access removed',
      assignment.isInJudgePool && assignment.isStaff
        ? 'Staff and judging access were removed with this admin assignment.'
        : assignment.isInJudgePool
          ? 'Judging access was removed with this admin assignment.'
          : assignment.isStaff
            ? 'Staff access was removed with this admin assignment.'
            : 'The admin roster was updated for this event.'
    )
    return
  }

  if (props.role === 'staff') {
    if (assignment.role === 'event_admin') {
      await patchRoleCapabilities(
        assignment.userId,
        {
          isStaff: false
        },
        'Staff access removed',
        assignment.isInJudgePool
          ? 'This admin still has judging enabled.'
          : 'This admin no longer appears in the staff roster.'
      )
      return
    }

    if (isAdminLikeAssignment(assignment)) {
      await normalizeAdminCapableAssignment(
        assignment.userId,
        {
          isStaff: false
        },
        'Staff access removed',
        deriveAdminCapableRoleFlags(assignment, { isStaff: false }).isInJudgePool
          ? 'This platform admin still has judging enabled.'
          : 'This platform admin still appears in the admins roster.'
      )
      return
    }

    await deleteRoleAssignment(
      assignment.userId,
      'Staff access removed',
      'The staff roster was updated for this event.'
    )
    return
  }

  if (assignment.role === 'event_admin') {
    await patchRoleCapabilities(
      assignment.userId,
      {
        isInJudgePool: false
      },
      'Judging disabled',
      assignment.isStaff
        ? 'This admin still has staff access.'
        : 'This admin no longer appears in the judges roster.'
    )
    return
  }

  if (isAdminLikeAssignment(assignment)) {
    await normalizeAdminCapableAssignment(
      assignment.userId,
      {
        isInJudgePool: false
      },
      'Judging disabled',
      deriveAdminCapableRoleFlags(assignment, { isInJudgePool: false }).isStaff
        ? 'This platform admin still has staff access.'
        : 'This platform admin still appears in the admins roster.'
    )
    return
  }

  await deleteRoleAssignment(
    assignment.userId,
    'Judge removed',
    'The judges roster was updated for this event.'
  )
}
</script>

<template>
  <AppCard class="!border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
    <template #header>
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-highlighted dark:text-white">
          {{ title }}
        </h2>
        <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
          {{ description }}
        </p>
      </div>
    </template>

    <div class="space-y-4">
      <AppAlert
        v-if="mutationError"
        color="error"
        variant="soft"
        title="Role update failed"
        :description="mutationError"
      />

      <AppAlert
        v-if="props.loadErrorMessage"
        color="error"
        variant="soft"
        title="Unable to load role assignments"
        :description="props.loadErrorMessage"
      />

      <AppAlert
        v-else-if="!props.page"
        color="neutral"
        title="Loading role assignments"
      />

      <div
        v-else
        class="space-y-4"
      >
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            {{ currentAssignmentsTitle }}
          </h3>
          <p class="text-xs text-muted">
            {{ assignedRows.length }} assigned
          </p>
        </div>

        <div
          v-if="props.role === 'judge' && assignedRows.length > 0"
          class="space-y-5"
        >
          <div
            v-if="adminJudgeRows.length > 0"
            class="space-y-3"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Admins who judge
            </p>

            <AccountRosterUserRow
              v-for="row in adminJudgeRows"
              :key="row.id"
              :display-name="row.displayName"
              :email="row.email"
              name-class="mr-1"
            >
              <template #badges>
                <AppBadge
                  v-for="badge in getRoleBadges(row)"
                  :key="`${row.id}-${badge}`"
                  color="primary"
                  variant="soft"
                  class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                >
                  {{ roleBadgeLabels[badge] }}
                </AppBadge>
                <AppBadge
                  v-if="isCurrentPlatformUser(row.id)"
                  color="info"
                  variant="soft"
                >
                  You
                </AppBadge>
              </template>

              <template #actions>
                <AppButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  class="shrink-0 self-start md:self-auto"
                  :loading="isPendingAction(row.id)"
                  @click="row.assignment ? removeRoleAssignment(row.assignment) : undefined"
                >
                  {{ getAssignedActionLabel(row) }}
                </AppButton>
              </template>
            </AccountRosterUserRow>
          </div>

          <div
            v-if="adminJudgeRows.length > 0 && reviewOnlyJudgeRows.length > 0"
            class="border-t border-black/8 pt-5 dark:border-white/[0.08]"
          />

          <div
            v-if="reviewOnlyJudgeRows.length > 0"
            class="space-y-3"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Review-only judges
            </p>

            <AccountRosterUserRow
              v-for="row in reviewOnlyJudgeRows"
              :key="row.id"
              :display-name="row.displayName"
              :email="row.email"
            >
              <template #badges>
                <AppBadge
                  v-for="badge in getRoleBadges(row)"
                  :key="`${row.id}-${badge}`"
                  color="primary"
                  variant="soft"
                  class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                >
                  {{ roleBadgeLabels[badge] }}
                </AppBadge>
                <AppBadge
                  v-if="isCurrentPlatformUser(row.id)"
                  color="info"
                  variant="soft"
                >
                  You
                </AppBadge>
              </template>

              <template #actions>
                <AppButton
                  size="sm"
                  color="error"
                  variant="soft"
                  class="shrink-0 self-start md:self-auto"
                  :loading="isPendingAction(row.id)"
                  @click="row.assignment ? removeRoleAssignment(row.assignment) : undefined"
                >
                  {{ getAssignedActionLabel(row) }}
                </AppButton>
              </template>
            </AccountRosterUserRow>
          </div>
        </div>

        <div
          v-else-if="assignedRows.length > 0"
          class="grid gap-3"
        >
          <AccountRosterUserRow
            v-for="row in assignedRows"
            :key="row.id"
            :display-name="row.displayName"
            :email="row.email"
          >
            <template #badges>
              <AppBadge
                v-for="badge in getRoleBadges(row)"
                :key="`${row.id}-${badge}`"
                color="primary"
                variant="soft"
                class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
              >
                {{ roleBadgeLabels[badge] }}
              </AppBadge>
              <AppBadge
                v-if="isCurrentPlatformUser(row.id)"
                color="info"
                variant="soft"
              >
                You
              </AppBadge>
            </template>

            <template #actions>
              <AppButton
                size="sm"
                color="error"
                variant="soft"
                class="shrink-0 self-start md:self-auto"
                :disabled="isAssignedActionDisabled(row)"
                :loading="!isAssignedActionDisabled(row) && isPendingAction(row.id)"
                @click="isAssignedActionDisabled(row) ? undefined : row.assignment ? removeRoleAssignment(row.assignment) : undefined"
              >
                {{ getAssignedActionLabel(row) }}
              </AppButton>
            </template>
          </AccountRosterUserRow>
        </div>

        <p
          v-else
          class="text-sm text-muted"
        >
          {{ emptyAssignedMessage }}
        </p>
      </div>

      <div
        v-if="props.page && !props.loadErrorMessage"
        class="space-y-4 border-t border-black/8 pt-5 dark:border-white/[0.08]"
      >
        <div class="space-y-1">
          <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            {{ addSectionTitle }}
          </h3>
          <p class="text-sm text-muted">
            {{ addSectionDescription }}
          </p>
        </div>

        <AppInput
          v-model="candidateSearchInput"
          type="search"
          name="role-candidate-search"
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
              v-for="index in candidateSkeletonRowCount"
              :key="`candidate-skeleton-${index}`"
            />
          </template>

          <template v-else>
            <AccountRosterUserRow
              v-for="row in candidateRows"
              :key="row.id"
              :display-name="row.displayName"
              :email="row.email"
              name-class="mr-1"
            >
              <template #badges>
                <AppBadge
                  v-for="badge in getRoleBadges(row)"
                  :key="`${row.id}-${badge}`"
                  color="primary"
                  variant="soft"
                  class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                >
                  {{ roleBadgeLabels[badge] }}
                </AppBadge>
                <AppBadge
                  v-if="isCurrentPlatformUser(row.id)"
                  color="info"
                  variant="soft"
                >
                  You
                </AppBadge>
              </template>

              <template #actions>
                <AppButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  class="shrink-0 self-start md:self-auto"
                  :disabled="isCandidateActionDisabled(row)"
                  :loading="!isCandidateActionDisabled(row) && isPendingAction(row.id)"
                  @click="isCandidateActionDisabled(row) ? undefined : assignRole(row.id)"
                >
                  {{ getCandidateActionLabel(row) }}
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
