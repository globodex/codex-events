<script setup lang="ts">
// The staff instructions of a track or challenge, for the event team only. The server sends them
// only to staff, event admins and platform admins, so a page shows this block whenever it has them.
defineProps<{
  /** Markdown. */
  source: string
}>()
</script>

<template>
  <div class="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-amber-950 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100">
    <p class="mb-3 text-xs font-semibold uppercase tracking-[0.16em]">
      Staff instructions
    </p>
    <AppMarkdownRenderer :source="source" />
  </div>
</template>
