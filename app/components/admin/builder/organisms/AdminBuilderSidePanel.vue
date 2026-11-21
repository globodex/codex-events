<script setup lang="ts">
import type { EventBalanceResult } from '#shared/domains/events/builder-scoring'
import type { EventBuilderBlockInstance, EventBuilderChecklistItem, EventBuilderScheduleEntry } from '~/domains/events/builder'
import { getTotalAgendaDurationMinutes } from '~/domains/events/builder'
import { formatLocalTime } from '~/lib/date-formatting'
import AdminBuilderChecklistRow from '~/components/admin/builder/molecules/AdminBuilderChecklistRow.vue'
import AdminBuilderMeterRow from '~/components/admin/builder/molecules/AdminBuilderMeterRow.vue'
import AdminBuilderScienceDialog from '~/components/admin/builder/molecules/AdminBuilderScienceDialog.vue'
import AdminBuilderScoreRing from '~/components/admin/builder/molecules/AdminBuilderScoreRing.vue'
import AdminBuilderSparkline from '~/components/admin/builder/molecules/AdminBuilderSparkline.vue'
import AdminBuilderTipRow from '~/components/admin/builder/molecules/AdminBuilderTipRow.vue'

const props = defineProps<{
  checklist: EventBuilderChecklistItem[]
  report: EventBalanceResult
  blocks: EventBuilderBlockInstance[]
  schedule: EventBuilderScheduleEntry[]
  canSubmit: boolean
  isSubmitting: boolean
  submitError: string
  submitLabel: string
}>()

const emit = defineEmits<{
  submit: []
  focusField: [item: EventBuilderChecklistItem]
}>()

const remaining = computed(() => props.checklist.filter(item => !item.complete).length)
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

const timeRangeLabel = computed(() => {
  const firstStart = props.schedule[0]?.startsAt

  if (!firstStart) {
    return ''
  }

  let start = firstStart
  let end = firstStart

  for (const entry of props.schedule) {
    const endOrStart = entry.endsAt || entry.startsAt
    if (entry.startsAt < start) start = entry.startsAt
    if (endOrStart > end) end = endOrStart
  }

  return start === end
    ? `Starts at ${formatLocalTime(start)}`
    : `From ${formatLocalTime(start)} to ${formatLocalTime(end)}`
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

const blockLabels = computed(() => props.blocks.map(block => block.title))

// Focus plots what is LEFT of the budget: a resource draining, like energy.
const focusPercentByItem = computed(() =>
  props.report.focusByItem.map(value =>
    props.report.focusBudget > 0
      ? Math.max(0, 100 - (value / props.report.focusBudget) * 100)
      : 100
  )
)

const warnings = computed(() => props.report.tips.filter(tip => tip.tone === 'warning'))

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
  <!-- One scroll only: the page. The panel sticks while it fits and scrolls with the grid otherwise. -->
  <div class="space-y-3 lg:sticky lg:top-6 lg:self-start">
    <div class="space-y-3">
      <AppCard
        variant="subtle"
        :ui="{ body: 'p-4' }"
      >
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Checklist
            </p>
            <AppBadge
              :color="remaining === 0 ? 'success' : 'neutral'"
              variant="soft"
              size="sm"
              class="tabular-nums"
            >
              {{ checklist.length - remaining }} / {{ checklist.length }}
            </AppBadge>
          </div>

          <ul>
            <AdminBuilderChecklistRow
              v-for="item in checklist"
              :key="item.id"
              :item="item"
              @focus-field="value => emit('focusField', value)"
            />
          </ul>
        </div>
      </AppCard>

      <AppCard
        variant="subtle"
        :ui="{ body: 'p-4' }"
      >
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Event health
            </p>
            <AdminBuilderScienceDialog />
          </div>

          <div
            v-if="!hasScoredAgenda"
            class="text-sm text-muted"
            data-testid="event-builder-score-empty"
          >
            Add session blocks to start scoring. Pick a template or build from the palette.
          </div>

          <template v-else>
            <div class="space-y-2.5">
              <AdminBuilderMeterRow
                icon="i-lucide-zap"
                label="Audience energy"
                :value="report.breakdown.energyCurve"
                :tone="meterTone(report.breakdown.energyCurve)"
                description="The room's battery through the clock: people tire as the day runs and recharge with real breaks and food. The same sessions land differently depending on when you recover."
              />
              <AdminBuilderMeterRow
                icon="i-lucide-crosshair"
                label="Participants focus"
                :value="report.breakdown.focusBudget"
                :tone="meterTone(report.breakdown.focusBudget)"
                :value-text="`${report.focusSpent} / ${report.focusBudget}`"
                :verdict="report.focusState === 'balanced' ? 'Good' : report.focusState === 'thin' ? 'Thin' : 'Heavy'"
                description="The day's attention bill: how much concentrating the program asks in total, against what this format can take. Breaks do not shrink the bill; fewer or shorter heavy sessions do."
              />
              <AdminBuilderMeterRow
                icon="i-lucide-shuffle"
                label="Activity variety"
                :value="report.breakdown.boredomRisk"
                :tone="meterTone(report.breakdown.boredomRisk)"
                description="How often the format changes. Repeating the same kind of session or letting passive blocks run long lowers it."
              />
              <AdminBuilderMeterRow
                icon="i-lucide-heart"
                label="Return intent"
                :value="report.breakdown.returnIntent"
                :tone="meterTone(report.breakdown.returnIntent)"
                description="How likely people are to come back. A strong closing, social time, food, and early registration raise it."
              />
            </div>
          </template>
        </div>
      </AppCard>

      <AppCard
        v-if="hasScoredAgenda && !report.breakdown.lowConfidence"
        variant="subtle"
        :ui="{ body: 'p-4' }"
      >
        <div class="space-y-3">
          <div class="space-y-1">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Audience energy
            </p>
            <AdminBuilderSparkline
              :values="report.energyByItem"
              :labels="blockLabels"
              :label="`Energy across ${blocks.length} blocks`"
              height-class="h-9"
              tone="energy"
              :threshold="report.energyMinimum < 45 ? 35 : null"
            />
          </div>
          <div class="space-y-1">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Participants focus
            </p>
            <AdminBuilderSparkline
              :values="focusPercentByItem"
              :labels="blockLabels"
              :label="`Focus remaining across ${blocks.length} blocks`"
              height-class="h-9"
              tone="focus"
              :threshold="focusPercentByItem.some(value => value < 20) ? 10 : null"
            />
          </div>
          <p class="text-[10px] uppercase tracking-[0.14em] text-dimmed">
            One point per agenda block
          </p>
        </div>
      </AppCard>

      <AppCard
        variant="subtle"
        :ui="{ body: 'p-4' }"
      >
        <div class="flex items-center gap-4">
          <AdminBuilderScoreRing
            :value="hasScoredAgenda ? report.score : 0"
            :tone="bandColor"
          />
          <div class="space-y-1.5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Event balance
            </p>
            <AppBadge
              :key="report.band.id"
              :color="bandColor"
              variant="soft"
              data-testid="event-builder-score-band"
              class="animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none"
            >
              {{ hasScoredAgenda ? report.band.label : 'No agenda yet' }}
            </AppBadge>
            <div
              v-if="hasScoredAgenda"
              class="space-y-0.5 text-xs text-muted"
            >
              <p data-testid="event-builder-total-duration">
                Total duration {{ totalDurationLabel }}
              </p>
              <p
                v-if="timeRangeLabel"
                data-testid="event-builder-time-range"
                class="tabular-nums"
              >
                {{ timeRangeLabel }}
              </p>
            </div>
          </div>
        </div>
        <p
          class="sr-only"
          aria-live="polite"
        >
          {{ announcement }}
        </p>
      </AppCard>

      <AppCard
        v-if="hasScoredAgenda && warnings.length > 0"
        variant="subtle"
        :ui="{ body: 'p-4' }"
        data-testid="event-builder-coach-tips"
      >
        <div class="space-y-2">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Coach tips
          </p>
          <ul class="space-y-2">
            <AdminBuilderTipRow
              v-for="tip in warnings"
              :key="tip.id"
              :tip="tip"
            />
          </ul>
        </div>
      </AppCard>
    </div>

    <div class="space-y-2">
      <AppAlert
        v-if="submitError"
        color="error"
        variant="soft"
        title="Could not save the event"
        :description="submitError"
      />
      <AppButton
        color="neutral"
        variant="solid"
        class="w-full justify-center"
        data-testid="event-builder-submit"
        :disabled="!canSubmit || isSubmitting"
        :loading="isSubmitting"
        @click="emit('submit')"
      >
        {{ submitLabel }}
      </AppButton>
    </div>
  </div>
</template>
