<script setup lang="ts">
// One photo of the event gallery: the picture that opens in the photo viewer, its file name and
// date, a download link, and the controls of the people who manage the gallery.
import type { EventPhotoRecord } from '#shared/domains/events/photos'

import { Switch as UiSwitch } from '~/components/ui/switch'
import { formatTimestamp } from '~/lib/date-formatting'

withDefaults(defineProps<{
  photo: EventPhotoRecord
  /** Shows who added the photo. */
  showUploader?: boolean
  /** Shows the Hidden, Highlight and Public marks. */
  showCurationBadges?: boolean
  canManage?: boolean
  canToggleHighlight?: boolean
  canTogglePublicVisibility?: boolean
  /** True while a change of any photo of the gallery runs. The controls are off then. */
  hasPendingMutation?: boolean
  /** True while this photo is being deleted. */
  isDeleting?: boolean
  /** True while this photo is being hidden or shown again. */
  isTogglingHidden?: boolean
}>(), {
  showUploader: false,
  showCurationBadges: false,
  canManage: false,
  canToggleHighlight: false,
  canTogglePublicVisibility: false,
  hasPendingMutation: false,
  isDeleting: false,
  isTogglingHidden: false
})

const emit = defineEmits<{
  delete: []
  togglePublicVisibility: [value: boolean]
  toggleHighlight: [value: boolean]
  toggleHidden: [value: boolean]
}>()

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
</script>

<template>
  <article
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
          :class="{ 'opacity-50': photo.isHidden }"
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
            v-if="photo.isHidden"
            color="error"
            variant="soft"
            size="sm"
            class="rounded-full"
          >
            Hidden
          </AppBadge>
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
        <!-- Highlights choose the photos of the event team for the curated view. Participant photos are always listed, so they have no highlight switch. -->
        <div
          v-if="canToggleHighlight && !photo.isParticipantUpload"
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
            @update:model-value="emit('toggleHighlight', Boolean($event))"
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

          <!-- A hidden photo cannot be on the public page. The event team shows it again first. -->
          <UiSwitch
            :id="publicVisibilitySwitchId(photo.id)"
            :model-value="photo.isPubliclyVisible"
            :disabled="hasPendingMutation || photo.isHidden === true"
            @update:model-value="emit('togglePublicVisibility', Boolean($event))"
          />
        </div>

        <div
          v-if="canManage"
          class="flex justify-end gap-2"
        >
          <AppButton
            v-if="photo.isParticipantUpload"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="isTogglingHidden"
            :disabled="hasPendingMutation"
            @click.prevent="emit('toggleHidden', !photo.isHidden)"
          >
            {{ photo.isHidden ? 'Show' : 'Hide' }}
          </AppButton>
          <AppButton
            color="error"
            variant="soft"
            size="sm"
            :loading="isDeleting"
            :disabled="hasPendingMutation"
            @click.prevent="emit('delete')"
          >
            Delete
          </AppButton>
        </div>
      </div>
    </div>
  </article>
</template>
