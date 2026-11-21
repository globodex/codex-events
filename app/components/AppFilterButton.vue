<script setup lang="ts">
const props = defineProps<{
  pressed: boolean
  count?: number | string
}>()
</script>

<template>
  <AppButton
    color="neutral"
    variant="ghost"
    size="sm"
    :aria-pressed="props.pressed"
    class="h-auto min-w-max grow basis-0 justify-between px-4 py-1.5 text-[13px] font-normal sm:min-w-0 sm:grow-0 sm:basis-auto sm:justify-start"
    :class="props.pressed
      ? 'bg-black font-medium text-white hover:bg-black hover:text-white dark:bg-white dark:text-black dark:hover:bg-white dark:hover:text-black'
      : 'bg-black/6 text-neutral-700 hover:bg-black/10 hover:text-highlighted dark:bg-white/[0.08] dark:text-[#A3A3A3] dark:hover:bg-white/[0.12] dark:hover:text-white'"
  >
    <slot />
    <span
      v-if="props.count !== undefined"
      class="rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none"
      :class="props.pressed
        ? 'bg-white/15 text-white dark:bg-black/10 dark:text-black'
        : 'bg-black/6 text-neutral-700 dark:bg-white/[0.08] dark:text-[#B0B0B0]'"
    >
      {{ props.count }}
    </span>
  </AppButton>
</template>
