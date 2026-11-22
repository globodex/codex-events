<script setup lang="ts">
import { defineRouteRules } from '#app/composables/pages'

import type { PublicApiListResponse, PublicEvent } from '~/domains/events/presentation'
import {
  publicEventCacheControl,
  publicEventCdnCacheControl
} from '#shared/http/public-cache-topology'

import EventCard from '~/components/public/events/EventCard.vue'
import {
  getPublicHomepageEventView,
  getPublicHomepageTabForEvent,
  type PublicHomepageTab
} from '~/domains/events/public-homepage'
import { normalizeTabQueryValue } from '~/lib/query-values'

defineRouteRules({
  cache: {
    maxAge: 30
  }
})

if (import.meta.server) {
  useResponseHeader('cache-control').value = publicEventCacheControl
  useResponseHeader('cloudflare-cdn-cache-control').value = publicEventCdnCacheControl
}

const publicEventsPageSize = 4
const route = useRoute()
const currentPage = ref(1)
const events = ref<PublicEvent[]>([])
const total = ref(0)
const isLoadingMore = ref(false)
const loadMoreError = ref<string>()
const homepageTabs = ['active', 'past'] as const
const requestedTab = computed<PublicHomepageTab | null>(() => {
  const normalizedTab = normalizeTabQueryValue(route.query.tab)

  return normalizedTab && homepageTabs.includes(normalizedTab as PublicHomepageTab)
    ? normalizedTab as PublicHomepageTab
    : null
})

async function selectHomepageTab(nextTab: PublicHomepageTab) {
  if (selectedTab.value === nextTab) {
    return
  }

  await navigateTo({
    path: route.path,
    query: {
      ...route.query,
      tab: nextTab
    },
    hash: route.hash
  })
}

const [
  { data: initialResponse, error: listError },
  { data: pastCountResponse, error: countError }
] = await Promise.all([
  useFetch<PublicApiListResponse<PublicEvent>>('/api/public/events', {
    key: 'public-events-homepage:page-1',
    query: {
      page: 1,
      page_size: publicEventsPageSize
    }
  }),
  useFetch<PublicApiListResponse<PublicEvent>>('/api/public/events', {
    key: 'public-events-homepage:past-count',
    query: {
      page: 1,
      page_size: 1,
      state: 'completed'
    }
  })
])

events.value = initialResponse.value?.data ?? []
total.value = initialResponse.value?.meta?.total ?? events.value.length
const pastTotal = computed(() => pastCountResponse.value?.meta?.total ?? 0)
const error = computed(() => listError.value ?? countError.value)

const hasMoreEvents = computed(() => events.value.length < total.value)
const loadedEventCount = computed(() => events.value.length)
const homepageEventView = computed(() =>
  getPublicHomepageEventView(
    requestedTab.value,
    total.value,
    pastTotal.value,
    loadedEventCount.value
  )
)
const selectedTab = computed<PublicHomepageTab>(() => homepageEventView.value.effectiveTab)
const filteredEvents = computed(() =>
  events.value.filter(event => getPublicHomepageTabForEvent(event) === homepageEventView.value.effectiveTab)
)
const currentFilterTotal = computed(() => {
  if (homepageEventView.value.effectiveTab === 'past') {
    return pastTotal.value
  }

  return homepageEventView.value.activeEventCount
})
const homepageFilters = computed(() => [
  { value: 'active', label: 'Active', count: homepageEventView.value.activeEventCount },
  { value: 'past', label: 'Past', count: pastTotal.value }
] as const)
const canLoadMoreForCurrentFilter = computed(() => {
  if (!hasMoreEvents.value) {
    return false
  }

  return filteredEvents.value.length < currentFilterTotal.value
})
const visibleEventCount = computed(() => filteredEvents.value.length)
const loadMoreSummary = computed(() => {
  return `Showing ${visibleEventCount.value} out of ${currentFilterTotal.value} ${homepageEventView.value.effectiveTab} events.`
})

async function loadMoreEvents() {
  if (isLoadingMore.value || !hasMoreEvents.value) {
    return
  }

  isLoadingMore.value = true
  loadMoreError.value = undefined

  try {
    const nextPage = currentPage.value + 1
    const response = await $fetch<PublicApiListResponse<PublicEvent>>('/api/public/events', {
      query: {
        page: nextPage,
        page_size: publicEventsPageSize
      }
    })

    const nextEvents = response.data.filter(candidate =>
      !events.value.some(existing => existing.slug === candidate.slug)
    )

    events.value = [...events.value, ...nextEvents]
    total.value = response.meta?.total ?? total.value
    currentPage.value = nextPage
  } catch {
    loadMoreError.value = 'More public events could not be loaded right now.'
  } finally {
    isLoadingMore.value = false
  }
}

useSeoMeta({
  title: 'Find a Event | Codex Events',
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
      description="We couldn't load the latest events. Please refresh the page or try again in a moment."
      class="!border !border-black/8 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 text-foreground dark:text-[#ECECEC]"
    />

    <template v-else>
      <div
        v-if="homepageEventView.showFilters"
        class="!border !border-black/8 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 flex flex-col gap-4 rounded-xl p-2"
      >
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <AppFilterButton
            v-for="filter in homepageFilters"
            :key="filter.value"
            :pressed="selectedTab === filter.value"
            :count="filter.count"
            @click="void selectHomepageTab(filter.value)"
          >
            {{ filter.label }}
          </AppFilterButton>
        </div>
      </div>

      <div
        v-if="events.length === 0"
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
        v-else-if="filteredEvents.length === 0"
        class="!border !border-dashed !border-black/10 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 rounded-xl p-10 text-center"
      >
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#8C8C8C]">
          No programs in this view
        </p>
        <p class="mt-3 text-lg font-semibold text-highlighted dark:text-white">
          There are no {{ homepageEventView.effectiveTab }} events in the currently loaded results.
        </p>
      </div>

      <div
        v-else
        class="relative space-y-16 pt-6"
      >
        <div
          v-if="homepageEventView.showTimelineRail"
          class="absolute bottom-0 left-0 top-0 hidden w-1 bg-black/16 dark:bg-white/[0.2] lg:block"
        />
        <EventCard
          v-for="event in filteredEvents"
          :key="event.slug"
          :event="event"
          :show-timeline-rail="homepageEventView.showTimelineRail"
        />
      </div>
    </template>

    <div
      v-if="!error && canLoadMoreForCurrentFilter"
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
        {{ loadMoreSummary }}
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
