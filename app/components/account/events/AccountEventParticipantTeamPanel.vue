<script setup lang="ts">
import type { AccountEventTeamSummary, AccountEventTeamsPage } from '#shared/domains/events/account-event-teams-page'
import type { TeamDirectoryEntry } from '~/domains/teams/workspace'

import {
  LazyTeamsParticipantTeamDirectoryPanel as LazyParticipantTeamDirectoryPanel,
  LazyTeamsParticipantTeamWorkspacePanel as LazyParticipantTeamWorkspacePanel
} from '#components'
import {
  buildAbsoluteAccountEventTeamsTabHref,
  buildAccountEventTeamsTabHref,
  buildAccountEventWorkspaceTabHref
} from '~/domains/teams/query'
import {
  getActiveTeamMemberCount,
  getCreateTeamAvailability,
  getJoinTeamAvailability,
  hasTeamReachedMemberLimit
} from '~/domains/teams/workspace'

const baseDirectoryFilterOptions = [
  { label: 'All teams', value: 'all' },
  { label: 'Open to join', value: 'open_to_join' },
  { label: 'Solo', value: 'solo' },
  { label: 'Multi-person', value: 'multi_person' },
  { label: 'Full', value: 'full' }
] as const

const props = withDefaults(defineProps<{
  page: AccountEventTeamsPage
  refreshTeams: (eventSlug: string) => Promise<void>
  selectedTeamSlug?: string | null
  showOperationalTeamStates?: boolean
}>(), {
  selectedTeamSlug: null,
  showOperationalTeamStates: false
})

const toast = useToast()
const requestedTeamSlug = computed(() => props.selectedTeamSlug?.trim().toLowerCase())
const { run, pendingActionKey, mutationError } = useTeamActions(() => props.page.event, props.refreshTeams)
const { filter, teams, meta, error, loading, hasMore, changeFilter, loadMore } = useTeamDirectory(() => props.page)

const selectedTeam = computed(() => {
  const team = props.page.selectedTeam
  return team && team.slug === requestedTeamSlug.value ? team : null
})
const ownTeamId = computed(() => props.page.ownTeamId)
const selectedSharedTeam = computed(() => selectedTeam.value?.id !== ownTeamId.value ? selectedTeam.value : null)
const pendingByTeam = computed(() => new Map(props.page.pendingJoinRequests.map(request => [request.teamId, request.id])))
const workspaceHref = computed(() => buildAccountEventWorkspaceTabHref(props.page.event.slug))
const canFormTeam = computed(() =>
  getCreateTeamAvailability(props.page.event, props.page.applicationStatus, Boolean(ownTeamId.value)).isAllowed
)
const teamFormationClosed = computed(() =>
  props.page.event.state !== 'registration_open' && props.page.event.state !== 'submission_open'
)
const hideOpenTeams = computed(() => filter.value === 'open_to_join' && !canFormTeam.value)
const directoryFilterOptions = computed(() =>
  baseDirectoryFilterOptions.map(option => ({
    ...option,
    count: option.value === 'open_to_join' && !canFormTeam.value
      ? 0
      : meta.value.filterCounts[option.value]
  }))
)

function joinAvailability(team: AccountEventTeamSummary) {
  return getJoinTeamAvailability(props.page.event, team, {
    applicationStatus: props.page.applicationStatus,
    hasTeamMembership: Boolean(ownTeamId.value),
    activeMemberCount: getActiveTeamMemberCount(team),
    hasPendingJoinRequest: pendingByTeam.value.has(team.id),
    isOwnTeam: team.id === ownTeamId.value
  })
}

const directoryEntries = computed<TeamDirectoryEntry[]>(() =>
  hideOpenTeams.value
    ? []
    : teams.value.map(team => ({
        team,
        detailHref: buildAccountEventTeamsTabHref(props.page.event.slug, team.slug),
        isOwnTeam: team.id === ownTeamId.value,
        isFull: hasTeamReachedMemberLimit(props.page.event.maxTeamMembers, getActiveTeamMemberCount(team)),
        pendingJoinRequestId: pendingByTeam.value.get(team.id) ?? null,
        joinAvailability: joinAvailability(team)
      }))
)

async function requestToJoinTeam(teamId: string) {
  if (await run(`join-team:${teamId}`, 'team-join-requests', { body: { teamId } })) {
    toast.add({
      title: 'Join request submitted',
      description: 'The team admins can now review your request.',
      color: 'success'
    })
  }
}

async function cancelJoinRequest(requestId: string) {
  if (await run(`cancel-join-request:${requestId}`, `team-join-requests/${requestId}/actions/cancel`)) {
    toast.add({
      title: 'Join request canceled',
      description: 'The pending request was canceled.',
      color: 'success'
    })
  }
}

async function copySelectedTeamLink() {
  if (!selectedTeam.value || !import.meta.client || !window.isSecureContext || !navigator.clipboard) {
    toast.add({
      title: 'Copy unavailable',
      description: 'This browser could not copy the team link right now.',
      color: 'error'
    })
    return
  }

  try {
    await navigator.clipboard.writeText(buildAbsoluteAccountEventTeamsTabHref(
      window.location.origin,
      props.page.event.slug,
      selectedTeam.value.slug
    ))

    toast.add({
      title: 'Team link copied',
      description: 'The direct team link was copied to your clipboard.',
      color: 'success'
    })
  } catch {
    toast.add({
      title: 'Copy failed',
      description: 'The team link could not be copied right now.',
      color: 'error'
    })
  }
}
</script>

<template>
  <div
    data-testid="account-event-team-panel"
    class="space-y-6"
  >
    <AppAlert
      v-if="mutationError"
      color="error"
      variant="soft"
      title="Team action failed"
      :description="mutationError"
    />

    <AppAlert
      v-if="requestedTeamSlug && !selectedTeam"
      color="warning"
      variant="soft"
      title="Selected team unavailable"
      description="The selected team from this link is not available in this event."
    />

    <div
      v-if="selectedSharedTeam"
      class="space-y-6"
    >
      <NuxtLink
        :to="buildAccountEventTeamsTabHref(props.page.event.slug)"
        class="inline-flex items-center gap-2 text-[13px] font-medium text-neutral-600 transition-colors hover:text-highlighted dark:text-[#A3A3A3] dark:hover:text-white"
      >
        <AppIcon
          name="i-lucide-arrow-left"
          class="size-4"
        />
        Back to teams
      </NuxtLink>

      <LazyParticipantTeamWorkspacePanel
        :team="selectedSharedTeam"
        :event-state="props.page.event.state"
        :max-team-members="props.page.event.maxTeamMembers"
        :is-team-locked="teamFormationClosed"
        :join-availability="joinAvailability(selectedSharedTeam)"
        :pending-join-request-id="pendingByTeam.get(selectedSharedTeam.id)"
        :pending-action-key="pendingActionKey"
        @copy-team-link="copySelectedTeamLink"
        @request-join="requestToJoinTeam"
        @cancel-join-request="cancelJoinRequest"
      />
    </div>

    <LazyParticipantTeamDirectoryPanel
      v-else
      :directory-filter="filter"
      :teams="directoryEntries"
      :max-team-members="props.page.event.maxTeamMembers"
      :create-team-href="canFormTeam ? workspaceHref : null"
      :own-team-workspace-href="ownTeamId ? workspaceHref : null"
      :total-teams="hideOpenTeams ? 0 : meta.total"
      :show-locked-status="teamFormationClosed"
      :show-operational-team-states="props.showOperationalTeamStates"
      :filter-options="directoryFilterOptions"
      :is-loading-teams="!hideOpenTeams && loading === 'filter'"
      :team-error-message="error?.page === 1 ? error.message : ''"
      :has-more-teams="!hideOpenTeams && hasMore"
      :is-loading-more-teams="loading === 'more'"
      :load-more-teams-error-message="error && error.page > 1 ? error.message : ''"
      :pending-action-key="pendingActionKey"
      @join-team="requestToJoinTeam"
      @cancel-join-request="cancelJoinRequest"
      @select-filter="changeFilter"
      @load-more-teams="loadMore"
    />
  </div>
</template>
