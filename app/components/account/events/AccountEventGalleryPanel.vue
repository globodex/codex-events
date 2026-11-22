<script setup lang="ts">
import type { EventPhotoRecord } from '#shared/domains/events/photos'
import type { AccountEventGalleryPage } from '#shared/domains/events/account-event-gallery-page'

import EventGalleryPanel from '~/components/events/EventGalleryPanel.vue'
import { normalizeApiError } from '~/lib/api'
import { createEventGalleryUploadBatches, createEventGalleryUploadItems } from '~/domains/events/gallery'
import { useApiClient } from '~/composables/useApiClient'

type AccountEventGalleryFilter = 'all' | 'highlighted' | 'not-highlighted' | 'public'

const props = withDefaults(defineProps<{
  eventId: string
  canManage: boolean
  page: AccountEventGalleryPage | null
  isLoading?: boolean
  loadErrorMessage?: string
}>(), {
  isLoading: false,
  loadErrorMessage: ''
})

const apiFetch = useApiClient()
const toast = useToast()
const eventId = computed(() => props.eventId.trim())
const canManage = computed(() => props.canManage)
// The server decides who adds photos as a participant. The gallery page carries its answer.
const canAddParticipantPhotos = computed(() => props.page?.canAddParticipantPhotos ?? false)
const canUpload = computed(() => canManage.value || canAddParticipantPhotos.value)
const mutationErrorMessage = ref('')
const pendingDeletePhotoId = ref<string | null>(null)
const pendingPublicVisibilityPhotoId = ref<string | null>(null)
const pendingHighlightPhotoId = ref<string | null>(null)
const pendingHiddenPhotoId = ref<string | null>(null)
// One change of a photo runs at a time.
const isPhotoChangePending = computed(() =>
  pendingDeletePhotoId.value !== null
  || pendingPublicVisibilityPhotoId.value !== null
  || pendingHighlightPhotoId.value !== null
  || pendingHiddenPhotoId.value !== null
)
const isUploading = ref(false)
const uploadingItems = ref(createEventGalleryUploadItems([]))
const photos = ref<EventPhotoRecord[]>([])
const galleryFilter = shallowRef<AccountEventGalleryFilter>('highlighted')
const hasResolvedInitialFilter = shallowRef(false)

watch(() => props.page, (page) => {
  photos.value = page?.photos ?? []
}, { immediate: true })

// The gallery shows two lists. The filter and the highlights belong to the photos of the event
// team. The photos that participants added are always listed in full, in their own section.
const eventTeamPhotos = computed(() => photos.value.filter(photo => photo.isParticipantUpload !== true))
const participantPhotos = computed(() => photos.value.filter(photo => photo.isParticipantUpload === true))
const highlightedPhotoCount = computed(() => eventTeamPhotos.value.filter(photo => photo.isHighlighted === true).length)
const notHighlightedPhotoCount = computed(() => eventTeamPhotos.value.length - highlightedPhotoCount.value)
const publicPhotoCount = computed(() => eventTeamPhotos.value.filter(photo => photo.isPubliclyVisible).length)
const galleryFilterOptions = computed<Array<{
  label: string
  value: AccountEventGalleryFilter
  count: number
}>>(() => {
  // The filter chooses among the photos of the event team, so it is shown when there are some.
  if (eventTeamPhotos.value.length === 0) {
    return []
  }

  if (canManage.value) {
    return [
      { label: 'All', value: 'all', count: eventTeamPhotos.value.length },
      { label: 'Highlighted', value: 'highlighted', count: highlightedPhotoCount.value },
      { label: 'Not highlighted', value: 'not-highlighted', count: notHighlightedPhotoCount.value },
      { label: 'Public', value: 'public', count: publicPhotoCount.value }
    ]
  }

  if (highlightedPhotoCount.value > 0 || galleryFilter.value === 'highlighted') {
    return [
      { label: 'Highlights', value: 'highlighted', count: highlightedPhotoCount.value },
      { label: 'All photos', value: 'all', count: eventTeamPhotos.value.length }
    ]
  }

  return [
    { label: 'All photos', value: 'all', count: eventTeamPhotos.value.length }
  ]
})
const visiblePhotos = computed(() => {
  if (galleryFilter.value === 'highlighted') {
    return eventTeamPhotos.value.filter(photo => photo.isHighlighted === true)
  }

  if (galleryFilter.value === 'not-highlighted') {
    return eventTeamPhotos.value.filter(photo => photo.isHighlighted !== true)
  }

  if (galleryFilter.value === 'public') {
    return eventTeamPhotos.value.filter(photo => photo.isPubliclyVisible)
  }

  return eventTeamPhotos.value
})
const panelDescription = computed(() => canManage.value
  ? 'Upload the full event archive, mark the strongest photos as highlights, and choose which images also appear on the public page.'
  : 'Browse the protected gallery for this event. Highlights show the curated set, and all photos keeps the full archive available.'
)
const emptyStateDescription = computed(() => canManage.value
  ? 'Upload the first JPEG or PNG image to start the event gallery.'
  : 'Gallery photos will appear here once the event team adds them.'
)

watch([() => props.page, canManage, highlightedPhotoCount], () => {
  if (!hasResolvedInitialFilter.value) {
    galleryFilter.value = canManage.value
      ? 'all'
      : highlightedPhotoCount.value > 0 ? 'highlighted' : 'all'
    hasResolvedInitialFilter.value = true
    return
  }

  const validFilters = new Set(galleryFilterOptions.value.map(option => option.value))

  if (!validFilters.has(galleryFilter.value)) {
    galleryFilter.value = galleryFilterOptions.value[0]?.value ?? 'all'
  }
}, {
  immediate: true
})

watch(eventId, () => {
  hasResolvedInitialFilter.value = false
  galleryFilter.value = canManage.value ? 'all' : 'highlighted'
})

async function uploadPhotos(files: File[]) {
  if (!canUpload.value || files.length === 0 || isUploading.value) {
    return
  }

  mutationErrorMessage.value = ''
  uploadingItems.value = createEventGalleryUploadItems(files)
  isUploading.value = true
  const targetEventId = eventId.value
  const uploadBatches = createEventGalleryUploadBatches(files)
  let uploadedCount = 0
  let latestPhotos: EventPhotoRecord[] | null = null

  try {
    for (const batch of uploadBatches) {
      const formData = new FormData()

      for (const file of batch) {
        formData.append('file', file)
      }

      const response = await apiFetch<{ data: EventPhotoRecord[] }>(`/api/events/${targetEventId}/photos`, {
        method: 'POST',
        body: formData
      })

      latestPhotos = response.data
      photos.value = response.data
      uploadedCount += batch.length
      uploadingItems.value = createEventGalleryUploadItems(files.slice(uploadedCount))
    }

    toast.add({
      title: files.length === 1 ? 'Photo added' : 'Photos added',
      description: files.length === 1
        ? 'The gallery now includes the new photo.'
        : `The gallery now includes ${files.length} new photos.`,
      color: 'success'
    })
  } catch (error) {
    const errorMessage = normalizeApiError(error).message
    mutationErrorMessage.value = uploadedCount > 0
      ? `${uploadedCount} ${uploadedCount === 1 ? 'photo was' : 'photos were'} added before the upload stopped. ${errorMessage}`
      : errorMessage

    if (uploadedCount > 0 && latestPhotos) {
      photos.value = latestPhotos
    }
  } finally {
    isUploading.value = false
    uploadingItems.value = []
  }
}

async function deletePhoto(photo: EventPhotoRecord) {
  if (!canManage.value || isPhotoChangePending.value) {
    return
  }

  const confirmed = window.confirm(`Delete ${photo.fileName ?? 'this photo'} from the event gallery?`)

  if (!confirmed) {
    return
  }

  mutationErrorMessage.value = ''
  pendingDeletePhotoId.value = photo.id

  try {
    await apiFetch(`/api/events/${eventId.value}/photos/${photo.id}`, {
      method: 'DELETE'
    })

    photos.value = photos.value.filter(entry => entry.id !== photo.id)
    toast.add({
      title: 'Photo removed',
      description: 'The gallery was updated.',
      color: 'success'
    })
  } catch (error) {
    mutationErrorMessage.value = normalizeApiError(error).message
  } finally {
    pendingDeletePhotoId.value = null
  }
}

async function togglePublicVisibility(payload: { photo: EventPhotoRecord, value: boolean }) {
  if (!canManage.value || isPhotoChangePending.value) {
    return
  }

  mutationErrorMessage.value = ''
  pendingPublicVisibilityPhotoId.value = payload.photo.id

  try {
    const response = await apiFetch<{ data: EventPhotoRecord }>(`/api/events/${eventId.value}/photos/${payload.photo.id}/public-visibility`, {
      method: 'PATCH',
      body: {
        isPubliclyVisible: payload.value
      }
    })

    photos.value = photos.value.map(entry => entry.id === payload.photo.id ? response.data : entry)
    toast.add({
      title: payload.value ? 'Added to public gallery' : 'Removed from public gallery',
      description: payload.value
        ? 'The image now appears on the public event page.'
        : 'The image is now visible only in the protected gallery.',
      color: 'success'
    })
  } catch (error) {
    mutationErrorMessage.value = normalizeApiError(error).message
  } finally {
    pendingPublicVisibilityPhotoId.value = null
  }
}

async function toggleHighlight(payload: { photo: EventPhotoRecord, value: boolean }) {
  if (!canManage.value || isPhotoChangePending.value) {
    return
  }

  mutationErrorMessage.value = ''
  pendingHighlightPhotoId.value = payload.photo.id

  try {
    const response = await apiFetch<{ data: EventPhotoRecord }>(`/api/events/${eventId.value}/photos/${payload.photo.id}/highlight`, {
      method: 'PATCH',
      body: {
        isHighlighted: payload.value
      }
    })

    photos.value = photos.value.map(entry => entry.id === payload.photo.id ? response.data : entry)
    toast.add({
      title: payload.value ? 'Photo highlighted' : 'Highlight removed',
      description: payload.value
        ? 'The image now appears in the highlighted gallery view.'
        : 'The image remains available in all photos.',
      color: 'success'
    })
  } catch (error) {
    mutationErrorMessage.value = normalizeApiError(error).message
  } finally {
    pendingHighlightPhotoId.value = null
  }
}

/** Hides a participant photo from participants and the public, or shows it again. */
async function toggleHidden(payload: { photo: EventPhotoRecord, value: boolean }) {
  if (!canManage.value || isPhotoChangePending.value) {
    return
  }

  mutationErrorMessage.value = ''
  pendingHiddenPhotoId.value = payload.photo.id

  try {
    const response = await apiFetch<{ data: EventPhotoRecord }>(`/api/events/${eventId.value}/photos/${payload.photo.id}/hidden`, {
      method: 'PATCH',
      body: {
        isHidden: payload.value
      }
    })

    photos.value = photos.value.map(entry => entry.id === payload.photo.id ? response.data : entry)
    toast.add({
      title: payload.value ? 'Photo hidden' : 'Photo shown again',
      description: payload.value
        ? 'Participants no longer see this photo.'
        : 'Participants see this photo again.',
      color: 'success'
    })
  } catch (error) {
    mutationErrorMessage.value = normalizeApiError(error).message
  } finally {
    pendingHiddenPhotoId.value = null
  }
}
</script>

<template>
  <EventGalleryPanel
    v-model:active-filter="galleryFilter"
    :description="panelDescription"
    :photos="visiblePhotos"
    :participant-photos="participantPhotos"
    :total-photo-count="photos.length"
    :filter-options="galleryFilterOptions"
    :can-manage="canManage"
    :can-add-participant-photos="canAddParticipantPhotos"
    :can-toggle-public-visibility="canManage"
    :can-toggle-highlight="canManage"
    :show-curation-badges="true"
    :show-uploader="true"
    :is-loading="props.isLoading"
    :load-error-message="props.loadErrorMessage"
    :mutation-error-message="mutationErrorMessage"
    :is-uploading="isUploading"
    :uploading-items="uploadingItems"
    :pending-delete-photo-id="pendingDeletePhotoId"
    :pending-public-visibility-photo-id="pendingPublicVisibilityPhotoId"
    :pending-highlight-photo-id="pendingHighlightPhotoId"
    :pending-hidden-photo-id="pendingHiddenPhotoId"
    add-button-label="Add photos"
    empty-state-title="No gallery photos yet"
    :empty-state-description="emptyStateDescription"
    empty-filtered-state-title="No photos in this view"
    empty-filtered-state-description="Switch filters to keep browsing the event gallery."
    @upload-photos="uploadPhotos"
    @delete-photo="deletePhoto"
    @toggle-public-visibility="togglePublicVisibility"
    @toggle-highlight="toggleHighlight"
    @toggle-hidden="toggleHidden"
  />
</template>
