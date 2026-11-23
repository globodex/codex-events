<script setup lang="ts">
import type { EventBuilderBlockType } from '#shared/domains/events/builder-blocks'
import AdminBuilderPaletteTile from '~/components/admin/builder/molecules/AdminBuilderPaletteTile.vue'

const props = defineProps<{
  types: readonly EventBuilderBlockType[]
}>()

const emit = defineEmits<{
  add: [type: EventBuilderBlockType]
  dragStart: []
  dragEnd: []
}>()

const gridElement = ref<HTMLElement | null>(null)

// Palette tiles are a clone-only drag source: dragging one into the agenda
// track inserts a block there, the palette itself never changes.
useAdminSortableLists({
  elements: () => [gridElement.value],
  enabled: () => true,
  sources: [() => props.types.length],
  createOptions: () => ({
    animation: 150,
    sort: false,
    group: { name: 'event-builder-blocks', pull: 'clone', put: false },
    draggable: '[data-builder-palette-tile]',
    ghostClass: 'opacity-45',
    chosenClass: 'cursor-grabbing',
    onStart() {
      emit('dragStart')
    },
    onEnd() {
      emit('dragEnd')
    }
  })
})
</script>

<template>
  <section
    id="event-builder-block-palette"
    aria-label="Blocks to add to the agenda"
    tabindex="-1"
  >
    <div
      ref="gridElement"
      class="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4"
    >
      <AdminBuilderPaletteTile
        v-for="type in types"
        :key="type"
        :type="type"
        @add="value => emit('add', value)"
      />
    </div>
  </section>
</template>
