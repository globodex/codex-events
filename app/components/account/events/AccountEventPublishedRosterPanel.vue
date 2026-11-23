<script setup lang="ts">
import type { ApiListResponse } from '~/lib/api'
import type { AccountEventRostersPage } from '#shared/domains/events/account-event-rosters-page'
import type {
  EventRoleAssignment,
  EventRoleUserSummary,
  EventStaffScope
} from '~/domains/events/access'
import type {
  EventRoleRosterBadge,
  EventRoleRosterRow
} from '~/domains/events/role-roster'
import type {
  PublishedEventStaffTrack,
  PublishedEventRosterMember,
  PublishedEventRosterRole
} from '~/domains/events/published-roster'

import {
  buildAssignedRoleRosterRows,
  buildRoleRosterRows,
  deriveAdminCapableRoleFlags,
  isAdminCapableEventUser,
  listEventRoleRosterBadges
} from '~/domains/events/role-roster'
import {
  buildPublishedStaffRosterSections,
  formatPublishedStaffRosterSectionCount,
  getPublishedEventRosterLinks
} from '~/domains/events/published-roster'
import { buildProfileIconHref } from '~/domains/accounts/profile-icon'
import {
  formatStaffScopeValue,
  keepStaffScope,
  parseStaffScopeValue,
  wholeEventStaffScope
} from '~/domains/events/access'
import { useApiClient } from '~/composables/useApiClient'

const props = defineProps<{
  eventId: string
  role: PublishedEventRosterRole
  title: string
  description: string
  page: AccountEventRostersPage | null
  loadErrorMessage?: string
  refreshPage?: () => Promise<unknown> | unknown
  tracks?: PublishedEventStaffTrack[]
  selectedTrackId?: string | null
  managementEventId?: string | null
}>()

const { actor } = useAccountBootstrap()
const apiFetch = useApiClient()
const roleCandidatePageSize = 20

const {
  mutationError,
  pendingActionKey,
  runRosterMutation
} = useRosterMutationRunner()

const members = computed(() => props.role === 'judge'
  ? props.page?.publishedJudges ?? []
  : props.page?.publishedStaff ?? [])
const emptyState = computed(() => props.role === 'judge'
  ? {
      title: 'No judges published yet',
      description: 'Assigned judges will appear here once the official judge roster is set for this event.'
    }
  : {
      title: 'No staff published yet',
      description: 'Assigned staff will appear here once the official staff roster is set for this event.'
    })
const errorState = computed(() => props.role === 'judge'
  ? {
      title: 'Judge roster unavailable'
    }
  : {
      title: 'Staff roster unavailable'
    })
const errorMessage = computed(() => props.loadErrorMessage?.trim() ?? '')
const managementEventId = computed(() => props.managementEventId?.trim() ?? '')
const canManageRoster = computed(() => managementEventId.value.length > 0 && props.page?.canManageRoles === true)
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
  requestKey: () => `event-role-candidates:${managementEventId.value}`,
  resetKey: managementEventId,
  enabled: canManageRoster,
  loadPage: async ({ page, pageSize, search, signal }) => await apiFetch<ApiListResponse<EventRoleUserSummary>>(
    `/api/events/${managementEventId.value}/roles/candidates`,
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
const roleAssignments = computed(() => props.page?.roleAssignments as EventRoleAssignment[] ?? [])
const assignedRosterRows = computed(() =>
  canManageRoster.value ? buildAssignedRoleRosterRows(roleAssignments.value, props.role) : []
)
const sortedTracks = computed(() =>
  [...(props.tracks ?? [])].sort((left, right) =>
    left.displayOrder - right.displayOrder || left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
  )
)
/** The challenges or the open tracks of the event as options of the staff select, in the saved order. */
function listStaffChallengeOptions(isOpenTrack: boolean) {
  return (props.page?.staffChallengeOptions ?? [])
    .filter(option => option.isOpenTrack === isOpenTrack)
    .map(option => ({
      value: formatStaffScopeValue({ staffTrackId: null, staffChallengeId: option.id }),
      // Participants do not see a draft. Until it is published, they see the person for the whole event.
      label: option.isPublished ? option.title : `${option.title} (draft)`
    }))
}

// What an event admin can choose for a staff member besides the whole event, grouped by kind.
const staffScopeGroups = computed(() => [
  {
    label: 'Tracks',
    options: sortedTracks.value.map(track => ({
      value: formatStaffScopeValue({ staffTrackId: track.id, staffChallengeId: null }),
      label: track.name
    }))
  },
  { label: 'Challenges', options: listStaffChallengeOptions(false) },
  { label: 'Open tracks', options: listStaffChallengeOptions(true) }
].filter(group => group.options.length > 0))
const canSetStaffScope = computed(() =>
  props.role === 'staff' && canManageRoster.value && staffScopeGroups.value.length > 0
)
const staffRosterSections = computed(() => props.role === 'staff'
  ? buildPublishedStaffRosterSections({
      members: members.value,
      tracks: sortedTracks.value,
      selectedTrackId: props.selectedTrackId
    })
  : []
)
const candidateRows = computed(() =>
  canManageRoster.value
    ? buildRoleRosterRows(
        candidateUsers.value,
        roleAssignments.value,
        props.role,
        ''
      ).filter(row => appliedCandidateSearch.value.length > 0 || !row.isAssigned)
    : []
)
const addSectionTitle = computed(() =>
  props.role === 'judge' ? 'Add judges or enable judging' : 'Add staff access'
)
const addSectionDescription = computed(() =>
  props.role === 'judge'
    ? 'Search by name, email, or user ID. Admins can also review submissions when judging is enabled for their admin assignment.'
    : 'Search by name, email, or user ID. Staff and judge access stay separate unless the person is already an event admin.'
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

function getMemberProfileIconHref(member: PublishedEventRosterMember) {
  return buildProfileIconHref(
    member.id,
    member.profileIconRevision,
    props.eventId
  )
}

function getAssignmentActionKey(prefix: 'assign' | 'remove' | 'toggle', userId: string) {
  return `${props.role}:${prefix}:${userId}`
}

function findRoleAssignment(userId: string) {
  return roleAssignments.value.find(assignment => assignment.userId === userId) ?? null
}

function findCandidateUser(userId: string) {
  return candidateUsers.value.find(user => user.id === userId) ?? null
}

function findAssignedRosterRow(userId: string) {
  return assignedRosterRows.value.find(row => row.id === userId) ?? null
}

function getAssignedRosterAssignment(userId: string) {
  return findAssignedRosterRow(userId)?.assignment ?? null
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

function isPlatformAdminTarget(userId: string) {
  return findRoleAssignment(userId)?.user?.isPlatformAdmin === true
    || findCandidateUser(userId)?.isPlatformAdmin === true
}

function isAdminLikeAssignment(assignment: EventRoleAssignment | null) {
  return isAdminCapableEventUser(assignment, assignment?.user)
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
      await apiFetch(`/api/events/${managementEventId.value}/roles/${userId}`, {
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
      await apiFetch(`/api/events/${managementEventId.value}/roles/${userId}`, {
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
      await apiFetch(`/api/events/${managementEventId.value}/roles/${userId}`, {
        method: 'DELETE'
      })
    },
    successTitle,
    successDescription
  )
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

/** The value of the staff select for a staff member. */
function getMemberStaffScopeValue(userId: string) {
  const assignment = getAssignedRosterAssignment(userId)
  const value = assignment ? formatStaffScopeValue(assignment) : ''
  const isOption = staffScopeGroups.value.some(group => group.options.some(option => option.value === value))

  // A challenge that was removed from the event is not an option anymore. Participants see the
  // person for the whole event, so the select says the same.
  return isOption ? value : ''
}

function describeStaffScope(staffScope: EventStaffScope) {
  if (staffScope.staffChallengeId) {
    return 'Participants will see this staff member with the selected challenge or open track.'
  }

  return staffScope.staffTrackId
    ? 'Participants will see this staff member with the selected track.'
    : 'Participants will see this staff member for the whole event.'
}

async function updateMemberStaffScope(userId: string, value: unknown) {
  const assignment = getAssignedRosterAssignment(userId)
  const scopeValue = typeof value === 'string' ? value : ''

  if (!assignment || scopeValue === formatStaffScopeValue(assignment)) {
    return
  }

  const staffScope = parseStaffScopeValue(scopeValue)

  await patchRoleCapabilities(userId, staffScope, 'Staff display updated', describeStaffScope(staffScope))
}

function getCandidateActionLabel(row: EventRoleRosterRow) {
  if (props.role === 'judge') {
    if (row.isAssigned) {
      return row.isEventAdmin ? 'Already judging' : 'Already a judge'
    }

    if (row.isEventAdmin) {
      return 'Enable judging'
    }

    return row.assignment?.role === 'staff' ? 'Replace staff with judge' : 'Add judge'
  }

  if (row.isAssigned) {
    return row.isEventAdmin ? 'Already on staff' : 'Already staff'
  }

  if (row.isEventAdmin) {
    return 'Grant staff access'
  }

  return row.assignment?.role === 'judge' ? 'Replace judge with staff' : 'Add staff'
}

function isCandidateActionDisabled(row: EventRoleRosterRow) {
  return row.isAssigned
}

async function assignRosterAccess(userId: string) {
  const trimmedUserId = userId.trim()

  if (!trimmedUserId) {
    mutationError.value = props.role === 'judge'
      ? 'Pick a registered user before assigning judge access.'
      : 'Pick a registered user before assigning staff access.'
    return
  }

  const existingAssignment = findRoleAssignment(trimmedUserId)
  const isPlatformAdmin = isPlatformAdminTarget(trimmedUserId)

  if (props.role === 'judge' && existingAssignment?.role === 'event_admin') {
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

  if (props.role === 'judge' && isPlatformAdmin) {
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

  if (props.role === 'judge') {
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
    return
  }

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
}

async function removeRosterAccess(assignment: EventRoleAssignment) {
  if (props.role === 'judge' && assignment.role === 'event_admin') {
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

  if (props.role === 'judge' && isAdminLikeAssignment(assignment)) {
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

  if (props.role === 'judge') {
    await deleteRoleAssignment(
      assignment.userId,
      'Judge removed',
      'The judges roster was updated for this event.'
    )
    return
  }

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
}

async function removePublishedRosterMember(userId: string) {
  const assignment = findAssignedRosterRow(userId)?.assignment

  if (!assignment) {
    return
  }

  await removeRosterAccess(assignment)
}
</script>

<template>
  <AppCard class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
    <template #header>
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-highlighted">
          {{ props.title }}
        </h2>
        <p class="text-sm text-muted">
          {{ props.description }}
        </p>
      </div>
    </template>

    <div class="space-y-6">
      <AppAlert
        v-if="mutationError"
        color="error"
        variant="soft"
        title="Role update failed"
        :description="mutationError"
      />

      <AppAlert
        v-if="!props.page && !errorMessage"
        color="neutral"
        variant="soft"
        :title="props.role === 'judge' ? 'Loading judges' : 'Loading staff'"
        description="The published roster is loading."
      />

      <AppAlert
        v-else-if="errorMessage"
        color="error"
        variant="soft"
        :title="errorState.title"
        :description="errorMessage"
      />

      <AppAlert
        v-else-if="members.length === 0"
        color="neutral"
        variant="soft"
        :title="emptyState.title"
        :description="emptyState.description"
      />

      <div
        v-else-if="props.role === 'staff'"
        class="space-y-7"
      >
        <section
          v-for="section in staffRosterSections"
          :key="section.id"
          class="space-y-3"
        >
          <div
            class="flex flex-col gap-3 border-b border-black/8 pb-3 sm:flex-row sm:items-end sm:justify-between dark:border-white/[0.08]"
            :class="section.isSelectedTrack ? 'border-sky-500/30 dark:border-sky-300/30' : ''"
          >
            <div class="min-w-0 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-semibold uppercase tracking-[0.16em] text-highlighted dark:text-white">
                  {{ section.title }}
                </h3>
                <AppBadge
                  v-if="section.isSelectedTrack"
                  color="primary"
                  variant="soft"
                >
                  Your track
                </AppBadge>
              </div>
              <p
                v-if="section.description"
                class="text-sm text-muted"
              >
                {{ section.description }}
              </p>
            </div>

            <p class="shrink-0 text-xs font-medium text-muted">
              {{ formatPublishedStaffRosterSectionCount(section.members.length) }}
            </p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <article
              v-for="member in section.members"
              :key="member.id"
              class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl flex min-w-0 flex-col gap-4 rounded-lg p-4 transition dark:!border-white/[0.10] dark:!bg-[#151515]/64"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex items-start gap-3">
                  <AppAvatar
                    size="3xl"
                    :src="getMemberProfileIconHref(member)"
                    :alt="member.fullName"
                    class="shrink-0"
                  />

                  <div class="min-w-0 space-y-1 pt-0.5">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="text-base font-semibold leading-6 text-highlighted dark:text-white">
                        {{ member.fullName }}
                      </h3>
                      <AppBadge
                        v-if="isCurrentPlatformUser(member.id)"
                        color="info"
                        variant="soft"
                      >
                        You
                      </AppBadge>
                    </div>

                    <p
                      v-if="member.company"
                      class="text-sm text-muted"
                    >
                      {{ member.company }}
                    </p>
                  </div>
                </div>

                <AppButton
                  v-if="canManageRoster && findAssignedRosterRow(member.id)?.assignment"
                  size="sm"
                  color="error"
                  variant="soft"
                  class="shrink-0"
                  :loading="isPendingAction(member.id)"
                  @click="removePublishedRosterMember(member.id)"
                >
                  <AppIcon
                    name="i-lucide-trash-2"
                    class="size-4"
                  />
                  Remove
                </AppButton>
              </div>

              <p
                v-if="member.bio"
                class="text-sm leading-6 text-neutral-700 dark:text-[#C7C7C7]"
              >
                {{ member.bio }}
              </p>

              <div class="mt-auto space-y-3 pt-1">
                <label
                  v-if="canSetStaffScope && getAssignedRosterAssignment(member.id)"
                  class="block space-y-2 border-t border-black/8 pt-3 dark:border-white/[0.08]"
                >
                  <span class="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Shown to participants
                  </span>
                  <AppSelect
                    :model-value="getMemberStaffScopeValue(member.id)"
                    :disabled="isPendingAction(member.id)"
                    :aria-label="`Shown to participants: ${member.fullName}`"
                    size="sm"
                    @update:model-value="updateMemberStaffScope(member.id, $event)"
                  >
                    <option value="">
                      Whole event
                    </option>
                    <optgroup
                      v-for="group in staffScopeGroups"
                      :key="group.label"
                      :label="group.label"
                    >
                      <option
                        v-for="option in group.options"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </optgroup>
                  </AppSelect>
                </label>

                <div
                  v-if="getPublishedEventRosterLinks(member).length > 0"
                  class="flex flex-wrap gap-2"
                >
                  <a
                    v-for="link in getPublishedEventRosterLinks(member)"
                    :key="link.key"
                    :href="link.href"
                    target="_blank"
                    rel="noreferrer"
                    class="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1 text-sm text-sky-700 transition hover:border-black/20 hover:text-sky-800 dark:border-white/[0.12] dark:text-sky-300 dark:hover:border-white/[0.22] dark:hover:text-sky-200"
                  >
                    {{ link.label }}
                    <AppIcon
                      name="i-lucide-external-link"
                      class="size-3"
                    />
                  </a>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>

      <div
        v-else
        class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3"
      >
        <article
          v-for="member in members"
          :key="member.id"
          class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl flex h-full flex-col gap-5 rounded-xl p-5 transition dark:!border-white/[0.10] dark:!bg-[#151515]/64"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex items-start gap-4">
              <AppAvatar
                size="3xl"
                :src="getMemberProfileIconHref(member)"
                :alt="member.fullName"
                class="shrink-0"
              />

              <div class="min-w-0 space-y-1.5 pt-0.5">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-base font-semibold leading-6 text-highlighted dark:text-white">
                    {{ member.fullName }}
                  </h3>
                  <AppBadge
                    v-if="isCurrentPlatformUser(member.id)"
                    color="info"
                    variant="soft"
                  >
                    You
                  </AppBadge>
                </div>

                <p
                  v-if="member.company"
                  class="text-sm text-muted"
                >
                  {{ member.company }}
                </p>
              </div>
            </div>

            <AppButton
              v-if="canManageRoster && findAssignedRosterRow(member.id)?.assignment"
              size="sm"
              color="error"
              variant="soft"
              class="shrink-0"
              :loading="isPendingAction(member.id)"
              @click="removePublishedRosterMember(member.id)"
            >
              <AppIcon
                name="i-lucide-trash-2"
                class="size-4"
              />
              Remove
            </AppButton>
          </div>

          <p
            v-if="member.bio"
            class="text-sm leading-6 text-neutral-700 dark:text-[#C7C7C7]"
          >
            {{ member.bio }}
          </p>

          <div class="mt-auto space-y-3 pt-1">
            <div
              v-if="getPublishedEventRosterLinks(member).length > 0"
              class="flex flex-wrap gap-2"
            >
              <a
                v-for="link in getPublishedEventRosterLinks(member)"
                :key="link.key"
                :href="link.href"
                target="_blank"
                rel="noreferrer"
                class="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1 text-sm text-sky-700 transition hover:border-black/20 hover:text-sky-800 dark:border-white/[0.12] dark:text-sky-300 dark:hover:border-white/[0.22] dark:hover:text-sky-200"
              >
                {{ link.label }}
                <AppIcon
                  name="i-lucide-external-link"
                  class="size-3"
                />
              </a>
            </div>
          </div>
        </article>
      </div>

      <div
        v-if="canManageRoster"
        class="space-y-4 border-t border-black/8 pt-5 dark:border-white/[0.08]"
      >
        <AppAlert
          v-if="props.loadErrorMessage"
          color="error"
          variant="soft"
          title="Unable to load role assignments"
          :description="props.loadErrorMessage"
        />

        <template v-else>
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
            :name="props.role === 'judge' ? 'judge-candidate-search' : 'staff-candidate-search'"
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
                    @click="isCandidateActionDisabled(row) ? undefined : assignRosterAccess(row.id)"
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
        </template>
      </div>
    </div>
  </AppCard>
</template>
