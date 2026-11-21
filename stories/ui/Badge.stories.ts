import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { BadgeVariants } from '~/components/ui/badge'
import { Badge } from '~/components/ui/badge'

const badges = [
  { variant: 'default', label: 'Confirmed' },
  { variant: 'secondary', label: 'Draft' },
  { variant: 'outline', label: 'Workshop' },
  { variant: 'destructive', label: 'Cancelled' }
] as const satisfies readonly { variant: BadgeVariants['variant'], label: string }[]

const meta = {
  title: 'Primitives/Badge',
  component: Badge
} satisfies Meta<typeof Badge>

export default meta

type Story = StoryObj<typeof meta>

export const Variants: Story = {
  render: () => ({
    components: { Badge },
    setup: () => ({ badges }),
    template: `
      <div class="flex flex-wrap gap-3">
        <Badge v-for="{ variant, label } in badges" :key="variant" :variant="variant">
          {{ label }}
        </Badge>
      </div>
    `
  })
}
