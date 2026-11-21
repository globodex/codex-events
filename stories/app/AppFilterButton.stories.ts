import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import { shallowRef } from 'vue'

import AppFilterButton from '~/components/AppFilterButton.vue'

const meta = {
  title: 'Shared/AppFilterButton',
  component: AppFilterButton,
  args: { pressed: false, count: 5 }
} satisfies Meta<typeof AppFilterButton>

export default meta

type Story = StoryObj<typeof meta>

export const WithCount: Story = {
  render: args => ({
    components: { AppFilterButton },
    setup: () => ({ args }),
    template: '<AppFilterButton v-bind="args">Workshops</AppFilterButton>'
  })
}

export const Pressed: Story = {
  ...WithCount,
  args: { pressed: true }
}

export const ZeroCount: Story = {
  ...WithCount,
  args: { count: 0 }
}

export const FilterGroup: Story = {
  render: () => ({
    components: { AppFilterButton },
    setup: () => ({ selected: shallowRef('All'), filters: ['All', 'Workshops', 'Talks'] }),
    template: `
      <div class="flex flex-wrap gap-2" role="group" aria-label="Session filters">
        <AppFilterButton
          v-for="filter in filters"
          :key="filter"
          :pressed="selected === filter"
          @click="selected = filter"
        >
          {{ filter }}
        </AppFilterButton>
      </div>
    `
  })
}
