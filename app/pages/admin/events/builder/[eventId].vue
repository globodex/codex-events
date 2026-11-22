<script setup lang="ts">
import type { ApiDataResponse } from '~/lib/api'
import type { EventRecord, TermsDocument } from '~/domains/events/records'
import type { AccountEventSettingsPage } from '#shared/domains/events/account-event-settings-page'
import type { AdminEventProgram, EventFloorPlan, EventProgram } from '#shared/domains/events/program'

import { normalizeApiError } from '~/lib/api'
import { getTermsVersionPublishErrorMessage } from '~/domains/events/admin-event'
import { accountEventPageNames, buildAccountEventPageCacheKey } from '~/domains/events/account-workspace-page'
import AdminBuilderWorkspace from '~/components/admin/builder/AdminBuilderWorkspace.vue'
import { useApiClient } from '~/composables/useApiClient'
import { useApiResponse } from '~/composables/useApiData'
import { useAccountEventPageRequest } from '~/composables/useAccountEventPageRequest'

definePageMeta({
  middleware: ['require-platform-account']
})

const route = useRoute()
const apiFetch = useApiClient()
const toast = useToast()
const eventSlug = computed(() => String(route.params.eventId ?? '').trim())
const settingsRequest = useAccountEventPageRequest<AccountEventSettingsPage>(eventSlug, 'settings')
const settingsPage = computed(() => settingsRequest.data.value?.page ?? null)
const currentEvent = computed<EventRecord | null>(() => settingsPage.value?.event ?? null)
const currentApplicationTerms = computed(() => settingsPage.value?.terms.application.current ?? null)
const currentWinnerTerms = computed(() => settingsPage.value?.terms.winner.current ?? null)
const initialSimplifiedClaimingStatus = computed(() => settingsPage.value?.simplifiedClaiming ?? null)
const lumaGuestList = computed(() => settingsPage.value?.lumaGuestList ?? null)
const creditOffers = computed(() => settingsPage.value?.credits ?? [])
const hasExistingTalkProposal = computed(() => settingsPage.value?.talkProposals.hasExistingProposal ?? false)

const AdminBuilderProgramEditor = defineAsyncComponent(() =>
  import('~/components/admin/builder/organisms/AdminBuilderProgramEditor.vue')
)
const isProgramOpen = shallowRef(false)
const isProgramDirty = shallowRef(false)
const isProgramSaving = shallowRef(false)
const programSaveError = shallowRef('')
const programDisclosure = useTemplateRef<HTMLDetailsElement>('programDisclosure')
const programPath = computed(() => `/api/events/${encodeURIComponent(currentEvent.value?.id ?? '')}/program`)
const programRequest = useApiResponse<AdminEventProgram>(
  programPath,
  programPath,
  { enabled: () => Boolean(currentEvent.value) && isProgramOpen.value, server: false }
)
const { protectedKey } = useAuthorizationCache()
const requestOwner = useProtectedRequestOwner()
const adminProgramCacheKey = protectedKey(programPath)

function syncProgramDisclosure() {
  isProgramOpen.value = programDisclosure.value?.open ?? false
}

watch(programDisclosure, syncProgramDisclosure)

function clearAgendaReads(slug: string, includeParent: boolean) {
  const reads = new Set([
    buildAccountEventPageCacheKey(slug, 'program'),
    buildAccountEventPageCacheKey(slug, 'program', { includeEventShell: true })
  ])
  if (includeParent) {
    reads.add(buildAccountEventPageCacheKey(slug, 'entry'))
    reads.add(buildAccountEventPageCacheKey(slug, 'entry', { includeAdminEventConfiguration: true }))
    for (const page of accountEventPageNames) {
      if (page !== 'entry') {
        reads.add(buildAccountEventPageCacheKey(slug, page, { includeEventShell: true }))
      }
    }
    reads.add(buildAccountEventPageCacheKey(slug, 'prizes', {
      includeAdminEventConfiguration: true,
      includeEventShell: true
    }))
  }

  const keys = Array.from(reads, read => protectedKey(read).value)
  keys.forEach(key => requestOwner.invalidate(key))
  clearNuxtData(keys)
}

function updateFloorPlan(plan: EventFloorPlan) {
  const data = programRequest.data.value
  if (!data) {
    return
  }

  const floorPlans = data.floorPlans.some(current => current.id === plan.id)
    ? data.floorPlans.map(current => current.id === plan.id ? plan : current)
    : [...data.floorPlans, plan]
  programRequest.data.value = { ...data, floorPlans }
  clearAgendaReads(eventSlug.value, false)
}

async function writeProgram(program: EventProgram | null) {
  if (isProgramSaving.value) {
    return
  }

  const key = adminProgramCacheKey.value
  const request = program ? { method: 'PUT', body: program } as const : { method: 'DELETE' } as const
  isProgramSaving.value = true
  programSaveError.value = ''

  try {
    const { data } = await apiFetch<ApiDataResponse<AdminEventProgram>>(programPath.value, request)
    const current = programRequest.data.value
    if (adminProgramCacheKey.value !== key || !current) {
      return
    }

    clearAgendaReads(eventSlug.value, current.program?.agendaItemId !== data.program?.agendaItemId)
    programRequest.data.value = { ...current, program: data.program }
    toast.add({ title: program ? 'Parallel agenda saved' : 'Parallel agenda removed', color: 'success' })
  } catch (error) {
    if (adminProgramCacheKey.value === key) {
      programSaveError.value = normalizeApiError(error).message
    }
  } finally {
    isProgramSaving.value = false
  }
}

const builder = useEventBuilder({
  mode: 'edit',
  initialEvent: currentEvent
})

const isSubmitting = ref(false)
const submitError = ref('')

async function saveEvent() {
  const event = currentEvent.value

  if (!event) {
    return
  }

  submitError.value = ''
  isSubmitting.value = true

  try {
    await apiFetch<ApiDataResponse<EventRecord>>(`/api/events/${event.id}`, {
      method: 'PATCH',
      body: builder.buildPatchBody()
    })
    clearAgendaReads(event.slug, true)

    toast.add({
      title: 'Event updated',
      description: `Balance score ${builder.report.value.score} — changes are saved.`,
      color: 'success'
    })

    await settingsRequest.refresh()
    builder.resetBaseline()
  } catch (error) {
    submitError.value = normalizeApiError(error).message
  } finally {
    isSubmitting.value = false
  }
}

interface ImageMutationState {
  pending: boolean
  error: string
}

const imageMutationState = reactive<Record<'background' | 'banner', ImageMutationState>>({
  background: { pending: false, error: '' },
  banner: { pending: false, error: '' }
})

async function uploadEventImage(slot: 'background' | 'banner', file: File) {
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

    await settingsRequest.refresh()
    toast.add({
      title: slot === 'background' ? 'Background image updated' : 'Banner image updated',
      color: 'success'
    })
  } catch (error) {
    state.error = normalizeApiError(error).message
  } finally {
    state.pending = false
  }
}

async function removeEventImage(slot: 'background' | 'banner') {
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

    await settingsRequest.refresh()
    toast.add({
      title: slot === 'background' ? 'Background image removed' : 'Banner image removed',
      color: 'success'
    })
  } catch (error) {
    state.error = normalizeApiError(error).message
  } finally {
    state.pending = false
  }
}

const savingTermsDocumentType = ref<TermsDocument['documentType'] | null>(null)

async function saveTerms(documentType: TermsDocument['documentType'], content: string) {
  const event = currentEvent.value

  if (!event) {
    return
  }

  savingTermsDocumentType.value = documentType
  submitError.value = ''

  const trimmedContent = content.trim()

  try {
    const versions = documentType === 'application_terms'
      ? settingsPage.value?.terms.application.versions ?? []
      : settingsPage.value?.terms.winner.versions ?? []
    const nextVersion = versions.reduce((highest, doc) => Math.max(highest, doc.version), 0) + 1
    const title = `${documentType === 'application_terms' ? 'Application Terms' : 'Winner Terms'} v${nextVersion}`
    const validationError = getTermsVersionPublishErrorMessage(title, trimmedContent)

    if (validationError) {
      submitError.value = validationError
      return
    }

    const createdDocument = await apiFetch<ApiDataResponse<TermsDocument>>(
      `/api/events/${event.id}/terms/${documentType}/versions`,
      {
        method: 'POST',
        body: { title, content: trimmedContent }
      }
    )

    await apiFetch(`/api/events/${event.id}/terms/${documentType}/actions/set-current`, {
      method: 'POST',
      body: { eventTermsDocumentId: createdDocument.data.id }
    })

    toast.add({
      title: documentType === 'application_terms' ? 'Application terms updated' : 'Winner terms updated',
      color: 'success'
    })
    await settingsRequest.refresh()
  } catch (error) {
    submitError.value = normalizeApiError(error).message
  } finally {
    savingTermsDocumentType.value = null
  }
}

const hasUnsavedChanges = computed(() => builder.isDirty.value || isProgramDirty.value)

onBeforeRouteLeave(() => {
  if (hasUnsavedChanges.value && !window.confirm('Leave the builder? Unsaved changes will be lost.')) {
    return false
  }
})

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (hasUnsavedChanges.value) {
    event.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  programRequest.clear()
})

useSeoMeta({
  title: 'Event Builder | Codex Events',
  description: 'Rework the event agenda with live balance scoring.'
})
</script>

<template>
  <AppContainer class="max-w-none space-y-6 py-6 sm:py-8">
    <AdminWorkspaceHeader
      title="Rework your event"
      :back-to="currentEvent ? `/account/events/${currentEvent.slug}?tab=settings` : undefined"
    />

    <AppAlert
      v-if="settingsRequest.error.value"
      color="error"
      variant="soft"
      title="Unable to load this event"
      :description="normalizeApiError(settingsRequest.error.value).message"
    />

    <AdminBuilderWorkspace
      v-else-if="currentEvent"
      :builder="builder"
      mode="edit"
      :event="currentEvent"
      :is-submitting="isSubmitting"
      :submit-error="submitError"
      :background-image-upload-pending="imageMutationState.background.pending"
      :background-image-upload-error="imageMutationState.background.error"
      :banner-image-upload-pending="imageMutationState.banner.pending"
      :banner-image-upload-error="imageMutationState.banner.error"
      :image-version="{ background: currentEvent.backgroundImageRevision, banner: currentEvent.bannerImageRevision }"
      :current-application-terms="currentApplicationTerms"
      :current-winner-terms="currentWinnerTerms"
      :saving-terms-document-type="savingTermsDocumentType"
      :initial-simplified-claiming-status="initialSimplifiedClaimingStatus"
      :luma-guest-list="lumaGuestList"
      :credit-offers="creditOffers"
      :has-existing-talk-proposal="hasExistingTalkProposal"
      @submit="saveEvent"
      @upload-background-image="file => uploadEventImage('background', file)"
      @remove-background-image="removeEventImage('background')"
      @upload-banner-image="file => uploadEventImage('banner', file)"
      @remove-banner-image="removeEventImage('banner')"
      @save-terms="saveTerms"
      @updated="settingsRequest.refresh"
    >
      <template #agenda>
        <details
          ref="programDisclosure"
          class="group"
          @toggle="syncProgramDisclosure"
        >
          <summary
            class="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-xl border border-default px-4 text-sm font-medium text-highlighted hover:bg-default focus-visible:ring-2 focus-visible:ring-ring/60 [&::-webkit-details-marker]:hidden"
          >
            Parallel agenda
            <AppIcon
              name="i-lucide-chevron-down"
              class="size-4 group-open:rotate-180"
            />
          </summary>

          <div class="mt-4">
            <AppAlert
              v-if="programRequest.error.value"
              color="error"
              title="Unable to load the parallel agenda"
              :description="normalizeApiError(programRequest.error.value).message"
            >
              <AppButton
                color="neutral"
                size="sm"
                class="mt-2"
                @click="programRequest.refresh()"
              >
                Retry
              </AppButton>
            </AppAlert>
            <AdminBuilderProgramEditor
              v-else-if="programRequest.data.value"
              :key="currentEvent.id"
              :event-id="currentEvent.id"
              :agenda-items="currentEvent.agendaItems"
              :program="programRequest.data.value.program"
              :floor-plans="programRequest.data.value.floorPlans"
              :saving="isProgramSaving"
              :save-error="programSaveError"
              @save="writeProgram"
              @remove="writeProgram(null)"
              @floor-updated="updateFloorPlan"
              @dirty-change="isProgramDirty = $event"
            />
            <p
              v-else
              class="text-sm text-muted"
              role="status"
            >
              Loading parallel agenda…
            </p>
          </div>
        </details>
      </template>
    </AdminBuilderWorkspace>
  </AppContainer>
</template>
