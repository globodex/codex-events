<script setup lang="ts">
import {
  LazyEventsEventGalleryPanel as EventGalleryPanel,
  LazyPublicEventsEventOverviewSection as EventOverviewSection,
  LazyPublicEventsEventPrizeList as EventPrizeList,
  LazyPublicEventsEventPublishedProjectsShowcase as EventPublishedProjectsShowcase,
  LazyPublicEventsEventWinnersShowcase as EventWinnersShowcase
} from '#components'
import { defineRouteRules } from '#app/composables/pages'

import type {
  PublicApiListResponse,
  PublicEvent,
  PublicPrize
} from '~/domains/events/presentation'
import {
  describeRegistrationDeadline,
  formatEventHeaderSummary,
  formatEventTypeLabel,
  resolveEventDetailBackgroundImageUrl
} from '~/domains/events/presentation'
import type { EventPhotoRecord } from '#shared/domains/events/photos'
import {
  publicEventCacheControl,
  publicEventCdnCacheControl
} from '#shared/http/public-cache-topology'
import type {
  PublishedProjectEntry,
  WinnerEntry
} from '~/domains/outcomes/published-outcomes'

import EventStateBadge from '~/components/public/events/EventStateBadge.vue'
import { resolvePublicEventPrimaryAction, shouldShowPublicRegistrationEntry } from '~/domains/applications/participant-application'
import { isTalkProposalWindowOpen } from '#shared/domains/talk-proposals/window'
import { usePublicEventWorkspaceAccess } from '~/composables/usePublicEventWorkspaceAccess'
import { normalizeTabQueryValue, resolveTabQueryValue } from '~/lib/query-values'
import type { WebMcpTool } from '~/composables/useWebMcpTool'
import { useWebMcpTool } from '~/composables/useWebMcpTool'

definePageMeta({
  layout: 'public',
  key: route => `${route.path}:${normalizeTabQueryValue(route.query.tracks) === 'full' ? 'full' : 'short'}`
})

defineRouteRules({
  cache: {
    maxAge: 30
  }
})

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? '').trim())
const includeFullTrackDetails = computed(() => normalizeTabQueryValue(route.query.tracks) === 'full')
const publicEventDetailPath = computed(() =>
  `/api/public/events/${slug.value}${includeFullTrackDetails.value ? '?tracks=full' : ''}`
)
if (!slug.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Event not found.'
  })
}

interface PublicEventDetail extends PublicEvent {
  hasPublicGallery: boolean
  hasPrizeTab: boolean
}

const { data: eventData, error: eventError } = await useApiResponse<PublicEventDetail>(
  () => `public-event-detail:${slug.value}:${includeFullTrackDetails.value ? 'full-tracks' : 'short-tracks'}`,
  () => publicEventDetailPath.value,
  {
    cacheScope: 'public'
  }
)

if (eventError.value) {
  throw createError({
    statusCode: eventError.value.statusCode ?? eventError.value.status ?? 500,
    statusMessage: eventError.value.statusMessage ?? 'Unable to load the requested event.'
  })
}

if (!eventData.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Event not found.'
  })
}

if (import.meta.server) {
  useResponseHeader('cache-control').value = publicEventCacheControl
  useResponseHeader('cloudflare-cdn-cache-control').value = publicEventCdnCacheControl
}

const event = computed(() => eventData.value!)
const eventDetailsWebMcpTool = computed<WebMcpTool>(() => ({
  name: 'get_event_details',
  title: 'Get event details',
  description: 'Read the canonical public event details currently loaded on this Codex Events page. This tool does not change data.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: true
  },
  execute: async () => event.value
}))
useWebMcpTool(eventDetailsWebMcpTool)

type PublicSection = 'overview' | 'prizes' | 'gallery'
const visibleTabs = computed(() => {
  const tabs: { id: PublicSection, label: string }[] = [{ id: 'overview', label: 'Overview' }]
  if (event.value.hasPrizeTab) tabs.push({ id: 'prizes', label: event.value.state === 'completed' ? 'Winners' : 'Prizes' })
  if (event.value.hasPublicGallery) tabs.push({ id: 'gallery', label: 'Gallery' })
  return tabs
})
const requestedSection = computed(() => resolveTabQueryValue(route.query.tab, ['overview', 'prizes', 'gallery'] as const, 'overview'))
const activeTab = computed(() => visibleTabs.value.find(tab => tab.id === requestedSection.value) ?? visibleTabs.value[0]!)

function tabLocation(tab: PublicSection) {
  return { path: route.path, query: { ...route.query, tab }, hash: route.hash }
}

watchEffect(() => {
  if (activeTab.value.id !== requestedSection.value) void navigateTo(tabLocation('overview'), { replace: true })
})

const isCompetitionEvent = computed(() => event.value.eventType === 'hackathon')
const now = useEventDeadlineClock(() => [
  event.value.registrationOpensAt, event.value.registrationClosesAt,
  event.value.talkProposalOpensAt, event.value.talkProposalClosesAt
])
const registrationOpen = computed(() => shouldShowPublicRegistrationEntry(
  event.value.state, event.value.registrationOpensAt, event.value.registrationClosesAt, now.value
))
const talkProposalWindow = computed(() => {
  const { eventType, talkProposalsEnabled, talkProposalOpensAt, talkProposalClosesAt } = event.value
  if (eventType !== 'meetup' || !talkProposalsEnabled || !talkProposalOpensAt || !talkProposalClosesAt
    || now.value.getTime() > Date.parse(talkProposalClosesAt)) {
    return null
  }

  return {
    opensAt: talkProposalOpensAt,
    closesAt: talkProposalClosesAt,
    isOpen: isTalkProposalWindowOpen(talkProposalOpensAt, talkProposalClosesAt, now.value.getTime())
  }
})
const workspaceAccess = usePublicEventWorkspaceAccess(slug, () =>
  !registrationOpen.value || (activeTab.value.id === 'overview' && !!talkProposalWindow.value)
)
const detailBackgroundImageUrl = computed(() => resolveEventDetailBackgroundImageUrl(event.value))
const detailBackgroundImageStyle = computed(() => detailBackgroundImageUrl.value
  ? { backgroundImage: `url(${JSON.stringify(detailBackgroundImageUrl.value)})` }
  : undefined)
const detailSummary = computed(() => formatEventHeaderSummary(event.value))
// While registration is the current state of the event, the header names its next deadline.
const registrationDeadline = computed(() => event.value.state === 'registration_open'
  ? describeRegistrationDeadline(event.value.registrationOpensAt, event.value.registrationClosesAt, now.value)
  : null)
const lumaEventUrl = computed(() => event.value.lumaEventUrl?.trim() || null)
const eventTypeLabel = computed(() => formatEventTypeLabel(event.value.eventType))
const primaryAction = computed(() =>
  resolvePublicEventPrimaryAction({
    eventSlug: slug.value,
    registrationOpen: registrationOpen.value,
    hasEventWorkspaceAccess: workspaceAccess.value === 'granted'
  })
)
const talkProposalAction = computed(() => {
  if (workspaceAccess.value === 'granted') {
    return { label: 'Open Talk proposal', to: `/account/events/${slug.value}?tab=call-for-talks` }
  }
  if (workspaceAccess.value !== 'denied' || !primaryAction.value) {
    return null
  }
  if (talkProposalWindow.value?.isOpen) {
    return { label: 'Propose a talk', to: `${primaryAction.value.to}?intent=talk-proposal` }
  }
  return primaryAction.value
})

const { data: section, status: sectionStatus, refresh: retrySection } = await useApiData(
  () => `public-event-section:${slug.value}:${activeTab.value.id}:${event.value.state}`,
  async ({ apiFetch, signal }) => {
    const base = `/api/public/events/${slug.value}`
    if (activeTab.value.id === 'overview') return { kind: 'overview' } as const
    if (activeTab.value.id === 'gallery') {
      const { data: photos } = await apiFetch<PublicApiListResponse<EventPhotoRecord>>(`${base}/photos`, { signal })
      return { kind: 'gallery', photos } as const
    }
    if (event.value.state === 'completed') {
      const [winners, projects] = await Promise.all([
        apiFetch<PublicApiListResponse<WinnerEntry>>(`${base}/winners`, { signal }),
        apiFetch<PublicApiListResponse<PublishedProjectEntry>>(`${base}/published-projects`, { signal })
      ])
      return { kind: 'winners', winners: winners.data, projects: projects.data } as const
    }
    const { data: prizes } = await apiFetch<PublicApiListResponse<PublicPrize>>(`${base}/prizes`, { signal })
    return { kind: 'prizes', prizes } as const
  },
  { cacheScope: 'public' }
)

useSeoMeta({
  title: () => `${event.value.name} | Codex Events`,
  description: () => isCompetitionEvent.value
    ? `See the schedule, location, prizes, and application details for ${event.value.name}.`
    : `See the schedule, location, and application details for ${event.value.name}.`
})
</script>

<template>
  <div class="relative isolate pb-24">
    <div
      v-if="detailBackgroundImageUrl"
      class="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        class="absolute inset-0 scale-110 bg-cover bg-center bg-no-repeat opacity-55 blur-md saturate-125 contrast-105"
        :style="detailBackgroundImageStyle"
      />
      <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-black/45 to-black/68 dark:from-black/35 dark:via-black/55 dark:to-black/76" />
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.22),transparent_46%)] dark:bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.10),transparent_48%)]" />
    </div>

    <section class="relative z-10 border-b border-black/8 bg-white/52 backdrop-blur-lg dark:border-white/[0.08] dark:bg-black/56">
      <AppContainer class="max-w-[68rem] pb-0 pt-2 sm:pt-3">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 text-[13px] font-medium text-neutral-600 transition-colors hover:text-highlighted dark:text-[#A3A3A3] dark:hover:text-white"
        >
          <AppIcon
            name="i-lucide-arrow-left"
            class="size-4"
          />
          Back to events
        </NuxtLink>

        <div class="mt-3 border-b border-black/8 pb-0 dark:border-white/[0.08]">
          <div class="space-y-2 pb-4">
            <div class="flex items-start justify-between gap-6">
              <div class="min-w-0 flex flex-wrap items-center gap-3">
                <h1
                  data-testid="public-event-detail-title"
                  class="text-[28px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white"
                >
                  {{ event.name }}
                </h1>
                <EventStateBadge
                  :state="event.state"
                  :registration-opens-at="event.registrationOpensAt"
                  :registration-closes-at="event.registrationClosesAt"
                />
                <AppBadge
                  color="neutral"
                  variant="subtle"
                  class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
                  data-testid="public-event-detail-type"
                >
                  {{ eventTypeLabel }}
                </AppBadge>
              </div>

              <div
                v-if="primaryAction"
                class="shrink-0 pt-0.5"
              >
                <AppButton
                  data-testid="public-event-primary-action"
                  :to="primaryAction.to"
                  color="neutral"
                  variant="solid"
                  class="h-auto rounded-lg bg-black px-4 py-2 text-[13px] font-medium text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
                >
                  {{ primaryAction.label }}
                  <template #trailing>
                    <AppIcon
                      name="i-lucide-arrow-up-right"
                      class="size-3.5"
                    />
                  </template>
                </AppButton>
              </div>
            </div>

            <p
              data-testid="public-event-detail-summary"
              class="text-[15px] text-neutral-700 dark:text-[#A3A3A3]"
            >
              {{ detailSummary }}<template v-if="registrationDeadline">
                · {{ registrationDeadline }}
              </template><template v-if="lumaEventUrl">
                ·
                <a
                  :href="lumaEventUrl"
                  target="_blank"
                  rel="noreferrer"
                  class="font-medium text-highlighted underline-offset-4 hover:underline dark:text-white"
                >Luma event</a>
              </template>
            </p>
            <p
              v-if="workspaceAccess === 'error'"
              role="status"
              class="text-sm text-muted"
            >
              We couldn’t check your access to this event.
            </p>
          </div>

          <nav
            v-if="visibleTabs.length > 1"
            aria-label="Event detail sections"
            role="tablist"
            class="flex items-center gap-5 overflow-x-auto"
          >
            <AppSectionTab
              v-for="tab in visibleTabs"
              :id="`public-tab-${tab.id}`"
              :key="tab.id"
              :selected="activeTab.id === tab.id"
              :aria-controls="`public-tab-panel-${tab.id}`"
              :to="tabLocation(tab.id)"
            >
              {{ tab.label }}
            </AppSectionTab>
          </nav>
        </div>
      </AppContainer>
    </section>

    <AppContainer class="relative z-10 max-w-[68rem] pt-6">
      <EventOverviewSection
        v-if="activeTab.id === 'overview'"
        id="public-tab-panel-overview"
        :role="visibleTabs.length > 1 ? 'tabpanel' : undefined"
        :aria-labelledby="visibleTabs.length > 1 ? 'public-tab-overview' : undefined"
        :event="event"
        :talk-proposal-window="talkProposalWindow"
        :talk-proposal-action="talkProposalAction"
      />

      <section
        v-else
        :id="`public-tab-panel-${activeTab.id}`"
        role="tabpanel"
        :aria-labelledby="`public-tab-${activeTab.id}`"
      >
        <AppAlert
          v-if="sectionStatus === 'error'"
          color="error"
          :title="`Unable to load ${activeTab.label.toLowerCase()}`"
          :retry="retrySection"
        />
        <p
          v-else-if="sectionStatus !== 'success'"
          role="status"
        >
          Loading {{ activeTab.label.toLowerCase() }}…
        </p>
        <template v-else-if="section?.kind === 'winners'">
          <EventWinnersShowcase :winners="section.winners" />
          <EventPublishedProjectsShowcase
            v-if="section.projects.length"
            class="mt-8"
            :projects="section.projects"
          />
        </template>
        <EventPrizeList
          v-else-if="section?.kind === 'prizes'"
          :prizes="section.prizes"
        />
        <EventGalleryPanel
          v-else-if="section?.kind === 'gallery'"
          :description="`Browse selected gallery photos from ${event.name}. Open any image to view it at full size.`"
          :photos="section.photos"
          empty-state-title="No gallery photos yet"
          empty-state-description="Public gallery photos will appear here once the event team selects them."
        />
      </section>
    </AppContainer>
  </div>
</template>
