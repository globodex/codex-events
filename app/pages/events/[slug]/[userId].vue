<script setup lang="ts">
import type { EventCertificate } from '#shared/domains/events/certificates'
import {
  buildEventCertificateLinkedInAddToProfileUrl,
  buildEventCertificatePath,
  buildEventCertificateSummary,
  buildEventCertificateVerificationText,
  eventCertificatePreviewUserId,
  eventCertificateTypeLabels,
  formatEventCertificatePlacement
} from '#shared/domains/events/certificates'

import EventCertificateCard from '~/components/public/events/EventCertificateCard.vue'

definePageMeta({
  layout: 'public'
})

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? '').trim())
const userId = computed(() => String(route.params.userId ?? '').trim())
const isPreview = computed(() => userId.value === eventCertificatePreviewUserId)
const previewQueryKeys = ['name', 'type', 'rank', 'track', 'project', 'team', 'prizes'] as const
const previewSearch = computed(() => {
  if (!isPreview.value) {
    return ''
  }

  const params = new URLSearchParams()

  for (const key of previewQueryKeys) {
    const value = route.query[key]

    if (typeof value === 'string' && value.trim()) {
      params.set(key, value)
    }
  }

  const search = params.toString()
  return search ? `?${search}` : ''
})
const certificateVariant = computed(() => route.query.variant === 'normal' ? 'normal' : 'holo')
const { actor: accountActor } = await useAccountLifecycleActor()
const toast = useToast()

if (!slug.value || !userId.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Certificate not found.'
  })
}

const { data: certificateData, error: certificateError } = await useApiResponse<EventCertificate>(
  () => `public-event-certificate:${slug.value}:${userId.value}:${previewSearch.value}`,
  () => `/api/public/events/${slug.value}/participants/${userId.value}/certificate${previewSearch.value}`,
  {
    cacheScope: 'public',
    watch: [slug, userId, previewSearch]
  }
)

if (certificateError.value || !certificateData.value) {
  throw createError({
    statusCode: certificateError.value?.statusCode ?? 404,
    statusMessage: 'Certificate not found.'
  })
}

const certificate = computed(() => certificateData.value!)
const typeLabel = computed(() => eventCertificateTypeLabels[certificate.value.eventType])
const locationLabel = computed(() => [certificate.value.city, certificate.value.country].filter(part => part.trim().length > 0).join(', '))
const dateLine = computed(() => `${certificate.value.eventDateLabel}${locationLabel.value ? ` · ${locationLabel.value}` : ''}`)
const placementLine = computed(() => certificate.value.placement
  ? [formatEventCertificatePlacement(certificate.value.placement), ...certificate.value.prizes].join(' · ')
  : '')
const metaLine = computed(() => [
  certificate.value.trackName ? `${certificate.value.trackName} track` : '',
  certificate.value.projectName,
  certificate.value.teamName ? `Team ${certificate.value.teamName}` : ''
].filter(part => part).join(' · '))

const requestUrl = useRequestURL()
const certificatePath = computed(() => buildEventCertificatePath(slug.value, userId.value))
const certificateUrl = computed(() => new URL(`${certificatePath.value}${previewSearch.value}`, requestUrl.origin).toString())
const linkedInAddToProfileUrl = computed(() => buildEventCertificateLinkedInAddToProfileUrl(certificate.value, certificateUrl.value))
const shareCertificateUrl = computed(() => {
  if (certificateVariant.value !== 'normal') {
    return certificateUrl.value
  }

  const url = new URL(certificateUrl.value)
  url.searchParams.set('variant', 'normal')
  return url.toString()
})
const certificateApiBasePath = computed(() => `/api/public/events/${slug.value}/participants/${userId.value}`)
const certificateImageUrl = computed(() => new URL(`${certificateApiBasePath.value}/certificate.png${previewSearch.value}`, requestUrl.origin).toString())
const certificateSummary = computed(() => buildEventCertificateSummary(certificate.value))
const certificateVerificationText = computed(() => buildEventCertificateVerificationText(certificate.value.certificateId))
const shouldCelebrate = ref(false)
const isCertificateOwner = computed(() => accountActor.value.platformUser?.id === userId.value)

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  if (isPreview.value) {
    setTimeout(() => {
      shouldCelebrate.value = true
    }, 600)
    return
  }

  if (!isCertificateOwner.value) {
    return
  }

  const celebrationStorageKey = `codex-events-certificate-celebrated:${slug.value}:${userId.value}`

  if (localStorage.getItem(celebrationStorageKey)) {
    return
  }

  localStorage.setItem(celebrationStorageKey, new Date().toISOString())
  setTimeout(() => {
    shouldCelebrate.value = true
  }, 600)
})

const stageBackgroundImageStyle = computed(() => certificate.value.backgroundImageUrl
  ? { backgroundImage: `url(${JSON.stringify(certificate.value.backgroundImageUrl)})` }
  : undefined)

async function copyCertificateLink() {
  try {
    await navigator.clipboard.writeText(shareCertificateUrl.value)
    toast.add({
      title: 'Certificate link copied',
      color: 'success'
    })
  } catch {
    toast.add({
      title: 'Unable to copy the link',
      description: 'Copy the address from your browser instead.',
      color: 'error'
    })
  }
}

useSeoMeta({
  robots: () => isPreview.value ? 'noindex, nofollow' : undefined,
  title: () => `${certificate.value.participantName} - Certificate of Participation | Codex Events`,
  description: () => certificateSummary.value,
  ogTitle: () => `${certificate.value.participantName} · Certificate of Participation`,
  ogDescription: () => certificateSummary.value,
  ogImage: () => certificateImageUrl.value,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: 'image/png',
  ogUrl: () => certificateUrl.value,
  ogType: 'website',
  ogSiteName: 'Codex Events',
  twitterCard: 'summary_large_image',
  twitterTitle: () => `${certificate.value.participantName} · Certificate of Participation`,
  twitterDescription: () => certificateSummary.value,
  twitterImage: () => certificateImageUrl.value
})

const certificateStructuredData = computed(() => JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'EducationalOccupationalCredential',
  'name': 'Certificate of Participation',
  'credentialCategory': 'Participation',
  'identifier': certificate.value.certificateId,
  'url': certificateUrl.value,
  'dateCreated': certificate.value.eventDateIso,
  'description': certificateSummary.value,
  'recognizedBy': {
    '@type': 'Organization',
    'name': 'Codex Events'
  },
  'about': {
    '@type': 'Event',
    'name': certificate.value.eventName,
    'startDate': certificate.value.eventDateIso,
    'location': {
      '@type': 'Place',
      'address': {
        '@type': 'PostalAddress',
        'addressLocality': certificate.value.city,
        'addressCountry': certificate.value.country
      }
    }
  }
}).replace(/</g, '\\u003c'))

useHead({
  link: [
    {
      rel: 'canonical',
      href: certificateUrl
    }
  ],
  script: isPreview.value
    ? []
    : [
        {
          type: 'application/ld+json',
          innerHTML: certificateStructuredData
        }
      ]
})
</script>

<template>
  <div class="certificate-stage relative isolate overflow-hidden pb-16">
    <div
      class="pointer-events-none absolute inset-0 -z-10 bg-white dark:bg-[#05060b]"
      aria-hidden="true"
    >
      <div class="absolute inset-0 block bg-[radial-gradient(55%_45%_at_50%_58%,rgba(96,60,235,0.10),transparent_70%)] dark:hidden" />
      <div
        v-if="certificateVariant === 'holo' && stageBackgroundImageStyle"
        class="absolute inset-0 hidden scale-110 bg-cover bg-center bg-no-repeat opacity-60 blur-md saturate-125 dark:block"
        :style="stageBackgroundImageStyle"
      />
      <div
        v-else-if="certificateVariant === 'holo'"
        class="absolute inset-0 hidden bg-[radial-gradient(70%_60%_at_50%_110%,rgba(96,60,235,0.4),transparent_70%),radial-gradient(50%_40%_at_15%_0%,rgba(40,80,220,0.25),transparent_70%)] dark:block"
      />
      <div
        v-else
        class="absolute inset-0 hidden bg-[radial-gradient(60%_50%_at_50%_0%,rgba(71,83,240,0.16),transparent_70%)] dark:block"
      />
      <div
        v-if="certificateVariant === 'holo'"
        class="absolute inset-0 hidden bg-gradient-to-b from-black/72 via-black/62 to-[#05060b] dark:block"
      />
    </div>

    <AppContainer class="max-w-[80rem] pt-5">
      <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <NuxtLink
          :to="`/events/${slug}`"
          class="inline-flex items-center gap-2 pt-1.5 text-[13px] font-medium text-neutral-600 transition-colors hover:text-neutral-950 dark:text-white/70 dark:hover:text-white"
        >
          <AppIcon
            name="i-lucide-arrow-left"
            class="size-4"
          />
          Back to event
        </NuxtLink>

        <div class="flex items-center gap-2 sm:gap-3">
          <AppButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-link"
            class="certificate-action-button h-auto"
            data-testid="certificate-copy-link"
            aria-label="Copy certificate link"
            title="Copy link"
            @click="copyCertificateLink"
          >
            <span class="hidden sm:inline">Copy link</span>
          </AppButton>

          <AppButton
            :to="`${certificateApiBasePath}/certificate.pdf${previewSearch}`"
            external
            color="neutral"
            variant="ghost"
            icon="i-lucide-file-text"
            class="certificate-action-button h-auto"
            data-testid="certificate-download-pdf"
            aria-label="Download certificate PDF"
            title="PDF"
          >
            <span class="hidden sm:inline">PDF</span>
          </AppButton>

          <AppButton
            :to="`${certificateApiBasePath}/certificate.png${previewSearch ? `${previewSearch}&download=1` : '?download=1'}`"
            external
            color="neutral"
            variant="ghost"
            icon="i-lucide-image"
            class="certificate-action-button h-auto"
            data-testid="certificate-download-image"
            aria-label="Download certificate image"
            title="Image"
          >
            <span class="hidden sm:inline">Image</span>
          </AppButton>

          <AppButton
            :to="linkedInAddToProfileUrl"
            external
            color="neutral"
            variant="ghost"
            icon="i-lucide-linkedin"
            class="certificate-action-button h-auto"
            data-testid="certificate-add-linkedin"
            aria-label="Add certificate to LinkedIn profile"
            title="Add to LinkedIn"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="hidden sm:inline">Add to LinkedIn</span>
          </AppButton>
        </div>
      </div>

      <div class="mx-auto mt-2 flex max-w-[46rem] flex-col items-center text-center">
        <p class="certificate-type-chip">
          {{ typeLabel.toUpperCase() }}
        </p>

        <h1
          data-testid="certificate-title"
          class="mt-3 text-[40px] font-bold leading-tight tracking-[-0.02em] text-neutral-950 dark:text-white sm:text-[56px]"
        >
          {{ certificate.participantName }}
        </h1>
        <p class="mt-1 text-[17px] text-neutral-600 dark:text-white/65 sm:text-[19px]">
          has participated in
        </p>
        <p class="mt-1.5 text-[24px] font-bold tracking-[-0.01em] text-neutral-950 dark:text-white sm:text-[30px]">
          {{ certificate.eventName }}
        </p>
        <p class="mt-1.5 text-[17px] font-medium text-indigo-600 dark:text-[#8b9bff] sm:text-[19px]">
          on {{ dateLine }}
        </p>
        <p
          v-if="placementLine"
          class="mt-2 inline-flex items-start gap-1.5 text-[16px] font-semibold text-amber-700 dark:text-amber-300 sm:text-[18px]"
          data-testid="certificate-placement"
        >
          <AppIcon
            name="i-lucide-trophy"
            class="mt-1 size-4.5 shrink-0"
          />
          {{ placementLine }}
        </p>
        <p
          v-if="metaLine"
          class="mt-1.5 text-[15px] text-neutral-600 dark:text-white/65 sm:text-[16px]"
          data-testid="certificate-meta-line"
        >
          {{ metaLine }}
        </p>
      </div>

      <div class="mx-auto mt-7 w-full max-w-[64rem] sm:mt-9">
        <EventCertificateCard
          :certificate="certificate"
          :celebrate="shouldCelebrate"
          :variant="certificateVariant"
        />
      </div>

      <div class="mx-auto mt-7 flex w-full max-w-[64rem] flex-col items-center gap-1 text-center">
        <p
          v-if="isPreview"
          class="inline-flex items-center gap-1.5 text-[13px] text-neutral-600 dark:text-white/60"
          data-testid="certificate-preview-notice"
        >
          <AppIcon
            name="i-lucide-flask-conical"
            class="size-3.5"
          />
          This is a design preview with sample data, not an issued certificate.
        </p>
        <template v-else>
          <p class="inline-flex items-start gap-1.5 text-[13px] text-neutral-600 dark:text-white/60">
            <AppIcon
              name="i-lucide-lock"
              class="mt-0.5 size-3.5 shrink-0"
            />
            {{ certificateVerificationText }}
          </p>
        </template>
      </div>
    </AppContainer>
  </div>
</template>

<style>
.certificate-action-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.16);
  background: rgba(0, 0, 0, 0.04);
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #171717;
  transition: background-color 150ms ease, border-color 150ms ease;
  backdrop-filter: blur(8px);
}

@media (max-width: 639px) {
  .certificate-action-button {
    gap: 0;
    border-radius: 10px;
    padding: 8px;
  }
}

.certificate-action-button:hover {
  background: rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.3);
}

.dark .certificate-action-button {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.dark .certificate-action-button:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.28);
}

.certificate-type-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  border: 1px solid rgba(79, 70, 229, 0.5);
  padding: 5px 18px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.28em;
  color: #4338ca;
  box-shadow: 0 0 18px -6px rgba(99, 102, 241, 0.5);
}

.dark .certificate-type-chip {
  border-color: rgba(139, 155, 255, 0.55);
  color: #aab7ff;
  box-shadow: 0 0 18px -4px rgba(110, 120, 255, 0.55);
}
</style>
