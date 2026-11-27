<script setup lang="ts">
import type { SessionPhase } from '~/domains/events/program-timeline'

// The line above an agenda item while it runs or starts next, for example "Now · 12m left".
// A running item has a pulsing green dot.
defineProps<{
  phase: SessionPhase
  label: string
}>()
</script>

<template>
  <span
    class="flex items-center gap-1.5 text-xs font-semibold leading-tight"
    :class="phase === 'now' ? 'text-success' : 'text-info'"
  >
    <span
      v-if="phase === 'now'"
      class="relative flex size-2"
    >
      <span class="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
      <span class="relative inline-flex size-2 rounded-full bg-success" />
    </span>
    {{ label }}
  </span>
</template>
