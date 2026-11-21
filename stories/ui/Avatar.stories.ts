import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'

const meta = {
  title: 'Primitives/Avatar',
  component: Avatar
} satisfies Meta<typeof Avatar>

export default meta

type Story = StoryObj<typeof meta>

export const ImageAndFallback: Story = {
  render: () => ({
    components: { Avatar, AvatarFallback, AvatarImage },
    template: `
      <div class="flex gap-3">
        <Avatar>
          <AvatarImage src="./platform-mark.png" alt="Codex Events" />
          <AvatarFallback>CE</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback aria-label="Jamie Doe">JD</AvatarFallback>
        </Avatar>
      </div>
    `
  })
}
