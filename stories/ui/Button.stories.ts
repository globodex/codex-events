import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { ButtonVariants } from '~/components/ui/button'
import { Plus } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'

const variants = [
  'default', 'secondary', 'outline', 'ghost', 'link', 'destructive'
] as const satisfies readonly NonNullable<ButtonVariants['variant']>[]

const sizes = [
  'sm', 'default', 'lg'
] as const satisfies readonly NonNullable<ButtonVariants['size']>[]

const iconSizes = [
  'icon-sm', 'icon', 'icon-lg'
] as const satisfies readonly NonNullable<ButtonVariants['size']>[]

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: { variant: 'default', size: 'default' },
  argTypes: {
    variant: { control: 'select', options: variants },
    size: { control: 'select', options: [...sizes, ...iconSizes] }
  }
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {
  render: args => ({
    components: { Button, Plus },
    setup: () => ({ args }),
    template: `
      <Button v-bind="args" type="button" aria-label="Add session">
        <Plus aria-hidden="true" />
        <template v-if="!args.size?.startsWith('icon')">Add session</template>
      </Button>
    `
  })
}

export const Variants: Story = {
  render: () => ({
    components: { Button },
    setup: () => ({ variants }),
    template: `
      <div class="flex flex-wrap items-center gap-3">
        <Button v-for="variant in variants" :key="variant" :variant="variant" type="button">
          {{ variant }}
        </Button>
        <Button type="button" disabled>Disabled</Button>
      </div>
    `
  })
}

export const Sizes: Story = {
  render: () => ({
    components: { Button, Plus },
    setup: () => ({ sizes, iconSizes }),
    template: `
      <div class="flex flex-wrap items-center gap-3">
        <Button v-for="size in sizes" :key="size" :size="size" type="button">{{ size }}</Button>
        <Button
          v-for="size in iconSizes"
          :key="size"
          :size="size"
          :aria-label="size"
          type="button"
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
    `
  })
}
