<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { NuxtLink } from '#components'

defineProps<{
  selected: boolean
  to?: RouteLocationRaw
}>()
</script>

<template>
  <component
    :is="to ? NuxtLink : 'button'"
    v-bind="to ? { to } : { type: 'button' }"
    role="tab"
    :aria-selected="selected"
    class="border-b-2 pb-3 text-[14px] font-medium transition-colors"
    :class="selected
      ? 'border-black text-highlighted dark:border-white dark:text-white'
      : 'border-transparent text-neutral-500 hover:text-highlighted dark:text-[#A3A3A3] dark:hover:text-white'"
  >
    <slot />
  </component>
</template>
