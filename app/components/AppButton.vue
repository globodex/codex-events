<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { Loader2Icon } from 'lucide-vue-next'

import { NuxtLink } from '#components'
import { Button as UiButton } from '~/components/ui/button'
import { cn } from '~/lib/utils'

defineOptions({
  inheritAttrs: false
})

type ButtonColor = 'primary' | 'secondary' | 'neutral' | 'success' | 'warning' | 'error' | 'info'
type ButtonVariant = 'solid' | 'soft' | 'subtle' | 'ghost' | 'outline'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const props = withDefaults(defineProps<{
  to?: string
  external?: boolean
  target?: string
  rel?: string
  label?: string
  icon?: string
  trailingIcon?: string
  color?: ButtonColor
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  class?: HTMLAttributes['class']
}>(), {
  color: 'primary',
  variant: 'solid',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button'
})

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-7 rounded-md px-2.5 text-xs',
  sm: 'h-8 rounded-lg px-3 text-sm',
  md: 'h-9 rounded-xl px-4 text-sm',
  lg: 'h-10 rounded-xl px-5 text-sm',
  xl: 'h-11 rounded-2xl px-6 text-base'
}

const toneClasses = computed(() => {
  const key = `${props.variant}:${props.color}`

  const variants: Record<string, string> = {
    'solid:primary': 'bg-primary text-primary-foreground hover:bg-primary/90',
    'solid:secondary': 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
    'solid:neutral': 'border border-default/80 bg-elevated text-highlighted hover:bg-accented',
    'solid:success': 'bg-success text-white hover:bg-success/90',
    'solid:warning': 'bg-warning text-white hover:bg-warning/90',
    'solid:error': 'bg-error text-white hover:bg-error/90',
    'solid:info': 'bg-info text-white hover:bg-info/90',
    'soft:primary': 'border border-primary/15 bg-primary/10 text-primary hover:bg-primary/15',
    'soft:secondary': 'border border-secondary/20 bg-secondary/15 text-secondary hover:bg-secondary/20',
    'soft:neutral': 'border border-default/80 bg-default text-toned hover:bg-accented hover:text-highlighted',
    'soft:success': 'border border-success/20 bg-success/10 text-success hover:bg-success/15',
    'soft:warning': 'border border-warning/20 bg-warning/10 text-warning hover:bg-warning/15',
    'soft:error': 'border border-error/20 bg-error/10 text-error hover:bg-error/15',
    'soft:info': 'border border-info/20 bg-info/10 text-info hover:bg-info/15',
    'subtle:primary': 'bg-primary/8 text-primary hover:bg-primary/12',
    'subtle:secondary': 'bg-secondary/10 text-secondary hover:bg-secondary/15',
    'subtle:neutral': 'bg-default/80 text-toned hover:bg-default hover:text-highlighted',
    'subtle:success': 'bg-success/8 text-success hover:bg-success/12',
    'subtle:warning': 'bg-warning/8 text-warning hover:bg-warning/12',
    'subtle:error': 'bg-error/8 text-error hover:bg-error/12',
    'subtle:info': 'bg-info/8 text-info hover:bg-info/12',
    'ghost:primary': 'text-primary hover:bg-primary/10',
    'ghost:secondary': 'text-secondary hover:bg-secondary/10',
    'ghost:neutral': 'text-muted hover:bg-default hover:text-highlighted',
    'ghost:success': 'text-success hover:bg-success/10',
    'ghost:warning': 'text-warning hover:bg-warning/10',
    'ghost:error': 'text-error hover:bg-error/10',
    'ghost:info': 'text-info hover:bg-info/10',
    'outline:primary': 'border border-primary/20 bg-transparent text-primary hover:bg-primary/8',
    'outline:secondary': 'border border-secondary/20 bg-transparent text-secondary hover:bg-secondary/10',
    'outline:neutral': 'border border-default/80 bg-transparent text-highlighted hover:bg-default',
    'outline:success': 'border border-success/20 bg-transparent text-success hover:bg-success/10',
    'outline:warning': 'border border-warning/20 bg-transparent text-warning hover:bg-warning/10',
    'outline:error': 'border border-error/20 bg-transparent text-error hover:bg-error/10',
    'outline:info': 'border border-info/20 bg-transparent text-info hover:bg-info/10'
  }

  return variants[key] ?? variants['solid:primary']
})

const rootClass = computed(() =>
  cn(
    'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-medium shadow-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    sizeClasses[props.size],
    toneClasses.value,
    props.class
  )
)

const inactive = computed(() => props.disabled || props.loading)
const targetElement = computed(() => {
  if (!props.to) return 'button'
  if (inactive.value) return 'span'
  return props.external ? 'a' : NuxtLink
})

const targetAttributes = computed(() => {
  if (!props.to) return { type: props.type, disabled: inactive.value }
  if (inactive.value) return { 'role': 'link', 'aria-disabled': true, 'class': 'pointer-events-none opacity-50' }
  if (props.external) return { href: props.to, target: props.target, rel: props.rel }
  return { to: props.to }
})
</script>

<template>
  <UiButton
    variant="ghost"
    size="default"
    as-child
    :class="rootClass"
    v-bind="$attrs"
  >
    <component
      :is="targetElement"
      v-bind="targetAttributes"
    >
      <Loader2Icon
        v-if="props.loading"
        class="size-4 animate-spin"
      />
      <slot name="leading">
        <AppIcon
          v-if="!props.loading && props.icon"
          :name="props.icon"
          class="size-4"
        />
      </slot>
      <slot>
        <span v-if="props.label">{{ props.label }}</span>
      </slot>
      <slot name="trailing">
        <AppIcon
          v-if="props.trailingIcon"
          :name="props.trailingIcon"
          class="size-4"
        />
      </slot>
    </component>
  </UiButton>
</template>
