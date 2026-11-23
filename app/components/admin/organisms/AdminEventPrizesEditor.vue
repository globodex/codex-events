<script setup lang="ts">
// The prizes of a Hackathon: an organizer writes, orders and saves them here.
// The event builder and the Settings tab of the event workspace both show this editor.
import AdminEditorRowShell from '~/components/admin/AdminEditorRowShell.vue'
import type { PrizeDefinition } from '~/domains/outcomes/prizes'
import { normalizeApiError } from '~/lib/api'
import { applyCatalogDisplayOrder, moveCatalogRow, useEventCatalogDraft } from '~/composables/useEventCatalogDraft'

const props = defineProps<{
  eventId: string
  /** The saved prizes of the event. */
  prizes: PrizeDefinition[]
}>()

const emit = defineEmits<{
  /** After a save wrote at least one prize, also when a later one failed. */
  saved: []
  /** True while the editor holds a change that is not saved. */
  dirtyChange: [dirty: boolean]
}>()

const toast = useToast()
const {
  rows: prizeRows,
  hasChanges: hasPrizeChanges,
  save: persistPrizes
} = useEventCatalogDraft<PrizeDefinition>({
  eventId: () => props.eventId,
  resource: 'prizes',
  source: () => props.prizes,
  onSaved: () => emit('saved')
})
const isSavingPrizes = ref(false)
const prizeMutationError = ref('')
const activePrizeDragId = ref<string | null>(null)
const prizeDropTargetId = ref<string | null>(null)
const prizeListElement = ref<HTMLElement | null>(null)

const orderedPrizes = computed(() =>
  [...prizeRows.value].sort((a, b) =>
    a.displayOrder - b.displayOrder || a.rankEnd - b.rankEnd || b.rankStart - a.rankStart || a.createdAt.localeCompare(b.createdAt)
  )
)

watch(hasPrizeChanges, dirty => emit('dirtyChange', dirty), { immediate: true })

useAdminSortableLists({
  elements: () => [prizeListElement.value],
  // Dragging needs two rows. The sorting library is loaded only then, so a page that shows
  // an empty or a one-row list does not load it.
  enabled: () => orderedPrizes.value.length > 1,
  sources: [orderedPrizes],
  createOptions: () => ({
    animation: 180,
    handle: '[data-prize-sort-handle]',
    draggable: '[data-prize-row]',
    dataIdAttr: 'data-prize-id',
    ghostClass: 'opacity-45',
    chosenClass: 'cursor-grabbing',
    dragClass: 'cursor-grabbing',
    onChoose(event) {
      activePrizeDragId.value = event.item.dataset.prizeId ?? null
      prizeDropTargetId.value = null
    },
    onMove(event) {
      const relatedId = event.related?.dataset.prizeId ?? null
      prizeDropTargetId.value = relatedId !== activePrizeDragId.value ? relatedId : null
      return true
    },
    onEnd(event) {
      const oldIndex = event.oldDraggableIndex ?? event.oldIndex
      const newIndex = event.newDraggableIndex ?? event.newIndex

      if (oldIndex !== undefined && newIndex !== undefined) {
        moveCatalogRow(orderedPrizes.value, oldIndex, newIndex)
      }

      activePrizeDragId.value = null
      prizeDropTargetId.value = null
    }
  }),
  onDestroy: () => {
    activePrizeDragId.value = null
    prizeDropTargetId.value = null
  }
})

function addPrize() {
  const draftPrize: PrizeDefinition = {
    id: `draft-prize-${crypto.randomUUID()}`,
    eventId: props.eventId,
    name: '',
    description: '',
    rewardType: 'api_credits',
    rewardValue: '',
    rewardCurrency: null,
    awardScope: 'team',
    rankStart: 1,
    rankEnd: 1,
    displayOrder: prizeRows.value.length + 1,
    createdAt: new Date().toISOString()
  }

  prizeRows.value = [...orderedPrizes.value, draftPrize]
  applyCatalogDisplayOrder(prizeRows.value)
}

function removePrize(prizeId: string) {
  prizeRows.value = orderedPrizes.value.filter(prize => prize.id !== prizeId)
  applyCatalogDisplayOrder(prizeRows.value)
}

async function savePrizes() {
  if (!hasPrizeChanges.value) {
    return
  }

  isSavingPrizes.value = true
  prizeMutationError.value = ''

  try {
    await persistPrizes()
    toast.add({
      title: 'Prizes updated',
      description: 'The prize catalog has been updated.',
      color: 'success'
    })
  } catch (error) {
    prizeMutationError.value = normalizeApiError(error).message
  } finally {
    isSavingPrizes.value = false
  }
}
</script>

<template>
  <div
    class="grid grid-cols-1 gap-4"
    :inert="isSavingPrizes"
  >
    <div class="space-y-3">
      <div
        ref="prizeListElement"
        class="grid grid-cols-1 gap-3"
      >
        <div
          v-for="(prize, index) in orderedPrizes"
          :key="prize.id"
          :data-prize-id="prize.id"
          data-prize-row
          class="rounded-xl border bg-white/88 p-3 transition-all dark:bg-[#111111]"
          :class="[
            prizeDropTargetId === prize.id
              ? 'border-dashed border-black/30 ring-2 ring-black/6 dark:border-white/[0.32] dark:ring-white/[0.08]'
              : 'border-black/8 dark:border-white/[0.08]',
            activePrizeDragId === prize.id
              ? 'shadow-[0_16px_40px_-34px_rgba(15,23,42,0.55)]'
              : ''
          ]"
        >
          <div
            v-if="prizeDropTargetId === prize.id"
            class="mb-3 rounded-lg border border-dashed border-black/18 bg-black/[0.03] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted dark:border-white/[0.14] dark:bg-white/[0.03]"
          >
            Drop prize here
          </div>

          <AdminEditorRowShell
            columns-class="sm:grid-cols-[4.25rem_minmax(0,1fr)_4.25rem]"
          >
            <template #controls>
              <AppButton
                color="neutral"
                variant="outline"
                icon="i-lucide-arrow-up"
                class="w-9 rounded-lg px-0"
                :aria-label="`Move ${prize.name || `prize ${index + 1}`} up`"
                :disabled="index === 0"
                @click="moveCatalogRow(orderedPrizes, index, index - 1)"
              />

              <button
                type="button"
                data-prize-sort-handle
                class="group inline-flex h-11 w-11 cursor-grab items-center justify-center rounded-xl border border-black/8 bg-white text-toned transition hover:border-black/20 hover:text-highlighted active:cursor-grabbing dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]"
                :aria-label="`Drag to reorder ${prize.name || `prize ${index + 1}`}`"
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
                class="w-9 rounded-lg px-0"
                :aria-label="`Move ${prize.name || `prize ${index + 1}`} down`"
                :disabled="index === orderedPrizes.length - 1"
                @click="moveCatalogRow(orderedPrizes, index, index + 1)"
              />
            </template>

            <div class="grid grid-cols-1 gap-2.5">
              <div class="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_140px_110px]">
                <label class="grid gap-1">
                  <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Prize name</span>
                  <AppInput
                    v-model="prize.name"
                    type="text"
                    placeholder="Best overall"
                  />
                </label>
                <label class="grid gap-1">
                  <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Reward value</span>
                  <AppInput
                    v-model="prize.rewardValue"
                    type="text"
                    placeholder="5000"
                  />
                </label>
                <label class="grid gap-1">
                  <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Currency</span>
                  <AppInput
                    :model-value="prize.rewardCurrency ?? undefined"
                    type="text"
                    placeholder="USD"
                    @update:model-value="value => prize.rewardCurrency = value ? String(value) : null"
                  />
                </label>
              </div>

              <div class="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_120px_88px_88px]">
                <label class="grid gap-1">
                  <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Reward type</span>
                  <AppSelect
                    v-model="prize.rewardType"
                  >
                    <option value="api_credits">
                      API credits
                    </option>
                    <option value="subscription">
                      Subscription
                    </option>
                    <option value="physical">
                      Physical
                    </option>
                    <option value="other">
                      Other
                    </option>
                  </AppSelect>
                </label>
                <label class="grid gap-1">
                  <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Awarded to</span>
                  <AppSelect
                    v-model="prize.awardScope"
                  >
                    <option value="team">
                      Team
                    </option>
                    <option value="member">
                      Member
                    </option>
                  </AppSelect>
                </label>
                <label class="grid gap-1">
                  <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Rank from</span>
                  <AppInput
                    v-model.number="prize.rankStart"
                    type="number"
                    min="1"
                    placeholder="1"
                  />
                </label>
                <label class="grid gap-1">
                  <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Rank to</span>
                  <AppInput
                    v-model.number="prize.rankEnd"
                    type="number"
                    min="1"
                    placeholder="1"
                  />
                </label>
              </div>

              <label class="grid gap-1">
                <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Description</span>
                <AppTextarea
                  v-model="prize.description"
                  rows="1"
                  class="min-h-10"
                  placeholder="Explain what the winner receives."
                />
              </label>
            </div>

            <template #actions>
              <AppButton
                color="error"
                variant="outline"
                icon="i-lucide-trash-2"
                class="w-9 rounded-lg px-0"
                :aria-label="`Delete ${prize.name || `prize ${index + 1}`}`"
                @click="removePrize(prize.id)"
              />
            </template>
          </AdminEditorRowShell>
        </div>

        <p
          v-if="orderedPrizes.length === 0"
          class="text-sm text-muted"
        >
          No prizes configured yet.
        </p>
      </div>

      <AppAlert
        v-if="prizeMutationError"
        data-testid="prizes-save-error"
        color="error"
        variant="soft"
        title="Prizes not saved"
        :description="prizeMutationError"
      />

      <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
        <AppButton
          type="button"
          color="neutral"
          variant="soft"
          size="sm"
          class="w-fit"
          @click="addPrize"
        >
          {{ orderedPrizes.length === 0 ? 'Add first prize' : 'Add prize' }}
        </AppButton>

        <AppButton
          type="button"
          color="primary"
          size="md"
          :disabled="!hasPrizeChanges || isSavingPrizes"
          :loading="isSavingPrizes"
          @click="savePrizes"
        >
          Save prizes
        </AppButton>
      </div>
    </div>
  </div>
</template>
