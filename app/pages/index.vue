<script setup lang="ts">
import { defineRouteRules } from '#app/composables/pages'

import type { DiscoveryTab, PublicDiscoveryPage } from '#shared/domains/events/public-discovery'
import {
  publicEventCacheControl,
  publicEventCdnCacheControl
} from '#shared/http/public-cache-topology'

import EventCard from '~/components/public/events/EventCard.vue'
import { normalizeTabQueryValue } from '~/lib/query-values'

definePageMeta({ key: route => normalizeTabQueryValue(route.query.tab) ?? 'default' })

defineRouteRules({
  cache: {
    maxAge: 30
  }
})

if (import.meta.server) {
  useResponseHeader('cache-control').value = publicEventCacheControl
  useResponseHeader('cloudflare-cdn-cache-control').value = publicEventCdnCacheControl
}

const route = useRoute()
const router = useRouter()
const tabParam = normalizeTabQueryValue(route.query.tab)
const requestedTab = tabParam === 'active' || tabParam === 'past' ? tabParam : undefined

function fetchDiscovery(page: number, tab?: DiscoveryTab, signal?: AbortSignal) {
  return $fetch<{ data: PublicDiscoveryPage }>('/api/public/discovery', { query: { page, tab }, signal })
    .then(response => response.data)
}

const { data: discovery, error, refresh } = await useAsyncData(
  `public-discovery:${requestedTab ?? 'default'}`,
  (_nuxtApp, { signal }) => fetchDiscovery(1, requestedTab, signal)
)
const totalEvents = computed(() => discovery.value ? discovery.value.counts.active + discovery.value.counts.past : 0)
const tabTotal = computed(() => discovery.value?.counts[discovery.value.tab] ?? 0)
const tabs = ['active', 'past'] as const
const isLoadingMore = ref(false)
const loadMoreError = ref('')
const requests = useAbortableRequest()

async function loadMoreEvents() {
  const current = discovery.value
  if (!current?.nextPage || isLoadingMore.value) return

  const signal = requests.createSignal('load-more')
  loadMoreError.value = ''
  isLoadingMore.value = true
  try {
    const next = await fetchDiscovery(current.nextPage, current.tab, signal)
    if (signal.aborted) return

    const previousSlugs = new Set(current.events.map(event => event.slug))
    discovery.value = {
      ...next,
      events: [...current.events, ...next.events.filter(event => !previousSlugs.has(event.slug))]
    }
  } catch {
    if (!signal.aborted) loadMoreError.value = 'More public events could not be loaded right now.'
  } finally {
    isLoadingMore.value = false
  }
}

useSeoMeta({
  title: 'Find an Event | Codex Events',
  description: 'Browse current and past Codex community events and find the ones you want to join.'
})
</script>

<template>
  <div class="mx-auto max-w-[1000px] space-y-8 px-4 pb-24 pt-4 text-foreground sm:px-6 lg:px-8">
    <section class="space-y-5">
      <div class="flex flex-col gap-4">
        <div class="space-y-3">
          <h1 class="text-[28px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
            Events
          </h1>
          <p class="max-w-3xl text-[15px] text-neutral-700 dark:text-[#A3A3A3]">
            Discover and join event programs running across the Codex community.
          </p>
        </div>
      </div>
    </section>

    <AppAlert
      v-if="error"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Events are temporarily unavailable"
      :retry="refresh"
      class="!border !border-black/8 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 text-foreground dark:text-[#ECECEC]"
    />

    <template v-else-if="discovery">
      <div
        v-if="totalEvents !== 1"
        class="!border !border-black/8 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 flex flex-col gap-4 rounded-xl p-2"
      >
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <AppFilterButton
            v-for="tab in tabs"
            :key="tab"
            :pressed="discovery.tab === tab"
            :count="discovery.counts[tab]"
            :to="router.resolve({ path: route.path, query: { ...route.query, tab }, hash: route.hash }).fullPath"
          >
            {{ tab === 'active' ? 'Active' : 'Past' }}
          </AppFilterButton>
        </div>
      </div>

      <div
        v-if="totalEvents === 0"
        class="!border !border-dashed !border-black/10 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 rounded-xl p-10 text-center"
      >
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#8C8C8C]">
          0 events configured
        </p>
        <p class="mt-3 text-lg font-semibold text-highlighted dark:text-white">
          There are currently no public events configured. Check again later.
        </p>
      </div>

      <div
        v-else-if="tabTotal === 0"
        class="!border !border-dashed !border-black/10 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 rounded-xl p-10 text-center"
      >
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#8C8C8C]">
          No programs in this view
        </p>
        <p class="mt-3 text-lg font-semibold text-highlighted dark:text-white">
          There are no {{ discovery.tab }} events.
        </p>
      </div>

      <div
        v-else
        class="relative space-y-16 pt-6"
      >
        <div
          v-if="tabTotal > 1"
          class="absolute bottom-0 left-0 top-0 hidden w-1 bg-black/16 dark:bg-white/[0.2] lg:block"
        />
        <EventCard
          v-for="(event, index) in discovery.events"
          :key="event.slug"
          :event="event"
          :show-timeline-rail="tabTotal > 1"
          :loading="index === 0 ? 'eager' : 'lazy'"
        />
      </div>
    </template>

    <div
      v-if="discovery?.nextPage"
      class="flex flex-col items-center gap-4 pt-2"
    >
      <AppButton
        color="neutral"
        variant="solid"
        :loading="isLoadingMore"
        data-testid="public-events-load-more"
        class="border border-black/8 bg-default/92 text-highlighted hover:bg-default dark:border-white/[0.08] dark:bg-default/92 dark:text-white dark:hover:bg-elevated/92"
        @click="loadMoreEvents"
      >
        Load more events
      </AppButton>

      <p class="text-sm text-neutral-500 dark:text-[#8C8C8C]">
        Showing {{ discovery.events.length }} out of {{ tabTotal }} {{ discovery.tab }} events.
      </p>
    </div>

    <AppAlert
      v-if="loadMoreError"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="More events unavailable"
      :description="loadMoreError"
      class="!border !border-black/8 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 text-foreground dark:text-[#ECECEC]"
    />
  </div>
</template>
