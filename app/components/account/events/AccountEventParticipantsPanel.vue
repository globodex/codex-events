<script setup lang="ts">
import type { AdminApplicationReviewView } from '~/domains/applications/admin-application-review'
import type { AdminApplicationRecord } from '~/domains/applications/admin-application-record'
import type { EventRecord, EventTrack } from '~/domains/events/records'

import { LazyApplicationsAdminApplicationsReviewPanel as LazyAdminApplicationsReviewPanel } from '#components'
import {
  getApprovedParticipantAttendanceSummary,
  getParticipantApplicationStatusSummary,
  getParticipantsLimitSummary,
  listParticipantRosterApplications
} from '~/domains/applications/admin-application-record'

const props = withDefaults(defineProps<{
  eventId: string
  applications: AdminApplicationRecord[]
  isLoading?: boolean
  errorMessage?: string
  pendingActionKey?: string | null
  readOnly?: boolean
  showAiKnowledge?: boolean
  tracks?: Pick<EventTrack, 'id' | 'name' | 'displayOrder'>[]
  participantsLimit?: number | null
  autoApproveApplications?: boolean
  eventState?: EventRecord['state']
  statusCounts?: {
    submitted: number
    approved: number
    rejected: number
    withdrawn: number
  }
}>(), {
  isLoading: false,
  errorMessage: '',
  pendingActionKey: null,
  readOnly: false,
  showAiKnowledge: false,
  tracks: () => [],
  participantsLimit: null,
  autoApproveApplications: false,
  eventState: 'draft',
  statusCounts: undefined
})

const emit = defineEmits<{
  approve: [application: AdminApplicationRecord]
  approveTeam: [applications: AdminApplicationRecord[]]
  reject: [application: AdminApplicationRecord]
  withdraw: [application: AdminApplicationRecord]
  undoWithdrawal: [application: AdminApplicationRecord]
  checkIn: [application: AdminApplicationRecord]
  saveDecisions: []
}>()

const participantView = ref<AdminApplicationReviewView>('applications')

function formatParticipantMetricValue(value: string | number) {
  if (props.isLoading) {
    return 'Loading...'
  }

  if (props.errorMessage) {
    return 'Unavailable'
  }

  return `${value}`
}

const participantRosterApplications = computed(() =>
  listParticipantRosterApplications(props.applications)
)

const participantStatusSummary = computed(() =>
  props.statusCounts
    ? {
        totalCount: props.statusCounts.submitted
          + props.statusCounts.approved
          + props.statusCounts.rejected
          + props.statusCounts.withdrawn,
        submittedCount: props.statusCounts.submitted,
        approvedCount: props.statusCounts.approved,
        rejectedCount: props.statusCounts.rejected,
        withdrawnCount: props.statusCounts.withdrawn
      }
    : getParticipantApplicationStatusSummary(participantRosterApplications.value)
)

const submittedParticipantSummaryValue = computed(() =>
  formatParticipantMetricValue(participantStatusSummary.value.submittedCount)
)

const approvedParticipantSummaryValue = computed(() =>
  formatParticipantMetricValue(participantStatusSummary.value.approvedCount)
)

const approvedParticipantRegistrationSummaryValue = computed(() =>
  formatParticipantMetricValue(`${participantStatusSummary.value.approvedCount} / ${participantStatusSummary.value.totalCount}`)
)

const checkedInParticipantSummaryValue = computed(() =>
  formatParticipantMetricValue(getApprovedParticipantAttendanceSummary(participantRosterApplications.value).value)
)

const rejectedParticipantSummaryValue = computed(() =>
  formatParticipantMetricValue(participantStatusSummary.value.rejectedCount)
)

const withdrawnParticipantSummaryValue = computed(() =>
  formatParticipantMetricValue(participantStatusSummary.value.withdrawnCount)
)

const participantFilters = computed(() => [
  { id: 'applications', label: 'New', count: submittedParticipantSummaryValue.value },
  { id: 'approved', label: 'Approved', count: approvedParticipantSummaryValue.value },
  { id: 'rejected', label: 'Rejected', count: rejectedParticipantSummaryValue.value },
  { id: 'withdrawn', label: 'Withdrawn', count: withdrawnParticipantSummaryValue.value }
] as const)

const participantsLimitSummary = computed(() =>
  getParticipantsLimitSummary(participantRosterApplications.value, props.participantsLimit)
)

// Five summary cards, plus the participants limit card when the event has a limit.
const participantSummaryGridClass = computed(() =>
  participantsLimitSummary.value ? 'xl:grid-cols-6' : 'xl:grid-cols-5'
)
</script>

<template>
  <div class="space-y-4">
    <div
      class="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
      :class="participantSummaryGridClass"
    >
      <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-4 py-4 sm:px-5 sm:py-5">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Awaiting review
        </p>
        <p class="mt-2 text-xl font-semibold text-highlighted">
          {{ submittedParticipantSummaryValue }}
        </p>
      </div>

      <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-4 py-4 sm:px-5 sm:py-5">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Approved
        </p>
        <p class="mt-2 text-xl font-semibold text-highlighted">
          {{ approvedParticipantRegistrationSummaryValue }}
        </p>
        <p class="mt-1 text-xs text-muted">
          Of total registrations
        </p>
      </div>

      <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-4 py-4 sm:px-5 sm:py-5">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Checked in
        </p>
        <p class="mt-2 text-xl font-semibold text-highlighted">
          {{ checkedInParticipantSummaryValue }}
        </p>
        <p class="mt-1 text-xs text-muted">
          Of approved participants
        </p>
      </div>

      <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-4 py-4 sm:px-5 sm:py-5">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Rejected
        </p>
        <p class="mt-2 text-xl font-semibold text-highlighted">
          {{ rejectedParticipantSummaryValue }}
        </p>
      </div>

      <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-4 py-4 sm:px-5 sm:py-5">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Withdrawn
        </p>
        <p class="mt-2 text-xl font-semibold text-highlighted">
          {{ withdrawnParticipantSummaryValue }}
        </p>
      </div>

      <div
        v-if="participantsLimitSummary"
        class="col-span-2 rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-4 py-4 sm:col-span-4 sm:px-5 sm:py-5 xl:col-span-1"
      >
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Participants limit
        </p>
        <p class="mt-2 text-xl font-semibold text-highlighted">
          {{ participantsLimitSummary.participantsLimit }}
        </p>
      </div>
    </div>

    <div class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 flex flex-col gap-4 rounded-xl p-2">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <AppFilterButton
          v-for="filter in participantFilters"
          :key="filter.id"
          :pressed="participantView === filter.id"
          :count="filter.count"
          @click="participantView = filter.id"
        >
          {{ filter.label }}
        </AppFilterButton>
      </div>
    </div>

    <LazyAdminApplicationsReviewPanel
      :event-id="eventId"
      :applications="participantRosterApplications"
      :view="participantView"
      :is-loading="isLoading"
      :error-message="errorMessage"
      :pending-action-key="pendingActionKey"
      :read-only="readOnly"
      search-enabled
      :show-ai-knowledge="showAiKnowledge"
      :tracks="tracks"
      :auto-approve-applications="autoApproveApplications"
      :event-state="eventState"
      @approve="emit('approve', $event)"
      @approve-team="emit('approveTeam', $event)"
      @reject="emit('reject', $event)"
      @withdraw="emit('withdraw', $event)"
      @undo-withdrawal="emit('undoWithdrawal', $event)"
      @check-in="emit('checkIn', $event)"
      @save-decisions="emit('saveDecisions')"
    />
  </div>
</template>
