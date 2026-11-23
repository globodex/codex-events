<script setup lang="ts">
// The frame around one open extra: a way back to the tiles, the name of the extra, and its editor.
import type { EventBuilderExtraDefinition } from '~/domains/events/builder'

defineProps<{
  extra: EventBuilderExtraDefinition
}>()

const emit = defineEmits<{
  close: []
}>()

defineSlots<{
  default(): unknown
  action(): unknown
}>()
</script>

<template>
  <section
    class="rounded-xl border border-black/8 bg-white/88 dark:border-white/[0.08] dark:bg-[#111111]"
    :data-testid="`event-builder-extra-panel-${extra.id}`"
  >
    <div class="flex items-center gap-2.5 p-3">
      <AppButton
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-arrow-left"
        aria-label="All extras"
        class="w-8 px-0"
        data-testid="event-builder-extras-back"
        @click="emit('close')"
      />
      <AppIcon
        :name="extra.icon"
        class="size-4.5 shrink-0 text-toned"
      />
      <h3 class="min-w-0 flex-1 truncate text-sm font-semibold text-highlighted">
        {{ extra.title }}
      </h3>
      <slot name="action" />
    </div>

    <div class="border-t border-black/6 p-4 dark:border-white/[0.06]">
      <slot />
    </div>
  </section>
</template>
