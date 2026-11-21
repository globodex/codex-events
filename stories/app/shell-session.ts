import type { Decorator } from '@storybook-vue/nuxt'
import type { PlatformSessionActor, SessionActor } from '~/domains/accounts/session-actor'
import { onBeforeUnmount, onMounted } from 'vue'
import { provideStorybookSession } from '../../.storybook/session'

export const participant: PlatformSessionActor = {
  kind: 'platform_user',
  isAuthenticated: true,
  hasPlatformAccount: true,
  hasAcceptedCurrentPlatformDocuments: true,
  sessionUser: {
    sub: 'storybook|participant',
    email: 'morgan@example.com',
    name: 'Morgan Chen'
  },
  platformUser: {
    id: 'storybook-participant',
    email: 'morgan@example.com',
    displayName: 'Morgan Chen',
    firstName: 'Morgan',
    familyName: 'Chen',
    isPlatformAdmin: false,
    isEventOrganizer: false
  },
  isPlatformAdmin: false,
  isEventOrganizer: false,
  eventRoles: []
}

export const administrator: PlatformSessionActor = {
  ...participant,
  platformUser: {
    ...participant.platformUser,
    isPlatformAdmin: true
  },
  isPlatformAdmin: true,
  eventRoles: [{
    eventId: 'storybook-event',
    role: 'event_admin',
    isInJudgePool: true,
    isStaff: true,
    staffTrackId: null,
    createdAt: '2026-10-01T09:00:00Z'
  }]
}

export function withShellSession(actor: SessionActor): Decorator {
  return story => ({
    components: { Story: story() },
    setup() {
      provideStorybookSession(actor)

      const listeners = new AbortController()
      function preventAuthNavigation(event: Event) {
        if (event.target instanceof Element && event.target.closest('a[href^="/auth/"]')) {
          event.preventDefault()
        }
      }

      // The profile dropdown teleports its links outside the story container.
      onMounted(() => {
        for (const event of ['click', 'auxclick', 'contextmenu']) {
          document.addEventListener(event, preventAuthNavigation, {
            capture: true,
            signal: listeners.signal
          })
        }
      })
      onBeforeUnmount(() => listeners.abort())
    },
    template: '<Story />'
  })
}
