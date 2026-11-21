import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppAvatar from '~/components/AppAvatar.vue'

const meta = {
  title: 'Shared/AppAvatar',
  component: AppAvatar,
  args: { alt: 'Sam Rivera' }
} satisfies Meta<typeof AppAvatar>

export default meta

type Story = StoryObj<typeof meta>

export const Initials: Story = {}

export const Icon: Story = {
  args: { fallback: 'icon' }
}

export const Sizes: Story = {
  render: args => ({
    components: { AppAvatar },
    setup: () => ({ args }),
    template: `
      <div class="flex items-center gap-3">
        <AppAvatar v-bind="args" size="sm" />
        <AppAvatar v-bind="args" size="lg" />
        <AppAvatar v-bind="args" size="3xl" />
      </div>
    `
  })
}
