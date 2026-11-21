import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppMarkdownRenderer from '~/components/AppMarkdownRenderer.vue'

const source = `# Workshop checklist

Bring a **charged laptop** with the latest version installed.

- Join your workshop room at **11:00**.
- Open a terminal and run \`git status\`.

> Ask a mentor if setup takes more than five minutes.
`

const meta = {
  title: 'Shared/AppMarkdownRenderer',
  component: AppMarkdownRenderer,
  args: { source, class: 'max-w-xl' }
} satisfies Meta<typeof AppMarkdownRenderer>

export default meta

type Story = StoryObj<typeof meta>

export const WorkshopNotes: Story = {}

export const WithoutLeadingHeading: Story = {
  args: { stripLeadingHeading: true }
}
