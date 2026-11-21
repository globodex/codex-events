import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventCertificateCard from '~/components/public/events/EventCertificateCard.vue'
import { publicCertificate, publicPrize, publishedProject } from './fixtures/build-day'

const meta = {
  title: 'Public/Outcomes/Certificate',
  component: EventCertificateCard,
  args: { certificate: publicCertificate },
  render: args => ({
    components: { EventCertificateCard },
    setup: () => ({ args }),
    template: '<div class="mx-auto max-w-xl"><EventCertificateCard v-bind="args" /></div>'
  })
} satisfies Meta<typeof EventCertificateCard>

export default meta

type Story = StoryObj<typeof meta>

export const Participation: Story = {}

export const Winner: Story = {
  args: {
    certificate: {
      ...publicCertificate,
      eventName: 'Codex Community Hackathon',
      eventSlug: 'storybook-hackathon',
      eventType: 'hackathon',
      placement: 1,
      teamName: publishedProject.teamName,
      projectName: publishedProject.projectName,
      prizes: [publicPrize.name]
    }
  }
}
