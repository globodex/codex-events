<script setup lang="ts">
import {
  formatEventHeaderSummary,
  resolveEventDetailBackgroundImageUrl,
  type PublicEvent
} from '~/domains/events/presentation'
import type {
  ParticipantApiDataResponse,
  ParticipantCurrentTermsResponse,
  VisibleEventRecord
} from '~/domains/applications/participant-application'

import EventStateBadge from '~/components/public/events/EventStateBadge.vue'
import { normalizeParticipantApiError, shouldShowPublicRegistrationEntry } from '~/domains/applications/participant-application'

definePageMeta({
  layout: 'event-detail',
  middleware: ['require-auth']
})

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? '').trim())

if (!slug.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Event not found.'
  })
}

const {
  data: eventData,
  error: eventError
} = await useApiResponse<PublicEvent>(() => `public-event-application-terms:${slug.value}`, () => `/api/public/events/${slug.value}`, {
  cacheScope: 'public',
  watch: [slug]
})

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

const event = computed(() => eventData.value!)
const registerHref = computed(() => `/events/${slug.value}/register`)
const backHref = computed(() =>
  shouldShowPublicRegistrationEntry(
    event.value.state,
    event.value.registrationOpensAt,
    event.value.registrationClosesAt
  )
    ? registerHref.value
    : `/events/${slug.value}`
)
const backLabel = computed(() =>
  shouldShowPublicRegistrationEntry(
    event.value.state,
    event.value.registrationOpensAt,
    event.value.registrationClosesAt
  )
    ? 'Back to registration'
    : 'Back to event'
)
const detailBackgroundImageUrl = computed(() => resolveEventDetailBackgroundImageUrl(event.value))
const detailBackgroundImageStyle = computed(() => detailBackgroundImageUrl.value
  ? { backgroundImage: `url(${JSON.stringify(detailBackgroundImageUrl.value)})` }
  : undefined)
const detailSummary = computed(() => formatEventHeaderSummary(event.value))

const { data: terms, error, status } = await useApiData(
  () => `public-event-application-terms-document:${slug.value}`,
  async ({ apiFetch, signal }) => {
    const visibleEvent = await apiFetch<ParticipantApiDataResponse<VisibleEventRecord>>(
      `/api/events/slug/${slug.value}`,
      { signal }
    )
    const response = await apiFetch<ParticipantApiDataResponse<ParticipantCurrentTermsResponse>>(
      `/api/events/${visibleEvent.data.id}/terms/current`,
      { signal }
    )
    return response.data
  }
)
const currentApplicationTerms = computed(() => terms.value?.application_terms)

const applicationTermsMarkdown = computed(() => {
  const content = currentApplicationTerms.value?.content?.trim() ?? ''
  return content.replaceAll('\\n', '\n')
})
const termsPublishedLabel = computed(() => {
  if (!currentApplicationTerms.value) {
    return ''
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(currentApplicationTerms.value.publishedAt))
})

useSeoMeta({
  title: () => `Application Terms | ${event.value.name} | Codex Events`,
  description: () => `Read the application terms for ${event.value.name}.`
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
          :to="backHref"
          class="inline-flex items-center gap-2 text-[13px] font-medium text-neutral-600 transition-colors hover:text-highlighted dark:text-[#A3A3A3] dark:hover:text-white"
        >
          <AppIcon
            name="i-lucide-arrow-left"
            class="size-4"
          />
          {{ backLabel }}
        </NuxtLink>

        <div class="mt-3 border-b border-black/8 pb-4 dark:border-white/[0.08]">
          <div class="space-y-2">
            <div class="min-w-0 flex flex-wrap items-center gap-3">
              <h1 class="text-[28px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
                {{ event.name }}
              </h1>
              <EventStateBadge
                :state="event.state"
                :registration-opens-at="event.registrationOpensAt"
                :registration-closes-at="event.registrationClosesAt"
              />
            </div>

            <p class="text-[15px] text-neutral-700 dark:text-[#A3A3A3]">
              {{ detailSummary }}
            </p>
          </div>
        </div>
      </AppContainer>
    </section>

    <AppContainer class="relative z-10 max-w-[68rem] space-y-6 pb-10 pt-6 sm:pb-14">
      <AppAlert
        v-if="status === 'idle' || status === 'pending'"
        color="neutral"
        variant="soft"
        title="Loading application terms"
      />

      <AppAlert
        v-else-if="error"
        color="error"
        variant="soft"
        title="Application terms unavailable"
        :description="normalizeParticipantApiError(error).message"
      />

      <AppAlert
        v-else-if="!currentApplicationTerms"
        color="warning"
        variant="soft"
        title="Application terms unavailable"
        description="Current application terms are not published for this event."
      />

      <section
        v-else
        class="rounded-xl border border-black/8 bg-[#F7F7F8]/80 p-6 dark:border-white/[0.08] dark:bg-[#111111]/80"
      >
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-4 dark:border-white/[0.08]">
          <div class="space-y-1">
            <h2 class="text-[20px] font-semibold text-highlighted dark:text-white">
              {{ currentApplicationTerms.title }}
            </h2>
            <p class="text-[12px] text-neutral-500 dark:text-[#8C8C8C]">
              Version {{ currentApplicationTerms.version }} · Published {{ termsPublishedLabel }}
            </p>
          </div>
        </div>

        <AppMarkdownRenderer
          :source="applicationTermsMarkdown"
          strip-leading-heading
        />
      </section>
    </AppContainer>
  </div>
</template>
