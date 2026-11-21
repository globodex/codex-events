import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppCountdownCard from '~/components/AppCountdownCard.vue'

const meta = {
  title: 'Shared/AppCountdownCard',
  component: AppCountdownCard,
  args: {
    title: 'Build Time starts soon',
    targetAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    targetLabel: 'Build Time starts',
    countdownLabel: 'Starts in',
    showTimestamp: false,
    class: 'max-w-xl'
  }
} satisfies Meta<typeof AppCountdownCard>

export default meta

type Story = StoryObj<typeof meta>

export const CountingDown: Story = {}

export const Inline: Story = {
  args: { variant: 'inline' }
}

export const Finished: Story = {
  args: {
    targetAt: '2000-01-01T00:00:00Z',
    expiredTitle: 'Build Time has ended',
    expiredDescription: 'Join everyone in the main room for demos.'
  }
}
