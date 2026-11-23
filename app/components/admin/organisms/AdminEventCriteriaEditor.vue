<script setup lang="ts">
// The judging criteria of a Hackathon: an organizer writes, orders and saves them here.
// The event builder and the Settings tab of the event workspace both show this editor.
import AdminEditorRowShell from '~/components/admin/AdminEditorRowShell.vue'
import type { EvaluationCriterion } from '~/domains/judging/criteria-config'
import { getCriteriaConfigurationValidationIssues } from '~/domains/judging/criteria-config'
import { normalizeApiError } from '~/lib/api'
import { applyCatalogDisplayOrder, moveCatalogRow, useEventCatalogDraft } from '~/composables/useEventCatalogDraft'

const props = defineProps<{
  eventId: string
  /** The saved criteria of the event. */
  criteria: EvaluationCriterion[]
}>()

const emit = defineEmits<{
  /** After a save wrote at least one criterion, also when a later one failed. */
  saved: []
  /** True while the editor holds a change that is not saved. */
  dirtyChange: [dirty: boolean]
}>()

type CriterionValidationField = 'name' | 'description' | 'weight'
type CriterionValidationErrors = Partial<Record<CriterionValidationField, string>>

const toast = useToast()
const {
  rows: criteriaRows,
  hasChanges: hasCriteriaChanges,
  save: persistCriteria
} = useEventCatalogDraft<EvaluationCriterion>({
  eventId: () => props.eventId,
  resource: 'evaluation-criteria',
  source: () => props.criteria,
  onSaved: () => emit('saved')
})
const isSavingCriteria = ref(false)
const hasAttemptedCriteriaSave = ref(false)
const criteriaMutationError = ref('')
const activeCriterionDragId = ref<string | null>(null)
const criterionDropTargetId = ref<string | null>(null)
const criteriaListElement = ref<HTMLElement | null>(null)

const orderedCriteria = computed(() =>
  [...criteriaRows.value].sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.localeCompare(b.createdAt))
)
const criteriaValidationIssues = computed(() =>
  getCriteriaConfigurationValidationIssues(orderedCriteria.value)
)
// The messages below the fields appear after the organizer tried to save.
const visibleCriteriaValidationIssues = computed(() =>
  hasAttemptedCriteriaSave.value ? criteriaValidationIssues.value : []
)
const criteriaValidationErrorsByCriterion = computed<Record<string, CriterionValidationErrors>>(() => {
  const errors: Record<string, CriterionValidationErrors> = {}

  visibleCriteriaValidationIssues.value.forEach((issue) => {
    const existing = errors[issue.criterionId] ?? {}
    existing[issue.field] = issue.message
    errors[issue.criterionId] = existing
  })

  return errors
})

watch(hasCriteriaChanges, dirty => emit('dirtyChange', dirty), { immediate: true })

useAdminSortableLists({
  elements: () => [criteriaListElement.value],
  // Dragging needs two rows. The sorting library is loaded only then, so a page that shows
  // an empty or a one-row list does not load it.
  enabled: () => orderedCriteria.value.length > 1,
  sources: [orderedCriteria],
  createOptions: () => ({
    animation: 180,
    handle: '[data-criterion-sort-handle]',
    draggable: '[data-criterion-row]',
    dataIdAttr: 'data-criterion-id',
    ghostClass: 'opacity-45',
    chosenClass: 'cursor-grabbing',
    dragClass: 'cursor-grabbing',
    onChoose(event) {
      activeCriterionDragId.value = event.item.dataset.criterionId ?? null
      criterionDropTargetId.value = null
    },
    onMove(event) {
      const relatedId = event.related?.dataset.criterionId ?? null
      criterionDropTargetId.value = relatedId !== activeCriterionDragId.value ? relatedId : null
      return true
    },
    onEnd(event) {
      const oldIndex = event.oldDraggableIndex ?? event.oldIndex
      const newIndex = event.newDraggableIndex ?? event.newIndex

      if (oldIndex !== undefined && newIndex !== undefined) {
        moveCatalogRow(orderedCriteria.value, oldIndex, newIndex)
      }

      activeCriterionDragId.value = null
      criterionDropTargetId.value = null
    }
  }),
  onDestroy: () => {
    activeCriterionDragId.value = null
    criterionDropTargetId.value = null
  }
})

function addCriterion() {
  const draftCriterion: EvaluationCriterion = {
    id: `draft-criterion-${crypto.randomUUID()}`,
    eventId: props.eventId,
    name: '',
    description: '',
    weight: 10,
    displayOrder: criteriaRows.value.length + 1,
    createdAt: new Date().toISOString()
  }

  criteriaRows.value = [...orderedCriteria.value, draftCriterion]
  applyCatalogDisplayOrder(criteriaRows.value)
}

function removeCriterion(criterionId: string) {
  criteriaRows.value = orderedCriteria.value.filter(criterion => criterion.id !== criterionId)
  applyCatalogDisplayOrder(criteriaRows.value)
}

function getCriterionValidationError(criterionId: string, field: CriterionValidationField) {
  return criteriaValidationErrorsByCriterion.value[criterionId]?.[field] ?? ''
}

async function saveCriteria() {
  if (!hasCriteriaChanges.value) {
    return
  }

  hasAttemptedCriteriaSave.value = true
  criteriaMutationError.value = ''

  if (criteriaValidationIssues.value.length > 0) {
    return
  }

  isSavingCriteria.value = true

  try {
    await persistCriteria()
    toast.add({
      title: 'Criteria updated',
      description: 'Judging criteria now match the latest configuration.',
      color: 'success'
    })
    hasAttemptedCriteriaSave.value = false
  } catch (error) {
    criteriaMutationError.value = normalizeApiError(error).message
  } finally {
    isSavingCriteria.value = false
  }
}
</script>

<template>
  <div
    class="grid grid-cols-1 gap-4"
    :inert="isSavingCriteria"
  >
    <div class="space-y-3">
      <div
        v-if="orderedCriteria.length === 0"
        class="grid gap-3 rounded-xl border border-dashed border-black/10 px-4 py-4 text-sm text-muted dark:border-white/[0.08]"
      >
        <p>No judging criteria configured yet.</p>
      </div>

      <div
        v-else
        ref="criteriaListElement"
        class="grid grid-cols-1 gap-3"
      >
        <div
          v-for="(criterion, index) in orderedCriteria"
          :key="criterion.id"
          :data-criterion-id="criterion.id"
          data-criterion-row
          class="rounded-xl border bg-white/88 p-3 transition-all dark:bg-[#111111]"
          :class="[
            criterionDropTargetId === criterion.id
              ? 'border-dashed border-black/30 ring-2 ring-black/6 dark:border-white/[0.32] dark:ring-white/[0.08]'
              : 'border-black/8 dark:border-white/[0.08]',
            activeCriterionDragId === criterion.id
              ? 'shadow-[0_16px_40px_-34px_rgba(15,23,42,0.55)]'
              : ''
          ]"
        >
          <div
            v-if="criterionDropTargetId === criterion.id"
            class="mb-3 rounded-lg border border-dashed border-black/18 bg-black/[0.03] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted dark:border-white/[0.14] dark:bg-white/[0.03]"
          >
            Drop criterion here
          </div>

          <AdminEditorRowShell>
            <template #controls>
              <AppButton
                color="neutral"
                variant="outline"
                icon="i-lucide-arrow-up"
                class="w-9 rounded-lg px-0"
                :aria-label="`Move ${criterion.name || `criterion ${index + 1}`} up`"
                :disabled="index === 0"
                @click="moveCatalogRow(orderedCriteria, index, index - 1)"
              />

              <button
                type="button"
                data-criterion-sort-handle
                class="group inline-flex h-11 w-11 cursor-grab items-center justify-center rounded-xl border border-black/8 bg-white text-toned transition hover:border-black/20 hover:text-highlighted active:cursor-grabbing dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]"
                :aria-label="`Drag to reorder ${criterion.name || `criterion ${index + 1}`}`"
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
                :aria-label="`Move ${criterion.name || `criterion ${index + 1}`} down`"
                :disabled="index === orderedCriteria.length - 1"
                @click="moveCatalogRow(orderedCriteria, index, index + 1)"
              />
            </template>

            <div class="grid grid-cols-1 gap-2.5">
              <div class="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_140px]">
                <label class="grid gap-1">
                  <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Criterion name</span>
                  <AppInput
                    v-model="criterion.name"
                    type="text"
                    placeholder="Impact"
                    required
                    :class="getCriterionValidationError(criterion.id, 'name') ? 'border-error/45 focus:border-error dark:border-error/50' : ''"
                  />
                  <p
                    v-if="getCriterionValidationError(criterion.id, 'name')"
                    class="text-xs text-error"
                  >
                    {{ getCriterionValidationError(criterion.id, 'name') }}
                  </p>
                </label>
                <label class="grid gap-1">
                  <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Weight</span>
                  <AppInput
                    v-model.number="criterion.weight"
                    type="number"
                    min="0"
                    placeholder="10"
                    required
                    :class="getCriterionValidationError(criterion.id, 'weight') ? 'border-error/45 focus:border-error dark:border-error/50' : ''"
                  />
                  <p
                    v-if="getCriterionValidationError(criterion.id, 'weight')"
                    class="text-xs text-error"
                  >
                    {{ getCriterionValidationError(criterion.id, 'weight') }}
                  </p>
                </label>
              </div>

              <label class="grid gap-1">
                <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Description</span>
                <AppTextarea
                  v-model="criterion.description"
                  rows="1"
                  class="min-h-10"
                  placeholder="Explain what judges should evaluate here."
                  required
                  :class="getCriterionValidationError(criterion.id, 'description') ? 'border-error/45 focus:border-error dark:border-error/50' : ''"
                />
                <p
                  v-if="getCriterionValidationError(criterion.id, 'description')"
                  class="text-xs text-error"
                >
                  {{ getCriterionValidationError(criterion.id, 'description') }}
                </p>
              </label>
            </div>

            <template #actions>
              <AppButton
                color="error"
                variant="outline"
                icon="i-lucide-trash-2"
                class="w-9 rounded-lg px-0"
                :aria-label="`Delete ${criterion.name || `criterion ${index + 1}`}`"
                @click="removeCriterion(criterion.id)"
              />
            </template>
          </AdminEditorRowShell>
        </div>
      </div>

      <AppAlert
        v-if="criteriaMutationError"
        data-testid="criteria-save-error"
        color="error"
        variant="soft"
        title="Criteria not saved"
        :description="criteriaMutationError"
      />

      <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
        <AppButton
          type="button"
          color="neutral"
          variant="soft"
          size="sm"
          class="w-fit"
          @click="addCriterion"
        >
          {{ orderedCriteria.length === 0 ? 'Add first criterion' : 'Add criterion' }}
        </AppButton>

        <AppButton
          type="button"
          color="primary"
          size="md"
          :disabled="!hasCriteriaChanges || isSavingCriteria"
          :loading="isSavingCriteria"
          @click="saveCriteria"
        >
          Save criteria
        </AppButton>
      </div>
    </div>
  </div>
</template>
