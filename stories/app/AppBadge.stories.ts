import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppBadge from '~/components/AppBadge.vue'

const meta = {
  title: 'Shared/AppBadge',
  component: AppBadge
} satisfies Meta<typeof AppBadge>

export default meta

type Story = StoryObj<typeof meta>

export const Variants: Story = {
  render: args => ({
    components: { AppBadge },
    setup: () => ({ args }),
    template: `
      <div class="flex flex-wrap items-center gap-3">
        <AppBadge v-bind="args" color="primary" variant="solid">Workshop</AppBadge>
        <AppBadge v-bind="args" color="success" variant="soft">Open</AppBadge>
        <AppBadge v-bind="args" color="warning" variant="subtle">Pending</AppBadge>
        <AppBadge v-bind="args" color="neutral" variant="outline">Draft</AppBadge>
      </div>
    `
  })
}

export const Small: Story = {
  args: { size: 'sm', color: 'info' },
  render: args => ({
    components: { AppBadge },
    setup: () => ({ args }),
    template: '<AppBadge v-bind="args">Updated</AppBadge>'
  })
}
