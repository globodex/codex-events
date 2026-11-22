<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import { cn } from '~/lib/utils'
import {
  getPublicEventStatePresentation,
  resolvePublicEventHeaderStateClass,
  type PublicEventState
} from '~/domains/events/presentation'

defineOptions({
  inheritAttrs: false
})

const props = defineProps<{
  state: PublicEventState
  registrationOpensAt?: string
  registrationClosesAt?: string
}>()

const now = useEventDeadlineClock(() => [props.registrationOpensAt, props.registrationClosesAt])
const statePresentation = computed(() => getPublicEventStatePresentation(props, now.value))
const label = computed(() => statePresentation.value.label)
const attrs = useAttrs()
const delegatedAttrs = reactiveOmit(attrs, 'class')
const rootClass = computed(() =>
  cn(
    'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
    resolvePublicEventHeaderStateClass(props, now.value),
    attrs.class
  )
)
</script>

<template>
  <span
    :class="rootClass"
    v-bind="delegatedAttrs"
  >
    {{ label }}
  </span>
</template>
