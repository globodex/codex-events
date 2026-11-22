<script setup lang="ts">
import type { PublicEventTrackResource } from '~/domains/events/presentation'

type TrackResource = PublicEventTrackResource & { id?: string }

const props = withDefaults(defineProps<{
  description?: string | null
  resources?: readonly TrackResource[]
  /** Draws a line between these details and the content above them. */
  separated?: boolean
}>(), {
  separated: true
})

const hasDescription = computed(() => Boolean(props.description?.trim()))
const sortedResources = computed(() => [...(props.resources ?? [])].sort((left, right) =>
  left.displayOrder - right.displayOrder || left.title.localeCompare(right.title)
))
const describedResources = computed(() => sortedResources.value.filter(resource => resource.description))

function resourceKey(resource: TrackResource) {
  return resource.id ?? `${resource.displayOrder}-${resource.title}-${resource.url}`
}
</script>

<template>
  <div
    v-if="hasDescription || sortedResources.length > 0 || $slots.default"
    class="space-y-5"
    :class="props.separated ? 'mt-5 border-t border-black/8 pt-5 dark:border-white/[0.08]' : 'mt-3'"
  >
    <LazyAppMarkdownRenderer
      v-if="hasDescription"
      hydrate-never
      :source="props.description"
      class="max-w-[72ch]"
    />

    <div
      v-if="sortedResources.length > 0"
      class="grid gap-3"
    >
      <p class="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        Resources
      </p>

      <div class="flex flex-wrap gap-2">
        <a
          v-for="resource in sortedResources"
          :key="resourceKey(resource)"
          :href="resource.url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex max-w-full items-center gap-2 rounded-lg border border-black/8 bg-white/78 px-3 py-2 text-[13px] font-medium text-highlighted transition hover:border-sky-500/40 hover:text-sky-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:hover:border-sky-300/35 dark:hover:text-sky-200"
        >
          <AppIcon
            name="i-lucide-link"
            class="size-3.5 shrink-0 text-sky-700 dark:text-sky-300"
          />
          <span class="min-w-0 truncate">{{ resource.title }}</span>
          <AppIcon
            name="i-lucide-external-link"
            class="size-3 shrink-0 text-neutral-500 dark:text-[#A3A3A3]"
          />
        </a>
      </div>

      <div
        v-if="describedResources.length > 0"
        class="grid gap-2"
      >
        <p
          v-for="resource in describedResources"
          :key="resourceKey(resource)"
          class="text-[13px] leading-relaxed text-neutral-500 dark:text-[#A3A3A3]"
        >
          <span class="font-medium text-toned">{{ resource.title }}:</span>
          {{ resource.description }}
        </p>
      </div>
    </div>

    <slot />
  </div>
</template>
