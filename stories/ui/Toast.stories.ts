import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Toaster } from '~/components/ui/sonner'

const notifications = [
  { type: 'success', message: 'Changes saved' },
  { type: 'info', message: 'The agenda has been updated' },
  { type: 'warning', message: 'This session overlaps another session' },
  { type: 'error', message: 'Changes could not be saved' },
  { type: 'loading', message: 'Saving changes…' }
] as const

const meta = {
  title: 'Primitives/Toast',
  component: Toaster
} satisfies Meta<typeof Toaster>

export default meta

type Story = StoryObj<typeof meta>

export const Notifications: Story = {
  render: () => ({
    components: { Button, Toaster },
    setup: () => ({ notifications, toast }),
    template: `
      <Toaster position="bottom-right" close-button />
      <div class="flex flex-wrap gap-3">
        <Button
          v-for="{ type, message } in notifications"
          :key="type"
          type="button"
          variant="outline"
          @click="toast[type](message, { id: type })"
        >
          {{ type }}
        </Button>
        <Button type="button" variant="ghost" @click="toast.dismiss()">Dismiss all</Button>
      </div>
    `
  })
}
