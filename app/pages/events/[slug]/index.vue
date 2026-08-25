<script setup lang="ts">
import { defineRouteRules } from '#app/composables/pages'

import type {
  PublicApiListResponse,
  PublicEvent,
  PublicPrize
} from '~/domains/events/presentation'
import {
  formatEventDateWithWeekday,
  formatEventLocation,
  formatEventTypeLabel,
  getEventEarliestStartAt,
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
import EventTracksPanel from '~/components/public/events/EventTracksPanel.vue'
import EventTimeline from '~/components/public/events/EventTimeline.vue'
import EventWinnersShowcase from '~/components/public/events/EventWinnersShowcase.vue'
import EventTalkProposalCallout from '~/components/public/events/EventTalkProposalCallout.vue'
import { resolvePublicEventPrimaryAction } from '~/domains/applications/participant-application'
import { isTalkProposalWindowOpen } from '~/domains/talk-proposals'
import { usePublicEventWorkspaceAccess } from '~/composables/usePublicEventWorkspaceAccess'
import { normalizeTabQueryValue, resolveTabQueryValue } from '~/lib/query-values'
import type { WebMcpTool } from '~/composables/useWebMcpTool'
import { useWebMcpTool } from '~/composables/useWebMcpTool'

definePageMeta({
  layout: 'public'
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
    cacheScope: 'public',
    watch: [slug, includeFullTrackDetails]
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
const {
  actor: accountActor,
  hasEventWorkspaceAccess
} = usePublicEventWorkspaceAccess(slug)
const { data: prizesData } = await useApiData<PublicPrize[]>(
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
    default: () => [],
    watch: [slug, isCompetitionEvent]
  }
)
const [
  { data: winnersData, error: winnersError },
  { data: publishedProjectsData, error: publishedProjectsError },
  { data: galleryPhotosData, error: galleryError }
] = await Promise.all([
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
      default: () => [],
      watch: [slug, eventState]
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
      default: () => [],
      watch: [slug, eventState]
    }
  ),
  useApiResponse<EventPhotoRecord[]>(() => `public-event-gallery:${slug.value}`, () => `/api/public/events/${slug.value}/photos`, {
    cacheScope: 'public',
    default: () => [],
    watch: [slug]
  })
])

if (winnersError.value) {
  throw winnersError.value
}

if (publishedProjectsError.value) {
  throw publishedProjectsError.value
}

if (galleryError.value) {
  throw galleryError.value
}

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
const detailSummary = computed(() => [
  formatEventDateWithWeekday(getEventEarliestStartAt(event.value)),
  formatEventLocation(event.value)
].filter(Boolean).join(' - '))
const eventTypeLabel = computed(() => formatEventTypeLabel(event.value.eventType))
const primaryAction = computed(() =>
  resolvePublicEventPrimaryAction({
    actorKind: accountActor.value.kind,
    hasAcceptedCurrentPlatformDocuments: accountActor.value.hasAcceptedCurrentPlatformDocuments,
    eventSlug: slug.value,
    eventState: event.value.state,
    registrationOpensAt: event.value.registrationOpensAt,
    registrationClosesAt: event.value.registrationClosesAt,
    hasEventWorkspaceAccess: hasEventWorkspaceAccess.value
  })
)
const showPrimaryAction = computed(() => Boolean(primaryAction.value))
const primaryActionHref = computed(() => primaryAction.value?.to ?? '')
const isPrimaryActionExternal = computed(() => primaryAction.value?.external ?? false)
const primaryActionLabel = computed(() => primaryAction.value?.label ?? '')
const talkProposalWorkspaceHref = computed(() => `/account/events/${slug.value}?tab=call-for-talks`)
const talkProposalIsOpen = computed(() => isTalkProposalWindowOpen(
  event.value.talkProposalOpensAt ?? null,
  event.value.talkProposalClosesAt ?? null
))
const talkProposalRegistrationAction = computed(() => resolvePublicEventPrimaryAction({
  actorKind: accountActor.value.kind,
  hasAcceptedCurrentPlatformDocuments: accountActor.value.hasAcceptedCurrentPlatformDocuments,
  eventSlug: slug.value,
  eventState: event.value.state,
  registrationOpensAt: event.value.registrationOpensAt,
  registrationClosesAt: event.value.registrationClosesAt,
  hasEventWorkspaceAccess: hasEventWorkspaceAccess.value,
  registrationIntent: 'talk-proposal'
}))
const talkProposalAction = computed(() => hasEventWorkspaceAccess.value
  ? { label: 'Open Talk proposal', to: talkProposalWorkspaceHref.value, external: false }
  : talkProposalIsOpen.value && talkProposalRegistrationAction.value
    ? { ...talkProposalRegistrationAction.value, label: 'Propose a talk' }
    : primaryAction.value
)
const publicSectionTabs = ['overview', 'prizes', 'details', 'gallery'] as const
type PublicSectionTab = (typeof publicSectionTabs)[number]
const activePublicSection = computed<PublicSectionTab>(() =>
  resolveTabQueryValue(route.query.tab, publicSectionTabs, 'overview')
)

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
  if (activePublicSection.value !== 'prizes' || hasPublishedPrizes.value || isWinnerRevealVisible.value) {
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
  if (activePublicSection.value !== 'gallery' || hasPublicGallery.value) {
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
                v-if="showPrimaryAction"
                class="shrink-0 pt-0.5"
              >
                <AppButton
                  data-testid="public-event-primary-action"
                  :to="primaryActionHref"
                  :external="isPrimaryActionExternal"
                  color="neutral"
                  variant="solid"
                  class="h-auto rounded-lg bg-black px-4 py-2 text-[13px] font-medium text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
                >
                  {{ primaryActionLabel }}
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
          </div>

          <nav
            aria-label="Event detail sections"
            role="tablist"
            class="flex items-center gap-5 overflow-x-auto"
          >
            <button
              id="public-tab-overview"
              type="button"
              role="tab"
              :aria-selected="activePublicSection === 'overview'"
              aria-controls="public-tab-panel-overview"
              class="border-b-2 pb-3 text-[14px] font-medium transition-colors"
              :class="activePublicSection === 'overview' ? 'border-black text-highlighted dark:border-white dark:text-white' : 'border-transparent text-neutral-500 hover:text-highlighted dark:text-[#A3A3A3] dark:hover:text-white'"
              @click="void selectPublicSection('overview')"
            >
              Overview
            </button>
            <button
              v-if="hasPublishedPrizes || isWinnerRevealVisible"
              id="public-tab-prizes"
              type="button"
              role="tab"
              :aria-selected="activePublicSection === 'prizes'"
              aria-controls="public-tab-panel-prizes"
              class="border-b-2 pb-3 text-[14px] font-medium transition-colors"
              :class="activePublicSection === 'prizes' ? 'border-black text-highlighted dark:border-white dark:text-white' : 'border-transparent text-neutral-500 hover:text-highlighted dark:text-[#A3A3A3] dark:hover:text-white'"
              @click="void selectPublicSection('prizes')"
            >
              {{ publicPrizeTabLabel }}
            </button>
            <button
              id="public-tab-details"
              type="button"
              role="tab"
              :aria-selected="activePublicSection === 'details'"
              aria-controls="public-tab-panel-details"
              class="border-b-2 pb-3 text-[14px] font-medium transition-colors"
              :class="activePublicSection === 'details' ? 'border-black text-highlighted dark:border-white dark:text-white' : 'border-transparent text-neutral-500 hover:text-highlighted dark:text-[#A3A3A3] dark:hover:text-white'"
              @click="void selectPublicSection('details')"
            >
              Details
            </button>
            <button
              v-if="hasPublicGallery"
              id="public-tab-gallery"
              type="button"
              role="tab"
              :aria-selected="activePublicSection === 'gallery'"
              aria-controls="public-tab-panel-gallery"
              class="border-b-2 pb-3 text-[14px] font-medium transition-colors"
              :class="activePublicSection === 'gallery' ? 'border-black text-highlighted dark:border-white dark:text-white' : 'border-transparent text-neutral-500 hover:text-highlighted dark:text-[#A3A3A3] dark:hover:text-white'"
              @click="void selectPublicSection('gallery')"
            >
              Gallery
            </button>
          </nav>
        </div>
      </AppContainer>
    </section>

    <AppContainer class="relative z-10 max-w-[68rem] pt-6">
      <section
        v-if="activePublicSection === 'overview'"
        id="public-tab-panel-overview"
        role="tabpanel"
        aria-labelledby="public-tab-overview"
        class="space-y-7"
      >
        <EventTalkProposalCallout
          v-if="event.eventType === 'meetup' && event.talkProposalsEnabled && event.talkProposalOpensAt && event.talkProposalClosesAt"
          :opens-at="event.talkProposalOpensAt"
          :closes-at="event.talkProposalClosesAt"
          :action-href="talkProposalAction?.to"
          :action-label="talkProposalAction?.label"
          :action-external="talkProposalAction?.external"
        />

        <EventOverviewPanel :description="event.description" />
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
        v-else-if="activePublicSection === 'details'"
        id="public-tab-panel-details"
        role="tabpanel"
        aria-labelledby="public-tab-details"
        class="space-y-7"
      >
        <EventTimeline
          :event="event"
        />

        <EventTracksPanel
          :event-type="event.eventType"
          :tracks="event.tracks ?? []"
        />

        <EventAgendaPanel :agenda-items="event.agendaItems" />
      </section>

      <section
        v-else
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
