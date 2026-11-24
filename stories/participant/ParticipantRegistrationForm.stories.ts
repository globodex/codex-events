import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import { ref } from 'vue'
import { fn } from 'storybook/test'

import ParticipantRegistrationForm from '~/components/applications/participant-registration/ParticipantRegistrationForm.vue'
import {
  createParticipantRegistrationDraft,
  resolveParticipantRegistrationDefinition
} from '~/domains/applications/participant-registration-definition'

const registrationEvent = {
  eventType: 'build',
  slug: 'build-day',
  state: 'registration_open',
  city: 'Vienna',
  country: 'Austria',
  autoApproveApplications: false
} as const

const definition = resolveParticipantRegistrationDefinition({
  event: {
    ...registrationEvent,
    inPersonEvent: true,
    applicationWhyThisEventVisible: true,
    applicationProofOfExecutionVisible: false,
    applicationTeamIntentVisible: true,
    applicationAiKnowledgeVisible: false,
    requireWhyThisEvent: true,
    requireProofOfExecution: false,
    requireTeamIntent: false,
    requireAiKnowledge: false
  },
  profileFields: [],
  trackOptions: [],
  maxTeamMembers: 4,
  currentApplicationTerms: null,
  registrationQuestions: [],
  talkProposal: null
})

const meta = {
  title: 'Participant/Events/Registration',
  component: ParticipantRegistrationForm,
  args: {
    event: registrationEvent,
    submissionPolicy: { isAllowed: true },
    inPersonCommitmentDateLabel: 'December 5',
    onSubmitApplication: fn()
  },
  argTypes: {
    definition: { control: false },
    modelValue: { control: false }
  },
  render: args => ({
    components: { ParticipantRegistrationForm },
    setup: () => ({ args, draft: ref(createParticipantRegistrationDraft()), definition }),
    template: `
      <ParticipantRegistrationForm
        v-bind="args"
        v-model="draft"
        :definition="definition"
      />
    `
  })
} satisfies Meta<typeof ParticipantRegistrationForm>

export default meta
type Story = StoryObj<Partial<InstanceType<typeof ParticipantRegistrationForm>['$props']>>

export const Open: Story = {}
export const Loading: Story = { args: { isLoading: true } }
export const SubmissionFailed: Story = {
  args: { submissionError: 'The application could not be submitted. Try again.' }
}
