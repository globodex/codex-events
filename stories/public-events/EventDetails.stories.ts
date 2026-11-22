import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventAgendaPanel from '~/components/public/events/EventAgendaPanel.vue'
import EventOverviewPanel from '~/components/public/events/EventOverviewPanel.vue'
import EventTalkProposalCallout from '~/components/public/events/EventTalkProposalCallout.vue'
import EventTimeline from '~/components/public/events/EventTimeline.vue'
import EventTracksPanel from '~/components/public/events/organisms/EventTracksPanel.vue'
import { dayFromToday, publicBuildDay } from './fixtures/build-day'

const meta = {
  title: 'Public/Event/Overview layout',
  tags: ['!autodocs'],
  render: () => ({
    components: { EventOverviewPanel, EventAgendaPanel, EventTalkProposalCallout, EventTimeline, EventTracksPanel },
    setup: () => ({
      event: publicBuildDay,
      opensAt: dayFromToday(-3),
      closesAt: dayFromToday(8)
    }),
    template: `
      <div class="mx-auto max-w-[68rem] space-y-7">
        <EventTalkProposalCallout
          :opens-at="opensAt"
          :closes-at="closesAt"
          action-href="/account/events/storybook-build-day?tab=call-for-talks"
        />
        <EventOverviewPanel :description="event.description" />
        <EventTimeline :event="event" />
        <EventTracksPanel :event-type="event.eventType" :tracks="event.tracks ?? []" />
        <EventAgendaPanel :agenda-items="event.agendaItems" />
      </div>
    `
  })
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const BuildDay: Story = {}
