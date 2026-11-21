import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventAgendaPanel from '~/components/public/events/EventAgendaPanel.vue'
import EventOverviewPanel from '~/components/public/events/EventOverviewPanel.vue'
import EventTalkProposalCallout from '~/components/public/events/EventTalkProposalCallout.vue'
import EventTimeline from '~/components/public/events/EventTimeline.vue'
import { dayFromToday, publicBuildDay } from './fixtures/build-day'

const meta = {
  title: 'Public/Event/Details layout',
  tags: ['!autodocs'],
  render: () => ({
    components: { EventOverviewPanel, EventAgendaPanel, EventTalkProposalCallout, EventTimeline },
    setup: () => ({
      event: publicBuildDay,
      opensAt: dayFromToday(-3),
      closesAt: dayFromToday(8)
    }),
    template: `
      <div class="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div class="space-y-6">
          <EventOverviewPanel :description="event.description" />
          <EventTalkProposalCallout
            :opens-at="opensAt"
            :closes-at="closesAt"
            action-href="/account/events/storybook-build-day?tab=call-for-talks"
          />
          <EventAgendaPanel :agenda-items="event.agendaItems" />
        </div>
        <EventTimeline :event="event" show-address />
      </div>
    `
  })
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const BuildDay: Story = {}
