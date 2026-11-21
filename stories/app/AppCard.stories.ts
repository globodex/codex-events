import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppButton from '~/components/AppButton.vue'
import AppCard from '~/components/AppCard.vue'

const meta = {
  title: 'Shared/AppCard',
  component: AppCard,
  args: { class: 'max-w-md' }
} satisfies Meta<typeof AppCard>

export default meta

type Story = StoryObj<typeof meta>

export const HeaderAndBody: Story = {
  render: args => ({
    components: { AppButton, AppCard },
    setup: () => ({ args }),
    template: `
      <AppCard v-bind="args">
        <template #header><h2 class="font-semibold">Venue</h2></template>
        <div class="space-y-3">
          <p class="text-sm">The main entrance opens at 09:00.</p>
          <AppButton label="View floor plan" color="neutral" variant="outline" />
        </div>
      </AppCard>
    `
  })
}

export const Subtle: Story = {
  args: { variant: 'subtle' },
  render: args => ({
    components: { AppCard },
    setup: () => ({ args }),
    template: '<AppCard v-bind="args"><p>No workshops are scheduled at this time.</p></AppCard>'
  })
}
