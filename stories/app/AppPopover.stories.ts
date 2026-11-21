import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppButton from '~/components/AppButton.vue'
import AppPopover from '~/components/AppPopover.vue'

const meta = {
  title: 'Shared/AppPopover',
  component: AppPopover,
  args: { align: 'start', contentClass: 'space-y-1' }
} satisfies Meta<typeof AppPopover>

export default meta

type Story = StoryObj<typeof meta>

export const RoomDetails: Story = {
  render: args => ({
    components: { AppButton, AppPopover },
    setup: () => ({ args }),
    template: `
      <AppPopover v-bind="args">
        <template #trigger>
          <AppButton label="Workshop A" color="neutral" variant="outline" icon="i-lucide-map-pin" />
        </template>
        <p class="font-medium">Workshop A</p>
        <p class="text-sm text-muted">Ground floor</p>
      </AppPopover>
    `
  })
}
