import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import { ref } from 'vue'
import { fn } from 'storybook/test'

import AccountSettingsProfileForm from '~/components/account/AccountSettingsProfileForm.vue'

const profile = {
  firstName: 'Casey',
  familyName: 'Rivera',
  company: '',
  bio: 'Building tools for small teams.',
  xProfileUrl: '',
  linkedinProfileUrl: '',
  githubProfileUrl: '',
  chatgptEmail: '',
  openaiOrgId: '',
  lumaEmail: 'casey@example.com'
}

const meta = {
  title: 'Participant/Settings/Profile',
  component: AccountSettingsProfileForm,
  args: { modelValue: profile, onSubmit: fn() },
  render: args => ({
    components: { AccountSettingsProfileForm },
    setup: () => ({ args, profile: ref({ ...args.modelValue }) }),
    template: '<AccountSettingsProfileForm v-bind="args" v-model="profile" />'
  })
} satisfies Meta<typeof AccountSettingsProfileForm>

export default meta
type Story = StoryObj<typeof meta>

export const Editing: Story = {}
export const Saving: Story = { args: { pending: true } }
export const SaveFailed: Story = {
  args: { error: 'Your changes could not be saved. Try again.' }
}
