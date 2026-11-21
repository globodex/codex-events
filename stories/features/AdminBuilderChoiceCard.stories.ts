import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { ref } from 'vue'
import AdminBuilderChoiceCard from '~/components/admin/builder/molecules/AdminBuilderChoiceCard.vue'

const meta = {
  title: 'Admin/Event builder/Choice card',
  component: AdminBuilderChoiceCard,
  args: {
    role: 'checkbox',
    label: 'Live pitch',
    description: 'Shortlisted teams present on stage and the judges score the pitch.',
    checked: false,
    disabled: false
  },
  decorators: [() => ({ template: '<div class="mx-auto max-w-xl"><story /></div>' })]
} satisfies Meta<typeof AdminBuilderChoiceCard>

export default meta

type Story = StoryObj<typeof meta>

export const Unchecked: Story = {}

export const Checked: Story = {
  args: { checked: true }
}

export const Disabled: Story = {
  args: { disabled: true }
}

export const CreditsClaiming: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    components: { AdminBuilderChoiceCard },
    setup() {
      const selected = ref<'regular' | 'simplified'>('regular')
      return { selected }
    },
    template: `
      <div class="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Credits claiming method">
        <AdminBuilderChoiceCard
          role="radio"
          label="Regular claiming"
          description="Approved participants sign in and claim one value from each offer."
          :checked="selected === 'regular'"
          @click="selected = 'regular'"
        />
        <AdminBuilderChoiceCard
          role="radio"
          label="Simplified claiming"
          description="Eligible attendees scan a QR and confirm their email."
          :checked="selected === 'simplified'"
          @click="selected = 'simplified'"
        />
      </div>
    `
  })
}
