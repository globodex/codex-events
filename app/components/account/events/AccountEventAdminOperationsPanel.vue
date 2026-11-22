<script setup lang="ts">
import type { ApiDataResponse } from '~/lib/api'
import type { AccountEventParticipantsPage } from '#shared/domains/events/account-event-participants-page'
import type { AccountEventOperationsPage } from '#shared/domains/events/account-event-operations-page'
import type { AccountEventSubmissionsPage } from '#shared/domains/events/account-event-submissions-page'
import type { AdminApplicationRecord } from '~/domains/applications/admin-application-record'
import type { EventRecord } from '~/domains/events/records'
import type {
  FinalDeliberationView,
  ShortlistEntry
} from '~/domains/outcomes/admin-outcomes'
import type { WinnerEntry } from '~/domains/outcomes/published-outcomes'
import type {
  AdminSubmissionDashboardFilter,
  AdminOperationalTeam
} from '~/domains/submissions/admin-operations'
import type { SubmissionRecord } from '~/domains/submissions/admin-submission-record'
import type { AdminTeamDetailRecord } from '~/domains/teams/admin-team-record'
import type {
  PrizeRedemptionBlindRankingEntry,
  PrizeRedemptionFinalRankingEntry,
  PrizeRedemptionRecord
} from '~/domains/prize-redemptions'

import { normalizeApiError } from '~/lib/api'
import {
  LazyAccountEventsAccountEventParticipantsPanel as LazyAccountEventParticipantsPanel,
  LazyAdminOrganismsAdminCompetitionPrizeRedemptionsPanel as LazyAdminCompetitionPrizeRedemptionsPanel
} from '#components'
import {
  buildAdminOperationalTeams,
  countActiveAdminOperationalTeams,
  filterActiveAdminOperationalTeams,
  filterAdminOperationalTeams,
  getAdminSubmissionDashboardMetrics,
  sortAdminOperationalTeamsForSubmissionDashboard
} from '~/domains/submissions/admin-operations'
import {
  formatEventState,
  getEventOperationsPhase
} from '~/domains/events/states'
import { getCurrentLifecycleControl } from '~/domains/events/lifecycle-controls'
import { buildPitchReviewCoverageEntries } from '~/domains/judging/admin-oversight'
import { formatTimestamp } from '~/lib/date-formatting'
import { useApiClient } from '~/composables/useApiClient'
import { useParticipantCheckIn } from '~/composables/useParticipantCheckIn'

type AccountEventAdminOperationsSection = 'participants' | 'submissions' | 'operations'
type LifecycleMetricCard = {
  key: string
  label: string
  value?: string
  description?: string
  breakdown?: Array<{
    label: string
    value: string
  }>
}

type LifecycleSummaryItem = {
  label: string
  value: string
  description: string
}

const props = withDefaults(defineProps<{
  eventId: string
  eventSlug: string
  section: AccountEventAdminOperationsSection
  page: AccountEventOperationsPage | AccountEventSubmissionsPage | null
  participantsPage?: AccountEventParticipantsPage | null
  canManage: boolean
  isLoading?: boolean
  // True while the server is still searching all registrations for the typed text.
  isSearchingParticipants?: boolean
  // True from "Load more" in the participant list until the longer list has arrived.
  isLoadingMoreParticipants?: boolean
  loadErrorMessage?: string
  refreshPage: (eventSlug: string) => Promise<unknown>
}>(), {
  isLoading: false,
  isSearchingParticipants: false,
  isLoadingMoreParticipants: false,
  loadErrorMessage: ''
})

const emit = defineEmits<{
  // The page owns the participant list request, so it loads the longer list.
  loadMoreParticipants: []
}>()

// Text of the participant search box. The page owns it, because it is part of the page request.
const participantSearch = defineModel<string>('participantSearch', { default: '' })

const toast = useToast()
const eventId = computed(() => props.eventId.trim())
const section = computed(() => props.section)

if (!eventId.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Event not found.'
  })
}

const showParticipantsSection = computed(() => section.value === 'participants')
const showLifecycleSection = computed(() => section.value === 'operations')
const apiFetch = useApiClient()
type ApplyStagedApplicationDecisionsResponse = ApiDataResponse<{
  appliedCount: number
  approvedCount: number
  rejectedCount: number
}>
type SubmissionMonitorData = {
  teamDetails: AdminTeamDetailRecord[]
  teamSubmissions: Array<SubmissionRecord | null>
}
type JudgeChoice = {
  value: string
  label: string
}
type PitchLineupEntry = {
  submissionId: string
  order: number
  projectName: string | null
  teamName: string | null
  rank: number | null
  status: 'upcoming' | 'live' | 'presented'
}

const mutationError = ref('')
const pendingActionKey = ref<string | null>(null)

const pageData = computed(() =>
  props.page as unknown as Partial<AccountEventOperationsPage> | null
)
const participantPageData = computed(() => props.participantsPage ?? null)
const currentEvent = computed(() => (showParticipantsSection.value
  ? participantPageData.value?.event
  : pageData.value?.event) as unknown as EventRecord | null)
const isCompetitionEvent = computed(() => currentEvent.value?.eventType === 'hackathon')
const loadCompetitionLifecycleData = computed(() => showLifecycleSection.value && isCompetitionEvent.value)
const showSubmissionsSection = computed(() => section.value === 'submissions' && isCompetitionEvent.value)
const canManage = computed(() => props.canManage)
const roleAssignments = computed(() => pageData.value?.roles?.assignments ?? [])
const assignments = computed(() => pageData.value?.assignments?.data ?? [])
const assignmentsTotal = computed(() => pageData.value?.assignments?.total ?? assignments.value.length)
const judgingSummaryData = computed(() => pageData.value?.judgingSummary ?? null)
const leaderboard = computed(() => pageData.value?.leaderboard ?? [])
const allTeams = computed(() => pageData.value?.teams?.data ?? [])
const prizes = computed(() => pageData.value?.prizes ?? [])
const applications = computed(() => {
  const page = showParticipantsSection.value ? participantPageData.value : pageData.value
  return page?.applications ?? []
})
const shortlistEntries = computed(() => (pageData.value?.shortlist?.entries ?? []) as unknown as ShortlistEntry[])
const shortlistHasSavedSelection = computed(() => pageData.value?.shortlist?.hasSavedShortlistSelection ?? false)
const finalDeliberation = computed(() => (pageData.value?.finalDeliberation ?? null) as unknown as FinalDeliberationView | null)
const finalDeliberationDraftOrderedSubmissionIds = ref<string[]>([])
const finalDeliberationHasDraftChanges = ref(false)
const winners = computed(() => (pageData.value?.winners ?? []) as unknown as WinnerEntry[])
const redemptionPage = computed(() => pageData.value?.prizeRedemptions)
const redemptions = computed(() => (redemptionPage.value?.redemptions ?? []) as unknown as PrizeRedemptionRecord[])
const prizeRedemptionBlindRankingEntries = computed(() =>
  (redemptionPage.value?.blindRankingEntries ?? []) as unknown as PrizeRedemptionBlindRankingEntry[]
)
const prizeRedemptionFinalRankingEntries = computed(() =>
  (redemptionPage.value?.finalRankingEntries ?? []) as unknown as PrizeRedemptionFinalRankingEntry[]
)
const submissionSearchInput = ref('')
const submissionStatusFilter = ref<AdminSubmissionDashboardFilter>('all')
const submissionSummaryData = computed(() => pageData.value?.submissionSummary ?? null)
const submissionMonitorData = computed<SubmissionMonitorData>(() =>
  (pageData.value?.submissionMonitor ?? {
    teamDetails: [],
    teamSubmissions: []
  }) as unknown as SubmissionMonitorData
)

const lifecycleMetrics = computed(() => {
  const lockedEntries = leaderboard.value.filter(entry => entry.submissionStatus === 'locked')

  return {
    submittedSubmissionCount: submissionSummaryData.value?.submittedOrLaterTeamCount ?? 0,
    judgePoolCount: roleAssignments.value.filter(assignment => assignment.isInJudgePool).length,
    lockedSubmissionCount: lockedEntries.length,
    activeAssignmentCount: judgingSummaryData.value?.activeAssignmentCount ?? assignments.value.length,
    lockedLeaderboardEntryCount: lockedEntries.length,
    completedReviewCount: lockedEntries.filter(entry => entry.reviewStatus === 'judge_completed').length,
    completedPitchAssignmentCount: judgingSummaryData.value?.completedPitchAssignmentCount ?? 0,
    prizeCount: prizes.value.length,
    hasCurrentWinnerTerms: Boolean(currentEvent.value?.currentTerms?.winnerTerms)
  }
})

const lifecycleControl = computed(() => {
  if (!currentEvent.value) {
    return null
  }

  return getCurrentLifecycleControl(currentEvent.value, lifecycleMetrics.value)
})

function formatLifecycleTimeframe(start: string, end: string) {
  return `${formatTimestamp(start, 'Not scheduled')} - ${formatTimestamp(end, 'Not scheduled')}`
}

const submissionOperationalTeams = computed<AdminOperationalTeam[]>(() =>
  buildAdminOperationalTeams(submissionMonitorData.value?.teamDetails ?? [], {
    teamDetails: submissionMonitorData.value?.teamDetails ?? [],
    submissions: submissionMonitorData.value?.teamSubmissions ?? []
  })
)
const activeSubmissionOperationalTeams = computed<AdminOperationalTeam[]>(() =>
  filterActiveAdminOperationalTeams(submissionOperationalTeams.value)
)
const sortedSubmissionTeams = computed(() =>
  sortAdminOperationalTeamsForSubmissionDashboard(activeSubmissionOperationalTeams.value)
)
const filteredSubmissionTeams = computed(() =>
  filterAdminOperationalTeams(sortedSubmissionTeams.value, {
    filter: submissionStatusFilter.value,
    search: submissionSearchInput.value
  })
)
const submissionDashboardMetrics = computed(() =>
  getAdminSubmissionDashboardMetrics(activeSubmissionOperationalTeams.value)
)
const operationsPhase = computed(() =>
  currentEvent.value ? getEventOperationsPhase(currentEvent.value.state) : null
)
const canLoadShortlist = computed(() =>
  Boolean(
    loadCompetitionLifecycleData.value
    && currentEvent.value
    && currentEvent.value.state === 'shortlist'
  )
)
const showAssignmentsPanel = computed(() =>
  Boolean(
    loadCompetitionLifecycleData.value
    && currentEvent.value
    && currentEvent.value.state === 'blind_review'
  )
)
const showPitchStagePanel = computed(() =>
  Boolean(loadCompetitionLifecycleData.value && currentEvent.value?.state === 'pitch')
)
const showPitchReviewPanel = computed(() =>
  Boolean(loadCompetitionLifecycleData.value && currentEvent.value?.state === 'pitch_review')
)
const showFinalDeliberationPanel = computed(() =>
  Boolean(loadCompetitionLifecycleData.value && currentEvent.value?.state === 'final_deliberation')
)
const hasSavedFinalDeliberationOrder = computed(() =>
  (finalDeliberation.value?.finalRankingSubmissionIds.length ?? 0) > 0
)
const currentFinalDeliberationOrderedSubmissionIds = computed(() => {
  if (finalDeliberationDraftOrderedSubmissionIds.value.length > 0) {
    return finalDeliberationDraftOrderedSubmissionIds.value
  }

  if ((finalDeliberation.value?.finalRankingSubmissionIds.length ?? 0) > 0) {
    return finalDeliberation.value!.finalRankingSubmissionIds
  }

  return (finalDeliberation.value?.entries ?? [])
    .filter((entry): entry is FinalDeliberationView['entries'][number] & { finalRank: number } =>
      entry.finalRank !== null
    )
    .map(entry => entry.submissionId)
})
const shouldPersistDraftOnAnnounceWinners = computed(() =>
  currentFinalDeliberationOrderedSubmissionIds.value.length > 0
  && (!hasSavedFinalDeliberationOrder.value || finalDeliberationHasDraftChanges.value)
)
const showPrizeRedemptionsPanel = computed(() =>
  Boolean(loadCompetitionLifecycleData.value && currentEvent.value && ['winners_announced', 'completed'].includes(currentEvent.value.state))
)
const judgeChoices = computed<JudgeChoice[]>(() =>
  roleAssignments.value
    .filter(assignment => assignment.isInJudgePool && Boolean(assignment.user))
    .map((assignment) => {
      const user = assignment.user!
      return {
        value: assignment.userId,
        label: `${user.displayName} (${user.email})`
      }
    })
)

watchEffect((onCleanup) => {
  if (import.meta.server || !showPitchReviewPanel.value || !canManage.value || pendingActionKey.value !== null) {
    return
  }

  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && !props.isLoading) {
      void props.refreshPage(props.eventSlug)
    }
  }, 5000)
  onCleanup(() => window.clearInterval(timer))
})

const approvedApplicationCount = computed(() =>
  applications.value.filter(application => application.status === 'approved').length
)

const rejectedApplicationCount = computed(() =>
  applications.value.filter(application => application.status === 'rejected').length
)

const totalApplicationValue = computed(() =>
  `${applications.value.length}`
)

const approvedApplicationValue = computed(() =>
  `${approvedApplicationCount.value}`
)

const rejectedApplicationValue = computed(() =>
  `${rejectedApplicationCount.value}`
)

const soloTeamCount = computed(() =>
  allTeams.value.filter(team => (team.activeMemberCount ?? 0) <= 1).length
)

const multiPersonTeamCount = computed(() =>
  allTeams.value.filter(team => (team.activeMemberCount ?? 0) > 1).length
)

const soloTeamValue = computed(() =>
  `${soloTeamCount.value}`
)

const multiPersonTeamValue = computed(() =>
  `${multiPersonTeamCount.value}`
)
const activeSubmissionTeamCount = computed(() =>
  showLifecycleSection.value
    ? submissionSummaryData.value?.totalTeams ?? 0
    : countActiveAdminOperationalTeams(submissionOperationalTeams.value)
)

const submittedSubmissionCount = computed(() =>
  submissionSummaryData.value?.submittedOrLaterTeamCount ?? 0
)

const draftSubmissionCount = computed(() =>
  submissionSummaryData.value?.statusCounts.draft ?? 0
)

const draftSubmissionValue = computed(() =>
  `${draftSubmissionCount.value}`
)

const submittedSubmissionValue = computed(() =>
  `${submittedSubmissionCount.value} / ${activeSubmissionTeamCount.value}`
)

const lockedSubmissionCount = computed(() =>
  leaderboard.value.filter(entry => entry.submissionStatus === 'locked').length
)
const rankedBlindSubmissionCount = computed(() =>
  leaderboard.value.filter(entry => entry.rank !== null).length
)

const completedReviewCount = computed(() =>
  leaderboard.value.filter(entry =>
    entry.submissionStatus === 'locked' && entry.reviewStatus === 'judge_completed'
  ).length
)

const judgingProgressValue = computed(() =>
  `${completedReviewCount.value} / ${lockedSubmissionCount.value}`
)

const judgePoolCount = computed(() =>
  roleAssignments.value.filter(assignment => assignment.isInJudgePool).length
)

const activePitchPresentationIndex = computed(() => {
  if (!currentEvent.value?.activePitchPresentationSubmissionId) {
    return null
  }

  const index = currentEvent.value.pitchPresentationSubmissionIds.findIndex(
    submissionId => submissionId === currentEvent.value?.activePitchPresentationSubmissionId
  )

  return index === -1 ? null : index
})
const leaderboardEntriesBySubmissionId = computed(() =>
  new Map(leaderboard.value.map(entry => [entry.submissionId, entry] as const))
)
const pitchLineupEntries = computed<PitchLineupEntry[]>(() => {
  if (!currentEvent.value) {
    return []
  }

  return currentEvent.value.pitchPresentationSubmissionIds.map((submissionId, index) => {
    const entry = leaderboardEntriesBySubmissionId.value.get(submissionId)
    const status = currentEvent.value?.pitchPresentationsCompletedAt
      ? 'presented'
      : activePitchPresentationIndex.value === null
        ? 'upcoming'
        : index < activePitchPresentationIndex.value
          ? 'presented'
          : index === activePitchPresentationIndex.value
            ? 'live'
            : 'upcoming'

    return {
      submissionId,
      order: index + 1,
      projectName: entry?.projectName ?? null,
      teamName: entry?.teamName ?? null,
      rank: entry?.rank ?? null,
      status
    }
  })
})
const pitchReviewCoverageEntries = computed(() => {
  if (!currentEvent.value) {
    return []
  }

  return buildPitchReviewCoverageEntries({
    finalistSubmissionIds: currentEvent.value.pitchPresentationSubmissionIds,
    leaderboardEntries: leaderboard.value,
    assignments: assignments.value,
    roleAssignments: roleAssignments.value
  })
})
const completedPitchAssignmentCount = computed(() =>
  pitchReviewCoverageEntries.value.reduce(
    (total, entry) => total + entry.completedAssignmentCount,
    0
  )
)
const pitchReviewMissingCoverageEntries = computed(() =>
  pitchReviewCoverageEntries.value.filter(entry => entry.missingJudgeLabels.length > 0)
)
const hasCompletedPitchReviews = computed(() => completedPitchAssignmentCount.value > 0)
const canStartFinalDeliberationFromPitchReview = computed(() =>
  lifecycleControl.value?.key === 'start_final_deliberation' && lifecycleControl.value.isEnabled
)
const canAdvancePitchPresentation = computed(() =>
  Boolean(
    currentEvent.value
    && currentEvent.value.state === 'pitch'
    && currentEvent.value.pitchPresentationSubmissionIds.length > 0
    && currentEvent.value.pitchPresentationsCompletedAt === null
    && (pendingActionKey.value === null || pendingActionKey.value === 'advance-pitch-presentation')
  )
)
const advancePitchPresentationLabel = computed(() => {
  if (!currentEvent.value) {
    return 'Enable next presentation'
  }

  if (currentEvent.value.pitchPresentationsCompletedAt) {
    return 'Pitch presentations complete'
  }

  if (activePitchPresentationIndex.value === null) {
    return 'Enable first presentation'
  }

  return activePitchPresentationIndex.value === currentEvent.value.pitchPresentationSubmissionIds.length - 1
    ? 'Finish pitch presentations'
    : 'Enable next presentation'
})
const pitchStageAlert = computed(() => {
  if (!currentEvent.value) {
    return {
      title: 'Live pitch stage is active',
      description: 'Pitch lineup data is still loading.'
    }
  }

  if (currentEvent.value.pitchPresentationsCompletedAt) {
    return {
      title: 'Pitch presentations are complete',
      description: 'The live lineup is finished. Start pitch review when you are ready to open judge scoring.'
    }
  }

  if (activePitchPresentationIndex.value === null) {
    return {
      title: 'No presentation enabled yet',
      description: 'Enable the first finalist from this lineup when the live pitch stage begins.'
    }
  }

  return {
    title: `Presentation ${activePitchPresentationIndex.value + 1} is live`,
    description: 'Advance the lineup when the current team finishes. Pitch review stays closed until the full lineup is completed.'
  }
})

const completedPitchPresentationCount = computed(() => {
  if (!currentEvent.value) {
    return 0
  }

  if (currentEvent.value.pitchPresentationsCompletedAt) {
    return currentEvent.value.pitchPresentationSubmissionIds.length
  }

  return activePitchPresentationIndex.value === null ? 0 : activePitchPresentationIndex.value
})

const pitchPresentationProgressValue = computed(() => {
  if (!currentEvent.value) {
    return '0 / 0'
  }

  return `${completedPitchPresentationCount.value} / ${currentEvent.value.pitchPresentationSubmissionIds.length}`
})

const pitchPresentationProgressDescription = computed(() => {
  if (!currentEvent.value || currentEvent.value.pitchPresentationSubmissionIds.length === 0) {
    return 'No finalist presentations are currently queued.'
  }

  if (currentEvent.value.pitchPresentationsCompletedAt) {
    return 'All finalist presentations are complete. Pitch review can now be opened separately.'
  }

  if (activePitchPresentationIndex.value === null) {
    return 'No finalist is enabled yet. Start the live lineup from the Operations tab.'
  }

  return `Presentation ${activePitchPresentationIndex.value + 1} is currently enabled.`
})

const averageSubmissionsPerJudgeValue = computed(() => {
  if (judgePoolCount.value === 0) {
    return 'Unavailable'
  }

  return (lockedSubmissionCount.value / judgePoolCount.value).toFixed(1)
})

const averageSubmissionsPerJudgeDescription = computed(() => {
  return judgePoolCount.value === 1
    ? '1 judge currently in the pool.'
    : `${judgePoolCount.value} judges currently in the pool.`
})

const lifecycleSummaryItems = computed<LifecycleSummaryItem[]>(() => {
  if (!currentEvent.value) {
    return []
  }

  const event = currentEvent.value

  switch (operationsPhase.value) {
    case 'registration_open':
      return [
        {
          label: 'Current status',
          value: formatEventState(event.state),
          description: isCompetitionEvent.value
            ? 'Applications are open and teams can start forming.'
            : 'Applications are open for this event.'
        },
        {
          label: 'Time frame',
          value: formatLifecycleTimeframe(event.registrationOpensAt, event.registrationClosesAt),
          description: 'Configured registration window.'
        }
      ]
    case 'submission_open':
      return [
        {
          label: 'Current status',
          value: formatEventState(event.state),
          description: 'Teams can still edit drafts and send final submissions.'
        },
        {
          label: 'Time frame',
          value: formatLifecycleTimeframe(event.submissionOpensAt!, event.submissionClosesAt!),
          description: 'Configured submission window.'
        }
      ]
    case 'judging':
      if (event.state === 'judging_preparation') {
        return [
          {
            label: 'Current status',
            value: formatEventState(event.state),
            description: 'Team formation is closed. Existing submissions can still be revised until the next judging stage starts.'
          },
          {
            label: 'Judging path',
            value: event.blindReviewCount > 0
              ? `${event.blindReviewCount} blind review${event.blindReviewCount === 1 ? '' : 's'} per submission`
              : 'Pitch only',
            description: event.pitchReviewEnabled
              ? 'The live pitch stage and post-pitch review stage are enabled for this event.'
              : 'Final ranking will be based on blind review only.'
          }
        ]
      }

      if (event.state === 'blind_review') {
        return [
          {
            label: 'Current status',
            value: formatEventState(event.state),
            description: 'Blind judging is in progress and reviewer identity remains hidden from submissions.'
          },
          {
            label: 'Next stage',
            value: event.pitchReviewEnabled ? 'Shortlist' : 'Final Deliberation',
            description: event.pitchReviewEnabled
              ? 'Admins will save the blind shortlist order and set the finalist boundary once blind reviews are complete.'
              : 'Blind scoring will feed directly into final ranking review.'
          }
        ]
      }

      if (event.state === 'shortlist') {
        return [
          {
            label: 'Current status',
            value: formatEventState(event.state),
            description: 'Blind scores are frozen and admins are choosing which submissions advance to the live pitch stage.'
          },
          {
            label: 'Next stage',
            value: 'Pitch',
            description: 'Continue from Operations once the shortlist order and finalist boundary are saved.'
          }
        ]
      }

      if (event.state === 'pitch') {
        return [
          {
            label: 'Current status',
            value: formatEventState(event.state),
            description: 'Finalist teams are presenting live. Admins enable each team one at a time and judges do not have post-pitch review assignments yet.'
          },
          {
            label: 'Next stage',
            value: 'Pitch Review',
            description: event.pitchPresentationsCompletedAt
              ? 'The live lineup is complete. Start pitch review when you are ready to open judge scoring.'
              : 'Finish the live lineup from Operations before pitch review can start.'
          }
        ]
      }

      if (event.state === 'pitch_review') {
        return [
          {
            label: 'Current status',
            value: formatEventState(event.state),
            description: 'Pitch judges can now see project and team details and submit post-pitch review scores.'
          },
          {
            label: 'Next stage',
            value: 'Final Deliberation',
            description: hasCompletedPitchReviews.value
              ? 'Final ranking review can start once you are ready to close pitch review.'
              : 'Final ranking review stays locked until at least one pitch review has been submitted.'
          }
        ]
      }

      if (event.state === 'final_deliberation') {
        return [
          {
            label: 'Current status',
            value: formatEventState(event.state),
            description: 'Combined scores are available and admins can finalize ranking without changing judge votes.'
          },
          {
            label: 'Score model',
            value: event.blindReviewCount > 0 && event.pitchReviewEnabled
              ? `${event.blindScoreWeightPercent}% blind / ${event.pitchScoreWeightPercent}% pitch`
              : event.pitchReviewEnabled
                ? 'Pitch only'
                : 'Blind review only',
            description: 'The final ranking reflects the configured judging stages for this event.'
          }
        ]
      }

      if (event.state === 'winners_announced') {
        return [
          {
            label: 'Current status',
            value: formatEventState(event.state),
            description: 'Winners are public and prize redemption can proceed.'
          },
          {
            label: 'Time frame',
            value: `After ${formatTimestamp(event.submissionClosesAt!, 'submission close')}`,
            description: 'Outcome and prize workflows stay available until the event is completed.'
          }
        ]
      }

      return [
        {
          label: 'Current status',
          value: formatEventState(event.state),
          description: 'Reviews and outcomes are now in progress.'
        },
        {
          label: 'Time frame',
          value: `After ${formatTimestamp(event.submissionClosesAt!, 'submission close')}`,
          description: 'Judging starts once the submission window has closed and continues until lifecycle completion.'
        }
      ]
    case 'completed':
      return [
        {
          label: 'Current status',
          value: formatEventState(event.state),
          description: 'The lifecycle has finished and no further transitions are available.'
        },
        {
          label: 'Time frame',
          value: isCompetitionEvent.value
            ? formatLifecycleTimeframe(event.registrationOpensAt, event.submissionClosesAt!)
            : formatLifecycleTimeframe(event.registrationOpensAt, event.registrationClosesAt),
          description: isCompetitionEvent.value
            ? 'Lifecycle window from registration opening through the submission deadline.'
            : 'Lifecycle window from registration opening through registration close.'
        }
      ]
    default:
      return [
        {
          label: 'Current status',
          value: formatEventState(event.state),
          description: 'Lifecycle controls remain available from this tab.'
        },
        {
          label: 'Time frame',
          value: isCompetitionEvent.value
            ? formatLifecycleTimeframe(event.registrationOpensAt, event.submissionClosesAt!)
            : formatLifecycleTimeframe(event.registrationOpensAt, event.registrationClosesAt),
          description: isCompetitionEvent.value
            ? 'Configured registration and submission window.'
            : 'Configured registration window.'
        }
      ]
  }
})

const lifecycleActionAvailability = computed(() => {
  const event = currentEvent.value
  const control = lifecycleControl.value

  if (!event) {
    return {
      label: 'Lifecycle status',
      message: 'No further lifecycle action is available from Operations.',
      className: 'text-toned'
    }
  }

  if (!control) {
    if (event.state === 'shortlist') {
      return {
        label: 'Continue from',
        message: 'Use Operations to save the shortlist order and start pitch.',
        className: 'text-warning'
      }
    }

    return {
      label: 'Lifecycle status',
      message: 'No further lifecycle action is available from Operations.',
      className: 'text-toned'
    }
  }

  if (control.isEnabled) {
    return {
      label: 'Available now',
      message: 'This lifecycle action can be run now.',
      className: 'text-success'
    }
  }

  switch (control.key) {
    case 'open_registration':
      if (control.code === 'registration_window_not_open_yet') {
        return {
          label: 'Available when',
          message: `The registration window starts on ${formatTimestamp(event.registrationOpensAt, 'the scheduled opening time')}.`,
          className: 'text-warning'
        }
      }

      return {
        label: 'Unavailable',
        message: `The registration window closed on ${formatTimestamp(event.registrationClosesAt, 'the scheduled closing time')}.`,
        className: 'text-warning'
      }
    case 'open_submission':
      if (control.code === 'registration_window_still_open') {
        return {
          label: 'Available when',
          message: `Registration closes on ${formatTimestamp(event.registrationClosesAt, 'the registration closing time')}. Submission can open after that, while the submission window is active.`,
          className: 'text-warning'
        }
      }

      return {
        label: 'Available when',
        message: `The submission window is active from ${formatTimestamp(event.submissionOpensAt!, 'the scheduled opening time')} to ${formatTimestamp(event.submissionClosesAt!, 'the scheduled closing time')}.`,
        className: 'text-warning'
      }
    case 'start_judging_preparation':
      if (control.code === 'submission_window_still_open') {
        return {
          label: 'Available when',
          message: `The submission window closes on ${formatTimestamp(event.submissionClosesAt!, 'the submission deadline')}. Submissions can be stopped after that.`,
          className: 'text-warning'
        }
      }

      if (control.code === 'submitted_submissions_required') {
        return {
          label: 'Available when',
          message: 'At least one team needs to send a submission before submissions can be stopped.',
          className: 'text-warning'
        }
      }

      return {
        label: 'Available when',
        message: control.reason ?? 'This lifecycle action is not available yet.',
        className: 'text-warning'
      }
    default:
      return {
        label: 'Available when',
        message: control.reason ?? 'This lifecycle action is not available yet.',
        className: 'text-warning'
      }
  }
})

const lifecycleActionHeading = computed(() =>
  lifecycleControl.value || currentEvent.value?.state !== 'shortlist'
    ? (lifecycleControl.value ? 'Next lifecycle action' : 'Lifecycle status')
    : 'Next lifecycle step'
)

const lifecycleActionLabel = computed(() => {
  if (lifecycleControl.value) {
    return lifecycleControl.value.label
  }

  if (currentEvent.value?.state === 'shortlist') {
    return 'Continue From Operations'
  }

  return 'No further lifecycle actions'
})

const lifecycleActionDescription = computed(() => {
  if (lifecycleControl.value) {
    return lifecycleControl.value.description
  }

  if (currentEvent.value?.state === 'shortlist') {
    return 'Shortlist order and finalist selection are managed directly from Operations because the next transition depends on the saved shortlist.'
  }

  return 'The event has reached a stable state with no additional lifecycle transition available from this view.'
})

const lifecycleMetricCards = computed<LifecycleMetricCard[]>(() => {
  if (!isCompetitionEvent.value) {
    switch (operationsPhase.value) {
      case 'registration_open':
      case 'completed':
        return [
          {
            key: 'applications',
            label: 'Applications',
            value: totalApplicationValue.value,
            breakdown: [
              {
                label: 'Approved',
                value: approvedApplicationValue.value
              },
              {
                label: 'Rejected',
                value: rejectedApplicationValue.value
              }
            ]
          }
        ]
      default:
        return []
    }
  }

  switch (operationsPhase.value) {
    case 'registration_open':
      return [
        {
          key: 'applications',
          label: 'Applications',
          breakdown: [
            {
              label: 'Approved',
              value: approvedApplicationValue.value
            },
            {
              label: 'Rejected',
              value: rejectedApplicationValue.value
            }
          ]
        },
        {
          key: 'teams',
          label: 'Teams',
          breakdown: [
            {
              label: 'Solo',
              value: soloTeamValue.value
            },
            {
              label: 'Multiple people',
              value: multiPersonTeamValue.value
            }
          ]
        }
      ]
    case 'submission_open':
      return [
        {
          key: 'drafts',
          label: 'Drafts Created',
          value: draftSubmissionValue.value,
          description: 'Teams that started a submission but have not sent it yet.'
        },
        {
          key: 'submissions',
          label: 'Submissions Sent',
          value: submittedSubmissionValue.value,
          description: 'Submitted projects relative to the total team count.'
        }
      ]
    case 'judging':
      if (currentEvent.value?.state === 'judging_preparation') {
        return [
          {
            key: 'submitted-projects',
            label: 'Submitted Projects',
            value: submittedSubmissionValue.value,
            description: 'Projects currently submitted and still eligible to be locked when judging starts.'
          },
          {
            key: 'judge-pool',
            label: currentEvent.value.blindReviewCount > 0 ? 'Judge Pool' : 'Judge Panel',
            value: `${judgePoolCount.value}`,
            description: averageSubmissionsPerJudgeDescription.value
          }
        ]
      }

      if (currentEvent.value?.state === 'blind_review') {
        return [
          {
            key: 'judging-progress',
            label: 'Blind Reviews Complete',
            value: judgingProgressValue.value,
            description: 'Locked submissions with a completed blind-review outcome.'
          },
          {
            key: 'judge-load',
            label: 'Average Per Judge',
            value: averageSubmissionsPerJudgeValue.value,
            description: averageSubmissionsPerJudgeDescription.value
          }
        ]
      }

      if (currentEvent.value?.state === 'shortlist') {
        return [
          {
            key: 'locked-submissions',
            label: 'Blind-Ranked Submissions',
            value: `${rankedBlindSubmissionCount.value}`,
            description: 'Ranked blind-review submissions available for shortlist ordering and finalist selection.'
          },
          {
            key: 'judge-load',
            label: 'Judge Pool',
            value: `${judgePoolCount.value}`,
            description: averageSubmissionsPerJudgeDescription.value
          }
        ]
      }

      if (currentEvent.value?.state === 'pitch') {
        return [
          {
            key: 'pitch-progress',
            label: 'Pitch Progress',
            value: pitchPresentationProgressValue.value,
            description: pitchPresentationProgressDescription.value
          },
          {
            key: 'judge-pool',
            label: 'Judge Panel',
            value: `${judgePoolCount.value}`,
            description: averageSubmissionsPerJudgeDescription.value
          }
        ]
      }

      if (currentEvent.value?.state === 'pitch_review' || currentEvent.value?.state === 'final_deliberation' || currentEvent.value?.state === 'winners_announced') {
        return [
          {
            key: 'locked-submissions',
            label: 'Submitted Projects',
            value: `${lockedSubmissionCount.value}`,
            description: 'Projects that remain in competition after submissions were locked.'
          },
          {
            key: 'judge-pool',
            label: 'Judge Panel',
            value: `${judgePoolCount.value}`,
            description: averageSubmissionsPerJudgeDescription.value
          }
        ]
      }

      return [
        {
          key: 'locked-submissions',
          label: 'Submitted Projects',
          value: `${lockedSubmissionCount.value}`,
          description: 'Projects that remain in competition after submissions were locked.'
        },
        {
          key: 'judge-pool',
          label: 'Judge Pool',
          value: `${judgePoolCount.value}`,
          description: averageSubmissionsPerJudgeDescription.value
        }
      ]
    case 'completed':
      return [
        {
          key: 'applications',
          label: 'Applications',
          value: totalApplicationValue.value,
          description: 'Final application totals for the completed event.',
          breakdown: [
            {
              label: 'Approved',
              value: approvedApplicationValue.value
            },
            {
              label: 'Rejected',
              value: rejectedApplicationValue.value
            }
          ]
        },
        {
          key: 'submissions',
          label: 'Submitted Projects',
          value: submittedSubmissionValue.value,
          description: 'Submitted projects relative to the total team count.'
        }
      ]
    default:
      return []
  }
})

async function runMutation(
  actionKey: string,
  action: () => Promise<unknown>,
  options?: {
    title: string
    description: string
  }
) {
  const eventSlug = props.eventSlug
  mutationError.value = ''
  pendingActionKey.value = actionKey
  const scrollPosition = import.meta.client
    ? {
        left: window.scrollX,
        top: window.scrollY
      }
    : null

  try {
    await action()

    if (options) {
      toast.add({
        title: options.title,
        description: options.description,
        color: 'success'
      })
    }

    await props.refreshPage(eventSlug)
  } catch (error) {
    mutationError.value = normalizeApiError(error).message
  } finally {
    pendingActionKey.value = null

    if (scrollPosition) {
      await nextTick()
      window.scrollTo({
        left: scrollPosition.left,
        top: scrollPosition.top
      })
    }
  }
}

type ShortlistSelectionPayload = {
  orderedSubmissionIds: string[]
  finalistSubmissionIds: string[]
}

async function persistShortlistSelection(payload: ShortlistSelectionPayload) {
  await apiFetch(`/api/events/${eventId.value}/shortlist/actions/select-finalists`, {
    method: 'POST',
    body: payload
  })
}

async function selectFinalists(payload: ShortlistSelectionPayload) {
  await runMutation(
    'shortlist-select',
    async () => {
      await persistShortlistSelection(payload)
    },
    {
      title: 'Pitch finalists updated',
      description: 'The saved shortlist order and finalist boundary have been updated for pitch review.'
    }
  )
}

async function startPitch(payload: ShortlistSelectionPayload) {
  if (!shortlistHasSavedSelection.value && import.meta.client) {
    const confirmed = window.confirm(
      [
        'Save the current shortlist and continue to pitch?',
        'This shortlist has not been saved yet. Continuing will save the current finalist boundary and open the live pitch stage.'
      ].join('\n\n')
    )

    if (!confirmed) {
      return
    }
  }

  await runMutation(
    'start-pitch',
    async () => {
      if (!shortlistHasSavedSelection.value || shortlistEntriesChanged(payload)) {
        await persistShortlistSelection(payload)
      }

      await apiFetch(`/api/events/${eventId.value}/actions/start-pitch`, {
        method: 'POST'
      })
    },
    {
      title: 'Pitch started',
      description: 'The live finalist pitch stage is now open. Enable each presentation from the lineup before opening pitch review.'
    }
  )
}

function shortlistEntriesChanged(payload: ShortlistSelectionPayload) {
  const currentOrderedSubmissionIds = shortlistEntries.value.map(entry => entry.submissionId)
  const currentFinalistSubmissionIds = shortlistEntries.value
    .filter(entry => entry.isPitchFinalist)
    .map(entry => entry.submissionId)

  return (
    payload.orderedSubmissionIds.length !== currentOrderedSubmissionIds.length
    || payload.finalistSubmissionIds.length !== currentFinalistSubmissionIds.length
    || payload.orderedSubmissionIds.some((submissionId, index) => submissionId !== currentOrderedSubmissionIds[index])
    || payload.finalistSubmissionIds.some((submissionId, index) => submissionId !== currentFinalistSubmissionIds[index])
  )
}

function syncFinalDeliberationDraft(payload: {
  orderedSubmissionIds: string[]
  hasDraftChanges: boolean
}) {
  finalDeliberationDraftOrderedSubmissionIds.value = payload.orderedSubmissionIds
  finalDeliberationHasDraftChanges.value = payload.hasDraftChanges
}

async function reassignAssignment(payload: { assignmentId: string, judgeUserId?: string, reason?: string }) {
  await runMutation(
    `reassign:${payload.assignmentId}`,
    async () => {
      await apiFetch(
        `/api/events/${eventId.value}/judging/assignments/${payload.assignmentId}/actions/reassign`,
        {
          method: 'POST',
          body: payload
        }
      )
    },
    {
      title: 'Assignment reassigned',
      description: 'The blind review assignment has been moved to a different judge.'
    }
  )
}

async function forceSkipAssignment(payload: { assignmentId: string, reason?: string }) {
  await runMutation(
    `force-skip:${payload.assignmentId}`,
    async () => {
      await apiFetch(
        `/api/events/${eventId.value}/judging/assignments/${payload.assignmentId}/actions/force-skip`,
        {
          method: 'POST',
          body: {
            reason: payload.reason
          }
        }
      )
    },
    {
      title: 'Assignment force-skipped',
      description: 'The active blind review was skipped and redistributed.'
    }
  )
}

async function advancePitchPresentation() {
  if (!currentEvent.value) {
    return
  }

  const wasNotStarted = activePitchPresentationIndex.value === null
  const wasLastPresentation = activePitchPresentationIndex.value !== null
    && activePitchPresentationIndex.value === currentEvent.value.pitchPresentationSubmissionIds.length - 1

  await runMutation(
    'advance-pitch-presentation',
    async () => {
      await apiFetch(`/api/events/${eventId.value}/actions/advance-pitch-presentation`, {
        method: 'POST'
      })
    },
    {
      title: wasNotStarted
        ? 'Pitch presentation enabled'
        : wasLastPresentation
          ? 'Pitch presentations completed'
          : 'Pitch presentation advanced',
      description: wasNotStarted
        ? 'The first finalist is now enabled to present.'
        : wasLastPresentation
          ? 'The live lineup is complete. Pitch review can now be opened separately.'
          : 'The next finalist is now enabled to present.'
    }
  )
}

async function startFinalDeliberation() {
  if (currentEvent.value?.state === 'pitch_review') {
    if (!hasCompletedPitchReviews.value) {
      return
    }

    if (import.meta.client && pitchReviewMissingCoverageEntries.value.length > 0) {
      const confirmed = window.confirm([
        'Are you sure you want to proceed to the final deliberation?',
        ...pitchReviewMissingCoverageEntries.value.map(entry =>
          `${entry.projectLabel} was not reviewed by ${entry.missingJudgeLabels.join(', ')}.`
        )
      ].join('\n'))

      if (!confirmed) {
        return
      }
    }
  }

  await runMutation(
    'start-final-deliberation',
    async () => {
      await apiFetch(`/api/events/${eventId.value}/actions/start-final-deliberation`, {
        method: 'POST'
      })
    },
    {
      title: 'Final deliberation started',
      description: 'The final weighted ranking is now ready for admin review.'
    }
  )
}

async function reorderFinalDeliberation(orderedSubmissionIds: string[]) {
  await runMutation(
    'final-deliberation-reorder',
    async () => {
      await apiFetch(`/api/events/${eventId.value}/final-deliberation/actions/reorder`, {
        method: 'POST',
        body: {
          orderedSubmissionIds
        }
      })
    },
    {
      title: 'Final order updated',
      description: 'The final ranking order has been updated without changing any judge scores.'
    }
  )
}

async function announceWinners() {
  if (!finalDeliberation.value) {
    await props.refreshPage(props.eventSlug)
  }

  if (!finalDeliberation.value) {
    return
  }

  if (import.meta.client && !hasSavedFinalDeliberationOrder.value) {
    const confirmed = window.confirm([
      'Announce winners and save the current final order?',
      'This final order has not been saved yet. Continuing will save it and publish the winners.'
    ].join('\n\n'))

    if (!confirmed) {
      return
    }
  }

  await runMutation(
    'announce-winners',
    async () => {
      await apiFetch(`/api/events/${eventId.value}/actions/announce-winners`, {
        method: 'POST',
        ...(shouldPersistDraftOnAnnounceWinners.value
          ? {
              body: {
                orderedSubmissionIds: currentFinalDeliberationOrderedSubmissionIds.value
              }
            }
          : {})
      })
    },
    {
      title: 'Winners announced',
      description: 'The final ranking is now published and prize redemption has been initialized when configured.'
    }
  )
}

function postApplicationDecision(application: AdminApplicationRecord, decision: 'approve' | 'reject') {
  return apiFetch(`/api/events/${application.eventId}/applications/${application.id}/actions/${decision}`, {
    method: 'POST'
  })
}

function stageApplicationDecision(application: AdminApplicationRecord, decision: 'approve' | 'reject') {
  const status = decision === 'approve' ? 'approved' : 'rejected'
  return runMutation(`stage:${status}:${application.id}`, () => postApplicationDecision(application, decision))
}

const checkInParticipant = useParticipantCheckIn(pendingActionKey, props.refreshPage)

async function withdrawApplication(application: AdminApplicationRecord) {
  const availability = application.adminWithdrawal

  if (!import.meta.client || !availability?.isAllowed) {
    return
  }

  const participantLabel = application.user?.displayName ?? application.user?.email ?? application.userId
  const warningLines = [
    `Withdraw ${participantLabel} from this event?`
  ]

  if (availability.teamAction === 'remove_member') {
    warningLines.push('This will also remove the participant from their active team.')
  }

  if (availability.warning) {
    warningLines.push(availability.warning)
  }

  const confirmed = window.confirm(warningLines.join('\n\n'))

  if (!confirmed) {
    return
  }

  await runMutation(
    `withdraw:${application.id}`,
    async () => await apiFetch(
      `/api/events/${application.eventId}/applications/${application.id}/actions/withdraw`,
      {
        method: 'POST'
      }
    ),
    {
      title: 'Participant withdrawn',
      description: 'The participant application was withdrawn and any related side effects were applied.'
    }
  )
}

async function undoApplicationWithdrawal(application: AdminApplicationRecord) {
  await runMutation(
    `undo-withdrawal:${application.id}`,
    async () => await apiFetch(
      `/api/events/${application.eventId}/applications/${application.id}/actions/undo-withdrawal`,
      {
        method: 'POST'
      }
    ),
    {
      title: 'Withdrawal undone',
      description: 'The participant has re-entered the registration flow.'
    }
  )
}

async function approveApplicationGroup(applicationsToApprove: AdminApplicationRecord[]) {
  const submittedApplications = applicationsToApprove.filter(application => application.status === 'submitted')
  if (submittedApplications.length === 0) return

  // When every member is already selected, the same action clears the team's approval.
  const unselected = submittedApplications.filter(application => application.preApprovalStatus !== 'approved')
  const targetApplications = unselected.length ? unselected : submittedApplications
  const sortedApplicationIds = submittedApplications
    .map(application => application.id)
    .sort((left, right) => left.localeCompare(right))

  await runMutation(`stage:approved-team:${sortedApplicationIds.join('__')}`, async () => {
    const results = await Promise.allSettled(targetApplications.map(application => postApplicationDecision(application, 'approve')))
    const failed = results.find(result => result.status === 'rejected')
    if (failed) {
      if (results.every(result => result.status === 'rejected')) throw failed.reason
      // Some decisions were saved. Show the error and let the normal page refresh show which ones.
      mutationError.value = normalizeApiError(failed.reason).message
    }
  })
}

async function applyStagedApplicationDecisions() {
  await runMutation(
    'apply-staged-decisions',
    async () => {
      const response = await apiFetch<ApplyStagedApplicationDecisionsResponse>(
        `/api/events/${eventId.value}/applications/actions/apply-staged-decisions`,
        {
          method: 'POST'
        }
      )

      if (response.data.appliedCount === 0) {
        throw createError({
          statusCode: 409,
          statusMessage: 'There are no staged decisions to apply.'
        })
      }
    },
    {
      title: 'Staged decisions applied',
      description: 'Application outcomes were applied and participant emails were queued.'
    }
  )
}

async function adminWithdrawSubmission(payload: {
  teamId: string
  requestedByUserId: string
  reason?: string
}) {
  await runMutation(
    `admin-withdraw:${payload.teamId}`,
    async () => {
      await apiFetch(`/api/events/${eventId.value}/teams/${payload.teamId}/submission/actions/admin-withdraw`, {
        method: 'POST',
        body: payload
      })
    },
    {
      title: 'Submission admin-withdrawn',
      description: 'The submission has been removed from competition on a recorded team-admin request.'
    }
  )
}

async function disqualifySubmission(payload: {
  teamId: string
  reason?: string
}) {
  await runMutation(
    `disqualify:${payload.teamId}`,
    async () => {
      await apiFetch(`/api/events/${eventId.value}/teams/${payload.teamId}/submission/actions/disqualify`, {
        method: 'POST',
        body: {
          reason: payload.reason
        }
      })
    },
    {
      title: 'Submission disqualified',
      description: 'The submission has been removed from competition through the admin workflow.'
    }
  )
}

async function runLifecycleAction() {
  if (!lifecycleControl.value) {
    return
  }

  if (
    lifecycleControl.value.key === 'start_final_deliberation'
    && currentEvent.value?.state === 'pitch_review'
  ) {
    await startFinalDeliberation()
    return
  }

  if (
    lifecycleControl.value.key === 'announce_winners'
    && currentEvent.value?.state === 'final_deliberation'
  ) {
    await announceWinners()
    return
  }

  await runMutation(
    'lifecycle',
    async () => {
      await apiFetch(lifecycleControl.value!.endpoint, {
        method: 'POST'
      })
    },
    {
      title: 'Lifecycle updated',
      description: `${lifecycleControl.value.label} completed successfully.`
    }
  )
}
</script>

<template>
  <div
    class="space-y-8"
    :aria-busy="props.isLoading"
  >
    <AppAlert
      v-if="mutationError"
      color="error"
      variant="soft"
      title="Admin operation failed"
      :description="mutationError"
    />

    <AppAlert
      v-if="props.loadErrorMessage"
      color="error"
      variant="soft"
      title="Unable to load event"
      :description="props.loadErrorMessage"
    />

    <p
      v-else-if="!currentEvent"
      role="status"
      class="py-6 text-sm text-muted"
    >
      Loading event…
    </p>

    <AppAlert
      v-else-if="!canManage"
      color="warning"
      variant="soft"
      title="Admin access required"
      description="You can see this event, but only its admins can use these tools."
    />

    <template v-else-if="currentEvent">
      <section
        v-if="showLifecycleSection"
        class="space-y-4"
      >
        <div
          v-if="lifecycleMetricCards.length > 0"
          class="grid gap-4 md:grid-cols-2"
        >
          <div
            v-for="card in lifecycleMetricCards"
            :key="card.key"
            class="flex h-full flex-col gap-4 rounded-xl !border !border-black/8 !bg-white/78 px-5 py-5 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64"
          >
            <div class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                {{ card.label }}
              </p>
              <p
                v-if="card.value"
                class="text-3xl font-semibold text-highlighted"
              >
                {{ card.value }}
              </p>
              <p
                v-if="card.description"
                class="text-sm text-toned"
              >
                {{ card.description }}
              </p>
            </div>

            <div
              v-if="card.breakdown?.length"
              class="grid gap-3 sm:grid-cols-2"
            >
              <div
                v-for="row in card.breakdown"
                :key="`${card.key}-${row.label}`"
                class="rounded-lg border border-black/8 bg-white/62 px-4 py-3 dark:border-white/[0.08] dark:bg-black/10"
              >
                <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {{ row.label }}
                </p>
                <p class="mt-1 text-lg font-semibold text-highlighted">
                  {{ row.value }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <LazyAdminCompetitionShortlistPanel
          v-if="canLoadShortlist"
          :event-state="currentEvent.state"
          :shortlist="shortlistEntries"
          :pending-action-key="pendingActionKey"
          @select-finalists="selectFinalists"
          @start-pitch="startPitch"
        />

        <AppCard
          v-if="!canLoadShortlist"
          class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64"
        >
          <div class="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div class="lg:pr-6">
              <div class="grid gap-5 sm:grid-cols-2">
                <div
                  v-for="item in lifecycleSummaryItems"
                  :key="item.label"
                  class="space-y-2"
                >
                  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    {{ item.label }}
                  </p>
                  <p class="text-base font-semibold text-highlighted">
                    {{ item.value }}
                  </p>
                  <p class="text-sm text-toned">
                    {{ item.description }}
                  </p>
                </div>
              </div>
            </div>

            <div class="space-y-4 border-t border-black/8 pt-5 dark:border-white/[0.08] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
              <div class="space-y-1">
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  {{ lifecycleActionHeading }}
                </p>
                <h3 class="text-base font-semibold text-highlighted">
                  {{ lifecycleActionLabel }}
                </h3>
                <p class="text-sm text-toned">
                  {{ lifecycleActionDescription }}
                </p>
              </div>

              <div class="space-y-1">
                <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {{ lifecycleActionAvailability.label }}
                </p>
                <p
                  class="text-sm"
                  :class="lifecycleActionAvailability.className"
                >
                  {{ lifecycleActionAvailability.message }}
                </p>
              </div>

              <AppButton
                v-if="lifecycleControl"
                :disabled="!lifecycleControl.isEnabled"
                color="primary"
                size="md"
                class="justify-center sm:justify-start"
                @click="runLifecycleAction"
              >
                {{ lifecycleControl.label }}
              </AppButton>
            </div>
          </div>
        </AppCard>

        <LazyAdminCompetitionAssignmentsPanel
          v-if="showAssignmentsPanel"
          :event-state="currentEvent.state"
          :assignments="assignments"
          :total-assignments="assignmentsTotal"
          :judge-choices="judgeChoices"
          :pending-action-key="pendingActionKey"
          @reassign="reassignAssignment"
          @force-skip="forceSkipAssignment"
        />

        <LazyAdminCompetitionPitchStagePanel
          v-if="showPitchStagePanel"
          :entries="pitchLineupEntries"
          :alert="pitchStageAlert"
          :can-advance="canAdvancePitchPresentation"
          :advance-label="advancePitchPresentationLabel"
          :pending-action-key="pendingActionKey"
          @advance="advancePitchPresentation"
        />

        <LazyAdminCompetitionPitchReviewPanel
          v-if="showPitchReviewPanel"
          :entries="pitchReviewCoverageEntries"
          :has-completed-pitch-reviews="hasCompletedPitchReviews"
          :can-start-final-deliberation="canStartFinalDeliberationFromPitchReview"
          :pending-action-key="pendingActionKey"
          @start-final-deliberation="startFinalDeliberation"
        />

        <LazyAdminCompetitionFinalDeliberationPanel
          v-if="showFinalDeliberationPanel"
          :event="currentEvent"
          :entries="finalDeliberation?.entries ?? []"
          :final-ranking-submission-ids="finalDeliberation?.finalRankingSubmissionIds ?? []"
          :pending-action-key="pendingActionKey"
          @draft-change="syncFinalDeliberationDraft"
          @reorder="reorderFinalDeliberation"
        />

        <LazyAdminCompetitionPrizeRedemptionsPanel
          v-if="showPrizeRedemptionsPanel"
          :event-state="currentEvent.state"
          :winners="winners"
          :redemptions="redemptions"
          :blind-ranking-entries="prizeRedemptionBlindRankingEntries"
          :final-ranking-entries="prizeRedemptionFinalRankingEntries"
          :pitch-presentation-submission-ids="currentEvent.pitchPresentationSubmissionIds"
          :winner-terms-title="currentEvent.currentTerms?.winnerTerms?.title ?? null"
        />
      </section>

      <section
        v-if="showParticipantsSection"
        class="space-y-4"
      >
        <LazyAccountEventParticipantsPanel
          v-model:search="participantSearch"
          :event-id="eventId"
          :applications="applications"
          :status-counts="participantPageData?.statusCounts"
          :checked-in-count="participantPageData?.checkedInCount"
          :pagination="participantPageData?.pagination"
          :is-searching="isSearchingParticipants"
          :is-loading-more="isLoadingMoreParticipants"
          :pending-action-key="pendingActionKey"
          :show-ai-knowledge="currentEvent.applicationAiKnowledgeVisible"
          :tracks="currentEvent.tracks ?? []"
          :participants-limit="currentEvent.participantsLimit ?? null"
          :auto-approve-applications="currentEvent.autoApproveApplications"
          :event-state="currentEvent.state"
          @approve="application => stageApplicationDecision(application, 'approve')"
          @approve-team="approveApplicationGroup"
          @reject="application => stageApplicationDecision(application, 'reject')"
          @withdraw="withdrawApplication"
          @undo-withdrawal="undoApplicationWithdrawal"
          @check-in="application => checkInParticipant(application, props.eventSlug)"
          @save-decisions="applyStagedApplicationDecisions"
          @load-more="emit('loadMoreParticipants')"
        />
      </section>

      <section
        v-if="showSubmissionsSection"
        class="space-y-6"
      >
        <LazyAdminSubmissionInterventionsPanel
          :event-state="currentEvent.state"
          :teams="sortedSubmissionTeams"
          :pending-action-key="pendingActionKey"
          @disqualify="disqualifySubmission"
        />

        <LazyAdminTeamsOperationsPanel
          v-model:search="submissionSearchInput"
          v-model:filter="submissionStatusFilter"
          :event-state="currentEvent.state"
          :teams="filteredSubmissionTeams"
          :metrics="submissionDashboardMetrics"
          :pending-action-key="pendingActionKey"
          @admin-withdraw="adminWithdrawSubmission"
        />
      </section>
    </template>
  </div>
</template>
