import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppButton from '~/components/AppButton.vue'
import AppTooltip from '~/components/AppTooltip.vue'

const meta = {
  title: 'Shared/AppTooltip',
  component: AppTooltip,
  args: { text: 'Copy link' },
  parameters: { layout: 'centered' }
} satisfies Meta<typeof AppTooltip>

export default meta

type Story = StoryObj<typeof meta>

export const OnHoverOrFocus: Story = {
  render: args => ({
    components: { AppButton, AppTooltip },
    setup: () => ({ args }),
    template: `
      <AppTooltip v-bind="args">
        <AppButton
          color="neutral"
          variant="ghost"
          size="sm"
          class="w-8 p-0"
          aria-label="Copy link"
          icon="i-lucide-copy"
        />
      </AppTooltip>
    `
  })
}
