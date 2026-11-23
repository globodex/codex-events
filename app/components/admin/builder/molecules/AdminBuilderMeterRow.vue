<script setup lang="ts">
// One bar of the event score, for example audience energy. The icon names the bar, and the
// tooltip says what the bar measures.
defineProps<{
  icon: string
  label: string
  value: number
  tone: 'neutral' | 'success' | 'warning' | 'error' | 'info'
  /** What the bar measures and what raises it. */
  description: string
}>()
</script>

<template>
  <AppTooltip
    :text="`${label} ${value} / 100. ${description}`"
    side="left"
  >
    <div class="flex cursor-help items-center gap-2.5">
      <AppIcon
        :name="icon"
        class="size-4 shrink-0 text-toned"
      />
      <AppMeter
        :value="value"
        :tone="tone"
        :aria-label="label"
        size="sm"
        class="min-w-0 flex-1"
      />
    </div>
  </AppTooltip>
</template>
