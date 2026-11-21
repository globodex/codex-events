<script setup lang="ts">
import type { EventRecord } from '~/domains/events/records'
import type {
  AccountEventJudgingPage,
  AccountJudgeAssignmentWorkspacePage
} from '#shared/domains/events/account-event-judging-page'

import {
  LazyJudgingJudgeAssignmentInboxCard as LazyJudgeAssignmentInboxCard,
  LazyJudgingOrganismsJudgeAssignmentWorkspacePanel as LazyJudgeAssignmentWorkspacePanel
} from '#components'
import { buildAccountEventJudgingTabHref } from '~/domains/judging/query'
import { normalizeJudgeAssignmentDetail } from '~/domains/judging/workspace'
import type { JudgeAssignmentApiDetail } from '~/domains/judging/workspace'

const props = withDefaults(defineProps<{
  eventId: string
  slug: string
  selectedAssignmentId?: string | null
  page: AccountEventJudgingPage | null
  isLoading?: boolean
  loadErrorMessage?: string
  refreshPage?: () => Promise<unknown> | unknown
  assignmentPage: AccountJudgeAssignmentWorkspacePage | null
  assignmentPageIsLoading?: boolean
  assignmentPageErrorMessage?: string
  refreshAssignmentPage?: () => Promise<unknown> | unknown
}>(), {
  selectedAssignmentId: null,
  isLoading: false,
  loadErrorMessage: '',
  refreshPage: undefined,
  assignmentPageIsLoading: false,
  assignmentPageErrorMessage: '',
  refreshAssignmentPage: undefined
})

const emit = defineEmits<{
  updated: []
}>()

const selectedAssignmentId = computed(() => props.selectedAssignmentId?.trim() ?? '')
const pageStatus = computed(() => {
  if (props.isLoading) {
    return 'pending'
  }

  if (props.loadErrorMessage) {
    return 'error'
  }

  return props.page ? 'success' : 'idle'
})
const pageError = computed(() => props.loadErrorMessage
  ? new Error(props.loadErrorMessage)
  : null)
const workspace = {
  status: pageStatus,
  error: pageError,
  refreshWorkspace: () => props.refreshPage?.()
}
const currentEvent = computed(() =>
  props.page?.event as unknown as EventRecord | null
)
const assignmentEvent = computed(() =>
  props.assignmentPage?.event as unknown as EventRecord | null
)
const selectedEvent = computed(() =>
  assignmentEvent.value
  ?? currentEvent.value
  ?? ({ id: props.eventId, slug: props.slug } as unknown as EventRecord)
)
const assignments = computed(() =>
  (props.page?.assignments ?? []).map(assignment =>
    normalizeJudgeAssignmentDetail(assignment as unknown as JudgeAssignmentApiDetail)
  )
)
const inReviewCount = computed(() =>
  assignments.value.filter(assignment => assignment.status === 'judge_started').length
)
const readyCount = computed(() =>
  assignments.value.filter(assignment => assignment.status === 'assigned').length
)
const nextQueuedAssignment = computed(() =>
  assignments.value.find(assignment =>
    assignment.status === 'assigned'
    && assignment.id !== selectedAssignmentId.value
  ) ?? null
)
const nextQueuedReviewHref = computed(() =>
  currentEvent.value && nextQueuedAssignment.value
    ? buildAccountEventJudgingTabHref(currentEvent.value.slug, nextQueuedAssignment.value.id)
    : null
)

const nextAction = computed(() => {
  const inProgress = assignments.value.find(assignment => assignment.status === 'judge_started')

  if (inProgress && currentEvent.value) {
    return {
      label: 'Continue review',
      to: buildAccountEventJudgingTabHref(currentEvent.value.slug, inProgress.id)
    }
  }

  const ready = assignments.value.find(assignment => assignment.status === 'assigned')

  if (ready && currentEvent.value) {
    return {
      label: 'Start next review',
      to: buildAccountEventJudgingTabHref(currentEvent.value.slug, ready.id)
    }
  }

  return null
})

async function refreshWorkspace() {
  if (selectedAssignmentId.value) {
    await props.refreshAssignmentPage?.()
  } else {
    await workspace.refreshWorkspace()
  }

  emit('updated')
}
</script>

<template>
  <div class="space-y-6">
    <AppAlert
      v-if="workspace.error.value && !selectedAssignmentId"
      color="error"
      variant="soft"
      title="Judging workspace unavailable"
      :description="workspace.error.value.message"
    />

    <AppAlert
      v-else-if="!selectedAssignmentId && workspace.status.value === 'pending' && !currentEvent"
      color="neutral"
      variant="soft"
      title="Loading judging workspace"
      description="Fetching your blind-review queue for this event."
    />

    <AppAlert
      v-else-if="!selectedAssignmentId && !currentEvent"
      color="warning"
      variant="soft"
      title="Judge access required"
      description="This event is not currently assigned to you as a judge."
    />

    <template v-else-if="selectedAssignmentId">
      <LazyJudgeAssignmentWorkspacePanel
        :event-id="selectedEvent.id"
        :event-slug="selectedEvent.slug"
        :assignment-id="selectedAssignmentId"
        :next-review-href="nextQueuedReviewHref"
        :page="props.assignmentPage"
        :is-loading="props.assignmentPageIsLoading"
        :load-error-message="props.assignmentPageErrorMessage"
        :refresh-page="props.refreshAssignmentPage"
        @updated="refreshWorkspace"
      />
    </template>

    <template v-else-if="currentEvent">
      <section class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-xl !border !border-black/8 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 p-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Active assignments
          </p>
          <p class="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] text-highlighted dark:text-white">
            {{ assignments.length }}
          </p>
        </div>

        <div class="rounded-xl !border !border-black/8 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 p-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            In review
          </p>
          <p class="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] text-highlighted dark:text-white">
            {{ inReviewCount }}
          </p>
        </div>

        <div class="rounded-xl !border !border-black/8 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 p-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Ready to start
          </p>
          <p class="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] text-highlighted dark:text-white">
            {{ readyCount }}
          </p>
        </div>
      </section>

      <section
        v-if="nextAction"
        class="rounded-xl !border !border-black/8 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-1">
            <p class="text-[15px] font-semibold text-highlighted dark:text-white">
              Continue in blind review
            </p>
            <p class="text-[13px] text-muted">
              Pick up your next assignment directly from this event workspace.
            </p>
          </div>

          <AppButton
            :to="nextAction.to"
            color="neutral"
            variant="soft"
            class="rounded-lg px-3 py-1.5 text-[13px] font-medium"
          >
            {{ nextAction.label }}
          </AppButton>
        </div>
      </section>

      <section
        v-if="assignments.length === 0"
        class="rounded-xl !border !border-dashed !border-black/10 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 p-8 text-center"
      >
        <p class="text-[15px] font-medium text-highlighted dark:text-white">
          No active blind reviews for this event
        </p>
        <p class="mt-2 text-[14px] text-neutral-500 dark:text-[#A3A3A3]">
          New assignments will appear here after judging starts.
        </p>
      </section>

      <section
        v-else
        class="grid gap-4"
      >
        <LazyJudgeAssignmentInboxCard
          v-for="assignment in assignments"
          :key="assignment.id"
          :assignment="assignment"
          :event-slug="currentEvent.slug"
        />
      </section>
    </template>
  </div>
</template>
