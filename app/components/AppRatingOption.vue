<script setup lang="ts">
const props = defineProps<{
  checked: boolean
  invalid?: boolean
}>()
</script>

<template>
  <AppButton
    color="neutral"
    variant="outline"
    size="xs"
    role="radio"
    :aria-checked="props.checked"
    class="h-auto rounded-lg px-0 py-2 text-[11px] font-semibold tabular-nums sm:text-xs"
    :class="props.checked
      ? 'border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground dark:hover:bg-primary'
      : props.invalid
        ? 'border-error/45 bg-black/20 text-error hover:border-error/55 hover:bg-white/5 hover:text-error dark:border-error/50 dark:hover:border-error/60 dark:hover:bg-white/5'
        : 'border-black/8 bg-black/20 text-muted hover:border-black/14 hover:bg-white/5 hover:text-highlighted dark:border-white/[0.08] dark:hover:border-white/[0.14] dark:hover:bg-white/5 dark:hover:text-white'"
  >
    <slot />
  </AppButton>
</template>
