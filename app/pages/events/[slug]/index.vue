<script setup lang="ts">
import { defineRouteRules } from '#app/composables/pages'

import type {
  PublicApiListResponse,
  PublicEvent,
  PublicPrize
} from '~/domains/events/presentation'
import {
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

import EventGalleryPanel from '~/components/events/EventGalleryPanel.vue'
import EventStateBadge from '~/components/public/events/EventStateBadge.vue'
import EventPrizeList from '~/components/public/events/EventPrizeList.vue'
import EventOverviewPanel from '~/components/public/events/EventOverviewPanel.vue'
import EventAgendaPanel from '~/components/public/events/EventAgendaPanel.vue'
import EventPublishedProjectsShowcase from '~/components/public/events/EventPublishedProjectsShowcase.vue'
import EventTracksPanel from '~/components/public/events/organisms/EventTracksPanel.vue'
import EventTimeline from '~/components/public/events/EventTimeline.vue'
import EventWinnersShowcase from '~/components/public/events/EventWinnersShowcase.vue'
import EventTalkProposalCallout from '~/components/public/events/EventTalkProposalCallout.vue'
import { resolvePublicEventPrimaryAction, shouldShowPublicRegistrationEntry } from '~/domains/applications/participant-application'
import { isTalkProposalWindowOpen } from '~/domains/talk-proposals'
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

const { data: eventData, error: eventError } = await useApiResponse<PublicEvent>(
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
const isCompetitionEvent = computed(() => event.value.eventType === 'hackathon')
const eventState = computed(() => event.value.state)
const registrationOpen = computed(() => shouldShowPublicRegistrationEntry(
  event.value.state, event.value.registrationOpensAt, event.value.registrationClosesAt
))
const talkProposalWindow = computed(() => {
  const { eventType, talkProposalsEnabled, talkProposalOpensAt, talkProposalClosesAt } = event.value
  if (eventType !== 'meetup' || !talkProposalsEnabled || !talkProposalOpensAt || !talkProposalClosesAt) {
    return null
  }

  return Date.now() <= Date.parse(talkProposalClosesAt)
    ? { opensAt: talkProposalOpensAt, closesAt: talkProposalClosesAt }
    : null
})
const workspaceAccess = usePublicEventWorkspaceAccess(slug, () => !registrationOpen.value || !!talkProposalWindow.value)
const [
  { data: prizesData, error: prizesError, status: prizesStatus },
  { data: winnersData, error: winnersError },
  { data: publishedProjectsData, error: publishedProjectsError },
  { data: galleryPhotosData, error: galleryError, status: galleryStatus }
] = await Promise.all([
  useApiData<PublicPrize[]>(
    () => `public-event-prizes:${slug.value}:${isCompetitionEvent.value ? 'competition' : 'registration'}`,
    async ({ apiFetch, signal }) => {
      if (!isCompetitionEvent.value) {
        return []
      }

      const response = await apiFetch<PublicApiListResponse<PublicPrize>>(`/api/public/events/${slug.value}/prizes`, {
        signal
      })

      return response.data
    },
    {
      cacheScope: 'public',
      default: () => []
    }
  ),
  useApiData<WinnerEntry[]>(
    () => `public-event-winners:${slug.value}:${eventState.value}`,
    async ({ apiFetch, signal }) => {
      if (!isCompetitionEvent.value || eventState.value !== 'completed') {
        return []
      }

      const response = await apiFetch<PublicApiListResponse<WinnerEntry>>(`/api/public/events/${slug.value}/winners`, {
        signal
      })

      return response.data
    },
    {
      cacheScope: 'public',
      default: () => []
    }
  ),
  useApiData<PublishedProjectEntry[]>(
    () => `public-event-published-projects:${slug.value}:${eventState.value}`,
    async ({ apiFetch, signal }) => {
      if (!isCompetitionEvent.value || eventState.value !== 'completed') {
        return []
      }

      const response = await apiFetch<PublicApiListResponse<PublishedProjectEntry>>(
        `/api/public/events/${slug.value}/published-projects`,
        {
          signal
        }
      )

      return response.data
    },
    {
      cacheScope: 'public',
      default: () => []
    }
  ),
  useApiResponse<EventPhotoRecord[]>(() => `public-event-gallery:${slug.value}`, () => `/api/public/events/${slug.value}/photos`, {
    cacheScope: 'public',
    default: () => []
  })
])

const sectionError = computed(() =>
  prizesError.value ?? winnersError.value ?? publishedProjectsError.value ?? galleryError.value
)
if (sectionError.value) {
  throw sectionError.value
}

watch(sectionError, (error) => {
  if (error) showError(error)
})

const prizes = computed(() => prizesData.value)
const winners = computed(() => winnersData.value)
const publishedProjects = computed(() => publishedProjectsData.value)
const galleryPhotos = computed(() => galleryPhotosData.value)
const hasPublishedPrizes = computed(() => isCompetitionEvent.value && prizes.value.length > 0)
const hasPublicGallery = computed(() => galleryPhotos.value.length > 0)
const isWinnerRevealVisible = computed(() => isCompetitionEvent.value && event.value.state === 'completed')
const publicPrizeTabLabel = computed(() => isWinnerRevealVisible.value ? 'Winners' : 'Prizes')

const detailBackgroundImageUrl = computed(() => resolveEventDetailBackgroundImageUrl(event.value))
const detailBackgroundImageStyle = computed(() => detailBackgroundImageUrl.value
  ? { backgroundImage: `url(${JSON.stringify(detailBackgroundImageUrl.value)})` }
  : undefined)
const detailSummary = computed(() => formatEventHeaderSummary(event.value))
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
  if (isTalkProposalWindowOpen(event.value.talkProposalOpensAt ?? null, event.value.talkProposalClosesAt ?? null)) {
    return { label: 'Propose a talk', to: `${primaryAction.value.to}?intent=talk-proposal` }
  }
  return primaryAction.value
})
const publicSectionTabs = ['overview', 'prizes', 'gallery'] as const
type PublicSectionTab = (typeof publicSectionTabs)[number]
const activePublicSection = computed<PublicSectionTab>(() =>
  resolveTabQueryValue(route.query.tab, publicSectionTabs, 'overview')
)

const visiblePublicTabs = computed(() => ([
  { id: 'overview', label: 'Overview', visible: true },
  { id: 'prizes', label: publicPrizeTabLabel.value, visible: hasPublishedPrizes.value || isWinnerRevealVisible.value },
  { id: 'gallery', label: 'Gallery', visible: hasPublicGallery.value }
] satisfies { id: PublicSectionTab, label: string, visible: boolean }[]).filter(tab => tab.visible))
// An event without prizes and public photos has only the Overview, so the page shows no tab bar.
const showPublicTabs = computed(() => visiblePublicTabs.value.length > 1)

async function selectPublicSection(nextSection: PublicSectionTab) {
  if (normalizeTabQueryValue(route.query.tab) === nextSection) {
    return
  }

  await navigateTo({
    path: route.path,
    query: {
      ...route.query,
      tab: nextSection
    },
    hash: route.hash
  })
}

watchEffect(() => {
  if (activePublicSection.value !== 'prizes' || prizesStatus.value !== 'success' || hasPublishedPrizes.value || isWinnerRevealVisible.value) {
    return
  }

  void navigateTo({
    path: route.path,
    query: {
      ...route.query,
      tab: 'overview'
    },
    hash: route.hash
  }, { replace: true })
})

watchEffect(() => {
  if (activePublicSection.value !== 'gallery' || galleryStatus.value !== 'success' || hasPublicGallery.value) {
    return
  }

  void navigateTo({
    path: route.path,
    query: {
      ...route.query,
      tab: 'overview'
    },
    hash: route.hash
  }, { replace: true })
})

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

            <p class="text-[15px] text-neutral-700 dark:text-[#A3A3A3]">
              {{ detailSummary }}
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
            v-if="showPublicTabs"
            aria-label="Event detail sections"
            role="tablist"
            class="flex items-center gap-5 overflow-x-auto"
          >
            <AppSectionTab
              v-for="tab in visiblePublicTabs"
              :id="`public-tab-${tab.id}`"
              :key="tab.id"
              :selected="activePublicSection === tab.id"
              :aria-controls="`public-tab-panel-${tab.id}`"
              @click="void selectPublicSection(tab.id)"
            >
              {{ tab.label }}
            </AppSectionTab>
          </nav>
        </div>
      </AppContainer>
    </section>

    <AppContainer class="relative z-10 max-w-[68rem] pt-6">
      <section
        v-if="activePublicSection === 'overview'"
        id="public-tab-panel-overview"
        :role="showPublicTabs ? 'tabpanel' : undefined"
        :aria-labelledby="showPublicTabs ? 'public-tab-overview' : undefined"
        class="space-y-7"
      >
        <EventTalkProposalCallout
          v-if="talkProposalWindow"
          :opens-at="talkProposalWindow.opensAt"
          :closes-at="talkProposalWindow.closesAt"
          :action-href="talkProposalAction?.to"
          :action-label="talkProposalAction?.label"
        />

        <EventOverviewPanel :description="event.description" />

        <EventTimeline :event="event" />

        <EventTracksPanel
          :event-type="event.eventType"
          :tracks="event.tracks ?? []"
        />

        <EventAgendaPanel
          :agenda-items="event.agendaItems"
          :public-sessions="event.publicSessions"
        />
      </section>

      <section
        v-else-if="(hasPublishedPrizes || isWinnerRevealVisible) && activePublicSection === 'prizes'"
        id="public-tab-panel-prizes"
        role="tabpanel"
        aria-labelledby="public-tab-prizes"
      >
        <template v-if="isWinnerRevealVisible">
          <EventWinnersShowcase :winners="winners" />

          <EventPublishedProjectsShowcase
            v-if="publishedProjects.length > 0"
            class="mt-8"
            :projects="publishedProjects"
          />
        </template>

        <EventPrizeList
          v-else
          :prizes="prizes"
        />
      </section>

      <section
        v-else-if="activePublicSection === 'gallery' && galleryStatus === 'success'"
        id="public-tab-panel-gallery"
        role="tabpanel"
        aria-labelledby="public-tab-gallery"
      >
        <EventGalleryPanel
          :description="`Browse selected gallery photos from ${event.name}. Open any image to view it at full size.`"
          :photos="galleryPhotos"
          empty-state-title="No gallery photos yet"
          empty-state-description="Public gallery photos will appear here once the event team selects them."
        />
      </section>
    </AppContainer>
  </div>
</template>
