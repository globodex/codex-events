import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { Copy } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Tooltip, TooltipArrow, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'

const meta = {
  title: 'Primitives/Tooltip',
  component: Tooltip
} satisfies Meta<typeof Tooltip>

export default meta

type Story = StoryObj<typeof meta>

export const IconButton: Story = {
  render: () => ({
    components: { Copy, Button, Tooltip, TooltipArrow, TooltipContent, TooltipProvider, TooltipTrigger },
    template: `
      <TooltipProvider :delay-duration="250">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button type="button" size="icon" variant="outline" aria-label="Copy link">
              <Copy aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Copy link
            <TooltipArrow class="fill-white dark:fill-[#161616]" />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    `
  })
}
