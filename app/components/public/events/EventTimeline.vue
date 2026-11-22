<script setup lang="ts">
import {
  describeEventWindowNote,
  describeEventWindowStatus,
  formatEventLocation,
  getEventDateTimePresentation,
  getEventWindowProgress,
  type PublicEvent
} from '~/domains/events/presentation'

const props = defineProps<{
  event: PublicEvent
  discordServerUrl?: string | null
  slidesUrl?: string | null
  showAddress?: boolean
  /** The event workspace shows registered people the event details only. */
  hideRegistrationWindow?: boolean
}>()

function formatAttendanceLabel(event: Pick<PublicEvent, 'inPersonEvent'>) {
  return event.inPersonEvent ? 'In person' : 'No in-person attendance required'
}

const eventDetailRows = computed(() => {
  const rows: Array<{
    label: string
    value: string
    href?: string
  }> = []

  if (props.event.eventType === 'hackathon') {
    rows.push({
      label: 'Team size',
      value: `1-${props.event.maxTeamMembers} members`
    })
  }

  rows.push({
    label: 'Attendance',
    value: formatAttendanceLabel(props.event)
  })

  if (props.event.inPersonEvent) {
    rows.push({
      label: 'Location',
      value: formatEventLocation(props.event)
    })
  }

  const address = props.event.address.trim()

  if (props.showAddress && address) {
    // The link opens a map search for the address, with the city and country to find the right place.
    const mapQuery = [address, formatEventLocation(props.event)].filter(Boolean).join(', ')

    rows.push({
      label: 'Address',
      value: address,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    })
  }

  const lumaEventUrl = props.event.lumaEventUrl?.trim()

  if (lumaEventUrl) {
    rows.push({
      label: 'Luma event',
      value: 'Open event page',
      href: lumaEventUrl
    })
  }

  const discordServerUrl = props.discordServerUrl?.trim()

  if (discordServerUrl) {
    rows.push({
      label: 'Discord server',
      value: 'Open server',
      href: discordServerUrl
    })
  }

  const slidesUrl = props.slidesUrl?.trim()

  if (slidesUrl) {
    rows.push({
      label: 'Slides',
      value: 'Open slides',
      href: slidesUrl
    })
  }

  return rows
})

const registrationStart = computed(() => getEventDateTimePresentation(props.event.registrationOpensAt))
const registrationEnd = computed(() => getEventDateTimePresentation(props.event.registrationClosesAt))

const timelineEntries = computed(() => [
  {
    id: 'registration',
    eyebrow: 'Registration Window',
    title: null,
    status: describeEventWindowStatus(props.event.registrationOpensAt, props.event.registrationClosesAt),
    note: describeEventWindowNote(props.event.registrationOpensAt, props.event.registrationClosesAt),
    progress: getEventWindowProgress(props.event.registrationOpensAt, props.event.registrationClosesAt),
    accent: 'bg-green-500',
    start: registrationStart.value,
    end: registrationEnd.value
  },
  {
    id: 'details',
    eyebrow: 'Event Details',
    title: null,
    rows: eventDetailRows.value
  }
].filter(entry => entry.id !== 'registration' || !props.hideRegistrationWindow))
</script>

<template>
  <section
    data-testid="public-event-timeline"
    class="grid grid-cols-1 gap-6"
    :class="{ 'lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]': timelineEntries.length > 1 }"
  >
    <AppCard
      v-for="entry in timelineEntries"
      :key="entry.id"
      class="!border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60 rounded-xl"
    >
      <template v-if="entry.start && entry.end">
        <div class="mb-3 flex items-start justify-between gap-4">
          <h3 class="text-[14px] font-medium text-neutral-500 dark:text-[#A3A3A3]">
            {{ entry.eyebrow }}
          </h3>
          <span class="rounded-full border border-black/8 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#C9C9C9]">
            {{ entry.status }}
          </span>
        </div>

        <div
          class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 rounded-[1rem] px-3.5 py-3"
          :title="`${entry.start.metaLabel} -> ${entry.end.metaLabel}`"
        >
          <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-4">
            <div class="min-w-0">
              <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-[#8C8C8C]">
                Opens
              </p>
              <p class="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
                {{ entry.start.timeLabel }}
              </p>
              <p class="mt-1 text-[12px] leading-4 text-neutral-500 dark:text-[#A3A3A3]">
                {{ entry.start.dayLabel }}, {{ entry.start.dateLabel }}
              </p>
            </div>

            <div
              class="flex items-center justify-center text-neutral-500 dark:text-[#A3A3A3]"
              aria-hidden="true"
            >
              <span class="inline-flex size-7 items-center justify-center rounded-full border border-black/8 bg-white/78 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <AppIcon
                  name="i-lucide-arrow-right"
                  class="size-3.5"
                />
              </span>
            </div>

            <div class="min-w-0 text-right">
              <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500 dark:text-[#8C8C8C]">
                Closes
              </p>
              <p class="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
                {{ entry.end.timeLabel }}
              </p>
              <p class="mt-1 text-[12px] leading-4 text-neutral-500 dark:text-[#A3A3A3]">
                {{ entry.end.dayLabel }}, {{ entry.end.dateLabel }}
              </p>
            </div>
          </div>
        </div>

        <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/6 dark:bg-white/[0.05]">
          <div
            class="h-full"
            :class="entry.accent"
            :style="{ width: `${entry.progress}%` }"
          />
        </div>
        <p class="mt-2 text-[12px] text-neutral-500 dark:text-[#8C8C8C]">
          {{ entry.note }}
        </p>
      </template>

      <template v-else>
        <h3 class="mb-4 text-[14px] font-medium text-neutral-500 dark:text-[#A3A3A3]">
          {{ entry.eyebrow }}
        </h3>
        <div class="space-y-3">
          <div
            v-for="row in entry.rows"
            :key="row.label"
            class="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-4 text-[13px]"
          >
            <span class="text-neutral-500 dark:text-[#8C8C8C]">
              {{ row.label }}
            </span>
            <a
              v-if="row.href"
              :href="row.href"
              target="_blank"
              rel="noreferrer"
              class="inline-flex items-center gap-1.5 justify-self-start font-medium text-highlighted transition-colors hover:text-black dark:text-white dark:hover:text-white/80"
            >
              <span>{{ row.value }}</span>
              <AppIcon
                name="i-lucide-arrow-up-right"
                class="size-3.5 shrink-0"
              />
            </a>
            <span
              v-else
              class="font-medium leading-5 text-highlighted dark:text-white"
            >
              {{ row.value }}
            </span>
          </div>
        </div>
      </template>
    </AppCard>
  </section>
</template>
