<script setup lang="ts">
import { accountPagePaths } from '#shared/domains/account/account-page-registry'
import type { AccountStaffPage } from '#shared/domains/account/event-dashboards'
import AccountEventDashboardList from '~/components/account/AccountEventDashboardList.vue'
import {
  formatEventDateWithWeekday,
  formatEventLocation,
  formatEventTypeLabel,
  getEventDashboardTeamSizeMetaItems
} from '~/domains/events/presentation'
import { formatStaffDashboardRole } from '~/domains/events/staff-dashboard'

definePageMeta({
  middleware: ['require-staff-dashboard']
})

const events = useApiResponse<AccountStaffPage>('staff-workspace', accountPagePaths['staff-workspace'], { server: false })

const currentStaffEvents = computed(() =>
  events.data.value?.current ?? []
)
const pastStaffEvents = computed(() =>
  events.data.value?.past ?? []
)
const allStaffEvents = computed(() => [
  ...currentStaffEvents.value,
  ...pastStaffEvents.value
])
const listItems = computed(() =>
  allStaffEvents.value.map(event => ({
    id: event.id,
    name: event.name,
    description: 'Open this event to review participant applications, inspect teams, and work from the internal staff surface.',
    state: event.state,
    registrationOpensAt: event.registrationOpensAt,
    registrationClosesAt: event.registrationClosesAt,
    to: `/account/events/${event.slug}?tab=participants`,
    actionLabel: 'Open staff view',
    sortAt: event.startsAt,
    overline: formatStaffDashboardRole(event),
    externalAction: {
      label: 'Public page',
      to: `/events/${event.slug}`
    },
    meta: [
      `Type: ${formatEventTypeLabel(event.eventType)}`,
      `Date: ${formatEventDateWithWeekday(event.startsAt)}`,
      formatEventLocation(event),
      ...getEventDashboardTeamSizeMetaItems(event)
    ]
  }))
)
const errorMessage = computed(() =>
  events.error.value?.statusMessage
  ?? events.error.value?.message
  ?? ''
)
const isLoading = computed(() =>
  events.status.value === 'idle' || events.status.value === 'pending'
)

useSeoMeta({
  title: 'Staff Dashboard | Codex Events',
  description: 'Open the events where you support staff operations and review participant activity.'
})
</script>

<template>
  <div class="pb-14">
    <section class="border-b border-black/8 dark:border-white/[0.08]">
      <AppContainer class="max-w-none pb-0 pt-2 sm:pt-3">
        <div class="space-y-2 pb-4">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="space-y-2">
              <h1 class="text-[28px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
                Staff dashboard
              </h1>
              <p class="max-w-3xl text-[15px] text-neutral-700 dark:text-[#A3A3A3]">
                Open the events where you support internal operations and move directly into participant and team visibility work.
              </p>
            </div>
          </div>
        </div>
      </AppContainer>
    </section>

    <AppContainer class="max-w-none space-y-6 pt-6">
      <AppAlert
        v-if="errorMessage"
        color="error"
        variant="soft"
        title="Staff dashboard unavailable"
        :retry="events.refresh"
        :description="errorMessage"
      />

      <AppAlert
        v-else-if="isLoading"
        color="neutral"
        variant="soft"
        title="Loading staff dashboard"
        description="Fetching the events where you can review participant and team activity."
      />

      <template v-else>
        <section class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-xl border border-black/8 bg-white p-4 dark:border-white/[0.08] dark:bg-[#111111]">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Staff events
            </p>
            <p class="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] text-highlighted dark:text-white">
              {{ allStaffEvents.length }}
            </p>
          </div>

          <div class="rounded-xl border border-black/8 bg-white p-4 dark:border-white/[0.08] dark:bg-[#111111]">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Current
            </p>
            <p class="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] text-highlighted dark:text-white">
              {{ currentStaffEvents.length }}
            </p>
          </div>

          <div class="rounded-xl border border-black/8 bg-white p-4 dark:border-white/[0.08] dark:bg-[#111111]">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Past
            </p>
            <p class="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] text-highlighted dark:text-white">
              {{ pastStaffEvents.length }}
            </p>
          </div>
        </section>

        <AccountEventDashboardList
          title="Events where you support operations"
          description="Each event opens into the Participants tab so you can review applications, participant status, and team activity without using the admin operations surface."
          :items="listItems"
          empty-title="No staff events yet"
          empty-description="When you are assigned staff access on an event, it will appear here."
        />
      </template>
    </AppContainer>
  </div>
</template>
