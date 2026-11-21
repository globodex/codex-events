import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import { shallowRef } from 'vue'

import AppSectionTab from '~/components/AppSectionTab.vue'

const meta = {
  title: 'Shared/AppSectionTab',
  component: AppSectionTab,
  args: { selected: true }
} satisfies Meta<typeof AppSectionTab>

export default meta

type Story = StoryObj<typeof meta>

export const EventSections: Story = {
  render: () => ({
    components: { AppSectionTab },
    setup: () => ({ active: shallowRef('overview') }),
    template: `
      <div class="max-w-sm">
        <div class="flex gap-5" role="tablist" aria-label="Event sections">
          <AppSectionTab
            id="overview-tab"
            aria-controls="overview-panel"
            :selected="active === 'overview'"
            @click="active = 'overview'"
          >
            Overview
          </AppSectionTab>
          <AppSectionTab
            id="agenda-tab"
            aria-controls="agenda-panel"
            :selected="active === 'agenda'"
            @click="active = 'agenda'"
          >
            Agenda
          </AppSectionTab>
        </div>
        <p
          id="overview-panel"
          v-show="active === 'overview'"
          class="pt-4"
          role="tabpanel"
          aria-labelledby="overview-tab"
        >
          Doors open at 09:00.
        </p>
        <p
          id="agenda-panel"
          v-show="active === 'agenda'"
          class="pt-4"
          role="tabpanel"
          aria-labelledby="agenda-tab"
        >
          Build Time begins at 10:00.
        </p>
      </div>
    `
  })
}

export const LinkedTab: Story = {
  args: { to: '#linked-agenda-panel' },
  render: args => ({
    components: { AppSectionTab },
    setup: () => ({ args }),
    template: `
      <div class="max-w-sm">
        <div class="flex gap-5" role="tablist" aria-label="Event sections">
          <AppSectionTab
            id="linked-agenda-tab"
            v-bind="args"
            aria-controls="linked-agenda-panel"
            @click.prevent
          >
            Agenda
          </AppSectionTab>
        </div>
        <p id="linked-agenda-panel" class="pt-4" role="tabpanel" aria-labelledby="linked-agenda-tab">
          Build Time begins at 10:00.
        </p>
      </div>
    `
  })
}
