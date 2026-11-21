<script setup lang="ts">
import type { JudgeAssignmentDetail } from '~/domains/judging/workspace'

import JudgeAssignmentStatusBadge from '~/components/judging/JudgeAssignmentStatusBadge.vue'
import {
  formatJudgeIneligibilityStatus,
  getJudgeSubmissionPanelDisplay,
  resolveJudgeIneligibilityColor
} from '~/domains/judging/workspace'

const props = defineProps<{
  assignment: JudgeAssignmentDetail
}>()

const display = computed(() => getJudgeSubmissionPanelDisplay(props.assignment))
</script>

<template>
  <AppCard class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
    <template #header>
      <div class="space-y-3">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            {{ display.overline }}
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <h2
              data-testid="judge-assignment-project-name"
              class="text-xl font-semibold text-highlighted dark:text-white"
            >
              {{ display.title }}
            </h2>

            <div
              data-testid="judge-assignment-status"
              class="flex items-center"
            >
              <JudgeAssignmentStatusBadge :status="display.status" />
            </div>

            <AppBadge
              data-testid="judge-assignment-ineligibility"
              :color="resolveJudgeIneligibilityColor(display.ineligibilityStatus)"
              variant="soft"
              class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
            >
              {{ formatJudgeIneligibilityStatus(display.ineligibilityStatus) }}
            </AppBadge>
          </div>
        </div>
      </div>
    </template>

    <div
      :data-testid="display.bodyTestId"
      class="space-y-6"
    >
      <div
        class="grid gap-6"
        :class="display.detailCards.length > 0 ? 'lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start' : ''"
      >
        <div class="min-w-0 space-y-2">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Submission description
          </p>
          <p class="text-sm leading-7 text-toned">
            {{ display.summary }}
          </p>
        </div>

        <div
          v-if="display.detailCards.length > 0"
          class="space-y-3"
        >
          <div
            v-for="detailCard in display.detailCards"
            :key="detailCard.label"
            class="rounded-xl border border-black/8 bg-[#F7F7F8] px-4 py-3 dark:border-white/[0.08] dark:bg-[#171717]"
          >
            <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              {{ detailCard.label }}
            </p>
            <p class="mt-1 text-[15px] font-semibold text-highlighted dark:text-white">
              {{ detailCard.title }}
            </p>
            <AppMarkdownRenderer
              v-if="detailCard.markdownDescription !== null"
              :source="detailCard.markdownDescription"
              class="mt-1"
            />
          </div>
        </div>
      </div>

      <div
        v-if="display.repositoryUrl || display.demoUrl"
        class="flex flex-wrap gap-3"
      >
        <AppButton
          v-if="display.repositoryUrl"
          :to="display.repositoryUrl"
          target="_blank"
          rel="noreferrer"
          color="primary"
          variant="soft"
          icon="i-lucide-github"
          trailing-icon="i-lucide-external-link"
          class="rounded-lg"
        >
          Repository
        </AppButton>

        <AppButton
          v-if="display.demoUrl"
          :to="display.demoUrl"
          target="_blank"
          rel="noreferrer"
          color="neutral"
          variant="outline"
          icon="i-lucide-monitor-play"
          trailing-icon="i-lucide-external-link"
          class="rounded-lg"
        >
          Demo
        </AppButton>
      </div>

      <div
        v-if="$slots.default"
        class="space-y-5 border-t border-black/8 pt-6 dark:border-white/[0.08]"
      >
        <slot />
      </div>
    </div>
  </AppCard>
</template>
