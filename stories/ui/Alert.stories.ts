import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { CircleAlert, Info } from 'lucide-vue-next'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'

const meta = {
  title: 'Primitives/Alert',
  component: Alert
} satisfies Meta<typeof Alert>

export default meta

type Story = StoryObj<typeof meta>

export const Variants: Story = {
  render: () => ({
    components: { Alert, AlertDescription, AlertTitle, CircleAlert, Info },
    template: `
      <div class="grid max-w-md gap-4">
        <Alert>
          <Info aria-hidden="true" />
          <AlertTitle>Room change</AlertTitle>
          <AlertDescription>The workshop has moved to Room B.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Changes could not be saved</AlertTitle>
          <AlertDescription>Check your connection and try again.</AlertDescription>
        </Alert>
      </div>
    `
  })
}
