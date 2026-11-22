<script setup lang="ts">
import type { DiscoveryEvent } from '#shared/domains/events/public-discovery'

import {
  formatEventCompactDate,
  formatEventDateWithWeekday,
  formatEventLocation,
  formatEventTypeLabel
} from '~/domains/events/presentation'

import EventStateBadge from '~/components/public/events/EventStateBadge.vue'

const props = withDefaults(defineProps<{
  event: DiscoveryEvent
  loading?: 'eager' | 'lazy'
  showTimelineRail?: boolean
}>(), {
  loading: 'lazy',
  showTimelineRail: true
})

const hasOutcomes = computed(() => props.event.eventType === 'hackathon' && props.event.state === 'completed')
const eventHref = computed(() => ({
  path: `/events/${props.event.slug}`,
  query: hasOutcomes.value ? { tab: 'prizes' } : {}
}))
</script>

<template>
  <div class="relative">
    <div
      v-if="props.showTimelineRail"
      class="absolute left-[-66px] top-5 hidden lg:block"
    >
      <div class="absolute left-[56px] top-0 h-5 w-5 rounded-full border-4 border-background bg-neutral-500 dark:bg-[#A3A3A3]" />
      <div class="absolute left-0 top-[2px] text-[12px] font-medium leading-none text-neutral-500 dark:text-[#8C8C8C]">
        {{ formatEventCompactDate(event.startsAt) }}
      </div>
    </div>

    <NuxtLink
      :to="eventHref"
      class="group block"
      :class="props.showTimelineRail ? 'lg:mx-8' : ''"
      :data-testid="`public-event-card-${event.slug}`"
    >
      <div class="!border !border-black/8 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 overflow-hidden rounded-3xl transition-colors group-hover:border-black/20 dark:group-hover:border-white/[0.2]">
        <div class="relative h-[300px] overflow-hidden md:h-[340px]">
          <div class="absolute inset-0 z-10 bg-gradient-to-b from-black/20 via-black/30 to-black/65 transition-colors group-hover:from-black/15 group-hover:to-black/55 dark:from-black/25 dark:via-black/35 dark:to-black/72" />
          <img
            v-if="event.imageUrl"
            :src="event.imageUrl"
            :loading="loading"
            :alt="event.name"
            class="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          >
          <div
            v-else
            class="h-full w-full bg-neutral-200 dark:bg-[#1A1A1A]"
          />

          <div class="absolute left-6 top-6 z-20 flex flex-wrap gap-2">
            <span
              class="rounded-full border border-white/25 bg-black/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md"
              :data-testid="`public-event-type-${event.slug}`"
            >
              {{ formatEventTypeLabel(event.eventType) }}
            </span>
            <EventStateBadge
              :state="event.state"
              :registration-opens-at="event.registrationOpensAt"
              :registration-closes-at="event.registrationClosesAt"
              class="border border-white/25 bg-black/55 text-white backdrop-blur-md dark:border-white/25 dark:bg-black/55 dark:text-white"
            />
          </div>

          <div class="absolute bottom-8 left-6 z-20">
            <h2 class="text-[32px] font-semibold tracking-[-0.01em] text-white">
              {{ event.name }}
            </h2>
          </div>
        </div>

        <div class="!border !border-black/8 !bg-white/78 !shadow-none dark:!border-white/[0.08] dark:!bg-white/[0.04] flex flex-col gap-5 rounded-none border-0 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="mb-1 text-[15px] font-medium text-highlighted dark:text-white">
              {{ formatEventDateWithWeekday(event.startsAt) }}
            </p>
            <p class="mt-1 text-[13px] text-neutral-500 dark:text-[#A3A3A3]">
              {{ formatEventLocation(event) }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <div class="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]">
              {{ hasOutcomes ? 'View outcomes' : 'View details' }}
              <AppIcon
                name="i-lucide-arrow-up-right"
                class="size-3.5"
              />
            </div>
          </div>
        </div>
      </div>
    </NuxtLink>
  </div>
</template>
