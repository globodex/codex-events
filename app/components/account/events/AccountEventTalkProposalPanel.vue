<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'

import type { AccountEventEntryEvent, AccountEventEntryTalkProposal } from '#shared/domains/events/account-event-entry-page'
import { getEmptyCustomQuestionAnswerValue } from '#shared/domains/events/custom-questions'
import { isTalkProposalWindowOpen } from '#shared/domains/talk-proposals/window'
import { getTalkProposalAnswerIssues } from '#shared/domains/talk-proposals/answer-issues'
import { normalizeApiError } from '~/lib/api'
import CustomQuestionInput from '~/components/events/molecules/CustomQuestionInput.vue'
import {
  createTalkProposalAnswers,
  talkProposalFormSchema,
  talkProposalStatusLabels,
  type TalkProposalFormValues
} from '~/domains/talk-proposals'
import { useApiClient } from '~/composables/useApiClient'

const props = defineProps<{
  event: AccountEventEntryEvent
  applicationStatus: 'submitted' | 'approved' | 'rejected' | 'withdrawn' | null
  proposal: AccountEventEntryTalkProposal | null
  refreshPage: (eventSlug: string) => Promise<void>
}>()

const apiFetch = useApiClient()
const actionPending = ref(false)
const errorMessage = ref('')
const toast = useToast()

const { errors, defineField, handleSubmit, submitCount } = useForm({
  validationSchema: toTypedSchema(talkProposalFormSchema),
  initialValues: {
    title: props.proposal?.title ?? '',
    abstract: props.proposal?.abstract ?? '',
    demoOrSlidesUrl: props.proposal?.demoOrSlidesUrl ?? '',
    questionSetRevision: props.event.talkProposalQuestionsRevision,
    answers: createTalkProposalAnswers(props.event.talkProposalQuestions, props.proposal?.answers)
  }
})
const [title] = defineField('title')
const [abstract] = defineField('abstract')
const [demoOrSlidesUrl] = defineField('demoOrSlidesUrl')
const [answers] = defineField('answers')
const proposalAnswers = computed(() => answers.value ?? [])

const hasEligibleRegistration = computed(() => props.applicationStatus === 'submitted' || props.applicationStatus === 'approved')
const now = useEventDeadlineClock(() => [props.event.talkProposalOpensAt, props.event.talkProposalClosesAt])
const windowOpen = computed(() => isTalkProposalWindowOpen(props.event.talkProposalOpensAt, props.event.talkProposalClosesAt, now.value.getTime()))
const canMutate = computed(() => hasEligibleRegistration.value && windowOpen.value)
const canEdit = computed(() => canMutate.value && (!props.proposal || props.proposal.status === 'draft'))
const statusLabel = computed(() => props.proposal ? talkProposalStatusLabels[props.proposal.status] : '')
const questionErrors = ref<Record<string, string>>({})

function updateAnswer(index: number, value: string | boolean) {
  answers.value = proposalAnswers.value.map((answer, currentIndex) => currentIndex === index
    ? { ...answer, value }
    : answer)
  Reflect.deleteProperty(questionErrors.value, props.event.talkProposalQuestions[index]?.id ?? '')
}

const successMessages = {
  draft: 'Draft saved',
  submit: 'Talk proposal submitted',
  withdraw: 'Talk proposal withdrawn',
  revise: 'Talk proposal ready to revise'
}

async function saveProposal(action: keyof typeof successMessages, body?: TalkProposalFormValues) {
  if (actionPending.value) return
  actionPending.value = true
  errorMessage.value = ''
  try {
    const { id, slug } = props.event
    const path = `/api/events/${id}/talk-proposals/me`
    await apiFetch(action === 'draft' ? path : `${path}/actions/${action}`, {
      method: action === 'draft' && props.proposal ? 'PATCH' : 'POST',
      body
    })
    await props.refreshPage(slug)
    toast.add({ title: successMessages[action], color: 'success' })
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    actionPending.value = false
  }
}

const saveDraft = handleSubmit(values => saveProposal('draft', values))
const submitProposal = handleSubmit((values) => {
  const issues = getTalkProposalAnswerIssues(props.event.talkProposalQuestions, values.answers, true)
  questionErrors.value = Object.fromEntries(issues.map(issue => [issue.questionId, issue.message]))
  if (issues.length === 0) return saveProposal('submit', values)
})
</script>

<template>
  <AppCard data-testid="participant-talk-proposal-panel">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold text-highlighted">
          Talk proposal
        </h2>
        <AppBadge
          v-if="proposal"
          :color="proposal.status === 'accepted' ? 'success' : proposal.status === 'rejected' ? 'error' : 'neutral'"
          variant="soft"
        >
          {{ statusLabel }}
        </AppBadge>
      </div>
    </template>

    <AppAlert
      v-if="errorMessage"
      class="mb-5"
      color="error"
      variant="soft"
      title="Unable to update your Talk proposal"
      :description="errorMessage"
    />

    <AppAlert
      v-if="!hasEligibleRegistration"
      class="mb-5"
      color="warning"
      variant="soft"
      title="Changes are paused"
      description="Your event registration must be submitted or approved before you can change this Talk proposal."
    />
    <AppAlert
      v-else-if="!windowOpen && proposal?.status !== 'accepted' && proposal?.status !== 'rejected'"
      class="mb-5"
      color="info"
      variant="soft"
      title="The Call for talks is closed"
      description="Your Talk proposal remains available here, but it can no longer be changed."
    />

    <AppAlert
      v-if="proposal?.status === 'accepted' || proposal?.status === 'rejected'"
      class="mb-5"
      :color="proposal.status === 'accepted' ? 'success' : 'neutral'"
      variant="soft"
      :title="proposal.status === 'accepted' ? 'Your talk was accepted' : 'Your talk was not accepted'"
      :description="proposal.decisionMessage || undefined"
    />

    <form
      class="space-y-5"
      @submit.prevent="saveDraft"
    >
      <AppFormField
        name="talk-proposal-title"
        label="Title"
      >
        <AppInput
          id="talk-proposal-title"
          v-model="title"
          :disabled="!canEdit || actionPending"
        />
        <p
          v-if="submitCount > 0 && errors.title"
          class="text-xs text-error"
        >
          {{ errors.title }}
        </p>
      </AppFormField>

      <AppFormField
        name="talk-proposal-abstract"
        label="Abstract"
      >
        <AppTextarea
          id="talk-proposal-abstract"
          v-model="abstract"
          :disabled="!canEdit || actionPending"
          :rows="8"
        />
        <p
          v-if="submitCount > 0 && errors.abstract"
          class="text-xs text-error"
        >
          {{ errors.abstract }}
        </p>
      </AppFormField>

      <AppFormField
        name="talk-proposal-url"
        label="Demo or slides URL"
      >
        <AppInput
          id="talk-proposal-url"
          v-model="demoOrSlidesUrl"
          type="url"
          :disabled="!canEdit || actionPending"
        />
        <p
          v-if="submitCount > 0 && errors.demoOrSlidesUrl"
          class="text-xs text-error"
        >
          {{ errors.demoOrSlidesUrl }}
        </p>
      </AppFormField>

      <CustomQuestionInput
        v-for="(question, index) in props.event.talkProposalQuestions"
        :key="question.id"
        :question="question"
        :model-value="proposalAnswers[index]?.value ?? getEmptyCustomQuestionAnswerValue(question)"
        :disabled="!canEdit || actionPending"
        :error="questionErrors[question.id]"
        @update:model-value="updateAnswer(index, $event)"
      />

      <div class="flex flex-wrap gap-3 border-t border-black/8 pt-5 dark:border-white/[0.08]">
        <AppButton
          v-if="canEdit"
          type="submit"
          :loading="actionPending"
          :disabled="actionPending"
        >
          {{ proposal ? 'Save draft' : 'Create draft' }}
        </AppButton>
        <AppButton
          v-if="proposal?.status === 'draft' && canMutate"
          type="button"
          color="primary"
          :loading="actionPending"
          :disabled="actionPending"
          @click="submitProposal"
        >
          Submit proposal
        </AppButton>
        <AppButton
          v-if="proposal?.status === 'submitted' && canMutate"
          type="button"
          color="error"
          variant="soft"
          :loading="actionPending"
          :disabled="actionPending"
          @click="saveProposal('withdraw')"
        >
          Withdraw proposal
        </AppButton>
        <AppButton
          v-if="proposal?.status === 'withdrawn' && canMutate"
          type="button"
          color="neutral"
          variant="soft"
          :loading="actionPending"
          :disabled="actionPending"
          @click="saveProposal('revise')"
        >
          Revise proposal
        </AppButton>
      </div>
    </form>
  </AppCard>
</template>
