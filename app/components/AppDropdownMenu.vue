<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu'

type DropdownItem = {
  label: string
  to?: string
  color?: 'primary' | 'neutral' | 'success' | 'warning' | 'error' | 'info'
  checked?: boolean
  type?: 'checkbox'
}

defineOptions({
  inheritAttrs: false
})

const props = withDefaults(defineProps<{
  items?: DropdownItem[]
}>(), {
  items: () => []
})

const open = shallowRef(false)
</script>

<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot :open="open" />
    </DropdownMenuTrigger>

    <DropdownMenuContent
      align="end"
      :side-offset="8"
      :collision-padding="8"
      class="min-w-48 max-w-[calc(100vw-1rem)] rounded-xl border border-default/80 bg-elevated/95 p-1 shadow-[0_24px_60px_-46px_rgba(15,20,34,0.7)] backdrop-blur"
    >
      <DropdownMenuItem
        v-for="item in props.items"
        :key="`${item.label}-${item.to ?? 'action'}`"
        :as="item.to ? 'a' : 'button'"
        :href="item.to"
        class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-toned transition-colors hover:bg-default hover:text-highlighted focus:bg-default focus:text-highlighted"
      >
        <span
          v-if="item.type === 'checkbox'"
          class="inline-flex size-4 items-center justify-center rounded border border-default/80 bg-default text-xs text-highlighted"
        >
          {{ item.checked ? '✓' : '' }}
        </span>
        <span>{{ item.label }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
