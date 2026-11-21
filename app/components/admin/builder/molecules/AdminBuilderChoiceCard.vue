<script setup lang="ts">
defineProps<{
  role: 'radio' | 'checkbox'
  checked: boolean
  disabled?: boolean
  label: string
  description: string
}>()
</script>

<template>
  <button
    type="button"
    :role="role"
    :aria-checked="checked"
    :disabled="disabled"
    class="relative rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
    :class="checked
      ? 'border-black/25 bg-white/95 dark:border-white/[0.28] dark:bg-[#181818]'
      : 'border-black/8 bg-white/88 text-toned hover:border-black/20 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]'"
  >
    <AppIcon
      v-if="checked"
      name="i-lucide-circle-check-big"
      class="absolute right-3 top-3 size-4 text-emerald-500"
    />
    <span class="block pr-6 text-sm font-semibold text-highlighted">{{ label }}</span>
    <span class="block text-[11px] text-dimmed">{{ description }}</span>
  </button>
</template>
