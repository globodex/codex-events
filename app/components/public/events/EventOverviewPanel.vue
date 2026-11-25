<script setup lang="ts">
const props = defineProps<{
  description: string
  /** The glass look of the public event page, where the card sits on the event picture. The workspace shows a plain card. */
  glass?: boolean
}>()

const descriptionMarkdown = computed(() => props.description.trim())
const glassClass = '!border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60'
</script>

<template>
  <AppCard
    v-if="descriptionMarkdown"
    :class="props.glass ? glassClass : undefined"
    data-testid="public-event-overview"
  >
    <LazyAppMarkdownRenderer
      hydrate-never
      :source="descriptionMarkdown"
    />
  </AppCard>

  <AppCard
    v-else
    class="!border-dashed"
    :class="props.glass ? glassClass : undefined"
    :ui="{ body: 'p-8 text-center' }"
    data-testid="public-event-overview-empty"
  >
    <p class="text-[15px] font-medium text-highlighted dark:text-white">
      Overview will appear here once published.
    </p>
  </AppCard>
</template>
