<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

import AppShellFooter from '~/components/shell/AppShellFooter.vue'
import AppShellHeader from '~/components/shell/AppShellHeader.vue'
import AppShellSidebar from '~/components/shell/AppShellSidebar.vue'
import { accountRegisterHref } from '#shared/domains/accounts/auth-navigation'

const route = useRoute()
const { currentAccountEventId } = useShellAccountEventPageContext()
const { actor, accountEventNavigationMode, sidebarGroups } = useShellNavigation({
  currentAccountEventId
})

const showWorkspaceSidebar = computed(() => actor.value?.kind === 'platform_user')
const shouldLetPageBackgroundReachScrollbar = computed(() =>
  route.path.startsWith('/account/events/')
)
const showIdentityAlert = computed(() => actor.value?.kind === 'authenticated_identity')

// Presentation mode, for example a workshop page on a projector, hides the header, sidebar and footer.
// Leaving the browser fullscreen, for example with Escape, also ends it.
const presentationMode = usePresentationMode()
useEventListener(() => import.meta.client ? document : undefined, 'fullscreenchange', () => {
  if (!document.fullscreenElement && presentationMode.active.value) {
    void presentationMode.exit()
  }
})
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden text-foreground">
    <AppShellHeader v-if="!presentationMode.active.value" />

    <div
      class="app-shell-scroll-region min-h-0 flex flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-none"
      :class="shouldLetPageBackgroundReachScrollbar ? 'app-shell-scroll-region--edge-background' : undefined"
    >
      <div class="relative flex items-start">
        <AppShellSidebar
          v-if="showWorkspaceSidebar && !presentationMode.active.value"
          class="hidden lg:block"
          :groups="sidebarGroups"
          :account-event-navigation-mode="accountEventNavigationMode"
        />

        <main class="min-w-0 flex-1 pb-10 lg:pb-14">
          <AppContainer
            v-if="showIdentityAlert && route.path !== accountRegisterHref"
            class="pt-6 lg:pt-8"
          >
            <AppAlert
              color="info"
              variant="soft"
              icon="i-lucide-id-card"
              class="mb-6 rounded-xl border border-info/20 bg-info/6"
              title="Finish your platform account before entering participant workflows"
              description="Accept the current platform Privacy Policy and Platform Terms to continue into account and participant workspaces."
            />
          </AppContainer>

          <slot />
        </main>
      </div>

      <AppShellFooter
        v-if="!presentationMode.active.value"
        class="mt-auto"
        :with-sidebar="showWorkspaceSidebar"
      />
    </div>
  </div>
</template>
