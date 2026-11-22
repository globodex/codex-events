<script setup lang="ts">
// The line that names the photos that are being uploaded to the gallery.
import type { EventGalleryUploadItem } from '~/domains/events/gallery'

const props = defineProps<{
  items: EventGalleryUploadItem[]
}>()

const label = computed(() => props.items.length === 1 ? 'Uploading 1 photo' : `Uploading ${props.items.length} photos`)
</script>

<template>
  <div class="flex items-center gap-2 overflow-hidden rounded-full border border-black/8 bg-black/[0.03] px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.04]">
    <span class="size-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
    <p class="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-highlighted dark:text-white">
      {{ label }}
    </p>
    <div class="min-w-0 flex-1 overflow-x-auto">
      <div class="flex min-w-max items-center gap-2 pr-1">
        <span
          v-for="item in items"
          :key="item.id"
          class="max-w-[11rem] truncate rounded-full bg-white/80 px-2 py-0.5 text-xs text-muted dark:bg-white/[0.08]"
        >
          {{ item.name }}
        </span>
      </div>
    </div>
  </div>
</template>
