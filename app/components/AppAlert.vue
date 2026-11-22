<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { Alert as UiAlert, AlertDescription as UiAlertDescription, AlertTitle as UiAlertTitle } from '~/components/ui/alert'
import { cn } from '~/lib/utils'

type AlertColor = 'primary' | 'secondary' | 'neutral' | 'success' | 'warning' | 'error' | 'info'
type AlertVariant = 'soft' | 'subtle' | 'outline'

const props = withDefaults(defineProps<{
  title?: string
  description?: string
  retry?: () => void
  icon?: string
  color?: AlertColor
  variant?: AlertVariant
  class?: HTMLAttributes['class']
}>(), {
  color: 'neutral',
  variant: 'soft'
})

const rootClass = computed(() => {
  const key = `${props.variant}:${props.color}`

  const variants: Record<string, string> = {
    'soft:primary': 'bg-primary/10 text-primary',
    'soft:secondary': 'bg-secondary/15 text-secondary',
    'soft:neutral': 'bg-default/80 text-toned',
    'soft:success': 'bg-success/10 text-success',
    'soft:warning': 'bg-warning/10 text-warning',
    'soft:error': 'bg-error/10 text-error',
    'soft:info': 'bg-info/10 text-info',
    'subtle:primary': 'bg-primary/8 text-primary',
    'subtle:secondary': 'bg-secondary/10 text-secondary',
    'subtle:neutral': 'bg-default/70 text-toned',
    'subtle:success': 'bg-success/8 text-success',
    'subtle:warning': 'bg-warning/8 text-warning',
    'subtle:error': 'bg-error/8 text-error',
    'subtle:info': 'bg-info/8 text-info',
    'outline:primary': 'border-primary/20 bg-transparent text-primary',
    'outline:secondary': 'border-secondary/20 bg-transparent text-secondary',
    'outline:neutral': 'border-default/80 bg-transparent text-toned',
    'outline:success': 'border-success/20 bg-transparent text-success',
    'outline:warning': 'border-warning/20 bg-transparent text-warning',
    'outline:error': 'border-error/20 bg-transparent text-error',
    'outline:info': 'border-info/20 bg-transparent text-info'
  }

  return cn(
    '!border !border-black/8 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 rounded-xl px-4 py-3',
    props.icon ? 'grid-cols-[calc(var(--spacing)*4)_1fr] gap-x-3' : undefined,
    variants[key] ?? variants['soft:neutral'],
    props.class
  )
})
</script>

<template>
  <UiAlert
    variant="default"
    :class="rootClass"
  >
    <AppIcon
      v-if="props.icon"
      :name="props.icon"
      class="mt-0.5 size-4"
    />
    <UiAlertTitle
      v-if="props.title"
      class="font-semibold text-current"
    >
      {{ props.title }}
    </UiAlertTitle>
    <UiAlertDescription
      v-if="props.description"
      class="col-span-full col-start-1 mt-1 text-current/90"
    >
      {{ props.description }}
    </UiAlertDescription>
    <AppButton
      v-if="retry"
      label="Retry"
      variant="outline"
      color="neutral"
      size="sm"
      class="mt-2 w-fit"
      @click="retry()"
    />
    <slot />
  </UiAlert>
</template>
