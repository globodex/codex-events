<script setup lang="ts">
import type {
  AdminOperationalTeam,
  AdminSubmissionDashboardFilter,
  AdminSubmissionDashboardMetrics
} from '~/domains/submissions/admin-operations'
import type { EventState } from '~/domains/events/states'

import { formatTimestamp } from '~/lib/date-formatting'
import {
  formatAdminSubmissionRowToggleLabel,
  getAdminSubmissionInterventionPolicy,
  formatSubmissionStatus,
  getSubmissionStatusColor,
  listActiveAdminOperationalTeamMembers
} from '~/domains/submissions/admin-operations'
import { formatAdminOperationalTeamProjectLabel } from '~/domains/submissions/project-labels'
import { isEventStateReached } from '~/domains/events/states'

const search = defineModel<string>('search', {
  required: true
})

const filter = defineModel<AdminSubmissionDashboardFilter>('filter', {
  required: true
})

const props = defineProps<{
  eventState: EventState
  teams: AdminOperationalTeam[]
  metrics: AdminSubmissionDashboardMetrics
  pendingActionKey?: string | null
  isLoading?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  adminWithdraw: [payload: { teamId: string, requestedByUserId: string, reason?: string }]
}>()

const expandedTeamIds = ref(new Set<string>())
const withdrawDrafts = reactive<Record<string, {
  requestedByUserId: string
  adminWithdrawReason: string
}>>({})

const hasEnteredSubmissionPhase = computed(() =>
  isEventStateReached(props.eventState, 'submission_open')
)

const summaryCards = computed(() => [
  {
    key: 'total',
    label: 'Total teams',
    value: props.metrics.totalTeams
  },
  {
    key: 'submitted-or-later',
    label: 'Submitted or later',
    value: props.metrics.submittedOrLaterTeams
  },
  {
    key: 'draft',
    label: 'Draft',
    value: props.metrics.draftTeams
  },
  {
    key: 'none',
    label: 'No record',
    value: props.metrics.noRecordTeams
  }
])

const filterOptions = computed<Array<{
  label: string
  value: AdminSubmissionDashboardFilter
  count: number
}>>(() => {
  const options: Array<{
    label: string
    value: AdminSubmissionDashboardFilter
    count: number
  }> = [
    { label: 'All', value: 'all', count: props.metrics.totalTeams },
    { label: 'No record', value: 'none', count: props.metrics.noRecordTeams },
    { label: 'Draft', value: 'draft', count: props.metrics.draftTeams },
    { label: 'Submitted', value: 'submitted', count: props.metrics.submittedTeams }
  ]

  if (props.metrics.lockedTeams > 0 || filter.value === 'locked') {
    options.push({
      label: 'Locked',
      value: 'locked',
      count: props.metrics.lockedTeams
    })
  }

  if (props.metrics.outTeams > 0 || filter.value === 'out') {
    options.push({
      label: 'Out',
      value: 'out',
      count: props.metrics.outTeams
    })
  }

  return options
})

const hasActiveSearch = computed(() => search.value.trim().length > 0)
const hasActiveFilter = computed(() => filter.value !== 'all')
const filteredCountLabel = computed(() => {
  if (props.isLoading) {
    return 'Loading...'
  }

  if (props.errorMessage) {
    return 'Unavailable'
  }

  return `${props.teams.length} shown`
})

const emptyState = computed(() => {
  if (hasActiveSearch.value || hasActiveFilter.value) {
    return {
      title: 'No matching teams',
      description: 'Try a different search or filter.'
    }
  }

  return {
    title: 'No teams yet',
    description: 'Teams appear here once approved participants start working.'
  }
})

function isExpanded(teamId: string) {
  return expandedTeamIds.value.has(teamId)
}

function toggleExpanded(teamId: string) {
  const nextExpandedTeamIds = new Set(expandedTeamIds.value)

  if (nextExpandedTeamIds.has(teamId)) {
    nextExpandedTeamIds.delete(teamId)
  } else {
    nextExpandedTeamIds.add(teamId)
  }

  expandedTeamIds.value = nextExpandedTeamIds
}

function getWithdrawDraft(team: AdminOperationalTeam) {
  const existing = withdrawDrafts[team.team.id]

  if (existing) {
    if (!existing.requestedByUserId && team.activeAdminChoices[0]) {
      existing.requestedByUserId = team.activeAdminChoices[0].userId
    }

    return existing
  }

  const next = {
    requestedByUserId: team.activeAdminChoices[0]?.userId ?? '',
    adminWithdrawReason: ''
  }

  withdrawDrafts[team.team.id] = next
  return next
}

function getWithdrawalPolicy(team: AdminOperationalTeam) {
  return getAdminSubmissionInterventionPolicy(props.eventState, team.submissionStatus)
}

function formatMetricValue(value: number) {
  if (props.isLoading) {
    return 'Loading...'
  }

  if (props.errorMessage) {
    return 'Unavailable'
  }

  return `${value}`
}

function getProjectLabel(team: AdminOperationalTeam) {
  return formatAdminOperationalTeamProjectLabel(
    team.submissionStatus,
    team.submission?.projectName,
    hasEnteredSubmissionPhase.value
  )
}

function getActiveMembers(team: AdminOperationalTeam) {
  return listActiveAdminOperationalTeamMembers(team.detail)
}

function formatMemberRole(role: 'admin' | 'member') {
  return role === 'admin' ? 'Admin' : 'Member'
}
</script>

<template>
  <div class="space-y-6">
    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="card in summaryCards"
        :key="card.key"
        class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 rounded-xl px-5 py-5"
      >
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {{ card.label }}
        </p>
        <p class="mt-2 text-xl font-semibold text-highlighted">
          {{ formatMetricValue(card.value) }}
        </p>
      </div>
    </section>

    <AppAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      title="Submission records unavailable"
      :description="errorMessage"
    />

    <AppAlert
      v-else-if="isLoading"
      color="neutral"
      variant="soft"
      title="Loading submissions"
      description="Resolving team and submission records."
    />

    <template v-else>
      <AppAlert
        v-if="!hasEnteredSubmissionPhase"
        color="neutral"
        variant="soft"
        title="Submission window not open yet"
        description="Teams can already form. No record and draft are shown as current team status, not as late-state queues."
      />

      <div class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 flex flex-col gap-4 rounded-xl p-2">
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <AppFilterButton
            v-for="option in filterOptions"
            :key="option.value"
            :pressed="filter === option.value"
            :count="option.count"
            @click="filter = option.value"
          >
            {{ option.label }}
          </AppFilterButton>
        </div>

        <div class="px-2 pb-2">
          <label
            for="admin-submission-search"
            class="sr-only"
          >
            Search teams
          </label>
          <AppInput
            id="admin-submission-search"
            v-model="search"
            type="search"
            name="admin-submission-search"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            data-1p-ignore="true"
            data-lpignore="true"
            data-bwignore="true"
            placeholder="Search team, project, admin, member, email, or user ID"
          />

          <p class="mt-2 text-sm text-muted">
            {{ filteredCountLabel }}
          </p>
        </div>
      </div>

      <AppCard class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
        <template #header>
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-highlighted">
              Teams and submissions
            </h2>
            <p class="text-sm text-muted">
              Review every team and its current submission state in one list.
            </p>
          </div>
        </template>

        <AppAlert
          v-if="teams.length === 0"
          color="neutral"
          variant="soft"
          :title="emptyState.title"
          :description="emptyState.description"
        />

        <div
          v-else
          class="divide-y divide-black/8 dark:divide-white/[0.08]"
        >
          <article
            v-for="team in teams"
            :key="team.team.id"
            :data-testid="`admin-team-${team.team.id}`"
            class="py-5 first:pt-0 last:pb-0"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 space-y-2">
                <div class="flex flex-wrap items-center gap-3">
                  <h4 class="text-lg font-semibold text-highlighted">
                    {{ team.team.name }}
                  </h4>

                  <AppBadge
                    :color="getSubmissionStatusColor(team.submissionStatus)"
                    variant="soft"
                  >
                    {{ formatSubmissionStatus(team.submissionStatus) }}
                  </AppBadge>
                </div>

                <p class="text-sm text-toned">
                  {{ getProjectLabel(team) }}
                </p>
              </div>

              <AppButton
                color="neutral"
                variant="outline"
                :label="formatAdminSubmissionRowToggleLabel(isExpanded(team.team.id))"
                :trailing-icon="isExpanded(team.team.id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                :data-testid="`admin-team-expand-toggle-${team.team.id}`"
                :aria-expanded="isExpanded(team.team.id)"
                :aria-controls="`admin-team-details-${team.team.id}`"
                class="self-center rounded-full"
                @click="toggleExpanded(team.team.id)"
              />
            </div>

            <div
              v-if="isExpanded(team.team.id)"
              :id="`admin-team-details-${team.team.id}`"
              class="mt-4 space-y-4 border-t border-black/8 pt-4 dark:border-white/[0.08]"
            >
              <AppAlert
                v-if="team.submission?.status === 'disqualified' && team.submission.disqualificationReason"
                color="warning"
                variant="soft"
                title="Disqualification reason"
                :description="team.submission.disqualificationReason"
              />

              <section class="space-y-3">
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  Team members
                </p>

                <div
                  v-if="getActiveMembers(team).length > 0"
                  class="flex flex-wrap gap-2"
                >
                  <span
                    v-for="member in getActiveMembers(team)"
                    :key="`${team.team.id}:${member.userId}`"
                    class="inline-flex max-w-full items-center gap-2 rounded-full border border-black/8 bg-white/62 px-3 py-1.5 text-sm text-toned dark:border-white/[0.08] dark:bg-black/10"
                  >
                    <span class="truncate">{{ member.label }}</span>
                    <span class="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                      {{ formatMemberRole(member.role) }}
                    </span>
                  </span>
                </div>

                <p
                  v-else
                  class="text-sm text-muted"
                >
                  No active team members.
                </p>
              </section>

              <div
                class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"
              >
                <div class="space-y-2">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Description
                  </p>
                  <p
                    v-if="team.submission?.summary"
                    class="whitespace-pre-wrap text-sm leading-6 text-toned"
                  >
                    {{ team.submission.summary }}
                  </p>
                  <p
                    v-else
                    class="text-sm text-muted"
                  >
                    {{ team.submission ? 'No description provided.' : 'No submission record yet.' }}
                  </p>
                </div>

                <div>
                  <div
                    v-if="getWithdrawalPolicy(team).canAdminWithdraw"
                    :data-testid="`admin-withdraw-team-${team.team.id}`"
                    class="space-y-4 rounded-lg border border-warning/20 bg-warning/[0.04] px-4 py-4 dark:border-warning/25 dark:bg-warning/[0.08]"
                  >
                    <div class="grid gap-4">
                      <label class="grid gap-2">
                        <span class="text-sm font-medium text-toned">Requested by team admin</span>
                        <AppSelect
                          v-model="getWithdrawDraft(team).requestedByUserId"
                        >
                          <option
                            v-for="choice in team.activeAdminChoices"
                            :key="choice.userId"
                            :value="choice.userId"
                          >
                            {{ choice.label }}
                          </option>
                        </AppSelect>
                      </label>

                      <label class="grid gap-2">
                        <span class="text-sm font-medium text-toned">Operational note</span>
                        <AppInput
                          v-model="getWithdrawDraft(team).adminWithdrawReason"
                          type="text"
                          placeholder="Requested by team due to..."
                        />
                      </label>
                    </div>

                    <AppAlert
                      v-if="team.activeAdminChoices.length === 0"
                      color="warning"
                      variant="soft"
                      title="Team-admin request required"
                      description="This action cannot be issued until the team detail exposes at least one active admin requester."
                    />

                    <AppButton
                      color="warning"
                      :data-testid="`admin-withdraw-submit-${team.team.id}`"
                      :loading="pendingActionKey === `admin-withdraw:${team.team.id}`"
                      :disabled="team.activeAdminChoices.length === 0 || (pendingActionKey !== null && pendingActionKey !== `admin-withdraw:${team.team.id}`)"
                      @click="emit('adminWithdraw', {
                        teamId: team.team.id,
                        requestedByUserId: getWithdrawDraft(team).requestedByUserId,
                        reason: getWithdrawDraft(team).adminWithdrawReason.trim() || undefined
                      })"
                    >
                      Withdraw submission
                    </AppButton>
                  </div>
                </div>
              </div>

              <div class="grid gap-3 text-sm lg:grid-cols-4">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Repository
                  </p>
                  <a
                    v-if="team.submission?.repositoryUrl"
                    :href="team.submission.repositoryUrl"
                    target="_blank"
                    rel="noreferrer"
                    class="mt-1 block break-all text-primary underline-offset-4 hover:underline"
                  >
                    {{ team.submission.repositoryUrl }}
                  </a>
                  <p
                    v-else
                    class="mt-1 text-muted"
                  >
                    {{ team.submission ? 'Not provided' : 'No submission record yet.' }}
                  </p>
                </div>

                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Demo
                  </p>
                  <a
                    v-if="team.submission?.demoUrl"
                    :href="team.submission.demoUrl"
                    target="_blank"
                    rel="noreferrer"
                    class="mt-1 block break-all text-primary underline-offset-4 hover:underline"
                  >
                    {{ team.submission.demoUrl }}
                  </a>
                  <p
                    v-else
                    class="mt-1 text-muted"
                  >
                    {{ team.submission ? 'Not provided' : 'No submission record yet.' }}
                  </p>
                </div>

                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Updated
                  </p>
                  <p class="mt-1 text-toned">
                    {{ formatTimestamp(team.submission?.updatedAt, team.submission ? 'No activity yet' : 'No submission record') }}
                  </p>
                </div>

                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Submitted
                  </p>
                  <p class="mt-1 text-toned">
                    {{ formatTimestamp(team.submission?.submittedAt, team.submission ? 'Not submitted' : 'No submission record') }}
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </AppCard>
    </template>
  </div>
</template>
