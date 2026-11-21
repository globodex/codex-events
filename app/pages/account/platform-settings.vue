<script setup lang="ts">
import { normalizeTabQueryValue, resolveTabQueryValue } from '~/lib/query-values'

definePageMeta({
  middleware: ['require-platform-admin']
})

const route = useRoute()
const accountTabListRef = ref<HTMLElement | null>(null)
const platformSettingsTabs = ['legal', 'event-defaults', 'event-organizers', 'platform-admins'] as const
type PlatformSettingsTab = typeof platformSettingsTabs[number]

const platformSettingsTabLabels: Record<PlatformSettingsTab, string> = {
  'legal': 'Legal settings',
  'event-defaults': 'Event defaults',
  'event-organizers': 'Manage event organizers',
  'platform-admins': 'Manage platform admins'
}

const activeTab = computed<PlatformSettingsTab>(() =>
  resolveTabQueryValue(route.query.tab, platformSettingsTabs, 'legal')
)
const visibleTabs = computed(() =>
  platformSettingsTabs.map(tab => ({
    id: tab,
    label: platformSettingsTabLabels[tab],
    to: {
      path: route.path,
      query: {
        ...route.query,
        tab
      },
      hash: route.hash
    }
  }))
)

function scrollActiveTabIntoView() {
  if (!import.meta.client) {
    return
  }

  void nextTick(() => {
    const activeTabElement = accountTabListRef.value?.querySelector<HTMLElement>(
      `#platform-settings-tab-${activeTab.value}`
    )

    activeTabElement?.scrollIntoView({
      block: 'nearest',
      inline: 'center'
    })
  })
}

watchEffect(() => {
  const normalizedTab = normalizeTabQueryValue(route.query.tab)

  if (normalizedTab === activeTab.value) {
    return
  }

  void navigateTo({
    path: route.path,
    query: {
      ...route.query,
      tab: activeTab.value
    },
    hash: route.hash
  }, {
    replace: true
  })
})

watch(activeTab, () => {
  scrollActiveTabIntoView()
}, {
  flush: 'post'
})

onMounted(() => {
  scrollActiveTabIntoView()
})

useSeoMeta({
  title: 'Platform Settings | Codex Events',
  description: 'Manage platform legal settings, event defaults, and platform-wide access.'
})
</script>

<template>
  <div class="pb-14">
    <section class="border-b border-black/8 dark:border-white/[0.08]">
      <AppContainer class="max-w-none pb-0 pt-2 sm:pt-3">
        <div class="space-y-2 pb-4">
          <div class="space-y-2">
            <h1 class="text-[28px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
              Platform settings
            </h1>
            <p class="max-w-3xl text-[15px] text-neutral-700 dark:text-[#A3A3A3]">
              Manage deployment legal settings, event defaults, and platform-wide access from one place.
            </p>
          </div>
        </div>

        <nav
          ref="accountTabListRef"
          aria-label="Platform settings sections"
          role="tablist"
          class="account-event-tab-list flex items-center gap-5 overflow-x-auto"
        >
          <NuxtLink
            v-for="tab in visibleTabs"
            :id="`platform-settings-tab-${tab.id}`"
            :key="tab.id"
            :to="tab.to"
            role="tab"
            :aria-selected="activeTab === tab.id"
            :aria-controls="`platform-settings-tab-panel-${tab.id}`"
            class="border-b-2 pb-3 text-[14px] font-medium transition-colors"
            :class="activeTab === tab.id ? 'border-black text-highlighted dark:border-white dark:text-white' : 'border-transparent text-neutral-500 hover:text-highlighted dark:text-[#A3A3A3] dark:hover:text-white'"
          >
            {{ tab.label }}
          </NuxtLink>
        </nav>
      </AppContainer>
    </section>

    <AppContainer class="relative z-10 max-w-none pt-6">
      <section
        v-if="activeTab === 'legal'"
        id="platform-settings-tab-panel-legal"
        role="tabpanel"
        aria-labelledby="platform-settings-tab-legal"
      >
        <AccountPlatformLegalSettingsPanel />
      </section>

      <section
        v-else-if="activeTab === 'event-defaults'"
        id="platform-settings-tab-panel-event-defaults"
        role="tabpanel"
        aria-labelledby="platform-settings-tab-event-defaults"
      >
        <AccountPlatformEventDefaultsPanel />
      </section>

      <section
        v-else
        :id="`platform-settings-tab-panel-${activeTab}`"
        role="tabpanel"
        :aria-labelledby="`platform-settings-tab-${activeTab}`"
      >
        <AccountPlatformRoleRosterPanel
          :key="activeTab"
          :role="activeTab === 'platform-admins' ? 'platform-admin' : 'event-organizer'"
        />
      </section>
    </AppContainer>
  </div>
</template>
