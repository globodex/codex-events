<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { useIntervalFn, useNow } from '@vueuse/core'

import type { CountdownPostTargetState } from '~/utils/countdown'

import {
  formatCountdownAccessibleLabel,
  formatCountdownCompactLabel,
  resolveCountdownState
} from '~/utils/countdown'
import { formatTimestamp } from '~/lib/date-formatting'
import { cn } from '~/lib/utils'

const props = withDefaults(defineProps<{
  title: string
  description?: string
  targetAt: string | number | Date | null | undefined
  targetLabel?: string
  countdownLabel?: string
  waitingTitle?: string
  waitingDescription?: string
  expiredTitle?: string
  expiredDescription?: string
  postTargetState?: CountdownPostTargetState
  tone?: 'primary' | 'secondary' | 'neutral' | 'success' | 'warning' | 'error' | 'info'
  variant?: 'card' | 'inline'
  showSeconds?: boolean
  showTimestamp?: boolean
  showLocalTimeNote?: boolean
  class?: HTMLAttributes['class']
}>(), {
  description: undefined,
  targetLabel: 'Scheduled for',
  countdownLabel: 'Time remaining',
  waitingTitle: 'Scheduled time reached',
  waitingDescription: 'This surface will update once the relevant product state changes.',
  expiredTitle: 'Countdown complete',
  expiredDescription: 'This scheduled time has passed.',
  postTargetState: 'expired',
  tone: 'info',
  variant: 'card',
  showSeconds: false,
  showTimestamp: true,
  showLocalTimeNote: false
})

const now = useNow({
  scheduler: callback => useIntervalFn(callback, props.showSeconds ? 1_000 : 60_000)
})

const countdownState = computed(() =>
  resolveCountdownState(props.targetAt, {
    now: now.value,
    postTargetState: props.postTargetState
  })
)

const countdownSummary = computed(() => {
  if (countdownState.value.phase !== 'counting_down') {
    return null
  }

  return formatCountdownCompactLabel(countdownState.value.segments, {
    includeSeconds: props.showSeconds,
    maxUnits: props.variant === 'inline' ? 3 : props.showSeconds ? 4 : 3
  })
})

const countdownAccessibleSummary = computed(() => {
  if (countdownState.value.phase !== 'counting_down') {
    return null
  }

  return formatCountdownAccessibleLabel(countdownState.value.segments, {
    includeSeconds: props.showSeconds
  })
})

const statusLabel = computed(() => {
  if (!countdownState.value.isTargetValid) {
    return 'Unavailable'
  }

  switch (countdownState.value.phase) {
    case 'counting_down':
      return 'Upcoming'
    case 'waiting':
      return 'Waiting'
    default:
      return 'Ended'
  }
})

const statusColor = computed(() => {
  if (!countdownState.value.isTargetValid) {
    return 'neutral'
  }

  switch (countdownState.value.phase) {
    case 'counting_down':
      return props.tone
    case 'waiting':
      return 'warning'
    default:
      return 'neutral'
  }
})

const surfaceToneClass = computed(() => {
  if (!countdownState.value.isTargetValid) {
    return 'bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.72))] dark:bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.16),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.82),rgba(16,16,16,0.74))]'
  }

  if (countdownState.value.phase === 'waiting') {
    return 'bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.72))] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.20),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.14),transparent_32%),linear-gradient(180deg,rgba(24,24,27,0.82),rgba(16,16,16,0.74))]'
  }

  if (countdownState.value.phase === 'expired') {
    return 'bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.10),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.72))] dark:bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.10),transparent_30%),linear-gradient(180deg,rgba(24,24,27,0.82),rgba(16,16,16,0.74))]'
  }

  switch (props.tone) {
    case 'success':
      return 'bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.72))] dark:bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_32%),linear-gradient(180deg,rgba(24,24,27,0.82),rgba(16,16,16,0.74))]'
    case 'warning':
      return 'bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.72))] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.20),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.14),transparent_32%),linear-gradient(180deg,rgba(24,24,27,0.82),rgba(16,16,16,0.74))]'
    case 'primary':
      return 'bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.72))] dark:bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.20),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_32%),linear-gradient(180deg,rgba(24,24,27,0.82),rgba(16,16,16,0.74))]'
    case 'error':
      return 'bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.72))] dark:bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.20),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.14),transparent_32%),linear-gradient(180deg,rgba(24,24,27,0.82),rgba(16,16,16,0.74))]'
    case 'secondary':
      return 'bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.72))] dark:bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.14),transparent_32%),linear-gradient(180deg,rgba(24,24,27,0.82),rgba(16,16,16,0.74))]'
    case 'neutral':
      return 'bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(203,213,225,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.72))] dark:bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(71,85,105,0.14),transparent_30%),linear-gradient(180deg,rgba(24,24,27,0.82),rgba(16,16,16,0.74))]'
    default:
      return 'bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.72))] dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.20),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_32%),linear-gradient(180deg,rgba(24,24,27,0.82),rgba(16,16,16,0.74))]'
  }
})

const phaseTitle = computed(() => {
  if (!countdownState.value.isTargetValid) {
    return 'Schedule unavailable'
  }

  switch (countdownState.value.phase) {
    case 'waiting':
      return props.waitingTitle
    case 'expired':
      return props.expiredTitle
    default:
      return props.title
  }
})

const phaseDescription = computed(() => {
  if (!countdownState.value.isTargetValid) {
    return 'The scheduled time for this surface is unavailable right now.'
  }

  switch (countdownState.value.phase) {
    case 'waiting':
      return props.waitingDescription
    case 'expired':
      return props.expiredDescription
    default:
      return props.description
  }
})

const normalizedTargetAt = computed(() => {
  if (props.targetAt instanceof Date) {
    return Number.isNaN(props.targetAt.getTime()) ? null : props.targetAt.toISOString()
  }

  if (typeof props.targetAt === 'number') {
    const date = new Date(props.targetAt)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  return typeof props.targetAt === 'string' ? props.targetAt : null
})

const targetTimestampLabel = computed(() => formatTimestamp(normalizedTargetAt.value, 'Not scheduled'))

const inlineRootClass = computed(() =>
  cn(
    'rounded-xl border border-black/8 bg-white/78 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-white/[0.10] dark:bg-[#151515]/64 countdown-surface px-4 py-4',
    surfaceToneClass.value,
    props.class
  )
)

const cardRootClass = computed(() =>
  cn(
    'rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60 overflow-hidden',
    props.class
  )
)

const countdownSurfaceClass = computed(() =>
  cn(
    'rounded-xl border border-black/8 bg-white/78 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-white/[0.10] dark:bg-[#151515]/64 countdown-surface relative overflow-hidden px-5 py-5',
    surfaceToneClass.value
  )
)

const visibleSegments = computed(() =>
  props.showSeconds
    ? countdownState.value.segments
    : countdownState.value.segments.filter(segment => segment.key !== 'seconds')
)

const countdownGridClass = computed(() =>
  props.showSeconds
    ? 'grid grid-cols-2 gap-3 sm:grid-cols-4'
    : 'grid grid-cols-2 gap-3 sm:grid-cols-3'
)

const skeletonSegmentCount = computed(() => props.showSeconds ? 4 : 3)
</script>

<template>
  <div
    v-if="props.variant === 'inline'"
    :class="inlineRootClass"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <AppBadge
            :color="statusColor"
            variant="soft"
            class="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
          >
            {{ statusLabel }}
          </AppBadge>
          <p class="text-sm font-semibold text-highlighted dark:text-white">
            {{ phaseTitle }}
          </p>
        </div>

        <p
          v-if="countdownState.phase === 'counting_down' && countdownSummary"
          class="text-sm text-neutral-700 dark:text-[#D2D2D2]"
        >
          {{ props.countdownLabel }} {{ countdownSummary }}
        </p>
        <p
          v-else-if="phaseDescription"
          class="text-sm text-neutral-700 dark:text-[#D2D2D2]"
        >
          {{ phaseDescription }}
        </p>
      </div>

      <div
        v-if="props.showTimestamp"
        class="text-right"
      >
        <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-[#8C8C8C]">
          {{ props.targetLabel }}
        </p>
        <p class="mt-1 text-sm font-semibold text-highlighted dark:text-white">
          {{ targetTimestampLabel }}
        </p>
      </div>
    </div>
  </div>

  <AppCard
    v-else
    :class="cardRootClass"
  >
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-highlighted dark:text-white">
            {{ phaseTitle }}
          </h2>
          <p
            v-if="phaseDescription"
            class="text-sm text-neutral-600 dark:text-[#A3A3A3]"
          >
            {{ phaseDescription }}
          </p>
        </div>

        <AppBadge
          :color="statusColor"
          variant="soft"
          class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
        >
          {{ statusLabel }}
        </AppBadge>
      </div>
    </template>

    <div :class="countdownSurfaceClass">
      <div class="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/35 opacity-60 dark:border-white/[0.08]" />

      <div class="relative space-y-5">
        <template v-if="countdownState.phase === 'counting_down' && countdownState.isTargetValid">
          <div class="flex flex-wrap items-center gap-3">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              {{ props.countdownLabel }}
            </p>
          </div>

          <span
            v-if="countdownAccessibleSummary"
            class="sr-only"
          >
            {{ props.countdownLabel }} {{ countdownAccessibleSummary }}
          </span>

          <ClientOnly>
            <div
              aria-hidden="true"
              :class="countdownGridClass"
            >
              <div
                v-for="segment in visibleSegments"
                :key="segment.key"
                class="countdown-segment rounded-[1.15rem] border border-black/8 bg-white/76 px-4 py-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.55)] backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
              >
                <p class="text-3xl font-semibold tracking-[-0.05em] text-highlighted dark:text-white sm:text-[2rem]">
                  {{ segment.displayValue }}
                </p>
                <p class="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-[#A3A3A3]">
                  {{ segment.label }}
                </p>
              </div>
            </div>

            <template #fallback>
              <div
                aria-hidden="true"
                :class="countdownGridClass"
              >
                <div
                  v-for="skeletonIndex in skeletonSegmentCount"
                  :key="skeletonIndex"
                  class="rounded-[1.15rem] border border-black/8 bg-white/68 px-4 py-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.04]"
                >
                  <div class="h-8 w-14 animate-pulse rounded bg-black/7 dark:bg-white/[0.08]" />
                  <div class="mt-2 h-3 w-12 animate-pulse rounded bg-black/6 dark:bg-white/[0.07]" />
                </div>
              </div>
            </template>
          </ClientOnly>
        </template>

        <template v-else>
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              {{ props.countdownLabel }}
            </p>
            <p class="text-lg font-semibold text-highlighted dark:text-white">
              {{ phaseTitle }}
            </p>
            <p class="max-w-2xl text-sm text-neutral-700 dark:text-[#D2D2D2]">
              {{ phaseDescription }}
            </p>
          </div>
        </template>

        <div
          v-if="props.showTimestamp"
          class="border-t border-black/8 pt-4 dark:border-white/[0.08]"
        >
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {{ props.targetLabel }}
          </p>
          <p class="mt-2 text-lg font-semibold text-highlighted dark:text-white">
            {{ targetTimestampLabel }}
          </p>
          <p
            v-if="props.showLocalTimeNote"
            class="mt-1 text-xs text-neutral-500 dark:text-[#8C8C8C]"
          >
            Shown in your local time
          </p>
        </div>
      </div>
    </div>
  </AppCard>
</template>

<style scoped>
.countdown-surface::after {
  content: '';
  position: absolute;
  right: -5rem;
  top: -6rem;
  height: 16rem;
  width: 16rem;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.2), transparent 66%);
  opacity: 0.8;
  filter: blur(10px);
  pointer-events: none;
  animation: countdown-float 12s ease-in-out infinite;
}

.countdown-segment {
  transition:
    transform 220ms ease,
    border-color 220ms ease,
    background-color 220ms ease;
}

.countdown-segment:hover {
  transform: translateY(-1px);
}

@keyframes countdown-float {
  0%,
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(-10px, 12px, 0) scale(1.05);
  }
}
</style>
