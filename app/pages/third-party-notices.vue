<script setup lang="ts">
import type { ThirdPartyNoticesPayload } from '#shared/types/third-party-notices'

const {
  data: noticesPayload,
  error: noticesError
} = await useFetch<ThirdPartyNoticesPayload>('/third-party-notices.generated.json', {
  key: 'third-party-notices'
})

if (noticesError.value) {
  throw createError({
    statusCode: noticesError.value.statusCode ?? noticesError.value.status ?? 500,
    statusMessage: noticesError.value.statusMessage ?? 'Unable to load third-party notices.'
  })
}

if (!noticesPayload.value) {
  throw createError({
    statusCode: 500,
    statusMessage: 'Unable to load third-party notices.'
  })
}

const { generatedAtLabel, scopeLabel, notices } = noticesPayload.value
const totalLicenseCount = new Set(notices.map(notice => notice.license ?? 'Undeclared')).size

useSeoMeta({
  title: 'Third-Party Notices | Codex Events',
  description: 'Review runtime open-source dependency notices and license texts for Codex Events.',
  robots: 'noindex, follow'
})
</script>

<template>
  <div class="relative isolate pb-24">
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

        <div class="mt-3 border-b border-black/8 pb-4 dark:border-white/[0.08]">
          <div class="space-y-3">
            <h1 class="text-[28px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
              Third-Party Notices
            </h1>
            <p class="max-w-3xl text-[15px] text-neutral-700 dark:text-[#A3A3A3]">
              This page lists the installed runtime open-source packages used by Codex Events together with their declared licenses and bundled notice material.
            </p>
            <div class="flex flex-wrap items-center gap-3 text-[13px] text-neutral-600 dark:text-[#A3A3A3]">
              <span>Generated {{ generatedAtLabel }} UTC</span>
              <span class="hidden sm:inline">•</span>
              <span>{{ notices.length }} packages</span>
              <span class="hidden sm:inline">•</span>
              <span>{{ totalLicenseCount }} declared license labels</span>
            </div>
          </div>
        </div>
      </AppContainer>
    </section>

    <AppContainer class="relative z-10 max-w-[68rem] space-y-6 pb-10 pt-6 sm:pb-14">
      <section class="rounded-xl border border-black/8 bg-[#F7F7F8]/80 p-6 dark:border-white/[0.08] dark:bg-[#111111]/80">
        <div class="space-y-3">
          <h2 class="text-lg font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
            Scope
          </h2>
          <p class="text-sm text-neutral-700 dark:text-[#A3A3A3]">
            {{ scopeLabel }}
          </p>
          <p class="text-sm text-neutral-700 dark:text-[#A3A3A3]">
            Each entry links back to the package source metadata. License text is shown when the installed package ships a bundled license file.
          </p>
        </div>
      </section>

      <section class="space-y-4">
        <article
          v-for="notice in notices"
          :key="`${notice.name}@${notice.version}`"
          class="overflow-hidden rounded-xl border border-black/8 bg-[#F7F7F8]/80 dark:border-white/[0.08] dark:bg-[#111111]/80"
        >
          <details class="group">
            <summary class="flex cursor-pointer list-none items-start justify-between gap-4 p-6">
              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-base font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
                    {{ notice.name }}
                  </h2>
                  <span class="rounded-full border border-black/10 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-white/[0.12] dark:text-[#D4D4D4]">
                    v{{ notice.version }}
                  </span>
                </div>

                <p class="text-sm text-neutral-700 dark:text-[#A3A3A3]">
                  Declared license: {{ notice.license ?? 'Not declared in package metadata' }}
                </p>

                <div class="flex flex-wrap items-center gap-2 text-[11px] text-neutral-600 dark:text-[#8A8A8A]">
                  <span
                    v-if="notice.licenseFileName"
                    class="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/[0.12]"
                  >
                    {{ notice.licenseFileName }}
                  </span>
                  <span
                    v-if="notice.noticeFileName"
                    class="rounded-full border border-black/10 px-2 py-0.5 dark:border-white/[0.12]"
                  >
                    {{ notice.noticeFileName }}
                  </span>
                </div>
              </div>

              <AppIcon
                name="i-lucide-chevron-down"
                class="mt-1 size-4 shrink-0 text-neutral-500 transition-transform group-open:rotate-180 dark:text-[#8A8A8A]"
              />
            </summary>

            <div class="space-y-5 border-t border-black/8 p-6 dark:border-white/[0.08]">
              <div class="flex flex-wrap items-center gap-3 text-sm">
                <a
                  v-if="notice.repositoryUrl"
                  :href="notice.repositoryUrl"
                  target="_blank"
                  rel="noreferrer"
                  class="font-medium text-highlighted transition-colors hover:text-highlighted/80 dark:text-white dark:hover:text-[#D7D7D7]"
                >
                  Repository
                </a>
                <a
                  v-if="notice.homepageUrl"
                  :href="notice.homepageUrl"
                  target="_blank"
                  rel="noreferrer"
                  class="font-medium text-highlighted transition-colors hover:text-highlighted/80 dark:text-white dark:hover:text-[#D7D7D7]"
                >
                  Homepage
                </a>
                <a
                  :href="notice.registryUrl"
                  target="_blank"
                  rel="noreferrer"
                  class="font-medium text-highlighted transition-colors hover:text-highlighted/80 dark:text-white dark:hover:text-[#D7D7D7]"
                >
                  npm package
                </a>
              </div>

              <section
                v-if="notice.noticeText"
                class="space-y-2"
              >
                <h3 class="text-sm font-semibold text-highlighted dark:text-white">
                  Notice text
                </h3>
                <pre class="max-h-[28rem] overflow-auto rounded-xl border border-black/8 bg-white/80 p-4 text-xs leading-6 whitespace-pre-wrap text-neutral-800 dark:border-white/[0.08] dark:bg-[#161616] dark:text-[#D7D7D7]">{{ notice.noticeText }}</pre>
              </section>

              <section class="space-y-2">
                <h3 class="text-sm font-semibold text-highlighted dark:text-white">
                  License text
                </h3>
                <pre
                  v-if="notice.licenseText"
                  class="max-h-[32rem] overflow-auto rounded-xl border border-black/8 bg-white/80 p-4 text-xs leading-6 whitespace-pre-wrap text-neutral-800 dark:border-white/[0.08] dark:bg-[#161616] dark:text-[#D7D7D7]"
                >{{ notice.licenseText }}</pre>
                <p
                  v-else
                  class="text-sm text-neutral-700 dark:text-[#A3A3A3]"
                >
                  This installed package did not ship a bundled license text file. Review the package source via the links above.
                </p>
              </section>
            </div>
          </details>
        </article>
      </section>
    </AppContainer>
  </div>
</template>
