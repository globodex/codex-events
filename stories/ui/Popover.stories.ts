import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger } from '~/components/ui/popover'

const meta = {
  title: 'Primitives/Popover',
  component: Popover
} satisfies Meta<typeof Popover>

export default meta

type Story = StoryObj<typeof meta>

export const RoomName: Story = {
  render: () => ({
    components: { Button, Input, Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger },
    template: `
      <Popover>
        <PopoverAnchor as-child>
          <div class="flex w-fit items-center gap-3">
            <span>Room B</span>
            <PopoverTrigger as-child>
              <Button type="button" variant="outline">Edit room</Button>
            </PopoverTrigger>
          </div>
        </PopoverAnchor>
        <PopoverContent align="start" class="grid gap-3">
          <label class="grid gap-2 text-sm">
            Room name
            <Input default-value="Room B" />
          </label>
          <PopoverClose as-child>
            <Button type="button" class="justify-self-end">Done</Button>
          </PopoverClose>
        </PopoverContent>
      </Popover>
    `
  })
}
