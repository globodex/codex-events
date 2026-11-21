<script setup lang="ts">
import AdminEditorRowShell from '~/components/admin/AdminEditorRowShell.vue'

const slots = useSlots()

const props = defineProps<{
  itemId: string
  testId: string
  itemIdAttribute: string
  rowAttribute: string
  sortHandleAttribute: string
  moveUpLabel: string
  moveDownLabel: string
  dragLabel: string
  moveUpTestId: string
  moveDownTestId: string
  moveUpDisabled?: boolean
  moveDownDisabled?: boolean
  dragDisabled?: boolean
  active?: boolean
  columnsClass?: string
  contentClass?: string
  controlsClass?: string
  actionsClass?: string
}>()

const emit = defineEmits<{
  moveUp: []
  moveDown: []
}>()

const rowAttributes = computed(() => ({
  [props.itemIdAttribute]: props.itemId,
  [props.rowAttribute]: ''
}))

const sortHandleAttributes = computed(() => ({
  [props.sortHandleAttribute]: ''
}))
</script>

<template>
  <article
    :data-testid="testId"
    v-bind="rowAttributes"
    class="rounded-xl border bg-white/88 p-3 transition-all dark:bg-[#111111]"
    :class="[
      active
        ? 'border-black/16 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.55)] dark:border-white/[0.16]'
        : 'border-black/8 dark:border-white/[0.08]'
    ]"
  >
    <AdminEditorRowShell
      :columns-class="columnsClass"
      :content-class="contentClass"
      :controls-class="controlsClass"
      :actions-class="actionsClass"
    >
      <template #controls>
        <AppButton
          color="neutral"
          variant="outline"
          icon="i-lucide-arrow-up"
          :aria-label="moveUpLabel"
          :data-testid="moveUpTestId"
          :disabled="moveUpDisabled"
          class="w-9 rounded-lg px-0"
          @click="emit('moveUp')"
        />

        <button
          type="button"
          v-bind="sortHandleAttributes"
          class="group inline-flex h-11 w-11 cursor-grab items-center justify-center rounded-xl border border-black/8 bg-white text-toned transition hover:border-black/20 hover:text-highlighted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]"
          :aria-label="dragLabel"
          :disabled="dragDisabled"
        >
          <AppIcon
            name="i-lucide-grip-vertical"
            class="size-4.5 transition group-hover:scale-105"
          />
        </button>

        <AppButton
          color="neutral"
          variant="outline"
          icon="i-lucide-arrow-down"
          :aria-label="moveDownLabel"
          :data-testid="moveDownTestId"
          :disabled="moveDownDisabled"
          class="w-9 rounded-lg px-0"
          @click="emit('moveDown')"
        />
      </template>

      <slot />

      <template
        v-if="slots.actions"
        #actions
      >
        <slot name="actions" />
      </template>
    </AdminEditorRowShell>
  </article>
</template>
