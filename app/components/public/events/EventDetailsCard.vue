<script setup lang="ts">
// The practical details of an event for people in its workspace: where it takes place and the
// links of the event. The date, the city and the team size stand in the page header, so this
// card does not repeat them.
import { formatEventLocation, type PublicEvent } from '~/domains/events/presentation'

const props = defineProps<{
  event: Pick<PublicEvent, 'inPersonEvent' | 'address' | 'city' | 'country' | 'lumaEventUrl'>
  discordServerUrl?: string | null
  slidesUrl?: string | null
  /** True for a person who may see the street address. */
  showAddress?: boolean
}>()

interface EventDetailRow {
  label: string
  value: string
  href?: string
}

// The card is not shown for an event without any of these rows.
const rows = computed(() => {
  const rows: EventDetailRow[] = []
  const address = props.event.address.trim()

  if (!props.event.inPersonEvent) {
    rows.push({ label: 'Attendance', value: 'No in-person attendance required' })
  } else if (props.showAddress && address) {
    // The link opens a map search for the address, with the city and country to find the right place.
    const mapQuery = [address, formatEventLocation(props.event)].filter(Boolean).join(', ')

    rows.push({
      label: 'Address',
      value: address,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    })
  }

  const links = [
    { label: 'Luma event', value: 'Open event page', href: props.event.lumaEventUrl?.trim() },
    { label: 'Discord server', value: 'Open server', href: props.discordServerUrl?.trim() },
    { label: 'Slides', value: 'Open slides', href: props.slidesUrl?.trim() }
  ]

  return [...rows, ...links.filter(link => link.href)]
})
</script>

<template>
  <AppCard
    v-if="rows.length > 0"
    data-testid="event-details"
    class="!border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60 rounded-xl"
  >
    <div class="space-y-3">
      <div
        v-for="row in rows"
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
  </AppCard>
</template>
