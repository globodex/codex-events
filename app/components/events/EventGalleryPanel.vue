<script setup lang="ts">
import type { EventPhotoRecord } from '#shared/domains/events/photos'
import type { EventGalleryUploadItem } from '~/domains/events/gallery'

import 'photoswipe/style.css'

import { Switch as UiSwitch } from '~/components/ui/switch'
import { formatTimestamp } from '~/lib/date-formatting'

interface EventGalleryFilterOption {
  label: string
  value: string
  count?: number
}

type PhotoSwipeLightboxInstance = {
  init: () => void
  destroy: () => void
}

type PhotoSwipeLightboxCtor = new (options: Record<string, unknown>) => PhotoSwipeLightboxInstance

const props = withDefaults(defineProps<{
  description: string
  photos: EventPhotoRecord[]
  totalPhotoCount?: number | null
  filterOptions?: ReadonlyArray<EventGalleryFilterOption>
  canManage?: boolean
  canTogglePublicVisibility?: boolean
  canToggleHighlight?: boolean
  showCurationBadges?: boolean
  showUploader?: boolean
  isLoading?: boolean
  loadErrorMessage?: string
  mutationErrorMessage?: string
  isUploading?: boolean
  uploadingItems?: EventGalleryUploadItem[]
  pendingDeletePhotoId?: string | null
  pendingPublicVisibilityPhotoId?: string | null
  pendingHighlightPhotoId?: string | null
  addButtonLabel?: string
  emptyStateTitle?: string
  emptyStateDescription?: string
  emptyFilteredStateTitle?: string
  emptyFilteredStateDescription?: string
}>(), {
  totalPhotoCount: null,
  filterOptions: () => [],
  canManage: false,
  canTogglePublicVisibility: false,
  canToggleHighlight: false,
  showCurationBadges: false,
  showUploader: false,
  isLoading: false,
  loadErrorMessage: '',
  mutationErrorMessage: '',
  isUploading: false,
  uploadingItems: () => [],
  pendingDeletePhotoId: null,
  pendingPublicVisibilityPhotoId: null,
  pendingHighlightPhotoId: null,
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
}>()

const activeFilter = defineModel<string>('activeFilter', {
  default: 'all'
})

const fileInput = ref<HTMLInputElement | null>(null)
const galleryElement = ref<HTMLElement | null>(null)
const dragDepth = ref(0)
const isDragTargetActive = ref(false)
const photoCountLabel = computed(() => {
  const totalPhotoCount = props.totalPhotoCount

  if (typeof totalPhotoCount === 'number' && totalPhotoCount > props.photos.length) {
    return `${props.photos.length}/${totalPhotoCount} photos`
  }

  return `${props.photos.length} ${props.photos.length === 1 ? 'photo' : 'photos'}`
})
const uploadingItems = computed(() => props.uploadingItems ?? [])
const uploadStatusLabel = computed(() => uploadingItems.value.length === 1 ? 'Uploading 1 photo' : `Uploading ${uploadingItems.value.length} photos`)
const showInitialLoadingState = computed(() => props.isLoading && props.photos.length === 0)
const showFilterControls = computed(() => props.filterOptions.length > 1)
const hasFilteredEmptyState = computed(() =>
  typeof props.totalPhotoCount === 'number'
  && props.totalPhotoCount > 0
  && props.photos.length === 0
)
const resolvedEmptyStateTitle = computed(() => hasFilteredEmptyState.value ? props.emptyFilteredStateTitle : props.emptyStateTitle)
const resolvedEmptyStateDescription = computed(() => hasFilteredEmptyState.value ? props.emptyFilteredStateDescription : props.emptyStateDescription)
const canUseEmptyUploadTarget = computed(() => props.canManage && !hasFilteredEmptyState.value)
const hasPendingMutation = computed(() =>
  props.pendingDeletePhotoId !== null
  || props.pendingPublicVisibilityPhotoId !== null
  || props.pendingHighlightPhotoId !== null
)

let photoLightbox: PhotoSwipeLightboxInstance | null = null
let photoSwipeLightboxCtor: PhotoSwipeLightboxCtor | null = null

function formatPhotoTimestamp(value: string) {
  return formatTimestamp(value, 'Unknown upload time')
}

function publicVisibilitySwitchId(photoId: string) {
  return `event-gallery-public-visibility-${photoId}`
}

function publicVisibilityStatusLabel(photo: EventPhotoRecord) {
  return photo.isPubliclyVisible ? 'Visible on the public page' : 'Only in the protected gallery'
}

function highlightSwitchId(photoId: string) {
  return `event-gallery-highlight-${photoId}`
}

function highlightStatusLabel(photo: EventPhotoRecord) {
  return photo.isHighlighted ? 'Highlighted for participants' : 'In all photos only'
}

function openFilePicker() {
  if (!props.canManage || props.isUploading) {
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
  if (!props.canManage || props.isUploading || hasFilteredEmptyState.value || !hasDraggedFiles(event)) {
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

async function ensurePhotoLightbox() {
  if (!import.meta.client || !galleryElement.value || props.photos.length === 0) {
    photoLightbox?.destroy()
    photoLightbox = null
    return
  }

  if (!photoSwipeLightboxCtor) {
    const module = await import('photoswipe/lightbox')
    photoSwipeLightboxCtor = module.default as PhotoSwipeLightboxCtor
  }

  photoLightbox?.destroy()
  photoLightbox = new photoSwipeLightboxCtor!({
    gallery: galleryElement.value,
    children: 'a[data-photoswipe-photo]',
    loop: true,
    showHideAnimationType: 'zoom',
    pswpModule: async () => await import('photoswipe')
  })
  photoLightbox.init()
}

onMounted(async () => {
  await ensurePhotoLightbox()
})

watch([galleryElement, () => props.photos], async () => {
  await ensurePhotoLightbox()
}, {
  flush: 'post'
})

onBeforeUnmount(() => {
  photoLightbox?.destroy()
  photoLightbox = null
})
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
              color="neutral"
              variant="soft"
              class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
            >
              {{ photoCountLabel }}
            </AppBadge>
          </div>
          <p class="max-w-3xl text-sm text-muted">
            {{ description }}
          </p>
        </div>

        <div
          v-if="canManage"
          class="flex shrink-0 flex-wrap items-center gap-3"
        >
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png"
            multiple
            class="hidden"
            @change="onFileInputChange"
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
        v-if="showFilterControls"
        class="flex flex-col gap-4"
      >
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            class="inline-flex min-w-max grow basis-0 items-center justify-between gap-2 rounded-lg px-4 py-1.5 text-[13px] transition-colors sm:min-w-0 sm:grow-0 sm:basis-auto sm:justify-start"
            :class="activeFilter === option.value ? 'bg-black text-white font-medium dark:bg-white dark:text-black' : 'bg-black/6 text-neutral-700 hover:bg-black/10 hover:text-highlighted dark:bg-white/[0.08] dark:text-[#A3A3A3] dark:hover:bg-white/[0.12] dark:hover:text-white'"
            @click="activeFilter = option.value"
          >
            <span>{{ option.label }}</span>
            <span
              v-if="typeof option.count === 'number'"
              class="rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none"
              :class="activeFilter === option.value ? 'bg-white/15 text-white dark:bg-black/10 dark:text-black' : 'bg-black/6 text-neutral-700 dark:bg-white/[0.08] dark:text-[#B0B0B0]'"
            >
              {{ option.count }}
            </span>
          </button>
        </div>
      </div>

      <div
        v-if="showInitialLoadingState"
        class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <div
          v-for="placeholder in 6"
          :key="placeholder"
          class="aspect-[4/3] animate-pulse rounded-2xl bg-black/[0.05] dark:bg-white/[0.06]"
        />
      </div>

      <div
        v-else-if="photos.length === 0"
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
        <div
          v-if="uploadingItems.length > 0"
          class="mx-auto mt-4 flex max-w-3xl items-center gap-2 overflow-hidden rounded-full border border-black/8 bg-black/[0.03] px-3 py-2 text-left dark:border-white/[0.08] dark:bg-white/[0.04]"
        >
          <span class="size-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
          <p class="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-highlighted dark:text-white">
            {{ uploadStatusLabel }}
          </p>
          <div class="min-w-0 flex-1 overflow-x-auto">
            <div class="flex min-w-max items-center gap-2 pr-1">
              <span
                v-for="item in uploadingItems"
                :key="item.id"
                class="max-w-[11rem] truncate rounded-full bg-white/80 px-2 py-0.5 text-xs text-muted dark:bg-white/[0.08]"
              >
                {{ item.name }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="space-y-3"
      >
        <div
          v-if="uploadingItems.length > 0"
          class="flex items-center gap-2 overflow-hidden rounded-full border border-black/8 bg-black/[0.03] px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.04]"
        >
          <span class="size-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
          <p class="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-highlighted dark:text-white">
            {{ uploadStatusLabel }}
          </p>
          <div class="min-w-0 flex-1 overflow-x-auto">
            <div class="flex min-w-max items-center gap-2 pr-1">
              <span
                v-for="item in uploadingItems"
                :key="item.id"
                class="max-w-[11rem] truncate rounded-full bg-white/80 px-2 py-0.5 text-xs text-muted dark:bg-white/[0.08]"
              >
                {{ item.name }}
              </span>
            </div>
          </div>
        </div>

        <div
          class="relative"
          @dragenter="onDropTargetDragEnter"
          @dragover="onDropTargetDragOver"
          @dragleave="onDropTargetDragLeave"
          @drop="onDropTargetDrop"
        >
          <div
            ref="galleryElement"
            class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            <article
              v-for="photo in photos"
              :key="photo.id"
              class="group overflow-hidden rounded-2xl border border-black/8 bg-white/80 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)] dark:border-white/[0.08] dark:bg-[#111111]"
            >
              <a
                v-if="photo.originalUrl && photo.previewUrl"
                :href="photo.originalUrl"
                :data-photoswipe-photo="photo.id"
                :data-pswp-width="photo.width"
                :data-pswp-height="photo.height"
                :aria-label="`Open ${photo.fileName ?? 'gallery photo'}`"
                class="block"
              >
                <div
                  class="overflow-hidden bg-black/[0.04] dark:bg-white/[0.04]"
                  :style="{ aspectRatio: `${photo.width} / ${photo.height}` }"
                >
                  <img
                    :src="photo.previewUrl"
                    :alt="photo.fileName ?? 'Gallery photo'"
                    loading="lazy"
                    class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  >
                </div>
              </a>

              <div class="space-y-4 p-4">
                <div class="space-y-1">
                  <p class="truncate text-sm font-semibold text-highlighted dark:text-white">
                    {{ photo.fileName ?? 'Gallery photo' }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ formatPhotoTimestamp(photo.createdAt) }}
                  </p>
                  <p
                    v-if="showUploader && photo.uploadedBy"
                    class="truncate text-xs text-muted"
                  >
                    Added by {{ photo.uploadedBy.displayName }}
                  </p>
                  <div
                    v-if="showCurationBadges"
                    class="flex flex-wrap gap-2 pt-1"
                  >
                    <AppBadge
                      v-if="photo.isHighlighted"
                      color="warning"
                      variant="soft"
                      size="sm"
                      class="rounded-full"
                    >
                      Highlight
                    </AppBadge>
                    <AppBadge
                      v-if="photo.isPubliclyVisible"
                      color="success"
                      variant="soft"
                      size="sm"
                      class="rounded-full"
                    >
                      Public
                    </AppBadge>
                  </div>
                </div>

                <AppButton
                  v-if="photo.originalUrl"
                  :to="`${photo.originalUrl}&download=1`"
                  external
                  icon="i-lucide-download"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :aria-label="`Download original ${photo.fileName ?? 'gallery photo'}`"
                >
                  Download original
                </AppButton>

                <div
                  v-if="canToggleHighlight || canTogglePublicVisibility || canManage"
                  class="flex flex-col gap-4 border-t border-black/8 pt-4 dark:border-white/[0.08]"
                >
                  <div
                    v-if="canToggleHighlight"
                    class="flex items-start justify-between gap-4"
                  >
                    <div class="space-y-1">
                      <label
                        :for="highlightSwitchId(photo.id)"
                        class="text-sm font-medium text-highlighted dark:text-white"
                      >
                        Highlight for participants
                      </label>
                      <p class="text-sm text-muted">
                        Highlighted images appear in the default protected gallery view.
                      </p>
                      <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                        {{ highlightStatusLabel(photo) }}
                      </p>
                    </div>

                    <UiSwitch
                      :id="highlightSwitchId(photo.id)"
                      :model-value="photo.isHighlighted === true"
                      :disabled="hasPendingMutation"
                      @update:model-value="emit('toggleHighlight', { photo, value: Boolean($event) })"
                    />
                  </div>

                  <div
                    v-if="canTogglePublicVisibility"
                    class="flex items-start justify-between gap-4"
                  >
                    <div class="space-y-1">
                      <label
                        :for="publicVisibilitySwitchId(photo.id)"
                        class="text-sm font-medium text-highlighted dark:text-white"
                      >
                        Show on the public page
                      </label>
                      <p class="text-sm text-muted">
                        Selected images appear in the public Gallery tab for this event.
                      </p>
                      <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                        {{ publicVisibilityStatusLabel(photo) }}
                      </p>
                    </div>

                    <UiSwitch
                      :id="publicVisibilitySwitchId(photo.id)"
                      :model-value="photo.isPubliclyVisible"
                      :disabled="hasPendingMutation"
                      @update:model-value="emit('togglePublicVisibility', { photo, value: Boolean($event) })"
                    />
                  </div>

                  <div
                    v-if="canManage"
                    class="flex justify-end"
                  >
                    <AppButton
                      color="error"
                      variant="soft"
                      size="sm"
                      :loading="pendingDeletePhotoId === photo.id"
                      :disabled="hasPendingMutation"
                      @click.prevent="emit('deletePhoto', photo)"
                    >
                      Delete
                    </AppButton>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <div
            v-if="canManage && isDragTargetActive"
            class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-3xl border-2 border-dashed border-emerald-500/70 bg-emerald-500/[0.08] p-6"
          >
            <div class="rounded-full bg-white/92 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-highlighted shadow-[0_16px_40px_-24px_rgba(15,23,42,0.45)] dark:bg-[#111111]/95 dark:text-white">
              Drop photos to add them
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppCard>
</template>
