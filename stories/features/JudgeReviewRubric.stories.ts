import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { CriterionScoreDraft } from '~/domains/judging/workspace'

import { shallowRef } from 'vue'

import JudgeReviewRubric from '~/components/judging/JudgeReviewRubric.vue'

const criteria: CriterionScoreDraft[] = [
  {
    evaluationCriterionId: 'usefulness',
    criterionName: 'Usefulness',
    criterionDescription: 'How well does the project solve a problem for its intended users?',
    criterionWeight: 60,
    score: '4',
    comment: 'The demo shows how the tool saves time during a handoff.'
  },
  {
    evaluationCriterionId: 'implementation',
    criterionName: 'Implementation',
    criterionDescription: 'How well does the working prototype deliver the team’s idea?',
    criterionWeight: 40,
    score: '',
    comment: ''
  }
]

const meta = {
  title: 'Judging/Review rubric',
  component: JudgeReviewRubric,
  args: { modelValue: criteria },
  argTypes: { modelValue: { control: false } },
  render: args => ({
    components: { JudgeReviewRubric },
    setup: () => ({ args, drafts: shallowRef(args.modelValue) }),
    template: '<JudgeReviewRubric v-bind="args" v-model="drafts" />'
  })
} satisfies Meta<typeof JudgeReviewRubric>

export default meta
type Story = StoryObj<typeof meta>

export const Scoring: Story = {}

export const ReadOnly: Story = {
  args: { readonly: true }
}
