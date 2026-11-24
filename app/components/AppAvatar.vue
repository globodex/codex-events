<script setup lang="ts">
import { UserIcon } from 'lucide-vue-next'

import { Avatar as UiAvatar, AvatarFallback as UiAvatarFallback } from '~/components/ui/avatar'
import { cn } from '~/lib/utils'

type AvatarSize = 'xs' | 'sm' | 'lg' | '3xl'
type AvatarFallbackMode = 'initials' | 'icon'

const props = withDefaults(defineProps<{
  src?: string
  alt?: string
  size?: AvatarSize
  fallback?: AvatarFallbackMode
}>(), {
  src: undefined,
  alt: '',
  size: 'sm',
  fallback: 'initials'
})

const sizeClasses: Record<AvatarSize, string> = {
  'xs': 'size-6',
  'sm': 'size-8',
  'lg': 'size-10',
  '3xl': 'size-16'
}

const normalizedSrc = computed(() => props.src?.trim() || undefined)
const imageLoadFailed = ref(false)

const fallbackLabel = computed(() => {
  const value = (props.alt || '').trim()

  if (!value) {
    return 'CH'
  }

  return value
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
})

watch(normalizedSrc, () => {
  imageLoadFailed.value = false
})

const resolvedImageSrc = computed(() => imageLoadFailed.value ? undefined : normalizedSrc.value)
</script>

<template>
  <UiAvatar :class="cn('border border-default/70 bg-default', sizeClasses[props.size])">
    <img
      v-if="resolvedImageSrc"
      :src="resolvedImageSrc"
      :alt="props.alt"
      class="aspect-square size-full object-cover object-center"
      loading="eager"
      @error="imageLoadFailed = true"
    >
    <UiAvatarFallback
      v-else
      class="bg-default text-xs font-semibold text-toned"
    >
      <template v-if="props.fallback === 'initials'">
        {{ fallbackLabel }}
      </template>
      <UserIcon
        v-else
        class="size-4"
      />
    </UiAvatarFallback>
  </UiAvatar>
</template>
