import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import { shallowRef } from 'vue'

import AccountEventTracksPanel from '~/components/account/events/AccountEventTracksPanel.vue'

const tracks = [
  {
    id: 'tools',
    name: 'Tools and workflows',
    shortDescription: 'Connect the tools you use every day.',
    fullDescription: 'Build a small workflow that reads from one tool and acts in another.',
    displayOrder: 1,
    resources: [{
      title: 'Project notes',
      url: '#project-notes',
      description: 'A place to sketch what you plan to build.',
      displayOrder: 1
    }]
  },
  {
    id: 'interfaces',
    name: 'Interfaces',
    shortDescription: 'Make a useful workflow easier to use.',
    fullDescription: 'Start with a task you repeat often. Build an interface for it and try it with another participant.',
    displayOrder: 2,
    resources: []
  }
]

const meta = {
  title: 'Participant/Events/Tracks',
  component: AccountEventTracksPanel,
  args: { eventType: 'build', tracks, canSelectTrack: true, selectedTrackId: null },
  render: args => ({
    components: { AccountEventTracksPanel },
    setup: () => ({ args, selectedTrackId: shallowRef(args.selectedTrackId) }),
    template: `
      <AccountEventTracksPanel
        v-bind="args"
        :selected-track-id="selectedTrackId"
        @select-track="selectedTrackId = $event"
      />
    `
  })
} satisfies Meta<typeof AccountEventTracksPanel>

export default meta
type Story = StoryObj<typeof meta>

export const ChooseTrack: Story = {}
export const TrackSelected: Story = { args: { selectedTrackId: 'tools' } }
