<script setup lang="ts">
import { formatEventDate, formatEventTime } from '~/domains/events/presentation'
import type {
  EventCreditApiDataResponse
} from '~/domains/credits'
import type { EventCreditClaimAccess } from '#shared/domains/credits/claim-access'
import type {
  AccountEventEntryAdminCreditOffer,
  AccountEventEntryParticipantCreditOffer
} from '#shared/domains/events/account-event-entry-page'
import {
  createEventCreditOfferWithInventory,
  isEventCreditLink,
  normalizeEventCreditApiError
} from '~/domains/credits'
import { useApiClient } from '~/composables/useApiClient'

const props = defineProps<{
  eventId: string
  canManage: boolean
  /** What the credit claim rule says about the person who looks at this panel. */
  claimAccess: EventCreditClaimAccess
  /** The page that shows the participant's next step. Null when no page shows one. */
  nextStepHref: string | null
  participantCredits: AccountEventEntryParticipantCreditOffer[]
  adminCredits: AccountEventEntryAdminCreditOffer[]
}>()
const emit = defineEmits<{
  updated: []
}>()

type AdminEventCreditOffer = AccountEventEntryAdminCreditOffer
type ParticipantEventCreditOffer = AccountEventEntryParticipantCreditOffer

const apiFetch = useApiClient()
const toast = useToast()
const participantCredits = shallowRef<ParticipantEventCreditOffer[]>(props.participantCredits)
const adminCredits = shallowRef<AdminEventCreditOffer[]>(props.adminCredits)
const participantCreditsError = ref<unknown>(null)
const adminCreditsError = ref<unknown>(null)
const participantCreditsStatus = ref<'success' | 'pending'>('success')
const adminCreditsStatus = ref<'success' | 'pending'>('success')

watch(() => props.participantCredits, (offers) => {
  participantCredits.value = offers
}, { immediate: true })

watch(() => props.adminCredits, (offers) => {
  adminCredits.value = offers
}, { immediate: true })
const createFileInput = ref<HTMLInputElement | null>(null)
const createInventoryFile = ref<File | null>(null)
const createForm = reactive({
  name: '',
  description: ''
})
const editById = reactive<Record<string, { name: string, description: string }>>({})
const createError = ref('')
const createPending = ref(false)
const claimPendingById = reactive<Record<string, boolean>>({})
const claimErrorById = reactive<Record<string, string>>({})
const expandedInventoryOfferIds = ref(new Set<string>())
const expandedParticipantOfferIds = ref(new Set<string>())
const revealedClaimedCodeIds = ref(new Set<string>())
const editingOfferNameIds = ref(new Set<string>())
const savePendingById = reactive<Record<string, boolean>>({})
const saveErrorById = reactive<Record<string, string>>({})
const importPendingById = reactive<Record<string, boolean>>({})
const importErrorById = reactive<Record<string, string>>({})
const deletePendingById = reactive<Record<string, boolean>>({})

const selectedCreateFileName = computed(() => createInventoryFile.value?.name ?? '')
const maskedCreditValue = '•••• •••• ••••'
const createActionLabel = computed(() =>
  createInventoryFile.value ? 'Create offer and upload CSV' : 'Create offer'
)
const createUploadDescription = computed(() =>
  createInventoryFile.value
    ? `${createInventoryFile.value.name} will be uploaded after the offer is created.`
    : 'Optional now. Upload a single-column CSV with one code or redemption link per row, or add inventory after creating the offer.'
)
const adminSummaryCards = computed(() => {
  const offerCount = adminCredits.value.length
  const availableCount = adminCredits.value.reduce((sum, offer) => sum + offer.availableCount, 0)
  const claimedCount = adminCredits.value.reduce((sum, offer) => sum + offer.claimedCount, 0)

  return [
    {
      label: 'Offers',
      value: offerCount,
      description: offerCount === 1 ? 'One participant-facing credit offer is live.' : 'Participant-facing credit offers are live.'
    },
    {
      label: 'Available values',
      value: availableCount,
      description: 'Unclaimed codes and links that participants can still claim.'
    },
    {
      label: 'Claimed values',
      value: claimedCount,
      description: 'Uploaded values already attached to participant accounts.'
    }
  ]
})

watch(adminCredits, (offers) => {
  const nextIds = new Set(offers.map(offer => offer.id))
  const nextExpandedInventoryOfferIds = new Set(
    [...expandedInventoryOfferIds.value].filter(offerId => nextIds.has(offerId))
  )
  const nextEditingOfferNameIds = new Set(
    [...editingOfferNameIds.value].filter(offerId => nextIds.has(offerId))
  )

  expandedInventoryOfferIds.value = nextExpandedInventoryOfferIds
  editingOfferNameIds.value = nextEditingOfferNameIds

  for (const key of Object.keys(editById)) {
    if (!nextIds.has(key)) {
      Reflect.deleteProperty(editById, key)
    }
  }

  for (const offer of offers) {
    const existing = editById[offer.id]

    if (!existing) {
      editById[offer.id] = {
        name: offer.name,
        description: offer.description
      }
      continue
    }

    if (existing.name === offer.name && existing.description === offer.description) {
      continue
    }

    if (savePendingById[offer.id]) {
      continue
    }

    editById[offer.id] = {
      name: offer.name,
      description: offer.description
    }
  }
}, {
  immediate: true
})

watch(participantCredits, (offers) => {
  const nextIds = new Set(offers.map(offer => offer.id))
  const nextExpandedParticipantOfferIds = new Set(
    [...expandedParticipantOfferIds.value].filter(offerId => nextIds.has(offerId))
  )
  const nextClaimedCodeIds = new Set(
    offers
      .map(offer => offer.claimedCode?.id)
      .filter((codeId): codeId is string => Boolean(codeId))
  )
  const nextRevealedClaimedCodeIds = new Set(
    [...revealedClaimedCodeIds.value].filter(codeId => nextClaimedCodeIds.has(codeId))
  )

  expandedParticipantOfferIds.value = nextExpandedParticipantOfferIds
  revealedClaimedCodeIds.value = nextRevealedClaimedCodeIds
}, {
  immediate: true
})

function getEditState(offer: AdminEventCreditOffer) {
  return editById[offer.id] ?? {
    name: offer.name,
    description: offer.description
  }
}

function isEditingOfferName(offerId: string) {
  return editingOfferNameIds.value.has(offerId)
}

function startEditingOfferName(offer: AdminEventCreditOffer) {
  getEditState(offer).name = offer.name
  saveErrorById[offer.id] = ''

  const nextEditingOfferNameIds = new Set(editingOfferNameIds.value)
  nextEditingOfferNameIds.add(offer.id)
  editingOfferNameIds.value = nextEditingOfferNameIds
}

function stopEditingOfferName(offerId: string) {
  const nextEditingOfferNameIds = new Set(editingOfferNameIds.value)
  nextEditingOfferNameIds.delete(offerId)
  editingOfferNameIds.value = nextEditingOfferNameIds
}

function cancelEditingOfferName(offer: AdminEventCreditOffer) {
  getEditState(offer).name = offer.name
  saveErrorById[offer.id] = ''
  stopEditingOfferName(offer.id)
}

function formatCreditClaimedAt(value: string | null) {
  if (!value) {
    return 'Saved'
  }

  return `${formatEventDate(value)} at ${formatEventTime(value)}`
}

function isInventoryExpanded(offerId: string) {
  return expandedInventoryOfferIds.value.has(offerId)
}

function isParticipantOfferExpanded(offerId: string) {
  return expandedParticipantOfferIds.value.has(offerId)
}

function isClaimedCodeRevealed(codeId: string) {
  return revealedClaimedCodeIds.value.has(codeId)
}

// What a participant reads on an offer without a free code. "No credits left" is only true for
// an offer that had codes; an offer without uploaded codes can still get some.
function describeOfferWithoutFreeCode(offer: ParticipantEventCreditOffer) {
  return offer.totalCount > 0 ? 'No credits left' : 'Not available'
}

// True when an offer that the participant has not claimed still has a free code. Only then is
// there something to claim, so only then does the note about finishing the check-in make sense.
const hasOfferToClaim = computed(() =>
  participantCredits.value.some(offer => !offer.claimedCode && offer.availableCount > 0)
)

function toggleInventoryExpanded(offerId: string) {
  const nextExpandedInventoryOfferIds = new Set(expandedInventoryOfferIds.value)

  if (nextExpandedInventoryOfferIds.has(offerId)) {
    nextExpandedInventoryOfferIds.delete(offerId)
  } else {
    nextExpandedInventoryOfferIds.add(offerId)
  }

  expandedInventoryOfferIds.value = nextExpandedInventoryOfferIds
}

function toggleParticipantOfferExpanded(offerId: string) {
  const nextExpandedParticipantOfferIds = new Set(expandedParticipantOfferIds.value)

  if (nextExpandedParticipantOfferIds.has(offerId)) {
    nextExpandedParticipantOfferIds.delete(offerId)
  } else {
    nextExpandedParticipantOfferIds.add(offerId)
  }

  expandedParticipantOfferIds.value = nextExpandedParticipantOfferIds
}

function toggleClaimedCodeVisibility(codeId: string) {
  const nextRevealedClaimedCodeIds = new Set(revealedClaimedCodeIds.value)

  if (nextRevealedClaimedCodeIds.has(codeId)) {
    nextRevealedClaimedCodeIds.delete(codeId)
  } else {
    nextRevealedClaimedCodeIds.add(codeId)
  }

  revealedClaimedCodeIds.value = nextRevealedClaimedCodeIds
}

async function refreshCredits() {
  emit('updated')
}

function promptCreateInventoryUpload() {
  createFileInput.value?.click()
}

function handleCreateInventoryChange(event: Event) {
  const input = event.target as HTMLInputElement | null
  createInventoryFile.value = input?.files?.[0] ?? null
}

function clearCreateInventorySelection() {
  createInventoryFile.value = null

  if (createFileInput.value) {
    createFileInput.value.value = ''
  }
}

function promptOfferImportUpload(offerId: string) {
  const input = document.getElementById(`credit-offer-import-${offerId}`) as HTMLInputElement | null
  input?.click()
}

async function createOffer() {
  createError.value = ''

  const name = createForm.name.trim()
  const description = createForm.description.trim()

  if (!name || !description) {
    createError.value = 'Enter a name and details before creating a credit offer.'
    return
  }

  createPending.value = true

  try {
    const result = await createEventCreditOfferWithInventory({
      apiFetch,
      eventId: props.eventId,
      name,
      description,
      file: createInventoryFile.value
    })

    createForm.name = ''
    createForm.description = ''
    clearCreateInventorySelection()
    await refreshCredits()

    if (result.status === 'created_without_inventory') {
      toast.add({
        title: 'Offer created without inventory',
        description: `${result.importError.message} Upload the CSV from the new offer row below.`,
        color: 'warning'
      })
      return
    }

    toast.add({
      title: 'Credit offer created',
      description: result.importedCount > 0
        ? `${result.importedCount} credit value${result.importedCount === 1 ? '' : 's'} imported into the new offer.`
        : 'The new credit offer is ready for inventory uploads.',
      color: 'success'
    })
  } catch (error) {
    createError.value = normalizeEventCreditApiError(error).message
  } finally {
    createPending.value = false
  }
}

async function saveOffer(offer: AdminEventCreditOffer) {
  const edit = getEditState(offer)
  const name = edit.name.trim()
  const description = edit.description.trim()

  saveErrorById[offer.id] = ''

  if (!name || !description) {
    saveErrorById[offer.id] = 'Enter a name and details before saving this offer.'
    return
  }

  savePendingById[offer.id] = true

  try {
    await apiFetch<EventCreditApiDataResponse<AdminEventCreditOffer>>(
      `/api/events/${props.eventId}/credits/${offer.id}`,
      {
        method: 'PATCH',
        body: {
          name,
          description
        }
      }
    )

    await refreshCredits()
    stopEditingOfferName(offer.id)
    toast.add({
      title: 'Credit offer updated',
      description: 'The participant-facing credit details now match the latest admin changes.',
      color: 'success'
    })
  } catch (error) {
    saveErrorById[offer.id] = normalizeEventCreditApiError(error).message
  } finally {
    savePendingById[offer.id] = false
  }
}

async function deleteOffer(offer: AdminEventCreditOffer) {
  if (offer.claimedCount > 0 || !window.confirm(`Delete ${offer.name}?`)) {
    return
  }

  saveErrorById[offer.id] = ''
  deletePendingById[offer.id] = true
  try {
    await apiFetch(`/api/events/${props.eventId}/credits/${offer.id}`, {
      method: 'DELETE'
    })
    await refreshCredits()
    toast.add({ title: 'Credit offer deleted', color: 'success' })
  } catch (error) {
    saveErrorById[offer.id] = normalizeEventCreditApiError(error).message
  } finally {
    deletePendingById[offer.id] = false
  }
}

async function importCreditsFile(offerId: string, file: File) {
  importErrorById[offerId] = ''
  importPendingById[offerId] = true

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiFetch<EventCreditApiDataResponse<{ importedCount: number }>>(
      `/api/events/${props.eventId}/credits/${offerId}/import`,
      {
        method: 'POST',
        body: formData
      }
    )

    await refreshCredits()
    toast.add({
      title: 'Credits imported',
      description: `${response.data.importedCount} credit value${response.data.importedCount === 1 ? '' : 's'} added to this offer.`,
      color: 'success'
    })
  } catch (error) {
    importErrorById[offerId] = normalizeEventCreditApiError(error).message
  } finally {
    importPendingById[offerId] = false
  }
}

async function handleOfferImportChange(event: Event, offerId: string) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]

  if (!file) {
    return
  }

  await importCreditsFile(offerId, file)

  if (input) {
    input.value = ''
  }
}

async function claimOffer(offerId: string) {
  claimErrorById[offerId] = ''
  claimPendingById[offerId] = true

  try {
    const response = await apiFetch<EventCreditApiDataResponse<ParticipantEventCreditOffer>>(
      `/api/events/${props.eventId}/credits/${offerId}/actions/claim`,
      {
        method: 'POST'
      }
    )

    participantCredits.value = participantCredits.value.map(offer =>
      offer.id === offerId ? response.data : offer
    )

    toast.add({
      title: 'Credit claimed',
      description: 'Your assigned credit is now available in this tab.',
      color: 'success'
    })
  } catch (error) {
    claimErrorById[offerId] = normalizeEventCreditApiError(error).message
  } finally {
    // Read the page again after a refused claim too: the page was out of date, for example
    // because another participant took the last code a moment earlier.
    emit('updated')
    claimPendingById[offerId] = false
  }
}

async function copyCreditValue(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({
      title: 'Code copied',
      description: 'The credit value was copied to your clipboard.',
      color: 'success'
    })
  } catch {
    toast.add({
      title: 'Copy failed',
      description: 'This browser could not copy the credit value right now.',
      color: 'error'
    })
  }
}
</script>

<template>
  <div class="space-y-6">
    <section
      v-if="props.canManage"
      class="grid gap-4 md:grid-cols-3"
    >
      <div
        v-for="card in adminSummaryCards"
        :key="card.label"
        class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5"
      >
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {{ card.label }}
        </p>
        <p class="mt-2 text-xl font-semibold text-highlighted">
          {{ card.value }}
        </p>
        <p class="mt-1 text-sm text-muted">
          {{ card.description }}
        </p>
      </div>
    </section>

    <AppCard
      v-if="props.canManage"
      class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
      :ui="{ body: 'p-5' }"
    >
      <template #header>
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-highlighted">
            Credits management
          </h2>
          <p class="text-sm text-muted">
            Review active participant-facing offers, append CSV inventory over time, and inspect which values are already attached to participants.
          </p>
        </div>
      </template>

      <div class="space-y-6">
        <AppAlert
          v-if="adminCreditsError"
          color="error"
          variant="soft"
          title="Credits unavailable"
          :description="normalizeEventCreditApiError(adminCreditsError).message"
        />

        <AppAlert
          v-else-if="adminCreditsStatus === 'pending'"
          color="neutral"
          variant="soft"
          title="Loading credit inventory"
          description="Resolving the current offers, uploaded values, and claim records for this event."
        />

        <AppAlert
          v-else-if="adminCredits.length === 0"
          color="neutral"
          variant="soft"
          title="No active offers yet"
          description="Create the first offer below, then upload one or more CSV batches into it."
        />

        <div
          v-else
          class="grid gap-4"
        >
          <article
            v-for="offer in adminCredits"
            :key="offer.id"
            :data-testid="`admin-credit-offer-${offer.id}`"
            class="rounded-xl border border-black/8 bg-white/78 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-white/[0.10] dark:bg-[#151515]/64 px-5 py-5"
          >
            <div class="space-y-5">
              <div class="border-b border-black/8 pb-4 dark:border-white/[0.08]">
                <div
                  v-if="isEditingOfferName(offer.id)"
                  class="space-y-3"
                >
                  <form
                    class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
                    @submit.prevent="saveOffer(offer)"
                  >
                    <div class="min-w-0 flex-1">
                      <label
                        :for="`credit-offer-name-inline-${offer.id}`"
                        class="sr-only"
                      >
                        Offer name
                      </label>
                      <AppInput
                        :id="`credit-offer-name-inline-${offer.id}`"
                        v-model="getEditState(offer).name"
                        size="xl"
                        class="w-full"
                        :disabled="savePendingById[offer.id]"
                      />
                    </div>

                    <AppButton
                      type="submit"
                      color="primary"
                      class="shrink-0"
                      :loading="savePendingById[offer.id]"
                      :disabled="savePendingById[offer.id]"
                    >
                      Save
                    </AppButton>

                    <AppButton
                      type="button"
                      color="neutral"
                      variant="outline"
                      class="shrink-0"
                      :disabled="savePendingById[offer.id]"
                      @click="cancelEditingOfferName(offer)"
                    >
                      Cancel
                    </AppButton>
                  </form>

                  <div class="flex flex-wrap items-center gap-2">
                    <AppBadge
                      color="success"
                      variant="soft"
                    >
                      {{ offer.availableCount }}/{{ offer.totalCount }} available
                    </AppBadge>
                    <AppBadge
                      color="warning"
                      variant="soft"
                    >
                      {{ offer.claimedCount }} claimed
                    </AppBadge>
                  </div>
                </div>

                <div
                  v-else
                  class="flex flex-wrap items-center gap-2"
                >
                  <h3 class="text-lg font-semibold text-highlighted">
                    {{ offer.name }}
                  </h3>
                  <AppButton
                    color="neutral"
                    variant="outline"
                    size="sm"
                    icon="i-lucide-pencil"
                    class="h-8 w-8 shrink-0 gap-0 px-0"
                    :aria-label="`Edit ${offer.name} name`"
                    @click="startEditingOfferName(offer)"
                  >
                    <span class="sr-only">Edit offer name</span>
                  </AppButton>
                  <AppButton
                    v-if="offer.claimedCount === 0"
                    color="error"
                    variant="soft"
                    size="sm"
                    icon="i-lucide-trash-2"
                    :loading="deletePendingById[offer.id]"
                    :disabled="deletePendingById[offer.id]"
                    @click="deleteOffer(offer)"
                  >
                    Delete
                  </AppButton>
                  <AppBadge
                    color="success"
                    variant="soft"
                  >
                    {{ offer.availableCount }}/{{ offer.totalCount }} available
                  </AppBadge>
                  <AppBadge
                    color="warning"
                    variant="soft"
                  >
                    {{ offer.claimedCount }} claimed
                  </AppBadge>
                </div>
              </div>

              <div class="space-y-4">
                <LazyAdminMarkdownEditorField
                  v-model="getEditState(offer).description"
                  :name="`credit-offer-details-${offer.id}`"
                  :editor-id="`credit-offer-details-${offer.id}`"
                  label="Participant instructions"
                  description="Shown above the assigned code or link. Include redemption steps, provider links, deadlines, and support notes."
                  placeholder="Tell participants where to use the code or link, what account they need, and any deadline or eligibility note."
                  height="260px"
                  required
                />
              </div>

              <div class="grid gap-4 border-t border-black/8 pt-5 dark:border-white/[0.08] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div class="space-y-1">
                  <p class="text-sm font-medium text-highlighted">
                    Append inventory
                  </p>
                  <p class="text-sm text-muted">
                    Upload a single-column CSV with no header and one code or link per row.
                  </p>
                </div>

                <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                  <input
                    :id="`credit-offer-import-${offer.id}`"
                    type="file"
                    accept=".csv,text/csv"
                    class="sr-only"
                    :disabled="importPendingById[offer.id]"
                    @change="handleOfferImportChange($event, offer.id)"
                  >

                  <AppButton
                    type="button"
                    color="neutral"
                    variant="soft"
                    size="sm"
                    icon="i-lucide-upload"
                    :loading="importPendingById[offer.id]"
                    @click="promptOfferImportUpload(offer.id)"
                  >
                    Upload CSV
                  </AppButton>
                </div>
              </div>

              <div
                v-if="!isEditingOfferName(offer.id)"
                class="flex justify-end"
              >
                <AppButton
                  color="primary"
                  :loading="savePendingById[offer.id]"
                  @click="saveOffer(offer)"
                >
                  Save offer
                </AppButton>
              </div>

              <AppAlert
                v-if="saveErrorById[offer.id]"
                color="error"
                variant="soft"
                title="Credit offer could not be saved"
                :description="saveErrorById[offer.id]"
              />

              <AppAlert
                v-else-if="importErrorById[offer.id]"
                color="error"
                variant="soft"
                title="CSV import failed"
                :description="importErrorById[offer.id]"
              />

              <div class="space-y-3 border-t border-black/8 pt-5 dark:border-white/[0.08]">
                <div class="flex items-start justify-between gap-3">
                  <h4 class="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                    Uploaded values
                  </h4>
                  <div class="flex items-center gap-3">
                    <p class="text-xs text-muted">
                      {{ offer.totalCount }} total rows
                    </p>
                    <AppButton
                      v-if="offer.codes.length > 0"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      :label="isInventoryExpanded(offer.id) ? 'Hide values' : `Show all ${offer.codes.length}`"
                      :trailing-icon="isInventoryExpanded(offer.id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                      :aria-expanded="isInventoryExpanded(offer.id)"
                      :aria-controls="`credit-offer-values-${offer.id}`"
                      class="h-auto gap-1 p-0 text-highlighted hover:bg-transparent hover:text-toned dark:hover:bg-transparent dark:hover:text-[#D9D9D9]"
                      @click="toggleInventoryExpanded(offer.id)"
                    />
                  </div>
                </div>

                <div
                  v-if="offer.codes.length === 0"
                  class="rounded-xl border border-dashed border-black/10 px-4 py-4 text-sm text-muted dark:border-white/[0.08]"
                >
                  No inventory uploaded yet.
                </div>

                <div
                  v-else-if="isInventoryExpanded(offer.id)"
                  :id="`credit-offer-values-${offer.id}`"
                  class="overflow-x-auto"
                >
                  <table class="min-w-full border-separate border-spacing-y-2 text-sm">
                    <thead>
                      <tr class="text-left text-xs uppercase tracking-[0.14em] text-muted">
                        <th class="pr-4 pb-2">
                          Value
                        </th>
                        <th class="pr-4 pb-2">
                          Status
                        </th>
                        <th class="pr-4 pb-2">
                          Claimed by
                        </th>
                        <th class="pb-2">
                          Claimed at
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="code in offer.codes"
                        :key="code.id"
                        class="align-top"
                      >
                        <td class="pr-4 py-2 font-mono text-xs text-toned">
                          <a
                            v-if="isEventCreditLink(code.value)"
                            :href="code.value"
                            target="_blank"
                            rel="noreferrer"
                            class="break-all text-primary hover:text-primary/80"
                          >
                            {{ code.value }}
                          </a>
                          <span
                            v-else
                            class="break-all"
                          >
                            {{ code.value }}
                          </span>
                        </td>
                        <td class="pr-4 py-2 text-toned">
                          {{ code.claimedByUser ? 'Claimed' : 'Available' }}
                        </td>
                        <td class="pr-4 py-2 text-toned">
                          {{ code.claimedByUser ? `${code.claimedByUser.displayName} (${code.claimedByUser.email})` : '—' }}
                        </td>
                        <td class="py-2 text-toned">
                          {{ code.claimedAt ? formatEventDate(code.claimedAt) : '—' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p
                  v-else
                  class="text-sm text-muted"
                >
                  Expand this section only when you need to inspect the uploaded voucher list.
                </p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </AppCard>

    <AppCard
      v-if="props.canManage"
      class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
      :ui="{ body: 'p-5' }"
    >
      <template #header>
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-highlighted">
            Create credit offer
          </h2>
          <p class="text-sm text-muted">
            Add the title participants see, write the redemption instructions, and optionally upload the first set of codes or links.
          </p>
        </div>
      </template>

      <div class="space-y-4">
        <form
          class="space-y-4"
          @submit.prevent="createOffer"
        >
          <AppFormField
            label="Offer name shown to participants"
            name="credit-offer-name"
          >
            <AppInput
              id="credit-offer-name"
              v-model="createForm.name"
              :disabled="createPending"
              placeholder="OpenAI credits, meal voucher, workshop discount"
            />
            <p class="text-xs text-muted">
              Use the short title participants should recognize in the Credits tab.
            </p>
          </AppFormField>

          <LazyAdminMarkdownEditorField
            v-model="createForm.description"
            name="credit-offer-details-editor"
            editor-id="credit-offer-details-editor"
            label="Participant instructions"
            description="Shown before a participant redeems. Include where to use the code or link, any account requirement, deadlines, and support notes."
            placeholder="Example: Use your assigned code at the provider checkout page before June 30. One code is available per approved participant."
            height="260px"
            required
          />

          <div class="rounded-xl border border-dashed border-black/10 px-4 py-4 dark:border-white/[0.08]">
            <input
              ref="createFileInput"
              type="file"
              accept=".csv,text/csv"
              class="sr-only"
              :disabled="createPending"
              @change="handleCreateInventoryChange"
            >

            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="space-y-1">
                <p class="text-sm font-medium text-highlighted">
                  Codes or links CSV
                </p>
                <p class="text-xs text-muted">
                  {{ createUploadDescription }}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <AppButton
                  type="button"
                  color="neutral"
                  variant="soft"
                  size="sm"
                  icon="i-lucide-upload"
                  :disabled="createPending"
                  @click="promptCreateInventoryUpload"
                >
                  {{ createInventoryFile ? 'Change CSV' : 'Select CSV' }}
                </AppButton>

                <AppButton
                  v-if="createInventoryFile"
                  type="button"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :disabled="createPending"
                  @click="clearCreateInventorySelection"
                >
                  Clear
                </AppButton>
              </div>
            </div>

            <p
              v-if="selectedCreateFileName"
              class="mt-3 text-sm text-toned"
            >
              {{ selectedCreateFileName }}
            </p>
          </div>

          <div class="flex justify-end">
            <AppButton
              type="submit"
              color="primary"
              :loading="createPending"
            >
              {{ createActionLabel }}
            </AppButton>
          </div>
        </form>

        <AppAlert
          v-if="createError"
          color="error"
          variant="soft"
          title="Credit offer could not be created"
          :description="createError"
        />
      </div>
    </AppCard>

    <AppCard
      v-if="props.claimAccess !== 'cannot_claim'"
      class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
      :ui="{ body: 'p-5' }"
    >
      <template #header>
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-highlighted">
            Claim credits
          </h2>
          <p class="text-sm text-muted">
            Claim one value from each offer while inventory remains available. Once claimed, the assigned code or link stays attached to your account for this event.
          </p>
        </div>
      </template>

      <div class="space-y-6">
        <AppAlert
          v-if="participantCreditsError"
          color="error"
          variant="soft"
          title="Credits unavailable"
          :description="normalizeEventCreditApiError(participantCreditsError).message"
        />

        <AppAlert
          v-else-if="participantCreditsStatus === 'pending'"
          color="neutral"
          variant="soft"
          title="Loading credits"
          description="Resolving your available and already claimed credit offers."
        />

        <AppAlert
          v-else-if="participantCredits.length === 0"
          color="neutral"
          variant="soft"
          title="No credits available yet"
          description="Credits appear here once this event has uploaded values to claim."
        />

        <div
          v-else
          class="grid gap-4"
        >
          <AppAlert
            v-if="props.claimAccess === 'must_finish_check_in_flow' && hasOfferToClaim"
            data-testid="participant-credits-finish-check-in"
            color="neutral"
            variant="soft"
            class="block"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="font-semibold text-highlighted">
                Finish your check-in to claim credits
              </p>
              <AppButton
                v-if="props.nextStepHref"
                :to="props.nextStepHref"
                color="neutral"
                variant="solid"
                trailing-icon="i-lucide-arrow-right"
              >
                See your next step
              </AppButton>
            </div>
          </AppAlert>

          <article
            v-for="offer in participantCredits"
            :key="offer.id"
            :data-testid="`participant-credit-offer-${offer.id}`"
            class="rounded-xl border border-black/8 bg-white/78 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-white/[0.10] dark:bg-[#151515]/64 px-5 py-5"
          >
            <div class="flex h-full flex-col gap-4">
              <div
                :class="[
                  'space-y-3',
                  isParticipantOfferExpanded(offer.id) ? 'border-b border-black/8 pb-4 dark:border-white/[0.08]' : ''
                ]"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 class="text-lg font-semibold text-highlighted">
                      {{ offer.name }}
                    </h3>
                    <AppBadge
                      v-if="offer.claimedCode"
                      color="primary"
                      variant="soft"
                    >
                      Redeemed
                    </AppBadge>
                    <AppBadge
                      v-else
                      :color="offer.availableCount > 0 ? 'success' : 'neutral'"
                      variant="soft"
                    >
                      {{ offer.availableCount > 0 ? 'Available' : describeOfferWithoutFreeCode(offer) }}
                    </AppBadge>
                  </div>

                  <AppButton
                    color="neutral"
                    variant="outline"
                    :label="isParticipantOfferExpanded(offer.id) ? 'Collapse' : 'Expand'"
                    :trailing-icon="isParticipantOfferExpanded(offer.id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                    :aria-expanded="isParticipantOfferExpanded(offer.id)"
                    :aria-controls="`participant-credit-offer-body-${offer.id}`"
                    class="gap-1.5 self-center rounded-full px-3.5"
                    @click="toggleParticipantOfferExpanded(offer.id)"
                  />
                </div>
              </div>

              <div
                v-if="isParticipantOfferExpanded(offer.id)"
                :id="`participant-credit-offer-body-${offer.id}`"
                class="space-y-5"
              >
                <AppMarkdownRenderer :source="offer.description" />

                <template v-if="offer.claimedCode">
                  <div
                    class="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)]"
                  >
                    <div class="rounded-xl border border-black/8 bg-white/62 px-4 py-3 dark:border-white/[0.08] dark:bg-black/10">
                      <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        Your assigned value
                      </p>

                      <AppButton
                        v-if="isEventCreditLink(offer.claimedCode.value)"
                        :to="offer.claimedCode.value"
                        color="neutral"
                        variant="soft"
                        external
                        trailing-icon="i-lucide-external-link"
                        class="mt-3"
                      >
                        Open redemption link
                      </AppButton>

                      <div
                        v-else
                        class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <code class="min-w-0 break-all font-mono text-sm text-highlighted">
                          {{ isClaimedCodeRevealed(offer.claimedCode.id) ? offer.claimedCode.value : maskedCreditValue }}
                        </code>

                        <div class="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                          <AppButton
                            color="neutral"
                            variant="soft"
                            size="sm"
                            icon="i-lucide-copy"
                            @click="copyCreditValue(offer.claimedCode.value)"
                          >
                            Copy code
                          </AppButton>

                          <AppButton
                            type="button"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            :icon="isClaimedCodeRevealed(offer.claimedCode.id) ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                            class="h-8 w-8 gap-0 px-0"
                            :aria-label="isClaimedCodeRevealed(offer.claimedCode.id) ? 'Hide assigned code' : 'Show assigned code'"
                            :aria-pressed="isClaimedCodeRevealed(offer.claimedCode.id)"
                            :title="isClaimedCodeRevealed(offer.claimedCode.id) ? 'Hide code' : 'Show code'"
                            @click="toggleClaimedCodeVisibility(offer.claimedCode.id)"
                          >
                            <span class="sr-only">
                              {{ isClaimedCodeRevealed(offer.claimedCode.id) ? 'Hide assigned code' : 'Show assigned code' }}
                            </span>
                          </AppButton>
                        </div>
                      </div>
                    </div>

                    <div class="rounded-xl border border-black/8 bg-white/62 px-4 py-3 dark:border-white/[0.08] dark:bg-black/10">
                      <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        Claimed
                      </p>
                      <p class="mt-1 text-base font-semibold text-highlighted">
                        {{ formatCreditClaimedAt(offer.claimedCode.claimedAt) }}
                      </p>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <AppAlert
                    v-if="claimErrorById[offer.id]"
                    color="error"
                    variant="soft"
                    title="Credit could not be claimed"
                    :description="claimErrorById[offer.id]"
                  />

                  <AppAlert
                    v-else-if="offer.availableCount === 0"
                    color="neutral"
                    variant="soft"
                    :title="describeOfferWithoutFreeCode(offer)"
                  />

                  <div
                    v-else-if="props.claimAccess === 'can_claim'"
                    class="mt-auto"
                  >
                    <AppButton
                      color="primary"
                      :loading="claimPendingById[offer.id]"
                      @click="claimOffer(offer.id)"
                    >
                      Redeem credit
                    </AppButton>
                  </div>
                </template>
              </div>
            </div>
          </article>
        </div>
      </div>
    </AppCard>
  </div>
</template>
