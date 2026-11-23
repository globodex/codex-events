<script setup lang="ts">
// One optional part of an event on the extras level, for example "Credits". The tile shows the
// state of the option and opens it.
defineProps<{
  icon: string
  title: string
  /** The state of the option, for example "3 codes". Null while the option is not in use. */
  summary: string | null
}>()
</script>

<template>
  <button
    type="button"
    :aria-label="summary ? `${title}, ${summary}` : `${title}, not set`"
    class="flex min-h-[5.5rem] flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    :class="summary
      ? 'border-black/8 bg-white/88 text-highlighted hover:border-black/20 hover:shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]'
      : 'border-dashed border-black/15 text-muted hover:border-black/30 hover:text-highlighted dark:border-white/[0.16] dark:hover:border-white/[0.32]'"
  >
    <AppIcon
      :name="icon"
      class="size-5 shrink-0"
    />
    <span class="text-sm font-medium leading-snug">{{ title }}</span>
    <span
      v-if="summary"
      class="text-xs text-muted"
      data-testid="event-builder-extra-summary"
    >{{ summary }}</span>
    <AppIcon
      v-else
      name="i-lucide-plus"
      class="size-3.5 shrink-0"
    />
  </button>
</template>
