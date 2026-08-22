<script setup lang="ts">
import type {
  ParticipantRegistrationEvaluation,
  ParticipantRegistrationSectionId
} from '~/domains/applications/participant-registration-definition'

const props = defineProps<{
  evaluation: ParticipantRegistrationEvaluation
  progressPercent: number
  submitLabel: string
  showSubmit?: boolean
  submitting?: boolean
}>()

const emit = defineEmits<{
  navigate: [sectionId: ParticipantRegistrationSectionId]
}>()
</script>

<template>
  <aside
    class="sticky top-6 overflow-hidden rounded-xl border border-black/10 bg-white/90 shadow-[0_24px_54px_-42px_rgba(0,0,0,0.65)] backdrop-blur dark:border-white/10 dark:bg-[#171717]/92"
    data-testid="registration-progress-rail"
  >
    <div class="space-y-3 px-4 pb-3 pt-4">
      <div>
        <h2 class="text-[15px] font-semibold text-highlighted">
          Registration progress
        </h2>
        <p class="mt-1 text-[12px] text-muted">
          {{ props.evaluation.completedRequiredCount }} of {{ props.evaluation.requiredCount }} required items complete
        </p>
      </div>
      <AppMeter
        :value="props.progressPercent"
        size="sm"
        :tone="props.progressPercent === 100 ? 'success' : 'info'"
        label="Required items"
        :value-text="`${props.progressPercent}%`"
      />
    </div>

    <ol class="border-y border-black/8 px-3 dark:border-white/[0.08]">
      <li
        v-for="section in props.evaluation.sections"
        :key="section.id"
        class="border-t border-black/8 first:border-t-0 dark:border-white/[0.08]"
      >
        <button
          type="button"
          class="flex w-full gap-3 px-1 py-3.5 text-left transition-colors hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          :data-testid="`registration-progress-${section.id}`"
          @click="emit('navigate', section.id)"
        >
          <span
            class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border"
            :class="{
              'border-success bg-success text-white': section.state === 'complete',
              'border-error bg-error/10 text-error': section.state === 'error',
              'border-black/25 text-muted dark:border-white/25': section.state === 'incomplete'
            }"
          >
            <AppIcon
              :name="section.state === 'complete'
                ? 'i-lucide-check'
                : section.state === 'error' ? 'i-lucide-triangle-alert' : 'i-lucide-circle'"
              class="size-3"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13px] font-medium text-highlighted">{{ section.title }}</span>
            <span class="mt-0.5 block text-[11px] leading-4 text-muted">{{ section.summary }}</span>
          </span>
          <AppIcon
            name="i-lucide-chevron-right"
            class="mt-1 size-3.5 shrink-0 text-muted"
          />
        </button>
      </li>
    </ol>

    <div
      v-if="props.showSubmit"
      class="p-3"
    >
      <AppButton
        type="submit"
        color="neutral"
        variant="solid"
        :loading="props.submitting"
        :disabled="props.submitting"
        class="w-full justify-center bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
      >
        {{ props.submitLabel }}
      </AppButton>
    </div>
  </aside>
</template>
