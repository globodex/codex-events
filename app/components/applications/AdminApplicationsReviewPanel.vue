<script setup lang="ts">
import type { AdminApplicationRecord } from '~/domains/applications/admin-application-record'
import type {
  AdminApplicationAiKnowledgeFilter,
  AdminApplicationReviewGroup,
  AdminApplicationReviewPendingTeammate,
  AdminApplicationReviewView
} from '~/domains/applications/admin-application-review'
import type { EventRecord, EventTrack } from '~/domains/events/records'

import {
  buildAdminApplicationReviewGroups,
  canApproveAdminApplicationReviewGroup,
  countApprovedAdminApplicationsBySelectedTrack,
  filterApprovedAdminApplicationsForTrackCounts,
  filterAdminApplicationReviewGroups,
  filterAdminApplicationReviewGroupsByAiKnowledge,
  filterAdminApplicationReviewGroupsByApplicant,
  filterAdminApplicationReviewGroupsBySelectedTrack,
  hasAdminApplicationReviewApplicantApprovalSelected,
  hasAdminApplicationReviewGroupApprovalSelected,
  searchAdminApplicationReviewGroups,
  shouldShowAdminApplicationWithdrawalUndoAction
} from '~/domains/applications/admin-application-review'
import {
  aiKnowledgeLevelLabels,
  aiKnowledgeLevelValues,
  formatAiKnowledgeLevel,
  parseProofOfExecutionLinks
} from '~/domains/applications/participant-application'
import { buildProfileIconHref } from '~/domains/accounts/profile-icon'
import {
  formatFailedApplicationLumaSyncAlertToggleLabel,
  formatApplicationAttendanceStatus,
  formatApplicationLumaSyncStatus,
  getApplicationAttendanceStatusColor,
  getApplicationLumaSyncStatusColor,
  getApplicationStatusColor,
  isApplicationCheckedIn,
  listFailedApplicationLumaSyncApplications,
  shouldShowApplicationLumaSyncStatus
} from '~/domains/applications/admin-application-record'
import { formatTimestamp } from '~/lib/date-formatting'

const props = withDefaults(defineProps<{
  eventId: string
  applications: AdminApplicationRecord[]
  view: AdminApplicationReviewView
  isLoading?: boolean
  errorMessage?: string
  pendingActionKey?: string | null
  readOnly?: boolean
  searchEnabled?: boolean
  showAttendance?: boolean
  showAiKnowledge?: boolean
  tracks?: Pick<EventTrack, 'id' | 'name' | 'displayOrder'>[]
  autoApproveApplications?: boolean
  eventState?: EventRecord['state']
}>(), {
  isLoading: false,
  errorMessage: '',
  pendingActionKey: null,
  readOnly: false,
  searchEnabled: false,
  showAttendance: false,
  showAiKnowledge: false,
  tracks: () => [],
  autoApproveApplications: false,
  eventState: 'draft'
})

const emit = defineEmits<{
  approve: [application: AdminApplicationRecord]
  approveTeam: [applications: AdminApplicationRecord[]]
  reject: [application: AdminApplicationRecord]
  withdraw: [application: AdminApplicationRecord]
  undoWithdrawal: [application: AdminApplicationRecord]
  saveDecisions: []
}>()

const stagedCount = computed(() =>
  props.applications.filter(application => application.status === 'submitted' && Boolean(application.preApprovalStatus)).length
)
const hasSubmittedApplications = computed(() =>
  props.applications.some(application => application.status === 'submitted')
)
const whyThisEventPreviewCharacterLimit = 280
const proofLinksPreviewCount = 2
const expandedApplicationSectionKeys = ref(new Set<string>())
const isFailedLumaSyncAlertExpanded = ref(false)
const searchQuery = ref('')
const checkedInOnly = ref(false)
const aiKnowledgeFilter = ref<AdminApplicationAiKnowledgeFilter>('all')
const allSelectedTrackFilterValue = 'all'
const selectedTrackFilter = ref(allSelectedTrackFilterValue)
const showApprovedAttendance = computed(() =>
  props.showAttendance && props.view === 'approved'
)
const sortedTrackOptions = computed(() =>
  [...props.tracks].sort((left, right) =>
    left.displayOrder - right.displayOrder || left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
  )
)
const tracksById = computed(() =>
  new Map(sortedTrackOptions.value.map(track => [track.id, track]))
)
const hasTrackOptions = computed(() =>
  sortedTrackOptions.value.length > 0
)
const showTrackFilter = computed(() =>
  props.view === 'approved' && hasTrackOptions.value
)
const showAiKnowledgeDetails = computed(() =>
  props.showAiKnowledge && !hasTrackOptions.value
)
const showAiKnowledgeFilter = computed(() =>
  showAiKnowledgeDetails.value
)
const approvedTrackCountApplications = computed(() =>
  filterApprovedAdminApplicationsForTrackCounts(props.applications, {
    checkedInOnly: showApprovedAttendance.value && checkedInOnly.value
  })
)
const approvedTrackCounts = computed(() =>
  countApprovedAdminApplicationsBySelectedTrack(approvedTrackCountApplications.value)
)
const approvedTrackAllCount = computed(() =>
  approvedTrackCountApplications.value.length
)
const approvedTrackFilterOptions = computed(() =>
  sortedTrackOptions.value.map(track => ({
    ...track,
    filterValue: `track:${track.id}`,
    count: approvedTrackCounts.value.get(track.id) ?? 0
  }))
)
const activeSelectedTrackId = computed(() => {
  if (!showTrackFilter.value || !selectedTrackFilter.value.startsWith('track:')) {
    return null
  }

  const trackId = selectedTrackFilter.value.slice('track:'.length)
  return tracksById.value.has(trackId) ? trackId : null
})
const hasTrackFilter = computed(() =>
  activeSelectedTrackId.value !== null
)
const hasAiKnowledgeFilter = computed(() =>
  showAiKnowledgeFilter.value && aiKnowledgeFilter.value !== 'all'
)
const showAutoApproveApplicationsNotice = computed(() =>
  props.view === 'applications' && !props.readOnly && props.autoApproveApplications && !hasSubmittedApplications.value
)
const hasSearchQuery = computed(() =>
  props.searchEnabled && searchQuery.value.trim().length > 0
)
const filteredReviewGroups = computed(() => {
  let groups = filterAdminApplicationReviewGroups(
    buildAdminApplicationReviewGroups(props.applications),
    props.view
  )

  if (showApprovedAttendance.value && checkedInOnly.value) {
    groups = filterAdminApplicationReviewGroupsByApplicant(
      groups,
      applicant => isApplicationCheckedIn(applicant.application)
    )
  }

  if (hasAiKnowledgeFilter.value) {
    groups = filterAdminApplicationReviewGroupsByAiKnowledge(groups, aiKnowledgeFilter.value)
  }

  if (activeSelectedTrackId.value) {
    groups = filterAdminApplicationReviewGroupsBySelectedTrack(groups, activeSelectedTrackId.value)
  }

  return groups
})
const applicationReviewGroups = computed(() =>
  searchAdminApplicationReviewGroups(
    filteredReviewGroups.value,
    hasSearchQuery.value ? searchQuery.value : ''
  )
)
const failedLumaSyncApplications = computed(() =>
  listFailedApplicationLumaSyncApplications(props.applications, props.view)
)
const failedLumaSyncAlert = computed(() => {
  if (failedLumaSyncApplications.value.length === 0) {
    return null
  }

  if (props.view === 'approved') {
    return {
      title: 'Some approvals did not sync to Luma',
      description: `${failedLumaSyncApplications.value.length} approved participant${failedLumaSyncApplications.value.length === 1 ? '' : 's'} still need manual approval in Luma.`
    }
  }

  if (props.view === 'rejected') {
    return {
      title: 'Some rejections did not sync to Luma',
      description: `${failedLumaSyncApplications.value.length} rejected participant${failedLumaSyncApplications.value.length === 1 ? '' : 's'} still need manual rejection in Luma.`
    }
  }

  if (props.view === 'withdrawn') {
    return {
      title: 'Some withdrawals did not sync to Luma',
      description: `${failedLumaSyncApplications.value.length} withdrawn participant${failedLumaSyncApplications.value.length === 1 ? '' : 's'} still need manual rejection in Luma.`
    }
  }

  return null
})
const failedLumaSyncAlertToggleLabel = computed(() =>
  formatFailedApplicationLumaSyncAlertToggleLabel(
    failedLumaSyncApplications.value.length,
    isFailedLumaSyncAlertExpanded.value
  )
)

watch(
  () => [props.view, failedLumaSyncApplications.value.length],
  () => {
    isFailedLumaSyncAlertExpanded.value = false
  }
)

watch(
  showAiKnowledgeFilter,
  (isVisible) => {
    if (!isVisible) {
      aiKnowledgeFilter.value = 'all'
    }
  }
)

function selectTrackFilter(filterValue: string) {
  selectedTrackFilter.value = filterValue
}

function getSelectedTrackName(application: AdminApplicationRecord) {
  return application.selectedTrackId
    ? tracksById.value.get(application.selectedTrackId)?.name ?? null
    : null
}

function toggleFailedLumaSyncAlertExpanded() {
  isFailedLumaSyncAlertExpanded.value = !isFailedLumaSyncAlertExpanded.value
}

function getApplicationSectionKey(applicationId: string, section: 'motivation' | 'proof') {
  return `${applicationId}:${section}`
}

function isApplicationSectionExpanded(sectionKey: string) {
  return expandedApplicationSectionKeys.value.has(sectionKey)
}

function toggleApplicationSection(sectionKey: string) {
  const nextExpandedKeys = new Set(expandedApplicationSectionKeys.value)

  if (nextExpandedKeys.has(sectionKey)) {
    nextExpandedKeys.delete(sectionKey)
  } else {
    nextExpandedKeys.add(sectionKey)
  }

  expandedApplicationSectionKeys.value = nextExpandedKeys
}

function stageDecisionActionKey(applicationId: string, decision: 'approved' | 'rejected') {
  return `stage:${decision}:${applicationId}`
}

function stageGroupApprovalActionKey(group: AdminApplicationReviewGroup) {
  const sortedApplicationIds = group.applicants
    .map(applicant => applicant.application.id)
    .sort((left, right) => left.localeCompare(right))

  return `stage:approved-team:${sortedApplicationIds.join('__')}`
}

function formatPendingTeammateLabel(pendingTeammate: AdminApplicationReviewPendingTeammate) {
  return pendingTeammate.fullName ?? pendingTeammate.email ?? 'Unnamed teammate hint'
}

function hasApplicantRejectionSelected(applicant: AdminApplicationReviewGroup['applicants'][number]) {
  return applicant.application.preApprovalStatus === 'rejected'
}

function getWhyThisEventValue(applicant: AdminApplicationReviewGroup['applicants'][number]) {
  return applicant.registrationDetails.whyThisEvent.trim()
}

function shouldShowWhyThisEvent(applicant: AdminApplicationReviewGroup['applicants'][number]) {
  return getWhyThisEventValue(applicant).length > 0
}

function shouldShowWhyThisEventToggle(applicant: AdminApplicationReviewGroup['applicants'][number]) {
  return getWhyThisEventValue(applicant).length > whyThisEventPreviewCharacterLimit
}

function getVisibleWhyThisEvent(applicant: AdminApplicationReviewGroup['applicants'][number]) {
  const whyThisEvent = getWhyThisEventValue(applicant)
  const sectionKey = getApplicationSectionKey(applicant.application.id, 'motivation')

  if (
    isApplicationSectionExpanded(sectionKey)
    || whyThisEvent.length <= whyThisEventPreviewCharacterLimit
  ) {
    return whyThisEvent
  }

  return `${whyThisEvent.slice(0, whyThisEventPreviewCharacterLimit).trimEnd()}…`
}

function getProofOfExecutionLinks(applicant: AdminApplicationReviewGroup['applicants'][number]) {
  return parseProofOfExecutionLinks(applicant.registrationDetails.proofOfExecutionUrl)
}

function shouldShowProofOfExecutionLinks(applicant: AdminApplicationReviewGroup['applicants'][number]) {
  return getProofOfExecutionLinks(applicant).length > 0
}

function shouldShowApplicantMetadata(applicant: AdminApplicationReviewGroup['applicants'][number]) {
  return Boolean(
    applicant.application.user?.lumaEmail
    || applicant.application.user?.githubProfileUrl
    || applicant.application.user?.chatgptEmail
    || applicant.application.user?.openaiOrgId
    || applicant.application.user?.linkedinProfileUrl
    || applicant.application.user?.xProfileUrl
    || showAiKnowledgeDetails.value
  )
}

function shouldShowProofOfExecutionToggle(applicant: AdminApplicationReviewGroup['applicants'][number]) {
  return getProofOfExecutionLinks(applicant).length > proofLinksPreviewCount
}

function getVisibleProofOfExecutionLinks(applicant: AdminApplicationReviewGroup['applicants'][number]) {
  const proofLinks = getProofOfExecutionLinks(applicant)
  const sectionKey = getApplicationSectionKey(applicant.application.id, 'proof')

  if (
    isApplicationSectionExpanded(sectionKey)
    || proofLinks.length <= proofLinksPreviewCount
  ) {
    return proofLinks
  }

  return proofLinks.slice(0, proofLinksPreviewCount)
}

function getApplicantIdentityLabel(application: AdminApplicationRecord) {
  if (application.user?.displayName && application.user?.email && application.user.displayName !== application.user.email) {
    return `${application.user.displayName} - ${application.user.email}`
  }

  return application.user?.displayName ?? application.user?.email ?? application.userId
}

function getFailedLumaSyncParticipantPrimaryLabel(application: AdminApplicationRecord) {
  return application.user?.displayName ?? application.user?.email ?? application.userId
}

function getFailedLumaSyncParticipantSecondaryLabel(application: AdminApplicationRecord) {
  if (application.user?.displayName && application.user?.email && application.user.displayName !== application.user.email) {
    return application.user.email
  }

  return null
}

function getApplicantAvatarAlt(application: AdminApplicationRecord) {
  return application.user?.displayName ?? application.user?.email ?? application.userId
}

function getApplicantProfileIconHref(application: AdminApplicationRecord) {
  return buildProfileIconHref(
    application.userId,
    application.user?.profileIconRevision,
    props.eventId
  )
}

function getFailedLumaSyncParticipantMeta(application: AdminApplicationRecord) {
  if (application.user?.lumaEmail) {
    return {
      label: 'Luma',
      value: application.user.lumaEmail
    }
  }

  if (application.user?.email) {
    return {
      label: 'Account',
      value: application.user.email
    }
  }

  return {
    label: 'User ID',
    value: application.userId
  }
}

function getAdminWithdrawalAvailability(application: AdminApplicationRecord) {
  return application.adminWithdrawal ?? {
    isAllowed: false,
    reason: 'Withdrawal status is unavailable right now.',
    warning: null,
    activeTeamId: null,
    teamAction: 'none' as const
  }
}

function shouldShowWithdrawAction(application: AdminApplicationRecord) {
  return application.status === 'submitted' || application.status === 'approved'
}

function shouldShowUndoWithdrawalAction(application: AdminApplicationRecord) {
  return shouldShowAdminApplicationWithdrawalUndoAction(application, props.eventState)
}

function shouldShowApplicationActionColumn(application: AdminApplicationRecord) {
  return !props.readOnly && (shouldShowWithdrawAction(application) || shouldShowUndoWithdrawalAction(application))
}

function formatWithdrawalTimestamp(application: AdminApplicationRecord) {
  return application.withdrawnAt
    ? `Withdrawn ${formatTimestamp(application.withdrawnAt, 'recently')}`
    : null
}

function formatCheckedInTimestamp(application: AdminApplicationRecord) {
  return application.checkedInAt
    ? `Checked in ${formatTimestamp(application.checkedInAt, 'recently')}`
    : null
}

const reviewContent = computed(() => {
  if (showAutoApproveApplicationsNotice.value) {
    return {
      title: 'Participant Review',
      description: 'This event approves participants automatically.'
    }
  }

  if (props.view === 'approved') {
    return {
      title: 'Approved Participants',
      description: props.readOnly
        ? 'Browse approved participants and inferred teammate groupings.'
        : 'Browse approved participants, filter to checked-in attendees, and review inferred teammate groupings.'
    }
  }

  if (props.view === 'rejected') {
    return {
      title: 'Rejected Participants',
      description: props.readOnly
        ? 'Browse rejected participant records and inferred teammate groupings.'
        : 'Browse rejected participant records and inferred teammate groupings.'
    }
  }

  if (props.view === 'withdrawn') {
    return {
      title: 'Withdrawn Participants',
      description: props.readOnly
        ? 'Browse withdrawn participant records and inferred teammate groupings.'
        : 'Browse withdrawn participant records and any withdrawal-side effects already applied.'
    }
  }

  return {
    title: props.readOnly ? 'Participant Directory' : 'Participant Review',
    description: props.readOnly
      ? 'Browse event participants and teammate hints without review actions.'
      : 'Review incoming applications, then save once to apply decisions and trigger participant emails.'
  }
})

const emptyState = computed(() => {
  if (props.applications.length === 0) {
    return {
      title: 'No participant records yet',
      description: 'This event does not currently have participant records to review.'
    }
  }

  if (showApprovedAttendance.value && checkedInOnly.value && hasSearchQuery.value) {
    return {
      title: 'No checked-in approved participants match this search',
      description: 'Try a different name, email, or teammate hint, or clear the checked-in filter.'
    }
  }

  if (hasAiKnowledgeFilter.value && hasSearchQuery.value) {
    return {
      title: 'No participants match this search and AI Knowledge filter',
      description: 'Try a different search or choose another AI Knowledge level.'
    }
  }

  if (hasAiKnowledgeFilter.value) {
    return {
      title: 'No participants match this AI Knowledge filter',
      description: 'Choose another AI Knowledge level or show all participants.'
    }
  }

  if (hasTrackFilter.value && hasSearchQuery.value) {
    return {
      title: 'No approved participants match this search and track filter',
      description: 'Try a different search, choose another track, or show all approved participants.'
    }
  }

  if (hasTrackFilter.value) {
    return {
      title: 'No approved participants selected this track',
      description: 'Choose another track or show all approved participants.'
    }
  }

  if (hasSearchQuery.value) {
    if (props.view === 'approved') {
      return {
        title: 'No approved participants match this search',
        description: 'Try a different name, email, user ID, or teammate hint.'
      }
    }

    if (props.view === 'rejected') {
      return {
        title: 'No rejected participants match this search',
        description: 'Try a different name, email, user ID, or teammate hint.'
      }
    }

    if (props.view === 'withdrawn') {
      return {
        title: 'No withdrawn participants match this search',
        description: 'Try a different name, email, user ID, or teammate hint.'
      }
    }

    return {
      title: 'No applications match this search',
      description: 'Try a different name, email, user ID, or teammate hint.'
    }
  }

  if (showApprovedAttendance.value && checkedInOnly.value) {
    return {
      title: 'No checked-in approved participants yet',
      description: 'Approved participants will appear here after a Luma check-in is recorded.'
    }
  }

  if (props.view === 'approved') {
    return {
      title: 'No approved participants yet',
      description: 'Approved participants will appear here after staged decisions are saved.'
    }
  }

  if (props.view === 'rejected') {
    return {
      title: 'No rejected participants yet',
      description: 'Rejected participants will appear here after staged decisions are saved.'
    }
  }

  if (props.view === 'withdrawn') {
    return {
      title: 'No withdrawn participants yet',
      description: 'Withdrawn participants will appear here after a participant or admin withdrawal is recorded.'
    }
  }

  return {
    title: 'No applications awaiting review',
    description: props.readOnly
      ? 'Visible participant application records will appear here.'
      : 'Submitted applications will appear here until they are approved or rejected.'
  }
})
</script>

<template>
  <AppCard class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
    <template #header>
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-highlighted">
          {{ reviewContent.title }}
        </h2>
        <p class="text-sm text-muted">
          {{ reviewContent.description }}
        </p>
      </div>
    </template>

    <div class="space-y-6">
      <AppAlert
        v-if="errorMessage"
        color="error"
        variant="soft"
        title="Participant records unavailable"
        :description="errorMessage"
      />

      <AppAlert
        v-else-if="isLoading"
        color="neutral"
        variant="soft"
        title="Loading participants"
        description="Participant records are still loading."
      />

      <template v-else>
        <AppAlert
          v-if="failedLumaSyncAlert"
          color="warning"
          variant="soft"
        >
          <div class="col-span-full col-start-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div class="min-w-0 space-y-1">
              <p class="font-semibold text-current">
                {{ failedLumaSyncAlert.title }}
              </p>
              <p class="text-current/90">
                {{ failedLumaSyncAlert.description }}
              </p>
            </div>

            <AppButton
              color="warning"
              variant="outline"
              size="sm"
              :label="failedLumaSyncAlertToggleLabel"
              :trailing-icon="isFailedLumaSyncAlertExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              data-testid="failed-luma-sync-alert-toggle"
              :aria-expanded="isFailedLumaSyncAlertExpanded"
              aria-controls="failed-luma-sync-alert-panel"
              class="shrink-0 self-start"
              @click="toggleFailedLumaSyncAlertExpanded"
            />
          </div>

          <div
            v-if="isFailedLumaSyncAlertExpanded"
            id="failed-luma-sync-alert-panel"
            data-testid="failed-luma-sync-alert-panel"
            class="col-span-full col-start-1 mt-4 border-t border-current/15 pt-4"
          >
            <div class="overflow-x-auto">
              <table
                data-testid="failed-luma-sync-alert-table"
                class="min-w-full text-sm"
              >
                <thead>
                  <tr class="text-left text-xs uppercase tracking-[0.14em] text-current/70">
                    <th class="w-[58%] pr-4 pb-3 font-semibold">
                      Participant
                    </th>
                    <th class="pb-3 font-semibold">
                      Sync detail
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-current/10">
                  <tr
                    v-for="application in failedLumaSyncApplications"
                    :key="application.id"
                    class="align-top"
                  >
                    <td class="py-3 pr-4">
                      <div class="space-y-0.5">
                        <p class="font-medium text-current">
                          {{ getFailedLumaSyncParticipantPrimaryLabel(application) }}
                        </p>
                        <p
                          v-if="getFailedLumaSyncParticipantSecondaryLabel(application)"
                          class="break-all text-current/75"
                        >
                          {{ getFailedLumaSyncParticipantSecondaryLabel(application) }}
                        </p>
                      </div>
                    </td>
                    <td class="py-3">
                      <div class="space-y-0.5">
                        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-current/70">
                          {{ getFailedLumaSyncParticipantMeta(application).label }}
                        </p>
                        <p class="break-all text-current/90">
                          {{ getFailedLumaSyncParticipantMeta(application).value }}
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </AppAlert>

        <AppAlert
          v-if="showAutoApproveApplicationsNotice"
          color="neutral"
          variant="soft"
          title="Nothing to review"
          description="This event automatically approves participants after they register, so no review action is needed here."
        />

        <div
          v-if="!showAutoApproveApplicationsNotice && (searchEnabled || showApprovedAttendance || showTrackFilter || showAiKnowledgeFilter)"
          class="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center"
        >
          <AppInput
            v-if="searchEnabled"
            v-model="searchQuery"
            type="search"
            name="participant-review-search"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            data-1p-ignore="true"
            data-lpignore="true"
            data-bwignore="true"
            placeholder="Search participants by name, email, user ID, or teammate hint"
            class="min-w-0 flex-1 md:min-w-[28rem]"
          />

          <AppButton
            v-if="showApprovedAttendance"
            :color="checkedInOnly ? 'success' : 'neutral'"
            :variant="checkedInOnly ? 'soft' : 'outline'"
            data-testid="admin-approved-checked-in-filter"
            :aria-pressed="checkedInOnly"
            class="h-[46px] min-w-max shrink-0 rounded-lg"
            @click="checkedInOnly = !checkedInOnly"
          >
            <span
              aria-hidden="true"
              class="inline-flex size-4 shrink-0 items-center justify-center rounded border transition"
              :class="checkedInOnly ? 'border-success bg-success text-white' : 'border-current/40 text-transparent'"
            >
              <AppIcon
                v-if="checkedInOnly"
                name="i-lucide-check"
                class="size-3"
              />
            </span>
            <span>Checked in</span>
          </AppButton>

          <div
            v-if="showTrackFilter"
            class="flex w-full max-w-full flex-wrap items-center gap-2 rounded-xl border border-black/8 bg-black/4 p-1 dark:border-white/[0.08] dark:bg-white/[0.04]"
            aria-label="Approved participant track filter"
          >
            <AppFilterButton
              data-testid="admin-approved-track-filter-all"
              :pressed="!hasTrackFilter"
              :count="approvedTrackAllCount"
              class="py-2 sm:min-w-max sm:justify-between"
              @click="selectTrackFilter(allSelectedTrackFilterValue)"
            >
              All
            </AppFilterButton>
            <AppFilterButton
              v-for="track in approvedTrackFilterOptions"
              :key="track.id"
              :data-testid="`admin-approved-track-filter-${track.id}`"
              :pressed="activeSelectedTrackId === track.id"
              :count="track.count"
              class="py-2 sm:min-w-max sm:justify-between"
              @click="selectTrackFilter(track.filterValue)"
            >
              <span class="truncate">{{ track.name }}</span>
            </AppFilterButton>
          </div>

          <label
            v-if="showAiKnowledgeFilter"
            class="min-w-0 md:w-64"
          >
            <span class="sr-only">AI Knowledge</span>
            <AppSelect
              v-model="aiKnowledgeFilter"
              name="admin-ai-knowledge-filter"
              data-testid="admin-ai-knowledge-filter"
            >
              <option value="all">
                All AI Knowledge
              </option>
              <option
                v-for="level in aiKnowledgeLevelValues"
                :key="level"
                :value="level"
              >
                {{ aiKnowledgeLevelLabels[level] }}
              </option>
            </AppSelect>
          </label>
        </div>

        <div
          v-if="view === 'applications' && !readOnly && !showAutoApproveApplicationsNotice"
          class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-4"
        >
          <p class="text-sm text-muted">
            Save applies staged decisions and then queues participant emails.
          </p>
          <AppButton
            color="primary"
            :data-testid="'admin-application-save-decisions'"
            :loading="pendingActionKey === 'apply-staged-decisions'"
            :disabled="stagedCount === 0 || (pendingActionKey !== null && pendingActionKey !== 'apply-staged-decisions')"
            @click="emit('saveDecisions')"
          >
            Save staged decisions ({{ stagedCount }})
          </AppButton>
        </div>

        <div
          v-if="!showAutoApproveApplicationsNotice && applicationReviewGroups.length > 0"
          class="grid gap-5"
        >
          <section
            v-for="group in applicationReviewGroups"
            :key="group.id"
            :data-testid="`admin-application-group-${group.id}`"
            class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 overflow-hidden rounded-xl"
          >
            <div class="divide-y divide-black/8 dark:divide-white/[0.08]">
              <article
                v-for="applicant in group.applicants"
                :key="applicant.application.id"
                :data-testid="`admin-application-${applicant.application.id}`"
                class="grid gap-5 px-5 py-5"
                :class="shouldShowApplicationActionColumn(applicant.application) ? 'sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-start xl:items-center' : ''"
              >
                <div class="min-w-0 space-y-3">
                  <div class="space-y-3">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div class="flex min-w-0 items-start gap-3">
                        <AppAvatar
                          size="lg"
                          :src="getApplicantProfileIconHref(applicant.application)"
                          :alt="getApplicantAvatarAlt(applicant.application)"
                          class="shrink-0"
                        />
                        <div class="min-w-0 space-y-1">
                          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                            Participant
                          </p>
                          <div class="flex flex-wrap items-center gap-2">
                            <h4 class="text-lg font-semibold text-highlighted">
                              {{ getApplicantIdentityLabel(applicant.application) }}
                            </h4>
                            <AppBadge
                              v-if="applicant.application.status === 'approved'"
                              :color="getApplicationStatusColor(applicant.application.status)"
                              variant="soft"
                            >
                              Approved
                            </AppBadge>
                            <AppBadge
                              v-if="getSelectedTrackName(applicant.application)"
                              color="primary"
                              variant="soft"
                              :data-testid="`admin-application-track-badge-${applicant.application.id}`"
                            >
                              {{ getSelectedTrackName(applicant.application) }}
                            </AppBadge>
                            <AppBadge
                              v-if="showApprovedAttendance && applicant.application.status === 'approved'"
                              :data-testid="`admin-application-attendance-badge-${applicant.application.id}`"
                              :color="getApplicationAttendanceStatusColor(applicant.application)"
                              variant="soft"
                            >
                              {{ formatApplicationAttendanceStatus(applicant.application) }}
                            </AppBadge>
                            <AppBadge
                              v-if="applicant.application.status === 'rejected'"
                              :color="getApplicationStatusColor(applicant.application.status)"
                              variant="soft"
                            >
                              Rejected
                            </AppBadge>
                            <AppBadge
                              v-if="applicant.application.status === 'withdrawn'"
                              :color="getApplicationStatusColor(applicant.application.status)"
                              variant="soft"
                            >
                              Withdrawn
                            </AppBadge>
                            <AppBadge
                              v-if="shouldShowApplicationLumaSyncStatus(applicant.application)"
                              :color="getApplicationLumaSyncStatusColor(applicant.application.lumaSyncStatus)"
                              variant="soft"
                            >
                              {{ formatApplicationLumaSyncStatus(applicant.application.lumaSyncStatus) }}
                            </AppBadge>
                            <span
                              v-if="applicant.application.status === 'withdrawn' && formatWithdrawalTimestamp(applicant.application)"
                              class="rounded-full border border-black/10 px-3 py-1 text-xs text-highlighted dark:border-white/[0.12]"
                            >
                              {{ formatWithdrawalTimestamp(applicant.application) }}
                            </span>
                            <span
                              v-if="showApprovedAttendance && applicant.application.status === 'approved' && formatCheckedInTimestamp(applicant.application)"
                              :data-testid="`admin-application-checked-in-at-${applicant.application.id}`"
                              class="rounded-full border border-black/10 px-3 py-1 text-xs text-highlighted dark:border-white/[0.12]"
                            >
                              {{ formatCheckedInTimestamp(applicant.application) }}
                            </span>
                            <AppBadge
                              v-if="applicant.hasFuzzyMatch"
                              color="warning"
                              variant="soft"
                            >
                              Fuzzy teammate match
                            </AppBadge>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      v-if="shouldShowApplicantMetadata(applicant)"
                      class="flex flex-wrap gap-2 text-xs text-muted"
                    >
                      <span
                        v-if="applicant.application.user?.lumaEmail"
                        class="rounded-full border border-black/10 px-3 py-1 text-highlighted dark:border-white/[0.12]"
                      >
                        Luma: {{ applicant.application.user.lumaEmail }}
                      </span>
                      <a
                        v-if="applicant.application.user?.githubProfileUrl"
                        :href="applicant.application.user.githubProfileUrl"
                        target="_blank"
                        rel="noreferrer"
                        class="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1 text-sky-700 transition hover:border-black/20 hover:text-sky-800 dark:border-white/[0.12] dark:text-sky-300 dark:hover:border-white/[0.22] dark:hover:text-sky-200"
                      >
                        GitHub
                        <AppIcon
                          name="i-lucide-external-link"
                          class="size-3"
                        />
                      </a>
                      <span
                        v-if="applicant.application.user?.chatgptEmail"
                        class="rounded-full border border-black/10 px-3 py-1 text-highlighted dark:border-white/[0.12]"
                      >
                        ChatGPT: {{ applicant.application.user.chatgptEmail }}
                      </span>
                      <span
                        v-if="applicant.application.user?.openaiOrgId"
                        class="rounded-full border border-black/10 px-3 py-1 text-highlighted dark:border-white/[0.12]"
                      >
                        OpenAI org: {{ applicant.application.user.openaiOrgId }}
                      </span>
                      <a
                        v-if="applicant.application.user?.linkedinProfileUrl"
                        :href="applicant.application.user.linkedinProfileUrl"
                        target="_blank"
                        rel="noreferrer"
                        class="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1 text-sky-700 transition hover:border-black/20 hover:text-sky-800 dark:border-white/[0.12] dark:text-sky-300 dark:hover:border-white/[0.22] dark:hover:text-sky-200"
                      >
                        LinkedIn
                        <AppIcon
                          name="i-lucide-external-link"
                          class="size-3"
                        />
                      </a>
                      <a
                        v-if="applicant.application.user?.xProfileUrl"
                        :href="applicant.application.user.xProfileUrl"
                        target="_blank"
                        rel="noreferrer"
                        class="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1 text-sky-700 transition hover:border-black/20 hover:text-sky-800 dark:border-white/[0.12] dark:text-sky-300 dark:hover:border-white/[0.22] dark:hover:text-sky-200"
                      >
                        X
                        <AppIcon
                          name="i-lucide-external-link"
                          class="size-3"
                        />
                      </a>
                      <span
                        v-if="showAiKnowledgeDetails"
                        class="rounded-full border border-black/10 px-3 py-1 text-highlighted dark:border-white/[0.12]"
                      >
                        AI Knowledge: {{ formatAiKnowledgeLevel(applicant.registrationDetails.aiKnowledgeLevel) }}
                      </span>
                    </div>
                  </div>

                  <div
                    v-if="shouldShowWhyThisEvent(applicant) || shouldShowProofOfExecutionLinks(applicant)"
                    class="space-y-3"
                  >
                    <div
                      v-if="shouldShowProofOfExecutionLinks(applicant)"
                      class="space-y-2"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          Proof links
                        </p>
                        <AppButton
                          v-if="shouldShowProofOfExecutionToggle(applicant)"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          @click="toggleApplicationSection(getApplicationSectionKey(applicant.application.id, 'proof'))"
                        >
                          {{ isApplicationSectionExpanded(getApplicationSectionKey(applicant.application.id, 'proof')) ? 'Show less' : `Show all ${getProofOfExecutionLinks(applicant).length}` }}
                        </AppButton>
                      </div>
                      <div class="space-y-1.5">
                        <a
                          v-for="link in getVisibleProofOfExecutionLinks(applicant)"
                          :key="link"
                          :href="link"
                          target="_blank"
                          rel="noreferrer"
                          :title="link"
                          class="flex w-full items-start gap-2 text-xs text-sky-700 transition hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200"
                        >
                          <AppIcon
                            name="i-lucide-external-link"
                            class="mt-0.5 size-3 shrink-0"
                          />
                          <span class="min-w-0 break-all leading-5">
                            {{ link }}
                          </span>
                        </a>
                      </div>
                    </div>

                    <section
                      v-if="shouldShowWhyThisEvent(applicant)"
                      class="rounded-lg border border-black/8 bg-black/[0.02] px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.02]"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                          Why this event
                        </p>
                        <AppButton
                          v-if="shouldShowWhyThisEventToggle(applicant)"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          @click="toggleApplicationSection(getApplicationSectionKey(applicant.application.id, 'motivation'))"
                        >
                          {{ isApplicationSectionExpanded(getApplicationSectionKey(applicant.application.id, 'motivation')) ? 'Show less' : 'Show more' }}
                        </AppButton>
                      </div>
                      <p class="mt-2 whitespace-pre-line text-sm leading-6 text-toned">
                        {{ getVisibleWhyThisEvent(applicant) }}
                      </p>
                    </section>
                  </div>
                </div>

                <div
                  v-if="shouldShowApplicationActionColumn(applicant.application)"
                  class="grid gap-2 self-center xl:pl-2"
                >
                  <AppAlert
                    v-if="shouldShowWithdrawAction(applicant.application) && getAdminWithdrawalAvailability(applicant.application).warning"
                    color="warning"
                    variant="soft"
                    title="This withdrawal will dismantle the team"
                    :description="getAdminWithdrawalAvailability(applicant.application).warning ?? ''"
                  />
                  <p
                    v-else-if="shouldShowWithdrawAction(applicant.application) && getAdminWithdrawalAvailability(applicant.application).reason"
                    class="text-xs leading-5 text-muted"
                  >
                    {{ getAdminWithdrawalAvailability(applicant.application).reason }}
                  </p>

                  <AppButton
                    v-if="view === 'applications' && applicant.application.status === 'submitted'"
                    :color="hasAdminApplicationReviewApplicantApprovalSelected(applicant, group) ? 'success' : 'neutral'"
                    :aria-pressed="hasAdminApplicationReviewApplicantApprovalSelected(applicant, group)"
                    variant="soft"
                    icon="i-lucide-thumbs-up"
                    label="Approve"
                    class="w-full flex-row-reverse justify-between"
                    :data-testid="`admin-application-approve-${applicant.application.id}`"
                    :loading="pendingActionKey === stageDecisionActionKey(applicant.application.id, 'approved')"
                    :disabled="pendingActionKey !== null"
                    @click="emit('approve', applicant.application)"
                  />

                  <AppButton
                    v-if="view === 'applications' && applicant.application.status === 'submitted' && canApproveAdminApplicationReviewGroup(group)"
                    :color="hasAdminApplicationReviewGroupApprovalSelected(group) ? 'success' : 'neutral'"
                    :aria-pressed="hasAdminApplicationReviewGroupApprovalSelected(group)"
                    variant="soft"
                    icon="i-lucide-users-round"
                    label="Approve Team"
                    class="w-full flex-row-reverse justify-between"
                    :data-testid="`admin-application-approve-team-${applicant.application.id}`"
                    :loading="pendingActionKey === stageGroupApprovalActionKey(group)"
                    :disabled="pendingActionKey !== null"
                    @click="emit('approveTeam', group.applicants.map(groupApplicant => groupApplicant.application))"
                  />

                  <AppButton
                    v-if="view === 'applications' && applicant.application.status === 'submitted'"
                    :color="hasApplicantRejectionSelected(applicant) ? 'error' : 'neutral'"
                    :aria-pressed="hasApplicantRejectionSelected(applicant)"
                    variant="soft"
                    icon="i-lucide-thumbs-down"
                    label="Reject"
                    class="w-full flex-row-reverse justify-between"
                    :data-testid="`admin-application-reject-${applicant.application.id}`"
                    :loading="pendingActionKey === stageDecisionActionKey(applicant.application.id, 'rejected')"
                    :disabled="pendingActionKey !== null"
                    @click="emit('reject', applicant.application)"
                  />

                  <AppButton
                    v-if="shouldShowWithdrawAction(applicant.application)"
                    color="warning"
                    variant="outline"
                    icon="i-lucide-undo-2"
                    label="Withdraw"
                    class="w-full flex-row-reverse justify-between"
                    :data-testid="`admin-application-withdraw-${applicant.application.id}`"
                    :loading="pendingActionKey === `withdraw:${applicant.application.id}`"
                    :disabled="!getAdminWithdrawalAvailability(applicant.application).isAllowed || pendingActionKey !== null"
                    @click="emit('withdraw', applicant.application)"
                  />

                  <AppButton
                    v-if="shouldShowUndoWithdrawalAction(applicant.application)"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-rotate-ccw"
                    label="Undo"
                    class="w-full flex-row-reverse justify-between"
                    :data-testid="`admin-application-undo-withdrawal-${applicant.application.id}`"
                    :loading="pendingActionKey === `undo-withdrawal:${applicant.application.id}`"
                    :disabled="pendingActionKey !== null"
                    @click="emit('undoWithdrawal', applicant.application)"
                  />
                </div>
              </article>
              <article
                v-for="pendingTeammate in group.pendingTeammates"
                :key="pendingTeammate.id"
                class="px-5 py-5"
              >
                <div class="space-y-1">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Unmatched participant
                  </p>
                  <p class="text-lg font-semibold text-highlighted">
                    {{ formatPendingTeammateLabel(pendingTeammate) }}
                  </p>
                  <p
                    v-if="pendingTeammate.email && pendingTeammate.email !== formatPendingTeammateLabel(pendingTeammate)"
                    class="text-sm text-toned"
                  >
                    {{ pendingTeammate.email }}
                  </p>
                </div>
              </article>
            </div>
          </section>
        </div>

        <AppAlert
          v-else-if="!showAutoApproveApplicationsNotice"
          color="neutral"
          variant="soft"
          :title="emptyState.title"
          :description="emptyState.description"
        />
      </template>
    </div>
  </AppCard>
</template>
