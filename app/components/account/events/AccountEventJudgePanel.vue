<script setup lang="ts">
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
  selectedAssignmentId?: string | null
  page: AccountEventJudgingPage | null
  isLoading?: boolean
  loadErrorMessage?: string
  assignmentPage: AccountJudgeAssignmentWorkspacePage | null
  assignmentPageErrorMessage?: string
  onSaved: (review: AccountJudgeAssignmentWorkspacePage, assignment: JudgeAssignmentApiDetail) => void
}>(), {
  selectedAssignmentId: null,
  isLoading: false,
  loadErrorMessage: '',
  assignmentPageErrorMessage: ''
})

const selectedAssignmentId = computed(() => props.selectedAssignmentId?.trim() ?? '')
const currentEvent = computed(() => props.page?.event)
const assignments = computed(() =>
  (props.page?.assignments ?? []).map(assignment =>
    normalizeJudgeAssignmentDetail(assignment as JudgeAssignmentApiDetail)
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
</script>

<template>
  <div class="space-y-6">
    <LazyJudgeAssignmentWorkspacePanel
      v-if="selectedAssignmentId && assignmentPage?.assignment.id === selectedAssignmentId"
      :key="selectedAssignmentId"
      :next-review-href="nextQueuedReviewHref"
      :page="assignmentPage"
      :on-saved="props.onSaved"
    />

    <AppAlert
      v-else-if="selectedAssignmentId && assignmentPageErrorMessage"
      color="warning"
      variant="soft"
      title="Judge review unavailable"
      :description="assignmentPageErrorMessage"
    />

    <AppAlert
      v-else-if="!selectedAssignmentId && props.loadErrorMessage"
      color="error"
      variant="soft"
      title="Judging workspace unavailable"
      :description="props.loadErrorMessage"
    />

    <AppAlert
      v-else-if="selectedAssignmentId || props.isLoading || !currentEvent"
      color="neutral"
      variant="soft"
      title="Loading judging workspace"
      description="Fetching your blind-review queue for this event."
    />

    <template v-else>
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
