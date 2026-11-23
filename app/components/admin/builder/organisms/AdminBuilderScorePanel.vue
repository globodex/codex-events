<script setup lang="ts">
// The one score of the event builder: a ring with the event balance, four bars for what the
// balance is made of, and at most one tip.
import type { EventBalanceResult } from '#shared/domains/events/builder-scoring'
import type { EventBuilderBlockInstance } from '~/domains/events/builder'
import { getTotalAgendaDurationMinutes } from '~/domains/events/builder'
import AdminBuilderMeterRow from '~/components/admin/builder/molecules/AdminBuilderMeterRow.vue'
import AdminBuilderScienceDialog from '~/components/admin/builder/molecules/AdminBuilderScienceDialog.vue'
import AdminBuilderScoreRing from '~/components/admin/builder/molecules/AdminBuilderScoreRing.vue'
import AdminBuilderTipRow from '~/components/admin/builder/molecules/AdminBuilderTipRow.vue'

const props = defineProps<{
  report: EventBalanceResult
  blocks: EventBuilderBlockInstance[]
}>()

// An agenda without blocks has no score yet: the ring and the bars stay empty.
const hasScoredAgenda = computed(() => props.blocks.length > 0)

const totalDurationLabel = computed(() => {
  const total = getTotalAgendaDurationMinutes(props.blocks)
  const hours = Math.floor(total / 60)
  const minutes = total % 60

  if (hours === 0) {
    return `${minutes}m`
  }

  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
})

const bandColor = computed(() => {
  switch (props.report.band.id) {
    case 'excellent':
      return 'success' as const
    case 'good':
      return 'info' as const
    case 'fair':
      return 'warning' as const
    default:
      return 'error' as const
  }
})

function meterTone(value: number) {
  if (value >= 80) {
    return 'success' as const
  }

  if (value >= 60) {
    return 'info' as const
  }

  return value >= 40 ? 'warning' as const : 'error' as const
}

const meters = computed(() => [
  {
    icon: 'i-lucide-zap',
    label: 'Audience energy',
    value: props.report.breakdown.energyCurve,
    description: 'The room\'s battery through the clock: people tire as the day runs and recharge with real breaks and food.'
  },
  {
    icon: 'i-lucide-crosshair',
    label: 'Participants focus',
    value: props.report.breakdown.focusBudget,
    description: 'How much concentrating the program asks in total, against what this format can take. Fewer or shorter heavy sessions raise it.'
  },
  {
    icon: 'i-lucide-shuffle',
    label: 'Activity variety',
    value: props.report.breakdown.boredomRisk,
    description: 'How often the format changes. Repeating the same kind of session or letting passive blocks run long lowers it.'
  },
  {
    icon: 'i-lucide-heart',
    label: 'Return intent',
    value: props.report.breakdown.returnIntent,
    description: 'How likely people are to come back. A strong closing, social time, food, and early registration raise it.'
  }
].map(meter => ({ ...meter, value: hasScoredAgenda.value ? meter.value : 0 })))

// One tip at a time: when the organizer fixes it, the next one appears.
const tip = computed(() => props.report.tips.find(entry => entry.tone === 'warning') ?? null)

// Debounced announcement so drag storms don't spam screen readers.
const announcement = ref('')
let announceTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.report.score, (score) => {
  if (announceTimer) {
    clearTimeout(announceTimer)
  }

  announceTimer = setTimeout(() => {
    announcement.value = `Balance score ${score}. ${props.report.band.label}.`
  }, 800)
})

onBeforeUnmount(() => {
  if (announceTimer) {
    clearTimeout(announceTimer)
  }
})
</script>

<template>
  <AppCard
    variant="subtle"
    :ui="{ body: 'p-4' }"
    class="relative"
    data-testid="event-builder-score"
  >
    <div class="absolute right-2 top-2">
      <AdminBuilderScienceDialog />
    </div>

    <div class="flex items-center gap-5 lg:flex-col lg:items-stretch lg:gap-4">
      <div class="flex shrink-0 flex-col items-center gap-2">
        <AdminBuilderScoreRing
          :value="hasScoredAgenda ? report.score : 0"
          :tone="bandColor"
        />
        <div
          v-if="hasScoredAgenda"
          class="flex items-center gap-2 text-xs text-muted"
        >
          <AppBadge
            :key="report.band.id"
            :color="bandColor"
            variant="soft"
            size="sm"
            data-testid="event-builder-score-band"
            class="animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none"
          >
            {{ report.band.label }}
          </AppBadge>
          <span
            class="tabular-nums"
            data-testid="event-builder-total-duration"
          >{{ totalDurationLabel }}</span>
        </div>
      </div>

      <div class="min-w-0 flex-1 space-y-3">
        <div class="space-y-2.5 pr-7 lg:pr-0">
          <AdminBuilderMeterRow
            v-for="meter in meters"
            :key="meter.label"
            :icon="meter.icon"
            :label="meter.label"
            :value="meter.value"
            :tone="meterTone(meter.value)"
            :description="meter.description"
          />
        </div>

        <ul
          v-if="hasScoredAgenda && tip"
          data-testid="event-builder-coach-tip"
        >
          <AdminBuilderTipRow :tip="tip" />
        </ul>
      </div>
    </div>

    <p
      class="sr-only"
      aria-live="polite"
    >
      {{ announcement }}
    </p>
  </AppCard>
</template>
