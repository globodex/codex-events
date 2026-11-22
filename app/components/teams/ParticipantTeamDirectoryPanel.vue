<script setup lang="ts">
import {
  getActiveTeamMemberCount,
  formatJoinAvailabilityReason,
  getParticipantTeamDirectoryStatusBadge,
  isTeamDissolved,
  type TeamDirectoryEntry
} from '~/domains/teams/workspace'

const directoryFilter = defineModel<string>('directoryFilter', {
  required: false,
  default: 'all'
})

const props = defineProps<{
  teams: TeamDirectoryEntry[]
  maxTeamMembers: number
  createTeamHref?: string | null
  ownTeamWorkspaceHref?: string | null
  totalTeams?: number
  showLockedStatus?: boolean
  showOperationalTeamStates?: boolean
  filterOptions?: ReadonlyArray<{
    label: string
    value: string
    count?: number
  }>
  isLoadingTeams?: boolean
  teamErrorMessage?: string
  hasMoreTeams?: boolean
  isLoadingMoreTeams?: boolean
  loadMoreTeamsErrorMessage?: string
  pendingActionKey?: string | null
}>()

const emit = defineEmits<{
  joinTeam: [teamId: string]
  cancelJoinRequest: [payload: {
    teamId: string
    requestId: string | null
  }]
  loadMoreTeams: []
}>()

function isActionPending(actionKey: string) {
  return props.pendingActionKey === actionKey
}

function isDissolved(entry: TeamDirectoryEntry) {
  return isTeamDissolved(entry.team)
}

function getMemberCountLabel(entry: TeamDirectoryEntry) {
  const activeMemberCount = getActiveTeamMemberCount(entry.team)
  return isDissolved(entry) ? `${activeMemberCount} active members` : `${activeMemberCount}/${props.maxTeamMembers} members`
}

function getUnavailableReason(entry: TeamDirectoryEntry) {
  if (isDissolved(entry)) {
    return 'This team is dissolved and has no active members.'
  }

  return formatJoinAvailabilityReason(entry.team, entry.joinAvailability)
}

function getStatusBadge(entry: TeamDirectoryEntry) {
  return getParticipantTeamDirectoryStatusBadge(entry.team, {
    isFull: entry.isFull
  })
}

const directoryDescription = computed(() => props.showOperationalTeamStates
  ? 'Browse teams in this event, including dissolved teams retained for operational context.'
  : 'Browse the active teams in this event and filter the directory by team shape or joinability.'
)

function selectDirectoryFilter(nextFilter: string) {
  if (directoryFilter.value === nextFilter) {
    return
  }

  directoryFilter.value = nextFilter
}
</script>

<template>
  <AppCard
    data-testid="participant-team-directory-panel"
    class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
    :ui="{ body: 'p-5' }"
  >
    <div class="space-y-4">
      <div class="flex flex-col gap-3 border-b border-black/8 pb-3 dark:border-white/[0.08] sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-highlighted dark:text-white">
            Teams
          </h2>
          <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
            {{ directoryDescription }}
          </p>
        </div>

        <AppButton
          v-if="props.createTeamHref"
          :to="props.createTeamHref"
          color="neutral"
          variant="solid"
          trailing-icon="i-lucide-arrow-up-right"
          data-testid="participant-team-directory-create-team"
          class="self-start bg-black text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
        >
          Create Team
        </AppButton>
      </div>

      <div
        v-if="filterOptions?.length"
        class="!border !border-black/8 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 flex flex-col gap-4 rounded-xl p-2"
      >
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <AppFilterButton
            v-for="option in filterOptions"
            :key="option.value"
            :pressed="directoryFilter === option.value"
            :count="option.count"
            @click="selectDirectoryFilter(option.value)"
          >
            {{ option.label }}
          </AppFilterButton>
        </div>
      </div>

      <AppAlert
        v-if="teamErrorMessage"
        color="error"
        variant="soft"
        title="Team directory unavailable"
        :description="teamErrorMessage"
      />

      <AppAlert
        v-else-if="isLoadingTeams"
        color="neutral"
        variant="soft"
        title="Loading visible teams"
        description="The participant team directory is still resolving visible teams for this event."
      />

      <div
        v-else-if="teams.length > 0"
        class="grid gap-4"
      >
        <article
          v-for="entry in teams"
          :key="entry.team.id"
          :data-testid="`participant-team-card-${entry.team.id}`"
          class="rounded-xl border border-black/8 bg-white/78 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-white/[0.10] dark:bg-[#151515]/64 px-5 py-5"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-3">
                <h3 class="text-lg font-semibold text-highlighted">
                  {{ entry.team.name }}
                </h3>

                <AppBadge
                  v-if="isDissolved(entry)"
                  color="error"
                  variant="soft"
                >
                  Dissolved
                </AppBadge>

                <AppBadge
                  v-else-if="props.showLockedStatus"
                  color="neutral"
                  variant="outline"
                  class="border-black/16 bg-white/75 text-neutral-700 dark:border-white/[0.18] dark:bg-white/[0.03] dark:text-[#D0D0D0]"
                >
                  Locked
                </AppBadge>

                <AppBadge
                  v-else-if="getStatusBadge(entry)"
                  :color="getStatusBadge(entry)?.color"
                  variant="outline"
                  :class="getStatusBadge(entry)?.color === 'neutral' ? 'border-black/16 bg-white/75 text-neutral-700 dark:border-white/[0.18] dark:bg-white/[0.03] dark:text-[#D0D0D0]' : ''"
                >
                  {{ getStatusBadge(entry)?.label }}
                </AppBadge>

                <AppBadge
                  v-if="entry.team.workspaceMode === 'solo'"
                  color="secondary"
                  variant="outline"
                  class="border-violet-700/22 bg-violet-100 text-violet-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:border-violet-300/32 dark:bg-violet-300/14 dark:text-violet-50"
                >
                  Solo Team
                </AppBadge>

                <AppBadge
                  v-if="entry.isOwnTeam"
                  color="info"
                  :variant="entry.team.workspaceMode === 'solo' ? 'outline' : 'soft'"
                >
                  Your team
                </AppBadge>

                <AppBadge
                  v-if="entry.isFull"
                  color="warning"
                  variant="outline"
                  class="border-warning/35 bg-warning/10 text-warning shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] dark:border-warning/30 dark:bg-warning/12"
                >
                  Full
                </AppBadge>
              </div>

              <p
                v-if="entry.team.workspaceMode !== 'solo'"
                class="text-sm text-toned"
              >
                {{ getMemberCountLabel(entry) }}
              </p>

              <p
                v-if="entry.team.bio"
                class="max-w-3xl whitespace-pre-line text-sm text-muted"
              >
                {{ entry.team.bio }}
              </p>

              <p
                v-if="!entry.joinAvailability.isAllowed && getUnavailableReason(entry)"
                class="text-sm text-muted"
              >
                {{ getUnavailableReason(entry) }}
              </p>
            </div>

            <div class="flex shrink-0 flex-col items-start gap-3 sm:items-end">
              <AppButton
                v-if="entry.detailHref?.trim() && !entry.isOwnTeam"
                :to="entry.detailHref"
                color="neutral"
                class="rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 hover:text-white dark:border-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC] dark:hover:text-black"
                trailing-icon="i-lucide-arrow-up-right"
              >
                View team
              </AppButton>

              <AppButton
                v-else-if="entry.isOwnTeam && props.ownTeamWorkspaceHref"
                :to="props.ownTeamWorkspaceHref"
                color="neutral"
                class="rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 hover:text-white dark:border-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC] dark:hover:text-black"
                trailing-icon="i-lucide-arrow-up-right"
              >
                Your team
              </AppButton>

              <AppButton
                v-if="entry.hasPendingJoinRequest"
                color="warning"
                variant="soft"
                :loading="isActionPending(`cancel-join-request:${entry.pendingJoinRequestId}`)"
                :disabled="isActionPending(`cancel-join-request:${entry.pendingJoinRequestId}`)"
                :data-testid="`participant-team-cancel-join-${entry.team.id}`"
                @click="emit('cancelJoinRequest', {
                  teamId: entry.team.id,
                  requestId: entry.pendingJoinRequestId
                })"
              >
                Cancel pending request
              </AppButton>

              <AppButton
                v-else-if="entry.joinAvailability.isAllowed"
                color="success"
                trailing-icon="i-lucide-user-plus"
                class="rounded-lg bg-emerald-800 text-white shadow-sm ring-1 ring-emerald-950/20 hover:bg-emerald-900 disabled:bg-emerald-800 disabled:text-white disabled:opacity-100 dark:bg-emerald-300 dark:text-black dark:ring-emerald-100/15 dark:hover:bg-emerald-200 dark:hover:text-black dark:disabled:bg-emerald-300 dark:disabled:text-black"
                :loading="isActionPending(`join-team:${entry.team.id}`)"
                :disabled="isActionPending(`join-team:${entry.team.id}`)"
                :data-testid="`participant-team-join-${entry.team.id}`"
                @click="emit('joinTeam', entry.team.id)"
              >
                Request to join
              </AppButton>
            </div>
          </div>
        </article>
      </div>

      <AppAlert
        v-else
        color="neutral"
        variant="soft"
        title="No visible teams yet"
        :description="props.showOperationalTeamStates ? 'No teams match the current filter yet.' : 'No active teams match the current filter yet.'"
      />

      <div
        v-if="!teamErrorMessage && !isLoadingTeams && teams.length > 0"
        class="flex flex-col items-start gap-3"
      >
        <AppButton
          v-if="hasMoreTeams"
          color="neutral"
          variant="outline"
          :loading="isLoadingMoreTeams"
          data-testid="participant-team-load-more"
          @click="emit('loadMoreTeams')"
        >
          Load more teams
        </AppButton>

        <AppAlert
          v-if="loadMoreTeamsErrorMessage"
          color="error"
          variant="soft"
          title="Unable to load more teams"
          :description="loadMoreTeamsErrorMessage"
        />

        <p class="text-sm text-muted">
          Showing {{ teams.length }} of {{ totalTeams ?? teams.length }} visible teams.
        </p>
      </div>
    </div>
  </AppCard>
</template>
