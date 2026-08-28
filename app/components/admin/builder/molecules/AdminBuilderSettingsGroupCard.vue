<script setup lang="ts">
import type { EventBuilderSettingsGroupDefinition } from '~/domains/events/builder'

defineProps<{
  group: EventBuilderSettingsGroupDefinition
  complete: boolean
}>()

defineSlots<{
  default(): unknown
  action(): unknown
}>()
</script>

<template>
  <section
    class="rounded-xl border border-black/8 bg-white/88 dark:border-white/[0.08] dark:bg-[#111111]"
    :data-testid="`event-builder-settings-${group.id}`"
  >
    <div class="flex items-center gap-3 p-4 pb-3">
      <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/5 text-toned dark:bg-white/[0.06]">
        <AppIcon
          :name="group.icon"
          class="size-4.5"
        />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-highlighted">
          {{ group.title }}
        </p>
        <p class="text-xs text-muted">
          {{ group.description }}
        </p>
      </div>
      <div
        v-if="$slots.action || complete"
        class="flex shrink-0 items-center gap-1"
      >
        <slot name="action" />
        <AppIcon
          v-if="complete"
          name="i-lucide-circle-check-big"
          class="size-4.5 shrink-0 text-emerald-500"
          :aria-label="`${group.title} configured`"
        />
      </div>
    </div>

    <div class="border-t border-black/6 p-4 dark:border-white/[0.06]">
      <slot />
    </div>
  </section>
</template>
