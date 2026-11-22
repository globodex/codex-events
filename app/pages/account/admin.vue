<script setup lang="ts">
import AccountEventDashboardList from '~/components/account/AccountEventDashboardList.vue'
import {
  formatEventDateWithWeekday,
  formatEventLocation,
  formatEventTypeLabel,
  getEventDashboardTeamSizeMetaItems,
  getEventEarliestStartAt
} from '~/domains/events/presentation'
import {
  adminOverviewTabs,
  countAdminOverviewEventsByTab,
  getAdminOverviewTabForEvent,
  type AdminOverviewTab
} from '~/domains/events/admin-overview'
import { normalizeTabQueryValue, resolveTabQueryValue } from '~/lib/query-values'

definePageMeta({
  middleware: ['require-account-admin']
})

const route = useRoute()
const workspace = useAdminWorkspace()
const adminOverviewNow = Date.now()
const adminOverviewTabLabels: Record<AdminOverviewTab, string> = {
  active: 'Active',
  upcoming: 'Upcoming',
  past: 'Past'
}

const isPlatformAdmin = computed(() => workspace.actor.value?.isPlatformAdmin === true)
const isEventOrganizer = computed(() => workspace.actor.value?.isEventOrganizer === true)
const manageableEvents = computed(() => workspace.manageableEvents.value)
const activeTab = computed<AdminOverviewTab>(() =>
  resolveTabQueryValue(route.query.tab, adminOverviewTabs, 'active')
)
const filterCounts = computed(() =>
  countAdminOverviewEventsByTab(manageableEvents.value, adminOverviewNow)
)
const filterTabs = computed(() =>
  adminOverviewTabs.map(tab => ({
    id: tab,
    label: adminOverviewTabLabels[tab],
    count: filterCounts.value[tab]
  }))
)
const filteredEvents = computed(() =>
  manageableEvents.value.filter(event =>
    getAdminOverviewTabForEvent(event, adminOverviewNow) === activeTab.value
  )
)
const listItems = computed(() =>
  filteredEvents.value.map(event => ({
    id: event.id,
    name: event.name,
    description: isPlatformAdmin.value
      ? 'Open this event to manage operations, change settings, and work across the full internal admin surface.'
      : 'Open this event to manage operations, configure settings, and monitor the participant workflow from one shared detail surface.',
    state: event.state,
    registrationOpensAt: event.registrationOpensAt,
    registrationClosesAt: event.registrationClosesAt,
    to: `/account/events/${event.slug}?tab=operations`,
    actionLabel: 'Open operations',
    sortAt: getEventEarliestStartAt(event),
    externalAction: {
      label: 'Public page',
      to: `/events/${event.slug}`
    },
    overline: 'Admin',
    meta: [
      `Type: ${formatEventTypeLabel(event.eventType)}`,
      `Date: ${formatEventDateWithWeekday(getEventEarliestStartAt(event))}`,
      formatEventLocation(event),
      ...getEventDashboardTeamSizeMetaItems(event)
    ]
  }))
)
const listContent = computed(() => {
  if (activeTab.value === 'upcoming') {
    return {
      title: isPlatformAdmin.value ? 'Upcoming events' : 'Upcoming events you manage',
      description: isPlatformAdmin.value
        ? 'Draft and future events stay here until they move into active operations.'
        : 'Draft and future events you manage stay here until they move into active operations.',
      emptyTitle: 'No upcoming events',
      emptyDescription: isPlatformAdmin.value
        ? 'Draft and future events will appear here.'
        : 'When you manage a draft or future event, it will appear here.'
    }
  }

  if (activeTab.value === 'past') {
    return {
      title: isPlatformAdmin.value ? 'Past events' : 'Past events you managed',
      description: isPlatformAdmin.value
        ? 'Completed events remain available for reference and follow-up work.'
        : 'Completed events you managed remain available for reference and follow-up work.',
      emptyTitle: 'No past events',
      emptyDescription: isPlatformAdmin.value
        ? 'Completed events will appear here once they are closed.'
        : 'Completed events you managed will appear here once they are closed.'
    }
  }

  return {
    title: isPlatformAdmin.value ? 'Active events' : 'Active events you manage',
    description: isPlatformAdmin.value
      ? 'Use the shared list surface to jump into live operations, settings, judging, and outcome workflows.'
      : 'Open the events you currently manage and continue work in operations or settings.',
    emptyTitle: 'No active events',
    emptyDescription: isPlatformAdmin.value
      ? 'Active events will appear here once they move out of draft and before completion.'
      : 'When a manageable event is live or in progress, it will appear here.'
  }
})

async function selectAdminOverviewTab(nextTab: AdminOverviewTab) {
  if (normalizeTabQueryValue(route.query.tab) === nextTab) {
    return
  }

  await navigateTo({
    path: route.path,
    query: {
      ...route.query,
      tab: nextTab
    },
    hash: route.hash
  })
}

useSeoMeta({
  title: 'Manage Events | Codex Events',
  description: 'Open the events you manage and run applications, judging, and outcomes.'
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
                Admin dashboard
              </h1>
              <p
                v-if="workspace.actor.value"
                class="max-w-3xl text-[15px] text-neutral-700 dark:text-[#A3A3A3]"
              >
                {{
                  isPlatformAdmin
                    ? 'Run platform-wide admin work, create events, and open any event workspace from one place.'
                    : isEventOrganizer
                      ? 'Create events and open the events you manage from one place.'
                      : 'Open the events you manage and jump into their operations and settings tabs.'
                }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <AppDropdownMenu
                v-if="workspace.session.capabilities.value.canCreateEvent"
                :items="[
                  { label: 'Create event (builder)', to: '/admin/events/builder/new' },
                  { label: 'Create event (classic)', to: '/admin/events/new' }
                ]"
              >
                <AppButton
                  color="neutral"
                  variant="solid"
                  data-testid="admin-create-event-menu"
                  class="h-auto rounded-lg bg-black px-4 py-2 text-[13px] font-medium text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
                >
                  Create event
                  <template #trailing>
                    <AppIcon
                      name="i-lucide-chevron-down"
                      class="size-3.5"
                    />
                  </template>
                </AppButton>
              </AppDropdownMenu>
            </div>
          </div>
        </div>
      </AppContainer>
    </section>

    <AppContainer class="max-w-none space-y-6 pt-6">
      <AppAlert
        v-if="workspace.session.error.value"
        color="error"
        variant="soft"
        title="Admin dashboard unavailable"
        :description="workspace.session.error.value.message"
      />

      <AppAlert
        v-else-if="workspace.events.error.value"
        color="error"
        variant="soft"
        title="Unable to load events"
        :description="workspace.events.error.value.message"
      />

      <AppAlert
        v-else-if="workspace.session.status.value !== 'success' || workspace.events.status.value !== 'success'"
        color="neutral"
        variant="soft"
        title="Loading admin dashboard"
      />

      <template v-else>
        <section class="!border !border-black/8 !bg-default/80 !shadow-none dark:!border-white/[0.08] dark:!bg-default/80 flex flex-col gap-4 rounded-xl p-2">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <AppFilterButton
              v-for="tab in filterTabs"
              :key="tab.id"
              :pressed="activeTab === tab.id"
              :count="tab.count"
              @click="void selectAdminOverviewTab(tab.id)"
            >
              {{ tab.label }}
            </AppFilterButton>
          </div>
        </section>

        <AccountEventDashboardList
          :title="listContent.title"
          :description="listContent.description"
          :items="listItems"
          :empty-title="listContent.emptyTitle"
          :empty-description="listContent.emptyDescription"
        />
      </template>
    </AppContainer>
  </div>
</template>
