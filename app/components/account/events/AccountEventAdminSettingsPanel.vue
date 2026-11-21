<script setup lang="ts">
import type Sortable from 'sortablejs'

import AccountEventAdminTermsCard from '~/components/account/events/AccountEventAdminTermsCard.vue'
import AdminEditorRowShell from '~/components/admin/AdminEditorRowShell.vue'

import type { ApiDataResponse } from '~/lib/api'
import type {
  EventRecord,
  TermsDocument
} from '~/domains/events/records'
import type {
  EventFormState
} from '~/domains/events/admin-event'
import type { EvaluationCriterion } from '~/domains/judging/criteria-config'
import type { PrizeDefinition } from '~/domains/outcomes/prizes'
import type { EventProgramSettingsMode } from '~/domains/events/program-settings'
import type {
  AccountEventSettingsEvent,
  AccountEventSettingsPage,
  AccountEventSettingsPrize
} from '#shared/domains/events/account-event-settings-page'

import { normalizeApiError } from '~/lib/api'
import { moveListItemByIndex } from '~/utils/reorder-list'

import {
  buildEventConfigurationPatch,
  getTermsVersionPublishErrorMessage,
  toEventAgendaPayload
} from '~/domains/events/admin-event'
import { formatEventTypeLabel } from '~/domains/events/presentation'
import { getCriteriaConfigurationValidationIssues } from '~/domains/judging/criteria-config'
import { getEventProgramSettingsCopy } from '~/domains/events/program-settings'
import { computeEventBalance } from '#shared/domains/events/builder-scoring'
import { createBuilderStateFromEvent, toEventBalanceInputFromState } from '~/domains/events/builder'
import { useApiClient } from '~/composables/useApiClient'

const props = withDefaults(defineProps<{
  eventId: string
  page?: AccountEventSettingsPage | null
  eventData?: AccountEventSettingsEvent | null
  prizesData?: AccountEventSettingsPrize[]
  isLoading?: boolean
  loadErrorMessage?: string
  canManage?: boolean
  showProgramSettings?: boolean
  programSettingsMode?: EventProgramSettingsMode
  showTermsManagement?: boolean
  showCriteriaConfiguration?: boolean
  showPrizeConfiguration?: boolean
}>(), {
  page: null,
  eventData: null,
  prizesData: () => [],
  isLoading: false,
  loadErrorMessage: '',
  canManage: true,
  showProgramSettings: true,
  programSettingsMode: 'settings',
  showTermsManagement: true,
  showCriteriaConfiguration: true,
  showPrizeConfiguration: true
})

const emit = defineEmits<{
  updated: []
}>()

type CriterionEditState = Pick<EvaluationCriterion, 'name' | 'description' | 'weight' | 'displayOrder'>
type EditableCriterionRow = EvaluationCriterion & {
  isLocalDraft?: boolean
}
type CriterionValidationField = 'name' | 'description' | 'weight'
type CriterionValidationErrors = Partial<Record<CriterionValidationField, string>>
type PrizeEditState = Pick<PrizeDefinition, 'name' | 'description' | 'rewardType' | 'rewardValue' | 'awardScope' | 'rankStart' | 'rankEnd' | 'displayOrder'> & {
  rewardCurrency: string
}
type EditablePrizeRow = PrizeDefinition & {
  isLocalDraft?: boolean
}
type SortableInstance = Sortable
type SortableConstructor = typeof Sortable

const toast = useToast()
const apiFetch = useApiClient()
const eventId = computed(() => props.eventId.trim())

if (!eventId.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Event not found.'
  })
}

const showSettingsOverview = computed(() => props.showProgramSettings && props.programSettingsMode === 'settings')
const settingsPage = computed(() => props.page ?? null)

const isSavingConfig = ref(false)
const isRetryingLumaConfiguration = ref(false)
const isSavingCriteria = ref(false)
const isSavingPrizes = ref(false)
const savingTermsDocumentType = ref<TermsDocument['documentType'] | null>(null)
const hasAttemptedCriteriaSave = ref(false)
const configMutationError = ref('')
const mutationError = ref('')
const criteriaMutationError = ref('')
const imageMutationState = reactive({
  background: {
    pending: false,
    error: ''
  },
  banner: {
    pending: false,
    error: ''
  }
})
const criterionEdits = reactive<Record<string, CriterionEditState>>({})
const prizeEdits = reactive<Record<string, PrizeEditState>>({})
const criteriaRows = ref<EditableCriterionRow[]>([])
const prizeRows = ref<EditablePrizeRow[]>([])
const hideEventReason = ref('')
const activeCriterionDragId = ref<string | null>(null)
const criterionDropTargetId = ref<string | null>(null)
const criteriaListElement = ref<HTMLElement | null>(null)
const activePrizeDragId = ref<string | null>(null)
const prizeDropTargetId = ref<string | null>(null)
const prizeListElement = ref<HTMLElement | null>(null)
const applicationTermsDraft = ref('')
const winnerTermsDraft = ref('')
const lastSyncedApplicationTermsContent = ref('')
const lastSyncedWinnerTermsContent = ref('')
const eventVisibilityMutationError = ref('')
const isUpdatingEventVisibility = ref(false)
let criteriaSortable: SortableInstance | null = null
let prizeSortable: SortableInstance | null = null
let sortableConstructor: SortableConstructor | null = null

const currentEvent = computed(() => settingsPage.value?.event ?? props.eventData ?? null)

const builderBalance = computed(() => {
  const event = currentEvent.value

  if (!event || event.creationFlow !== 'builder') {
    return null
  }

  return computeEventBalance(toEventBalanceInputFromState(createBuilderStateFromEvent(event)))
})
const showEmergencyVisibilitySettings = computed(() => props.showProgramSettings && props.programSettingsMode === 'settings')
const isEventHidden = computed(() => Boolean(currentEvent.value?.hiddenAt))
const trimmedHideEventReason = computed(() => hideEventReason.value.trim())
const isCompetitionEvent = computed(() => currentEvent.value?.eventType === 'hackathon')
const settingsOverviewGridClass = computed(() =>
  isCompetitionEvent.value
    ? 'md:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(0,1fr))]'
    : 'md:grid-cols-2 lg:grid-cols-[minmax(0,1.45fr)_repeat(3,minmax(0,1fr))]'
)
const eventTypeLabel = computed(() =>
  currentEvent.value ? formatEventTypeLabel(currentEvent.value.eventType) : ''
)
const canManage = computed(() => props.canManage)
const programSettingsCopy = computed(() => getEventProgramSettingsCopy(props.programSettingsMode))
const hiddenEventAlertDescription = computed(() => {
  const reason = currentEvent.value?.hiddenReason?.trim()

  return reason
    ? `Public pages and participant event lists are unavailable. Reason: ${reason}`
    : 'Public pages and participant event lists are unavailable until an admin makes this event visible again.'
})
const eventVisibilityCardTitle = computed(() => isEventHidden.value ? 'Event hidden' : 'Hide event')
const eventVisibilityCardDescription = computed(() =>
  isEventHidden.value
    ? 'Public pages and participant event lists are unavailable while admins fix the issue.'
    : 'Hide this event when public access needs to stop while admins fix a serious issue.'
)
const criteria = computed(() => settingsPage.value?.criteria ?? [])
const prizes = computed(() => settingsPage.value?.prizes ?? props.prizesData ?? [])
const roleAssignments = computed(() => settingsPage.value?.roles.assignments ?? [])
const orderedCriteria = computed(() =>
  [...criteriaRows.value].sort((left, right) => {
    const leftOrder = getCriterionEdit(left).displayOrder
    const rightOrder = getCriterionEdit(right).displayOrder
    return leftOrder - rightOrder || left.createdAt.localeCompare(right.createdAt)
  })
)
const orderedPrizes = computed(() =>
  [...prizeRows.value].sort((left, right) => {
    const leftOrder = getPrizeEdit(left).displayOrder
    const rightOrder = getPrizeEdit(right).displayOrder

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return left.rankEnd - right.rankEnd || right.rankStart - left.rankStart || left.createdAt.localeCompare(right.createdAt)
  })
)
const hasCriteriaChanges = computed(() => {
  if (criteriaRows.value.length !== criteria.value.length) {
    return true
  }

  const visibleCriterionIds = new Set(criteriaRows.value.map(criterion => criterion.id))

  if (criteriaRows.value.some(criterion => !criteria.value.some(existingCriterion => existingCriterion.id === criterion.id))) {
    return true
  }

  if (criteria.value.some(criterion => !visibleCriterionIds.has(criterion.id))) {
    return true
  }

  return criteria.value.some((criterion) => {
    const edit = getCriterionEdit(criterion)

    return edit.name !== criterion.name
      || edit.description !== criterion.description
      || edit.weight !== criterion.weight
      || edit.displayOrder !== criterion.displayOrder
  })
})
const hasPrizeChanges = computed(() => {
  if (prizeRows.value.length !== prizes.value.length) {
    return true
  }

  const visiblePrizeIds = new Set(prizeRows.value.map(prize => prize.id))

  if (prizeRows.value.some(prize => !prizes.value.some(existingPrize => existingPrize.id === prize.id))) {
    return true
  }

  if (prizes.value.some(prize => !visiblePrizeIds.has(prize.id))) {
    return true
  }

  return prizes.value.some((prize) => {
    const edit = getPrizeEdit(prize)

    return edit.name !== prize.name
      || edit.description !== prize.description
      || edit.rewardType !== prize.rewardType
      || edit.rewardValue !== prize.rewardValue
      || (edit.rewardCurrency || null) !== prize.rewardCurrency
      || edit.awardScope !== prize.awardScope
      || edit.rankStart !== prize.rankStart
      || edit.rankEnd !== prize.rankEnd
      || edit.displayOrder !== prize.displayOrder
  })
})
const applicationTerms = computed(() => settingsPage.value?.terms.application.versions ?? [])
const winnerTerms = computed(() => settingsPage.value?.terms.winner.versions ?? [])
const currentApplicationTerms = computed(() => settingsPage.value?.terms.application.current ?? null)
const currentWinnerTerms = computed(() => settingsPage.value?.terms.winner.current ?? null)
const creatorAssignment = computed(() =>
  roleAssignments.value.find(assignment => assignment.userId === currentEvent.value?.createdByUserId) ?? null
)
const creatorLabel = computed(() => {
  const creator = creatorAssignment.value?.user

  if (creator) {
    return creator.displayName || creator.email
  }

  return currentEvent.value?.createdByUserId ?? 'Platform admin'
})
const creatorMeta = computed(() => creatorAssignment.value?.user?.email ?? 'Platform admin')
const adminCount = computed(() => settingsPage.value?.roles.counts.admins ?? 0)
const criteriaValidationIssues = computed(() =>
  getCriteriaConfigurationValidationIssues(
    orderedCriteria.value.map((criterion) => {
      const edit = getCriterionEdit(criterion)

      return {
        id: criterion.id,
        name: edit.name,
        description: edit.description,
        weight: edit.weight
      }
    })
  )
)
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
const staffCount = computed(() => settingsPage.value?.roles.counts.staff ?? 0)
const judgeCount = computed(() => settingsPage.value?.roles.counts.judges ?? 0)

function nextCriterionDisplayOrder(items: Array<EditableCriterionRow>) {
  return items.reduce((highest, item) => Math.max(highest, item.displayOrder), 0) + 1
}

function nextPrizeDisplayOrder(items: Array<EditablePrizeRow>) {
  return items.reduce((highest, item) => Math.max(highest, getPrizeEdit(item).displayOrder), 0) + 1
}

function replaceReactiveMap<T>(target: Record<string, T>, source: Record<string, T>) {
  for (const key of Object.keys(target)) {
    if (!(key in source)) {
      Reflect.deleteProperty(target, key)
    }
  }

  Object.assign(target, source)
}

function createCriterionEditState(criterion: EditableCriterionRow): CriterionEditState {
  return {
    name: criterion.name,
    description: criterion.description,
    weight: criterion.weight,
    displayOrder: criterion.displayOrder
  }
}

function createPrizeEditState(prize: PrizeDefinition): PrizeEditState {
  return {
    name: prize.name,
    description: prize.description,
    rewardType: prize.rewardType,
    rewardValue: prize.rewardValue,
    rewardCurrency: prize.rewardCurrency ?? '',
    awardScope: prize.awardScope,
    rankStart: prize.rankStart,
    rankEnd: prize.rankEnd,
    displayOrder: prize.displayOrder
  }
}

function getCriterionEdit(criterion: EditableCriterionRow) {
  const existing = criterionEdits[criterion.id]

  if (existing) {
    return existing
  }

  const next = createCriterionEditState(criterion)
  criterionEdits[criterion.id] = next
  return next
}

function getPrizeEdit(prize: PrizeDefinition) {
  const existing = prizeEdits[prize.id]

  if (existing) {
    return existing
  }

  const next = createPrizeEditState(prize)
  prizeEdits[prize.id] = next
  return next
}

function moveItemByDirection<T extends { id: string }>(items: T[], itemId: string, direction: -1 | 1) {
  const currentIndex = items.findIndex(item => item.id === itemId)

  if (currentIndex < 0) {
    return items
  }

  const targetIndex = currentIndex + direction

  if (targetIndex < 0 || targetIndex >= items.length) {
    return items
  }

  const reordered = [...items]
  const [movedItem] = reordered.splice(currentIndex, 1)

  if (!movedItem) {
    return items
  }

  reordered.splice(targetIndex, 0, movedItem)
  return reordered
}

function applyPrizeOrderFromList(items: PrizeDefinition[]) {
  items.forEach((prize, index) => {
    getPrizeEdit(prize).displayOrder = index + 1
  })
}

function applyCriterionOrderFromList(items: EditableCriterionRow[]) {
  items.forEach((criterion, index) => {
    getCriterionEdit(criterion).displayOrder = index + 1
  })
  criteriaRows.value = [...items]
}

function moveCriterion(criterionId: string, direction: -1 | 1) {
  applyCriterionOrderFromList(moveItemByDirection(orderedCriteria.value, criterionId, direction))
}

function destroyCriteriaSortable() {
  criteriaSortable?.destroy()
  criteriaSortable = null
  activeCriterionDragId.value = null
  criterionDropTargetId.value = null
}

function movePrize(prizeId: string, direction: -1 | 1) {
  applyPrizeOrderFromList(moveItemByDirection(orderedPrizes.value, prizeId, direction))
}

async function loadSortableConstructor() {
  if (!sortableConstructor) {
    const module = await import('sortablejs')
    sortableConstructor = module.default
  }

  return sortableConstructor
}

async function initializeCriteriaSortable() {
  if (!import.meta.client || !props.showCriteriaConfiguration || !criteriaListElement.value) {
    destroyCriteriaSortable()
    return
  }

  const Sortable = await loadSortableConstructor()

  if (!props.showCriteriaConfiguration || !criteriaListElement.value) {
    destroyCriteriaSortable()
    return
  }

  destroyCriteriaSortable()

  criteriaSortable = Sortable.create(criteriaListElement.value, {
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
        applyCriterionOrderFromList(moveListItemByIndex(orderedCriteria.value, oldIndex, newIndex))
      }

      activeCriterionDragId.value = null
      criterionDropTargetId.value = null
    }
  })
}

function destroyPrizeSortable() {
  prizeSortable?.destroy()
  prizeSortable = null
  activePrizeDragId.value = null
  prizeDropTargetId.value = null
}

async function initializePrizeSortable() {
  if (!import.meta.client || !props.showPrizeConfiguration || !prizeListElement.value) {
    destroyPrizeSortable()
    return
  }

  const Sortable = await loadSortableConstructor()

  if (!props.showPrizeConfiguration || !prizeListElement.value) {
    destroyPrizeSortable()
    return
  }

  destroyPrizeSortable()

  prizeSortable = Sortable.create(prizeListElement.value, {
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
        applyPrizeOrderFromList(moveListItemByIndex(orderedPrizes.value, oldIndex, newIndex))
      }

      activePrizeDragId.value = null
      prizeDropTargetId.value = null
    }
  })
}

watch(criteria, (items) => {
  criteriaRows.value = items.map(criterion => ({ ...criterion }))
  replaceReactiveMap(
    criterionEdits,
    Object.fromEntries(items.map(criterion => [criterion.id, createCriterionEditState(criterion)]))
  )
}, {
  immediate: true
})

watch(prizes, (items) => {
  prizeRows.value = items.map(prize => ({ ...prize }))
  replaceReactiveMap(
    prizeEdits,
    Object.fromEntries(items.map(prize => [prize.id, createPrizeEditState(prize)]))
  )
}, {
  immediate: true
})

watch([orderedCriteria, () => props.showCriteriaConfiguration], async () => {
  await nextTick()
  await initializeCriteriaSortable()
}, {
  immediate: true,
  flush: 'post'
})

watch([orderedPrizes, () => props.showPrizeConfiguration], async () => {
  await nextTick()
  await initializePrizeSortable()
}, {
  immediate: true,
  flush: 'post'
})

watch(currentApplicationTerms, (document) => {
  const nextContent = document?.content ?? ''

  if (applicationTermsDraft.value === lastSyncedApplicationTermsContent.value) {
    applicationTermsDraft.value = nextContent
  }

  lastSyncedApplicationTermsContent.value = nextContent
}, {
  immediate: true
})

watch(currentWinnerTerms, (document) => {
  const nextContent = document?.content ?? ''

  if (winnerTermsDraft.value === lastSyncedWinnerTermsContent.value) {
    winnerTermsDraft.value = nextContent
  }

  lastSyncedWinnerTermsContent.value = nextContent
}, {
  immediate: true
})

onBeforeUnmount(() => {
  destroyCriteriaSortable()
  destroyPrizeSortable()
})

async function saveConfiguration(configForm: EventFormState) {
  if (!currentEvent.value) {
    return
  }

  if (props.programSettingsMode === 'details') {
    await patchConfiguration(
      {
        agendaItems: toEventAgendaPayload(configForm.agendaItems),
        city: configForm.city,
        country: configForm.country,
        address: configForm.address
      },
      programSettingsCopy.value.successTitle,
      programSettingsCopy.value.successDescription
    )
    return
  }

  await patchConfiguration(
    buildEventConfigurationPatch(configForm, currentEvent.value.eventType),
    programSettingsCopy.value.successTitle,
    programSettingsCopy.value.successDescription
  )
}

async function patchConfiguration(
  body: Record<string, unknown>,
  successTitle: string,
  successDescription: string
) {
  if (!currentEvent.value) {
    return
  }

  configMutationError.value = ''
  isSavingConfig.value = true

  try {
    const updateUrl = `/api/events/${currentEvent.value.id}` as string

    await apiFetch(updateUrl, {
      method: 'PATCH',
      body
    })

    toast.add({
      title: successTitle,
      description: successDescription,
      color: 'success'
    })

    emit('updated')
  } catch (error) {
    configMutationError.value = normalizeApiError(error).message
  } finally {
    isSavingConfig.value = false
  }
}

async function retryLumaConfiguration() {
  const event = currentEvent.value

  if (!event) {
    return
  }

  configMutationError.value = ''
  isRetryingLumaConfiguration.value = true

  try {
    await apiFetch<ApiDataResponse<EventRecord>>(`/api/events/${event.id}/luma/actions/retry-configuration`, {
      method: 'POST'
    })

    toast.add({
      title: 'Luma configuration retried',
      description: 'The latest Luma webhook status is shown in event settings.',
      color: 'success'
    })

    emit('updated')
  } catch (error) {
    configMutationError.value = normalizeApiError(error).message
  } finally {
    isRetryingLumaConfiguration.value = false
  }
}

async function hideEvent() {
  const event = currentEvent.value

  if (!event || !trimmedHideEventReason.value) {
    return
  }

  eventVisibilityMutationError.value = ''
  isUpdatingEventVisibility.value = true

  try {
    await apiFetch<ApiDataResponse<EventRecord>>(`/api/events/${event.id}/actions/hide`, {
      method: 'POST',
      body: {
        reason: trimmedHideEventReason.value
      }
    })

    hideEventReason.value = ''
    toast.add({
      title: 'Event hidden',
      description: 'Public and participant access has been paused.',
      color: 'success'
    })
    emit('updated')
  } catch (error) {
    eventVisibilityMutationError.value = normalizeApiError(error).message
  } finally {
    isUpdatingEventVisibility.value = false
  }
}

async function unhideEvent() {
  const event = currentEvent.value

  if (!event) {
    return
  }

  eventVisibilityMutationError.value = ''
  isUpdatingEventVisibility.value = true

  try {
    await apiFetch<ApiDataResponse<EventRecord>>(`/api/events/${event.id}/actions/unhide`, {
      method: 'POST'
    })

    toast.add({
      title: 'Event visible',
      description: 'Public and participant access has been restored.',
      color: 'success'
    })
    emit('updated')
  } catch (error) {
    eventVisibilityMutationError.value = normalizeApiError(error).message
  } finally {
    isUpdatingEventVisibility.value = false
  }
}

type EventImageSlot = 'background' | 'banner'

async function uploadEventImage(slot: EventImageSlot, file: File) {
  const event = currentEvent.value

  if (!event) {
    return
  }

  const state = imageMutationState[slot]
  state.pending = true
  state.error = ''

  try {
    const formData = new FormData()
    formData.append('file', file)

    await apiFetch<ApiDataResponse<EventRecord>>(`/api/events/${event.id}/images/${slot}`, {
      method: 'POST',
      body: formData
    })

    emit('updated')
    toast.add({
      title: slot === 'background' ? 'Background image updated' : 'Banner image updated',
      description: slot === 'background'
        ? 'The public Details tab now shows the latest background image.'
        : 'The public Details tab now shows the latest banner image.',
      color: 'success'
    })
  } catch (error) {
    state.error = normalizeApiError(error).message
  } finally {
    state.pending = false
  }
}

async function removeEventImage(slot: EventImageSlot) {
  const event = currentEvent.value

  if (!event) {
    return
  }

  const state = imageMutationState[slot]
  state.pending = true
  state.error = ''

  try {
    await apiFetch<ApiDataResponse<EventRecord>>(`/api/events/${event.id}/images/${slot}`, {
      method: 'DELETE'
    })

    emit('updated')
    toast.add({
      title: slot === 'background' ? 'Background image removed' : 'Banner image removed',
      description: slot === 'background'
        ? 'The public Details tab no longer shows a managed background image.'
        : 'The public Details tab no longer shows a managed banner image.',
      color: 'success'
    })
  } catch (error) {
    state.error = normalizeApiError(error).message
  } finally {
    state.pending = false
  }
}

async function uploadBackgroundImage(file: File) {
  await uploadEventImage('background', file)
}

async function removeBackgroundImage() {
  await removeEventImage('background')
}

async function uploadBannerImage(file: File) {
  await uploadEventImage('banner', file)
}

async function removeBannerImage() {
  await removeEventImage('banner')
}

function addCriterion() {
  const event = currentEvent.value

  if (!event) {
    return
  }

  const draftCriterion: EditableCriterionRow = {
    id: `draft-criterion-${crypto.randomUUID()}`,
    eventId: event.id,
    name: '',
    description: '',
    weight: 10,
    displayOrder: nextCriterionDisplayOrder(criteriaRows.value),
    createdAt: new Date().toISOString(),
    isLocalDraft: true
  }

  criteriaRows.value = [...orderedCriteria.value, draftCriterion]
  criterionEdits[draftCriterion.id] = createCriterionEditState(draftCriterion)
  applyCriterionOrderFromList(criteriaRows.value)
}

function removeCriterion(criterionId: string) {
  criteriaRows.value = orderedCriteria.value.filter(criterion => criterion.id !== criterionId)
  Reflect.deleteProperty(criterionEdits, criterionId)
  applyCriterionOrderFromList(criteriaRows.value)
}

function getCriterionValidationError(criterionId: string, field: CriterionValidationField) {
  return criteriaValidationErrorsByCriterion.value[criterionId]?.[field] ?? ''
}

function buildCriterionMutationBody(criterion: EditableCriterionRow) {
  const edit = getCriterionEdit(criterion)

  return {
    name: edit.name,
    description: edit.description,
    weight: edit.weight,
    displayOrder: edit.displayOrder
  }
}

function criterionMatchesPersistedState(criterion: EditableCriterionRow) {
  const persistedCriterion = criteria.value.find(existingCriterion => existingCriterion.id === criterion.id)

  if (!persistedCriterion) {
    return false
  }

  const edit = getCriterionEdit(criterion)

  return edit.name === persistedCriterion.name
    && edit.description === persistedCriterion.description
    && edit.weight === persistedCriterion.weight
    && edit.displayOrder === persistedCriterion.displayOrder
}

function addPrize() {
  const event = currentEvent.value

  if (!event) {
    return
  }

  const draftPrize: EditablePrizeRow = {
    id: `draft-prize-${crypto.randomUUID()}`,
    eventId: event.id,
    name: '',
    description: '',
    rewardType: 'api_credits',
    rewardValue: '',
    rewardCurrency: null,
    awardScope: 'team',
    rankStart: 1,
    rankEnd: 1,
    displayOrder: nextPrizeDisplayOrder(prizeRows.value),
    createdAt: new Date().toISOString(),
    isLocalDraft: true
  }

  prizeRows.value = [...orderedPrizes.value, draftPrize]
  prizeEdits[draftPrize.id] = createPrizeEditState(draftPrize)
  applyPrizeOrderFromList(prizeRows.value)
}

function removePrize(prizeId: string) {
  prizeRows.value = orderedPrizes.value.filter(prize => prize.id !== prizeId)
  Reflect.deleteProperty(prizeEdits, prizeId)
  applyPrizeOrderFromList(prizeRows.value)
}

function buildPrizeMutationBody(prize: EditablePrizeRow) {
  const edit = getPrizeEdit(prize)

  return {
    name: edit.name,
    description: edit.description,
    rewardType: edit.rewardType,
    rewardValue: edit.rewardValue,
    rewardCurrency: edit.rewardCurrency || null,
    awardScope: edit.awardScope,
    rankStart: edit.rankStart,
    rankEnd: edit.rankEnd,
    displayOrder: edit.displayOrder
  }
}

function prizeMatchesPersistedState(prize: EditablePrizeRow) {
  const persistedPrize = prizes.value.find(existingPrize => existingPrize.id === prize.id)

  if (!persistedPrize) {
    return false
  }

  const edit = getPrizeEdit(prize)

  return edit.name === persistedPrize.name
    && edit.description === persistedPrize.description
    && edit.rewardType === persistedPrize.rewardType
    && edit.rewardValue === persistedPrize.rewardValue
    && (edit.rewardCurrency || null) === persistedPrize.rewardCurrency
    && edit.awardScope === persistedPrize.awardScope
    && edit.rankStart === persistedPrize.rankStart
    && edit.rankEnd === persistedPrize.rankEnd
    && edit.displayOrder === persistedPrize.displayOrder
}

async function saveCriteria() {
  const event = currentEvent.value

  if (!event || !hasCriteriaChanges.value) {
    return
  }

  const visibleCriterionIds = new Set(orderedCriteria.value.map(criterion => criterion.id))
  const removedPersistedCriteria = criteria.value.filter(criterion => !visibleCriterionIds.has(criterion.id))
  const updatedPersistedCriteria = orderedCriteria.value.filter(
    criterion => !criterion.isLocalDraft && !criterionMatchesPersistedState(criterion)
  )
  const reorderedPersistedCriteria = updatedPersistedCriteria.filter(
    criterion => getCriterionEdit(criterion).displayOrder !== criteria.value.find(existing => existing.id === criterion.id)?.displayOrder
  )
  const maxDisplayOrder = Math.max(
    0,
    ...criteria.value.map(criterion => criterion.displayOrder),
    ...orderedCriteria.value.map(criterion => getCriterionEdit(criterion).displayOrder)
  )

  hasAttemptedCriteriaSave.value = true
  criteriaMutationError.value = ''

  if (criteriaValidationIssues.value.length > 0) {
    return
  }

  isSavingCriteria.value = true

  try {
    for (const criterion of removedPersistedCriteria) {
      await apiFetch(`/api/events/${event.id}/evaluation-criteria/${criterion.id}`, {
        method: 'DELETE'
      })
    }

    for (const [index, criterion] of reorderedPersistedCriteria.entries()) {
      await apiFetch(`/api/events/${event.id}/evaluation-criteria/${criterion.id}`, {
        method: 'PATCH',
        body: {
          displayOrder: maxDisplayOrder + index + 1
        }
      })
    }

    for (const criterion of updatedPersistedCriteria) {
      await apiFetch(`/api/events/${event.id}/evaluation-criteria/${criterion.id}`, {
        method: 'PATCH',
        body: buildCriterionMutationBody(criterion)
      })
    }

    for (const criterion of orderedCriteria.value) {
      if (!criterion.isLocalDraft) {
        continue
      }

      await apiFetch(`/api/events/${event.id}/evaluation-criteria`, {
        method: 'POST',
        body: buildCriterionMutationBody(criterion)
      })
    }

    toast.add({
      title: 'Criteria updated',
      description: 'Judging criteria now match the latest configuration.',
      color: 'success'
    })
    hasAttemptedCriteriaSave.value = false
    emit('updated')
  } catch (error) {
    criteriaMutationError.value = normalizeApiError(error).message
  } finally {
    isSavingCriteria.value = false
  }
}

async function savePrizes() {
  const event = currentEvent.value

  if (!event || !hasPrizeChanges.value) {
    return
  }

  isSavingPrizes.value = true
  mutationError.value = ''

  try {
    const visiblePrizeIds = new Set(orderedPrizes.value.map(prize => prize.id))

    for (const prize of prizes.value) {
      if (visiblePrizeIds.has(prize.id)) {
        continue
      }

      await apiFetch(`/api/events/${event.id}/prizes/${prize.id}`, {
        method: 'DELETE'
      })
    }

    for (const prize of orderedPrizes.value) {
      const requestBody = buildPrizeMutationBody(prize)

      if (prize.isLocalDraft) {
        await apiFetch(`/api/events/${event.id}/prizes`, {
          method: 'POST',
          body: requestBody
        })
        continue
      }

      if (prizeMatchesPersistedState(prize)) {
        continue
      }

      await apiFetch(`/api/events/${event.id}/prizes/${prize.id}`, {
        method: 'PATCH',
        body: requestBody
      })
    }

    toast.add({
      title: 'Prizes updated',
      description: 'The prize catalog has been updated.',
      color: 'success'
    })
    emit('updated')
  } catch (error) {
    mutationError.value = normalizeApiError(error).message
  } finally {
    isSavingPrizes.value = false
  }
}

function getNextTermsVersion(documents: Array<Pick<TermsDocument, 'version'>>) {
  return documents.reduce((highest, document) => Math.max(highest, document.version), 0) + 1
}

function formatTermsTitle(documentType: TermsDocument['documentType'], version: number) {
  const label = documentType === 'application_terms' ? 'Application Terms' : 'Winner Terms'
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())

  return `${label} v${version} (${date})`
}

function getTermsDraft(documentType: TermsDocument['documentType']) {
  return documentType === 'application_terms' ? applicationTermsDraft.value : winnerTermsDraft.value
}

async function saveTerms(documentType: TermsDocument['documentType']) {
  const event = currentEvent.value

  if (!event) {
    return
  }

  mutationError.value = ''
  savingTermsDocumentType.value = documentType

  const content = getTermsDraft(documentType).trim()
  const version = getNextTermsVersion(documentType === 'application_terms' ? applicationTerms.value : winnerTerms.value)
  const title = formatTermsTitle(documentType, version)
  const validationError = getTermsVersionPublishErrorMessage(title, content)

  if (validationError) {
    mutationError.value = validationError
    savingTermsDocumentType.value = null
    return
  }

  try {
    const createdDocument = await apiFetch<ApiDataResponse<TermsDocument>>(`/api/events/${event.id}/terms/${documentType}/versions`, {
      method: 'POST',
      body: {
        title,
        content
      }
    })

    await apiFetch(`/api/events/${event.id}/terms/${documentType}/actions/set-current`, {
      method: 'POST',
      body: {
        eventTermsDocumentId: createdDocument.data.id
      }
    })

    toast.add({
      title: documentType === 'application_terms' ? 'Application terms updated' : 'Winner terms updated',
      description: documentType === 'application_terms'
        ? 'A new application terms version is now current for registration.'
        : 'A new winner terms version is now current for prize redemption.',
      color: 'success'
    })
    emit('updated')
  } catch (error) {
    mutationError.value = normalizeApiError(error).message
  } finally {
    savingTermsDocumentType.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <AppAlert
      v-if="mutationError"
      color="error"
      variant="soft"
      title="Admin action failed"
      :description="mutationError"
    />

    <AppAlert
      v-if="props.loadErrorMessage"
      color="error"
      variant="soft"
      title="Unable to load event"
      :description="props.loadErrorMessage"
    />

    <AppAlert
      v-else-if="currentEvent && !canManage"
      color="warning"
      variant="soft"
      title="Admin access required"
      description="This event is visible, but the current actor does not have event-admin capabilities for it."
    />

    <div
      v-else-if="props.isLoading"
      class="rounded-xl border border-dashed border-black/10 px-5 py-8 text-center text-sm text-muted dark:border-white/[0.08]"
    >
      Loading event settings…
    </div>

    <template v-else-if="currentEvent">
      <section
        v-if="showSettingsOverview"
        class="grid gap-4"
        :class="settingsOverviewGridClass"
      >
        <div class="min-w-0 rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Created by
          </p>
          <p
            class="mt-2 min-w-0 truncate text-xl font-semibold text-highlighted"
            :title="creatorLabel"
          >
            {{ creatorLabel }}
          </p>
          <p
            class="mt-1 min-w-0 truncate text-sm text-muted"
            :title="creatorMeta"
          >
            {{ creatorMeta }}
          </p>
        </div>

        <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Event type
          </p>
          <p class="mt-2 text-xl font-semibold text-highlighted">
            {{ eventTypeLabel }}
          </p>
        </div>

        <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Admins
          </p>
          <p class="mt-2 text-xl font-semibold text-highlighted">
            {{ adminCount }}
          </p>
        </div>

        <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Staff
          </p>
          <p class="mt-2 text-xl font-semibold text-highlighted">
            {{ staffCount }}
          </p>
        </div>

        <div
          v-if="isCompetitionEvent"
          class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5"
        >
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Judges
          </p>
          <p class="mt-2 text-xl font-semibold text-highlighted">
            {{ judgeCount }}
          </p>
        </div>
      </section>

      <section
        v-if="props.showProgramSettings"
        class="space-y-6"
      >
        <div
          data-testid="event-builder-settings-banner"
          class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-black/8 bg-white/78 p-4 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] dark:border-white/[0.08] dark:bg-[#151515]/64"
        >
          <AppButton
            color="neutral"
            variant="solid"
            size="sm"
            :to="`/admin/events/builder/${currentEvent.slug}`"
            data-testid="event-builder-open-in-builder"
          >
            Open event builder
            <template #trailing>
              <AppIcon
                name="i-lucide-arrow-right"
                class="size-3.5"
              />
            </template>
          </AppButton>
          <AppBadge
            v-if="builderBalance"
            :color="builderBalance.score >= 80 ? 'success' : builderBalance.score >= 60 ? 'info' : 'warning'"
            variant="soft"
            class="tabular-nums"
          >
            Balance {{ builderBalance.score }} · {{ builderBalance.band.label }}
          </AppBadge>
        </div>

        <LazyAdminEventCreateEditForm
          :initial-event="currentEvent"
          :initial-simplified-claiming-status="settingsPage?.simplifiedClaiming ?? null"
          :has-existing-talk-proposal="settingsPage?.talkProposals.hasExistingProposal ?? false"
          :image-version="{ background: currentEvent.backgroundImageRevision, banner: currentEvent.bannerImageRevision }"
          :can-upload-managed-images="true"
          :is-submitting="isSavingConfig"
          :mode="props.programSettingsMode"
          :background-image-upload-pending="imageMutationState.background.pending"
          :background-image-upload-error="imageMutationState.background.error"
          :banner-image-upload-pending="imageMutationState.banner.pending"
          :banner-image-upload-error="imageMutationState.banner.error"
          :is-retrying-luma-configuration="isRetryingLumaConfiguration"
          :submit-label="programSettingsCopy.submitLabel"
          :helper-text="programSettingsCopy.helperText"
          :submit-error="configMutationError"
          @submit="saveConfiguration"
          @upload-background-image="uploadBackgroundImage"
          @remove-background-image="removeBackgroundImage"
          @upload-banner-image="uploadBannerImage"
          @remove-banner-image="removeBannerImage"
          @retry-luma-configuration="retryLumaConfiguration"
          @updated="emit('updated')"
        />
      </section>

      <section class="space-y-6">
        <AccountEventAdminTermsCard
          v-if="props.showTermsManagement"
          v-model:application-terms-draft="applicationTermsDraft"
          v-model:winner-terms-draft="winnerTermsDraft"
          :current-application-terms="currentApplicationTerms"
          :current-winner-terms="currentWinnerTerms"
          :saving-terms-document-type="savingTermsDocumentType"
          :show-winner-terms="isCompetitionEvent"
          @save-terms="saveTerms"
        />

        <AppCard
          v-if="props.showCriteriaConfiguration && isCompetitionEvent"
          class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
        >
          <template #header>
            <div class="space-y-1">
              <h2 class="text-lg font-semibold text-highlighted">
                Judging Criteria
              </h2>
              <p class="text-sm text-muted">
                Set how judges score submissions.
              </p>
            </div>
          </template>

          <div class="grid grid-cols-1 gap-4">
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
                        :aria-label="`Move ${getCriterionEdit(criterion).name || `criterion ${index + 1}`} up`"
                        :disabled="index === 0"
                        @click="moveCriterion(criterion.id, -1)"
                      />

                      <button
                        type="button"
                        data-criterion-sort-handle
                        class="group inline-flex h-11 w-11 cursor-grab items-center justify-center rounded-xl border border-black/8 bg-white text-toned transition hover:border-black/20 hover:text-highlighted active:cursor-grabbing dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]"
                        :aria-label="`Drag to reorder ${getCriterionEdit(criterion).name || `criterion ${index + 1}`}`"
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
                        :aria-label="`Move ${getCriterionEdit(criterion).name || `criterion ${index + 1}`} down`"
                        :disabled="index === orderedCriteria.length - 1"
                        @click="moveCriterion(criterion.id, 1)"
                      />
                    </template>

                    <div class="grid grid-cols-1 gap-2.5">
                      <div class="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_140px]">
                        <label class="grid gap-1">
                          <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Criterion name</span>
                          <AppInput
                            v-model="getCriterionEdit(criterion).name"
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
                            v-model.number="getCriterionEdit(criterion).weight"
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
                          v-model="getCriterionEdit(criterion).description"
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
                        :aria-label="`Delete ${getCriterionEdit(criterion).name || `criterion ${index + 1}`}`"
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
                  :disabled="!hasCriteriaChanges || isSavingCriteria || isSavingPrizes"
                  :loading="isSavingCriteria"
                  @click="saveCriteria"
                >
                  Save criteria
                </AppButton>
              </div>
            </div>
          </div>
        </AppCard>

        <AppCard
          v-if="props.showPrizeConfiguration && isCompetitionEvent"
          class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
        >
          <template #header>
            <div class="space-y-1">
              <h2 class="text-lg font-semibold text-highlighted">
                Prize Configuration
              </h2>
              <p class="text-sm text-muted">
                Set prizes and placement ranges.
              </p>
            </div>
          </template>

          <div class="grid grid-cols-1 gap-4">
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
                        :aria-label="`Move ${getPrizeEdit(prize).name || `prize ${index + 1}`} up`"
                        :disabled="index === 0"
                        @click="movePrize(prize.id, -1)"
                      />

                      <button
                        type="button"
                        data-prize-sort-handle
                        class="group inline-flex h-11 w-11 cursor-grab items-center justify-center rounded-xl border border-black/8 bg-white text-toned transition hover:border-black/20 hover:text-highlighted active:cursor-grabbing dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]"
                        :aria-label="`Drag to reorder ${getPrizeEdit(prize).name || `prize ${index + 1}`}`"
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
                        :aria-label="`Move ${getPrizeEdit(prize).name || `prize ${index + 1}`} down`"
                        :disabled="index === orderedPrizes.length - 1"
                        @click="movePrize(prize.id, 1)"
                      />
                    </template>

                    <div class="grid grid-cols-1 gap-2.5">
                      <div class="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_140px_110px]">
                        <label class="grid gap-1">
                          <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Prize name</span>
                          <AppInput
                            v-model="getPrizeEdit(prize).name"
                            type="text"
                            placeholder="Best overall"
                          />
                        </label>
                        <label class="grid gap-1">
                          <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Reward value</span>
                          <AppInput
                            v-model="getPrizeEdit(prize).rewardValue"
                            type="text"
                            placeholder="5000"
                          />
                        </label>
                        <label class="grid gap-1">
                          <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Currency</span>
                          <AppInput
                            v-model="getPrizeEdit(prize).rewardCurrency"
                            type="text"
                            placeholder="USD"
                          />
                        </label>
                      </div>

                      <div class="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_120px_88px_88px]">
                        <label class="grid gap-1">
                          <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Reward type</span>
                          <AppSelect
                            v-model="getPrizeEdit(prize).rewardType"
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
                            v-model="getPrizeEdit(prize).awardScope"
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
                            v-model.number="getPrizeEdit(prize).rankStart"
                            type="number"
                            min="1"
                            placeholder="1"
                          />
                        </label>
                        <label class="grid gap-1">
                          <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Rank to</span>
                          <AppInput
                            v-model.number="getPrizeEdit(prize).rankEnd"
                            type="number"
                            min="1"
                            placeholder="1"
                          />
                        </label>
                      </div>

                      <label class="grid gap-1">
                        <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Description</span>
                        <AppTextarea
                          v-model="getPrizeEdit(prize).description"
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
                        :aria-label="`Delete ${getPrizeEdit(prize).name || `prize ${index + 1}`}`"
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
                  :disabled="!hasPrizeChanges || isSavingPrizes || isSavingCriteria"
                  :loading="isSavingPrizes"
                  @click="savePrizes"
                >
                  Save prizes
                </AppButton>
              </div>
            </div>
          </div>
        </AppCard>
      </section>

      <AppCard
        v-if="showEmergencyVisibilitySettings"
        class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
      >
        <template #header>
          <div class="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Emergency visibility
              </p>
              <h2 class="text-lg font-semibold text-highlighted">
                {{ eventVisibilityCardTitle }}
              </h2>
              <p class="max-w-3xl text-sm text-muted">
                {{ eventVisibilityCardDescription }}
              </p>
            </div>

            <AppButton
              v-if="isEventHidden"
              type="button"
              color="primary"
              size="md"
              :disabled="isUpdatingEventVisibility"
              :loading="isUpdatingEventVisibility"
              class="justify-center"
              @click="unhideEvent"
            >
              Make event visible
            </AppButton>
          </div>
        </template>

        <div class="grid gap-4">
          <AppAlert
            v-if="isEventHidden"
            color="warning"
            variant="soft"
            title="Event hidden"
            :description="hiddenEventAlertDescription"
          />

          <AppAlert
            v-if="eventVisibilityMutationError"
            color="error"
            variant="soft"
            title="Visibility update failed"
            :description="eventVisibilityMutationError"
          />

          <div
            v-if="isEventHidden"
            class="space-y-1"
          >
            <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Hidden reason
            </p>
            <p class="text-sm text-toned">
              {{ currentEvent.hiddenReason || 'No reason recorded.' }}
            </p>
          </div>

          <div
            v-else
            class="grid gap-3"
          >
            <label class="grid gap-2">
              <span class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Reason
              </span>
              <AppTextarea
                v-model="hideEventReason"
                rows="3"
                placeholder="What needs to be fixed before the event is visible again?"
                :disabled="isUpdatingEventVisibility"
              />
            </label>

            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-sm text-toned">
                Admins can still open this event and restore it from this Settings tab.
              </p>
              <AppButton
                type="button"
                color="error"
                size="md"
                :disabled="!trimmedHideEventReason || isUpdatingEventVisibility"
                :loading="isUpdatingEventVisibility"
                class="justify-center"
                @click="hideEvent"
              >
                Hide event
              </AppButton>
            </div>
          </div>
        </div>
      </AppCard>
    </template>
  </div>
</template>
