<script setup lang="ts">
// Shared bar-with-track meter.
const props = withDefaults(defineProps<{
  value: number
  max?: number
  label?: string
  /** The name of the meter for screen readers, for a meter without a visible label. */
  ariaLabel?: string
  tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md'
  showValue?: boolean
  valueText?: string
}>(), {
  max: 100,
  label: '',
  ariaLabel: '',
  tone: 'neutral',
  size: 'md',
  showValue: false,
  valueText: ''
})

const clampedValue = computed(() => Math.min(props.max, Math.max(0, props.value)))
const percent = computed(() => props.max > 0 ? (clampedValue.value / props.max) * 100 : 0)

const toneClasses: Record<NonNullable<typeof props.tone>, string> = {
  neutral: 'bg-neutral-900 dark:bg-neutral-100',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-rose-500',
  info: 'bg-sky-500'
}
</script>

<template>
  <div class="space-y-1.5">
    <div
      v-if="label || showValue || valueText"
      class="flex items-baseline justify-between gap-3"
    >
      <span
        v-if="label"
        class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
      >
        {{ label }}
      </span>
      <span
        v-if="showValue || valueText"
        class="text-xs font-medium tabular-nums text-toned"
      >
        {{ valueText || `${Math.round(clampedValue)} / ${max}` }}
      </span>
    </div>

    <div
      role="progressbar"
      :aria-valuenow="Math.round(clampedValue)"
      :aria-valuemin="0"
      :aria-valuemax="max"
      :aria-label="ariaLabel || label || undefined"
      class="w-full overflow-hidden rounded-full bg-black/6 dark:bg-white/[0.05]"
      :class="size === 'sm' ? 'h-1.5' : 'h-2.5'"
    >
      <div
        class="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
        :class="toneClasses[tone]"
        :style="{ width: `${percent}%` }"
      />
    </div>
  </div>
</template>
