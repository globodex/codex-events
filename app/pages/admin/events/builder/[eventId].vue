<script setup lang="ts">
import type { ApiDataResponse } from '~/lib/api'
import type { EventRecord, TermsDocument } from '~/domains/events/records'
import type { AccountEventSettingsPage } from '#shared/domains/events/account-event-settings-page'
import type { AdminEventProgram, EventFloorPlan, EventProgram } from '#shared/domains/events/program'
import { countProgramSessions } from '#shared/domains/events/program'

import { normalizeApiError } from '~/lib/api'
import { getTermsVersionPublishErrorMessage, type SaveBuilderFloorPlan } from '~/domains/events/admin-event'
import { buildAccountEventPageCacheKey } from '~/domains/events/account-workspace-page'
import AdminBuilderWorkspace from '~/components/admin/builder/AdminBuilderWorkspace.vue'
import { useApiClient } from '~/composables/useApiClient'
import { useApiResponse } from '~/composables/useApiData'
import { useAccountEventPageRequest } from '~/composables/useAccountEventPageRequest'

definePageMeta({
  middleware: ['require-platform-account']
})

const route = useRoute()
const apiFetch = useApiClient()
const { clearUpdatedEvent } = useEventConfiguration()
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
// The rooms and sessions load when the organizer opens that extra for the first time. The
// builder renders the panel of the extra only then, and it keeps the panel after that.
const isProgramOpen = shallowRef(false)
const isProgramDirty = shallowRef(false)
// True while the criteria or the prizes hold a change that their own save button has not saved.
const hasUnsavedExtras = shallowRef(false)
const isProgramSaving = shallowRef(false)
const programSaveError = shallowRef('')
const programPanel = useTemplateRef<HTMLElement>('programPanel')
const { authorizationGeneration, clearReads } = useAuthorizationCache()
const eventPath = computed(() => `/api/events/${encodeURIComponent(currentEvent.value?.id ?? '')}`)
const programTarget = computed(() => ({
  eventPath: eventPath.value,
  slug: eventSlug.value,
  generation: authorizationGeneration.value
}))
const programPath = computed(() => `${programTarget.value.eventPath}/program`)
const programRequest = useApiResponse<AdminEventProgram>(
  programPath,
  programPath,
  { enabled: () => Boolean(currentEvent.value) && isProgramOpen.value, server: false }
)

watch(programPanel, (panel) => {
  if (panel) {
    isProgramOpen.value = true
  }
})

// The number on the tile "Rooms and sessions". The loaded editor has the current sessions.
// Before it loads, the number comes with the settings of the event.
const sessionCount = computed(() => programRequest.data.value
  ? countProgramSessions(programRequest.data.value.program)
  : settingsPage.value?.builder.programSessionCount ?? 0)

function clearAgendaReads(slug: string, includeParent: boolean, keepKey?: string) {
  const family = includeParent ? `account-event-page:${slug}` : buildAccountEventPageCacheKey(slug, 'program')
  clearReads([family], keepKey)
}

// A write may finish after navigation. Expire the original event, and patch only its open editor.
function finishProgramWrite(target: typeof programTarget.value, agendaItemChanged: boolean) {
  const stillEditing = Boolean(programPanel.value) && target === programTarget.value
  const path = `${target.eventPath}/program`
  clearAgendaReads(target.slug, agendaItemChanged, stillEditing ? settingsRequest.requestKey.value : undefined)
  clearReads([path], stillEditing ? path : undefined)
  return stillEditing ? programRequest.data.value : undefined
}

const saveFloorPlan: SaveBuilderFloorPlan = async (path, request) => {
  const target = programTarget.value
  const { data: plan } = await apiFetch<ApiDataResponse<EventFloorPlan>>(`${target.eventPath}/floor-plans${path}`, request)
  const current = finishProgramWrite(target, false)
  if (!current) return

  const floorPlans = current.floorPlans.some(floor => floor.id === plan.id)
    ? current.floorPlans.map(floor => floor.id === plan.id ? plan : floor)
    : [...current.floorPlans, plan]
  programRequest.data.value = { ...current, floorPlans }
  return plan
}

async function writeProgram(program: EventProgram | null) {
  if (isProgramSaving.value) {
    return
  }

  const target = programTarget.value
  const originalAgendaItem = programRequest.data.value?.program?.agendaItemId
  const request = program ? { method: 'PUT', body: program } as const : { method: 'DELETE' } as const
  isProgramSaving.value = true
  programSaveError.value = ''

  try {
    const { data } = await apiFetch<ApiDataResponse<AdminEventProgram>>(programPath.value, request)
    const current = finishProgramWrite(target, originalAgendaItem !== data.program?.agendaItemId)
    if (!current) return

    programRequest.data.value = { ...current, program: data.program }
    toast.add({ title: program ? 'Rooms and sessions saved' : 'Rooms and sessions removed', color: 'success' })
  } catch (error) {
    if (programPanel.value && target === programTarget.value) {
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
  const submittedSnapshot = builder.draftSnapshot.value

  try {
    const { data } = await apiFetch<ApiDataResponse<EventRecord>>(`/api/events/${event.id}`, {
      method: 'PATCH',
      body: builder.buildPatchBody()
    })
    const stillEditing = currentEvent.value?.id === event.id
    clearUpdatedEvent(event.slug, data.slug)
    if (!stillEditing) {
      return
    }
    builder.markSaved(submittedSnapshot)

    toast.add({ title: 'Event saved', color: 'success' })

    if (data.slug !== event.slug) {
      await navigateTo({ path: `/admin/events/builder/${data.slug}`, query: route.query, hash: route.hash }, { replace: true })
    } else {
      clearAgendaReads(event.slug, true, settingsRequest.requestKey.value)
      await settingsRequest.refresh()
    }
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

const hasUnsavedChanges = computed(() => builder.isDirty.value || isProgramDirty.value || hasUnsavedExtras.value)

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
      back-label="Event settings"
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
      :current-application-terms="currentApplicationTerms"
      :current-winner-terms="currentWinnerTerms"
      :saving-terms-document-type="savingTermsDocumentType"
      :initial-simplified-claiming-status="initialSimplifiedClaimingStatus"
      :luma-guest-list="lumaGuestList"
      :credit-offers="creditOffers"
      :has-existing-talk-proposal="hasExistingTalkProposal"
      :session-count="sessionCount"
      :criteria="settingsPage?.criteria"
      :prizes="settingsPage?.prizes"
      @submit="saveEvent"
      @extras-unsaved-change="hasUnsavedExtras = $event"
      @upload-background-image="file => uploadEventImage('background', file)"
      @remove-background-image="removeEventImage('background')"
      @upload-banner-image="file => uploadEventImage('banner', file)"
      @remove-banner-image="removeEventImage('banner')"
      @save-terms="saveTerms"
      @updated="settingsRequest.refresh"
    >
      <template #rooms>
        <div ref="programPanel">
          <AppAlert
            v-if="programRequest.error.value"
            color="error"
            title="Unable to load the rooms and sessions"
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
            :save-floor-plan="saveFloorPlan"
            :agenda-items="currentEvent.agendaItems"
            :program="programRequest.data.value.program"
            :floor-plans="programRequest.data.value.floorPlans"
            :challenges="currentEvent.challenges ?? []"
            :saving="isProgramSaving"
            :save-error="programSaveError"
            @save="writeProgram"
            @remove="writeProgram(null)"
            @dirty-change="isProgramDirty = $event"
          />
          <p
            v-else
            class="text-sm text-muted"
            role="status"
          >
            Loading…
          </p>
        </div>
      </template>
    </AdminBuilderWorkspace>
  </AppContainer>
</template>
