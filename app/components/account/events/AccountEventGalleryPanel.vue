<script setup lang="ts">
import type { EventPhotoRecord } from '#shared/domains/events/photos'
import type { PendingGalleryPhotoChange } from '~/domains/events/gallery'
import type { AccountEventGalleryPage } from '#shared/domains/events/account-event-gallery-page'

import AccountEventNextStepNotice from '~/components/account/events/molecules/AccountEventNextStepNotice.vue'
import EventGalleryPanel from '~/components/events/EventGalleryPanel.vue'
import { normalizeApiError } from '~/lib/api'
import { createEventGalleryUploadBatches, createEventGalleryUploadItems } from '~/domains/events/gallery'
import { useApiClient } from '~/composables/useApiClient'

type AccountEventGalleryFilter = 'all' | 'highlighted' | 'not-highlighted' | 'public'

const props = withDefaults(defineProps<{
  eventId: string
  eventSlug: string
  canManage: boolean
  page: AccountEventGalleryPage | null
  refreshPage: (eventSlug: string) => Promise<void>
  /** The page that shows the next-step card. Null when the event shows no next-step card. */
  nextStepHref: string | null
  loadErrorMessage?: string
}>(), {
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
const pendingPhotoChange = shallowRef<PendingGalleryPhotoChange | null>(null)
const isUploading = ref(false)
const uploadingItems = ref(createEventGalleryUploadItems([]))
const photos = computed(() => props.page?.photos ?? [])
const selectedFilter = shallowRef<AccountEventGalleryFilter | null>(null)

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

  if (highlightedPhotoCount.value > 0 || selectedFilter.value === 'highlighted') {
    return [
      { label: 'Highlights', value: 'highlighted', count: highlightedPhotoCount.value },
      { label: 'All photos', value: 'all', count: eventTeamPhotos.value.length }
    ]
  }

  return [
    { label: 'All photos', value: 'all', count: eventTeamPhotos.value.length }
  ]
})
// The first available filter is the default. Only an explicit choice overrides it.
const galleryFilter = computed({
  get: () => galleryFilterOptions.value.find(option => option.value === selectedFilter.value)?.value
    ?? galleryFilterOptions.value[0]?.value ?? 'all',
  set: (value: AccountEventGalleryFilter) => { selectedFilter.value = value }
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
// The description explains the controls of the people who manage the gallery. Participants have none.
const panelDescription = computed(() => canManage.value
  ? 'Upload the full event archive, mark the strongest photos as highlights, and choose which images also appear on the public page.'
  : ''
)
const emptyStateDescription = computed(() => canManage.value
  ? 'Upload the first JPEG or PNG image to start the event gallery.'
  : 'Gallery photos will appear here once the event team adds them.'
)

watch(eventId, () => {
  selectedFilter.value = null
})

async function uploadPhotos(files: File[]) {
  if (!canUpload.value || files.length === 0 || isUploading.value) {
    return
  }

  mutationErrorMessage.value = ''
  uploadingItems.value = createEventGalleryUploadItems(files)
  isUploading.value = true
  const eventSlug = props.eventSlug
  const targetEventId = eventId.value
  const uploadBatches = createEventGalleryUploadBatches(files)
  let uploadedCount = 0

  try {
    for (const batch of uploadBatches) {
      const formData = new FormData()

      for (const file of batch) {
        formData.append('file', file)
      }

      await apiFetch(`/api/events/${targetEventId}/photos`, {
        method: 'POST',
        body: formData
      })

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
  } finally {
    // An upload that stopped halfway also added photos.
    if (uploadedCount > 0) await props.refreshPage(eventSlug)
    uploadingItems.value = []
    isUploading.value = false
  }
}

async function changePhoto(
  photo: EventPhotoRecord,
  action: PendingGalleryPhotoChange['action'],
  request: () => Promise<unknown>,
  success: { title: string, description: string }
) {
  if (!canManage.value || pendingPhotoChange.value) return

  const eventSlug = props.eventSlug
  pendingPhotoChange.value = { photoId: photo.id, action }
  mutationErrorMessage.value = ''
  try {
    await request()
    await props.refreshPage(eventSlug)
    toast.add({ ...success, color: 'success' })
  } catch (error) {
    mutationErrorMessage.value = normalizeApiError(error).message
  } finally {
    pendingPhotoChange.value = null
  }
}

function deletePhoto(photo: EventPhotoRecord) {
  if (!window.confirm(`Delete ${photo.fileName ?? 'this photo'} from the event gallery?`)) return

  return changePhoto(photo, 'delete', () =>
    apiFetch(`/api/events/${eventId.value}/photos/${photo.id}`, { method: 'DELETE' }), {
    title: 'Photo removed',
    description: 'The gallery was updated.'
  })
}

function togglePublicVisibility({ photo, value }: { photo: EventPhotoRecord, value: boolean }) {
  return changePhoto(photo, 'public-visibility', () =>
    apiFetch(`/api/events/${eventId.value}/photos/${photo.id}/public-visibility`, {
      method: 'PATCH',
      body: { isPubliclyVisible: value }
    }), {
    title: value ? 'Added to public gallery' : 'Removed from public gallery',
    description: value ? 'The image now appears on the public event page.' : 'The image is now visible only in the protected gallery.'
  })
}

function toggleHighlight({ photo, value }: { photo: EventPhotoRecord, value: boolean }) {
  return changePhoto(photo, 'highlight', () =>
    apiFetch(`/api/events/${eventId.value}/photos/${photo.id}/highlight`, {
      method: 'PATCH',
      body: { isHighlighted: value }
    }), {
    title: value ? 'Photo highlighted' : 'Highlight removed',
    description: value ? 'The image now appears in the highlighted gallery view.' : 'The image remains available in all photos.'
  })
}

function toggleHidden({ photo, value }: { photo: EventPhotoRecord, value: boolean }) {
  return changePhoto(photo, 'hidden', () =>
    apiFetch(`/api/events/${eventId.value}/photos/${photo.id}/hidden`, {
      method: 'PATCH',
      body: { isHidden: value }
    }), {
    title: value ? 'Photo hidden' : 'Photo shown again',
    description: value ? 'Participants no longer see this photo.' : 'Participants see this photo again.'
  })
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
    :show-curation-badges="true"
    :show-uploader="true"
    :is-loading="!props.page && !props.loadErrorMessage"
    :load-error-message="props.loadErrorMessage"
    :mutation-error-message="mutationErrorMessage"
    :is-uploading="isUploading"
    :uploading-items="uploadingItems"
    :pending-change="pendingPhotoChange"
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
  >
    <!-- The server decides who sees this notice. The gallery page carries its answer. -->
    <template
      v-if="props.page?.mustFinishCheckInFlowToAddPhotos"
      #notice
    >
      <AccountEventNextStepNotice
        title="Finish your next step to add photos"
        :next-step-href="props.nextStepHref"
      />
    </template>
  </EventGalleryPanel>
</template>
