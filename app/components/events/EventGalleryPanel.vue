<script setup lang="ts">
import type { EventPhotoRecord } from '#shared/domains/events/photos'
import type { EventGalleryUploadItem, PendingGalleryPhotoChange } from '~/domains/events/gallery'

import 'photoswipe/style.css'

import EventGalleryPhotoCard from '~/components/events/molecules/EventGalleryPhotoCard.vue'
import EventGalleryUploadStatus from '~/components/events/molecules/EventGalleryUploadStatus.vue'

interface EventGalleryFilterOption {
  label: string
  value: string
  count?: number
}

const props = withDefaults(defineProps<{
  description?: string
  photos: EventPhotoRecord[]
  /** Photos that participants added. Listed after `photos`, under "Photos from participants". */
  participantPhotos?: EventPhotoRecord[]
  totalPhotoCount?: number | null
  filterOptions?: ReadonlyArray<EventGalleryFilterOption>
  canManage?: boolean
  /** The viewer adds photos as a participant. Shows the upload action of the participant section. */
  canAddParticipantPhotos?: boolean
  showCurationBadges?: boolean
  showUploader?: boolean
  isLoading?: boolean
  loadErrorMessage?: string
  mutationErrorMessage?: string
  isUploading?: boolean
  uploadingItems?: EventGalleryUploadItem[]
  pendingChange?: PendingGalleryPhotoChange | null
  addButtonLabel?: string
  emptyStateTitle?: string
  emptyStateDescription?: string
  emptyFilteredStateTitle?: string
  emptyFilteredStateDescription?: string
}>(), {
  description: '',
  participantPhotos: () => [],
  totalPhotoCount: null,
  filterOptions: () => [],
  canManage: false,
  canAddParticipantPhotos: false,
  showCurationBadges: false,
  showUploader: false,
  isLoading: false,
  loadErrorMessage: '',
  mutationErrorMessage: '',
  isUploading: false,
  uploadingItems: () => [],
  pendingChange: null,
  addButtonLabel: 'Add photos',
  emptyStateTitle: 'No gallery photos yet',
  emptyStateDescription: 'Gallery photos will appear here once they are available.',
  emptyFilteredStateTitle: 'No photos match this filter',
  emptyFilteredStateDescription: 'Try another gallery filter to keep browsing.'
})

const emit = defineEmits<{
  uploadPhotos: [files: File[]]
  deletePhoto: [photo: EventPhotoRecord]
  togglePublicVisibility: [payload: { photo: EventPhotoRecord, value: boolean }]
  toggleHighlight: [payload: { photo: EventPhotoRecord, value: boolean }]
  toggleHidden: [payload: { photo: EventPhotoRecord, value: boolean }]
}>()

const activeFilter = defineModel<string>('activeFilter', {
  default: 'all'
})

const fileInput = ref<HTMLInputElement | null>(null)
const galleryElement = ref<HTMLElement | null>(null)
const dragDepth = ref(0)
const isDragTargetActive = ref(false)
// Everything the panel lists: the photos of the event team first, then the participant photos.
const listedPhotos = computed(() => [...props.photos, ...props.participantPhotos])
// The panel shows its photos in up to two groups. The participant group also appears without
// photos for a participant who can add some, because it holds their upload action.
const photoGroups = computed(() => {
  const groups: Array<{ id: 'event-team' | 'participants', photos: EventPhotoRecord[] }> = []

  if (props.photos.length > 0) {
    groups.push({ id: 'event-team', photos: props.photos })
  }

  if (props.participantPhotos.length > 0 || props.canAddParticipantPhotos) {
    groups.push({ id: 'participants', photos: props.participantPhotos })
  }

  return groups
})
// The people who manage the gallery and participants who add photos use the same upload control.
const canUpload = computed(() => props.canManage || props.canAddParticipantPhotos)
const photoCountLabel = computed(() => {
  const totalPhotoCount = props.totalPhotoCount
  const listedPhotoCount = listedPhotos.value.length

  if (typeof totalPhotoCount === 'number' && totalPhotoCount > listedPhotoCount) {
    return `${listedPhotoCount}/${totalPhotoCount} photos`
  }

  return `${listedPhotoCount} ${listedPhotoCount === 1 ? 'photo' : 'photos'}`
})
const showPhotos = computed(() => !props.loadErrorMessage && !props.isLoading)
const showFilterControls = computed(() => props.filterOptions.length > 1)
const hasFilteredEmptyState = computed(() =>
  typeof props.totalPhotoCount === 'number'
  && props.totalPhotoCount > 0
  && listedPhotos.value.length === 0
)
const resolvedEmptyStateTitle = computed(() => hasFilteredEmptyState.value ? props.emptyFilteredStateTitle : props.emptyStateTitle)
const resolvedEmptyStateDescription = computed(() => hasFilteredEmptyState.value ? props.emptyFilteredStateDescription : props.emptyStateDescription)
const canUseEmptyUploadTarget = computed(() => props.canManage && !hasFilteredEmptyState.value)
// A gallery without photos has one empty state. For a participant who can add photos it is the
// invitation in the participant section, next to their upload action.
const invitesFirstParticipantPhoto = computed(() =>
  props.canAddParticipantPhotos && listedPhotos.value.length === 0 && !hasFilteredEmptyState.value
)
function openFilePicker() {
  if (!canUpload.value || props.isUploading) {
    return
  }

  fileInput.value?.click()
}

function openFilePickerFromEmptyState() {
  if (!canUseEmptyUploadTarget.value) {
    return
  }

  openFilePicker()
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement | null
  const files = Array.from(input?.files ?? [])

  if (files.length > 0) {
    emit('uploadPhotos', files)
  }

  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function hasDraggedFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function activateDropTarget(event: DragEvent) {
  if (!canUpload.value || props.isUploading || hasFilteredEmptyState.value || !hasDraggedFiles(event)) {
    return false
  }

  event.preventDefault()
  return true
}

function onDropTargetDragEnter(event: DragEvent) {
  if (!activateDropTarget(event)) {
    return
  }

  dragDepth.value += 1
  isDragTargetActive.value = true
}

function onDropTargetDragOver(event: DragEvent) {
  if (!activateDropTarget(event)) {
    return
  }

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }

  isDragTargetActive.value = true
}

function onDropTargetDragLeave(event: DragEvent) {
  if (!activateDropTarget(event)) {
    return
  }

  dragDepth.value = Math.max(0, dragDepth.value - 1)

  if (dragDepth.value === 0) {
    isDragTargetActive.value = false
  }
}

function onDropTargetDrop(event: DragEvent) {
  if (!activateDropTarget(event)) {
    return
  }

  const files = Array.from(event.dataTransfer?.files ?? [])
  dragDepth.value = 0
  isDragTargetActive.value = false

  if (files.length > 0) {
    emit('uploadPhotos', files)
  }
}

// PhotoSwipe listens for clicks on the gallery, including photos added after it mounts.
watch(galleryElement, async (gallery, _previous, onCleanup) => {
  if (!gallery) return

  const { default: PhotoSwipeLightbox } = await import('photoswipe/lightbox')
  if (gallery !== galleryElement.value) return

  const lightbox = new PhotoSwipeLightbox({
    gallery,
    children: 'a[data-photoswipe-photo]',
    showHideAnimationType: 'zoom',
    pswpModule: () => import('photoswipe')
  })
  lightbox.init()
  onCleanup(() => lightbox.destroy())
}, { flush: 'post' })
</script>

<template>
  <AppCard class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
    <template #header>
      <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="text-lg font-semibold text-highlighted">
              Gallery
            </h2>
            <AppBadge
              v-if="showPhotos"
              color="neutral"
              variant="soft"
              class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
            >
              {{ photoCountLabel }}
            </AppBadge>
          </div>
          <p
            v-if="description"
            class="max-w-3xl text-sm text-muted"
          >
            {{ description }}
          </p>
        </div>

        <input
          v-if="canUpload"
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png"
          multiple
          class="hidden"
          @change="onFileInputChange"
        >

        <div
          v-if="canManage"
          class="flex shrink-0 flex-wrap items-center gap-3"
        >
          <AppButton
            color="primary"
            icon="i-lucide-upload"
            :loading="isUploading"
            @click="openFilePicker"
          >
            {{ addButtonLabel }}
          </AppButton>
        </div>
      </div>
    </template>

    <div class="space-y-5">
      <!-- A notice of the page that shows the gallery, for example what a participant does before adding photos. -->
      <slot name="notice" />

      <AppAlert
        v-if="mutationErrorMessage"
        color="error"
        variant="soft"
        title="Unable to update the gallery"
        :description="mutationErrorMessage"
      />

      <AppAlert
        v-if="loadErrorMessage"
        color="error"
        variant="soft"
        title="Unable to load the gallery"
        :description="loadErrorMessage"
      />

      <div
        v-if="showPhotos && showFilterControls"
        class="flex flex-col gap-4"
      >
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <AppFilterButton
            v-for="option in filterOptions"
            :key="option.value"
            :pressed="activeFilter === option.value"
            :count="option.count"
            @click="activeFilter = option.value"
          >
            {{ option.label }}
          </AppFilterButton>
        </div>
      </div>

      <div
        v-if="isLoading && !loadErrorMessage"
        class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <div
          v-for="placeholder in 6"
          :key="placeholder"
          class="aspect-[4/3] animate-pulse rounded-2xl bg-black/[0.05] dark:bg-white/[0.06]"
        />
      </div>

      <template v-else-if="showPhotos">
        <div
          v-if="listedPhotos.length === 0 && !invitesFirstParticipantPhoto"
          class="rounded-2xl border border-dashed px-6 py-10 text-center transition-colors dark:border-white/[0.08]"
          :class="canUseEmptyUploadTarget
            ? [
              'cursor-pointer',
              isDragTargetActive
                ? 'border-emerald-500/60 bg-emerald-500/[0.06] dark:border-emerald-400/60 dark:bg-emerald-400/[0.08]'
                : 'border-black/10 hover:border-black/18 hover:bg-black/[0.02] dark:border-white/[0.08] dark:hover:border-white/[0.14] dark:hover:bg-white/[0.03]'
            ]
            : 'border-black/10 dark:border-white/[0.08]'"
          :role="canUseEmptyUploadTarget ? 'button' : undefined"
          :tabindex="canUseEmptyUploadTarget ? 0 : undefined"
          :aria-disabled="canUseEmptyUploadTarget && isUploading ? 'true' : undefined"
          @click="openFilePickerFromEmptyState"
          @keydown.enter.prevent="openFilePickerFromEmptyState"
          @keydown.space.prevent="openFilePickerFromEmptyState"
          @dragenter="onDropTargetDragEnter"
          @dragover="onDropTargetDragOver"
          @dragleave="onDropTargetDragLeave"
          @drop="onDropTargetDrop"
        >
          <p class="text-base font-semibold text-highlighted">
            {{ resolvedEmptyStateTitle }}
          </p>
          <p class="mt-2 text-sm text-muted">
            {{ resolvedEmptyStateDescription }}
          </p>
          <p
            v-if="canUseEmptyUploadTarget"
            class="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted"
          >
            {{ isDragTargetActive ? 'Drop JPEG or PNG files here.' : 'Drop JPEG or PNG files here, or click to choose.' }}
          </p>
          <EventGalleryUploadStatus
            v-if="uploadingItems.length > 0"
            class="mx-auto mt-4 max-w-3xl text-left"
            :items="uploadingItems"
          />
        </div>

        <EventGalleryUploadStatus
          v-else-if="uploadingItems.length > 0"
          :items="uploadingItems"
        />

        <div
          v-if="photoGroups.length > 0"
          class="relative"
          @dragenter="onDropTargetDragEnter"
          @dragover="onDropTargetDragOver"
          @dragleave="onDropTargetDragLeave"
          @drop="onDropTargetDrop"
        >
          <!-- The lightbox opens every photo link inside this element, across both groups. -->
          <div
            ref="galleryElement"
            class="space-y-8"
          >
            <section
              v-for="group in photoGroups"
              :key="group.id"
              class="space-y-4"
              :data-testid="`event-gallery-group-${group.id}`"
            >
              <div
                v-if="group.id === 'participants'"
                class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div class="space-y-1">
                  <h3 class="text-base font-semibold text-highlighted">
                    Photos from participants
                  </h3>
                  <p
                    v-if="canAddParticipantPhotos"
                    class="text-sm text-muted"
                  >
                    Other participants and the event team can see your photos.
                  </p>
                </div>

                <AppButton
                  v-if="canAddParticipantPhotos"
                  color="primary"
                  icon="i-lucide-upload"
                  class="shrink-0"
                  :loading="isUploading"
                  @click="openFilePicker"
                >
                  {{ addButtonLabel }}
                </AppButton>
              </div>

              <p
                v-if="invitesFirstParticipantPhoto"
                class="text-sm text-muted"
              >
                No photos yet. Add the first one.
              </p>

              <div
                v-if="group.photos.length > 0"
                class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              >
                <EventGalleryPhotoCard
                  v-for="photo in group.photos"
                  :key="photo.id"
                  :photo="photo"
                  :show-uploader="showUploader"
                  :show-curation-badges="showCurationBadges"
                  :can-manage="canManage"
                  :has-pending-mutation="!!pendingChange"
                  :is-deleting="pendingChange?.photoId === photo.id && pendingChange.action === 'delete'"
                  :is-toggling-hidden="pendingChange?.photoId === photo.id && pendingChange.action === 'hidden'"
                  @delete="emit('deletePhoto', photo)"
                  @toggle-public-visibility="emit('togglePublicVisibility', { photo, value: $event })"
                  @toggle-highlight="emit('toggleHighlight', { photo, value: $event })"
                  @toggle-hidden="emit('toggleHidden', { photo, value: $event })"
                />
              </div>
            </section>
          </div>

          <div
            v-if="canUpload && isDragTargetActive"
            class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-3xl border-2 border-dashed border-emerald-500/70 bg-emerald-500/[0.08] p-6"
          >
            <div class="rounded-full bg-white/92 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-highlighted shadow-[0_16px_40px_-24px_rgba(15,23,42,0.45)] dark:bg-[#111111]/95 dark:text-white">
              Drop photos to add them
            </div>
          </div>
        </div>
      </template>
    </div>
  </AppCard>
</template>
