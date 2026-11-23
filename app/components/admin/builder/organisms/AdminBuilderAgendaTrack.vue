<script setup lang="ts">
import type { EventBuilderBlockType } from '#shared/domains/events/builder-blocks'
import { resolveEventBuilderBlockType } from '#shared/domains/events/builder-blocks'
import type { EventBuilderBlockInstance, EventBuilderScheduleEntry } from '~/domains/events/builder'
import AdminBuilderBlockCard from '~/components/admin/builder/molecules/AdminBuilderBlockCard.vue'
import AdminBuilderTrackRow from '~/components/admin/builder/molecules/AdminBuilderTrackRow.vue'

const props = defineProps<{
  blocks: EventBuilderBlockInstance[]
  schedule: EventBuilderScheduleEntry[]
  /** A palette tile is being dragged — the track presents itself as a drop zone. */
  receiving?: boolean
}>()

const emit = defineEmits<{
  reorder: [oldIndex: number, newIndex: number]
  insert: [type: EventBuilderBlockType, index: number]
  move: [id: string, direction: -1 | 1]
  clone: [id: string]
  remove: [id: string]
  updateTitle: [id: string, title: string]
  updateDetails: [id: string, details: string]
  updateDuration: [id: string, minutes: number]
  updateFocusCost: [id: string, value: number]
  updateEnergyDelta: [id: string, value: number]
}>()

const listElement = ref<HTMLElement | null>(null)
const activeDragId = ref<string | null>(null)
const dropTargetId = ref<string | null>(null)

// Sortable drags are native drag events or synthesized pointer moves depending
// on the browser path, so the "pointer is over the zone" flag comes from plain
// geometry: while a palette drag is active, hit-test the cursor against the
// zone on every move event either mode emits.
const dragOverZone = ref(false)

function onGlobalDragMove(event: MouseEvent) {
  const rect = listElement.value?.getBoundingClientRect()

  if (!rect) {
    return
  }

  dragOverZone.value = event.clientX >= rect.left
    && event.clientX <= rect.right
    && event.clientY >= rect.top
    && event.clientY <= rect.bottom
}

function detachGlobalDragListeners() {
  window.removeEventListener('pointermove', onGlobalDragMove)
  window.removeEventListener('dragover', onGlobalDragMove)
}

watch(() => props.receiving, (receiving) => {
  if (receiving) {
    window.addEventListener('pointermove', onGlobalDragMove)
    window.addEventListener('dragover', onGlobalDragMove)
  } else {
    detachGlobalDragListeners()
    dragOverZone.value = false
  }
})

onBeforeUnmount(() => {
  detachGlobalDragListeners()
})

useAdminSortableLists({
  elements: () => [listElement.value],
  enabled: () => true,
  sources: [() => props.blocks.length],
  createOptions: () => ({
    animation: 180,
    handle: '[data-builder-block-sort-handle]',
    draggable: '[data-builder-block-row]',
    dataIdAttr: 'data-builder-block-id',
    // Accept palette tiles (clone drops); block rows never leave the track.
    group: { name: 'event-builder-blocks', pull: false, put: true },
    ghostClass: 'opacity-45',
    chosenClass: 'cursor-grabbing',
    dragClass: 'cursor-grabbing',
    onChoose(event) {
      activeDragId.value = event.item.dataset.builderBlockId ?? null
      dropTargetId.value = null
    },
    onMove(event) {
      // The drop indicator only tracks internal reorders — palette drags show
      // the dragged tile itself at the insertion point.
      if (activeDragId.value) {
        const relatedId = (event.related as HTMLElement | undefined)?.dataset.builderBlockId ?? null

        dropTargetId.value = relatedId !== activeDragId.value ? relatedId : null
      }

      return true
    },
    onAdd(event) {
      const rawType = event.item.dataset.builderPaletteType

      // Sortable parks a foreign clone at the top of the list regardless of
      // where it was dropped, so derive the insertion index from the drop
      // point itself: before the first row whose midpoint sits below it.
      // Sortable attaches the browser event, but its types don't declare it.
      const pointer = (event as { originalEvent?: MouseEvent | TouchEvent }).originalEvent
      const pointerY = pointer && 'clientY' in pointer
        ? pointer.clientY
        : (pointer as TouchEvent | undefined)?.changedTouches?.[0]?.clientY
      const rows = [...(listElement.value?.querySelectorAll('[data-builder-block-row]') ?? [])]
        .filter(row => row !== event.item)
      let insertIndex = rows.length

      if (typeof pointerY === 'number') {
        for (let index = 0; index < rows.length; index += 1) {
          const rect = rows[index]!.getBoundingClientRect()

          if (pointerY < rect.top + rect.height / 2) {
            insertIndex = index
            break
          }
        }
      }

      // Sortable moved the cloned palette tile into our DOM; remove it and let
      // Vue render the real block row from state instead.
      event.item.remove()
      dropTargetId.value = null
      dragOverZone.value = false

      // Only drops that declare a palette type insert; Custom Session included.
      if (rawType) {
        emit('insert', resolveEventBuilderBlockType(rawType), insertIndex)
      }
    },
    onEnd(event) {
      const oldIndex = event.oldDraggableIndex ?? event.oldIndex
      const newIndex = event.newDraggableIndex ?? event.newIndex

      if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
        emit('reorder', oldIndex, newIndex)
      }

      activeDragId.value = null
      dropTargetId.value = null
    }
  }),
  onDestroy: () => {
    activeDragId.value = null
    dropTargetId.value = null
  }
})
</script>

<template>
  <section aria-label="Agenda">
    <div
      ref="listElement"
      class="-m-2 space-y-2.5 rounded-2xl border-2 border-dashed p-1.5 transition-colors duration-150"
      :class="receiving
        ? (dragOverZone
          ? 'border-emerald-500/70 bg-emerald-500/[0.07]'
          : 'border-emerald-500/35 bg-emerald-500/[0.03]')
        : 'border-transparent'"
      data-testid="event-builder-track"
    >
      <div
        v-if="blocks.length === 0"
        class="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-sm transition-colors"
        :class="receiving
          ? 'border-transparent text-emerald-600 dark:text-emerald-400'
          : 'border-black/10 text-muted dark:border-white/[0.12]'"
        data-testid="event-builder-empty-track"
      >
        <AppIcon
          name="i-lucide-calendar-plus"
          class="size-5 shrink-0"
          :class="receiving ? 'text-emerald-500' : 'text-dimmed'"
        />
        {{ receiving ? 'Drop the block here' : 'Add a block or pick a template' }}
      </div>

      <template
        v-for="(block, index) in blocks"
        :key="block.id"
      >
        <div
          v-if="dropTargetId === block.id"
          class="rounded-xl border-2 border-dashed border-black/20 px-4 py-2 text-center text-xs text-muted dark:border-white/[0.2]"
        >
          Drop block here
        </div>
        <AdminBuilderTrackRow
          :item-id="block.id"
          :index="index"
          :title="block.title"
          :active="activeDragId === block.id"
          @move="direction => emit('move', block.id, direction)"
        >
          <AdminBuilderBlockCard
            :block="block"
            :schedule="schedule[index]"
            :index="index"
            @update-title="(id, title) => emit('updateTitle', id, title)"
            @update-details="(id, details) => emit('updateDetails', id, details)"
            @clone="id => emit('clone', id)"
            @update-duration="(id, minutes) => emit('updateDuration', id, minutes)"
            @update-focus-cost="(id, value) => emit('updateFocusCost', id, value)"
            @update-energy-delta="(id, value) => emit('updateEnergyDelta', id, value)"
            @remove="id => emit('remove', id)"
          />
        </AdminBuilderTrackRow>
      </template>
    </div>
  </section>
</template>
