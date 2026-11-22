<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'

import type { ApiDataResponse } from '~/lib/api'
import type { AccountEventEntryTalkProposal } from '#shared/domains/events/account-event-entry-page'
import type {
  CustomQuestionAnswer,
  CustomQuestionDefinition
} from '#shared/domains/events/custom-questions'
import { getEmptyCustomQuestionAnswerValue } from '#shared/domains/events/custom-questions'
import { getTalkProposalAnswerIssues } from '#shared/domains/talk-proposals/answer-issues'
import { normalizeApiError } from '~/lib/api'
import CustomQuestionInput from '~/components/events/molecules/CustomQuestionInput.vue'
import {
  isTalkProposalWindowOpen,
  talkProposalFormSchema,
  talkProposalStatusLabels
} from '~/domains/talk-proposals'
import { useApiClient } from '~/composables/useApiClient'

const props = defineProps<{
  eventId: string
  applicationStatus: 'submitted' | 'approved' | 'rejected' | 'withdrawn' | null
  opensAt: string | null
  closesAt: string | null
  questions: CustomQuestionDefinition[]
  questionSetRevision: number
  proposal: AccountEventEntryTalkProposal | null
}>()
const emit = defineEmits<{
  hasProposalChange: [hasProposal: boolean]
  updated: []
}>()

const apiFetch = useApiClient()
const proposal = shallowRef<AccountEventEntryTalkProposal | null>(props.proposal)
const actionPending = ref(false)
const errorMessage = ref('')
const toast = useToast()

const { errors, defineField, handleSubmit, resetForm, submitCount } = useForm({
  validationSchema: toTypedSchema(talkProposalFormSchema),
  initialValues: {
    title: '',
    abstract: '',
    demoOrSlidesUrl: '',
    questionSetRevision: props.questionSetRevision,
    answers: []
  }
})
const [title] = defineField('title')
const [abstract] = defineField('abstract')
const [demoOrSlidesUrl] = defineField('demoOrSlidesUrl')
const [answers] = defineField('answers')
const proposalAnswers = computed(() => answers.value ?? [])

const hasEligibleRegistration = computed(() => props.applicationStatus === 'submitted' || props.applicationStatus === 'approved')
const windowOpen = computed(() => isTalkProposalWindowOpen(props.opensAt, props.closesAt))
const canMutate = computed(() => hasEligibleRegistration.value && windowOpen.value)
const canEdit = computed(() => canMutate.value && (!proposal.value || proposal.value.status === 'draft'))
const statusLabel = computed(() => proposal.value ? talkProposalStatusLabels[proposal.value.status] : '')
const questionErrors = ref<Record<string, string>>({})

function answersForQuestions(source: CustomQuestionAnswer[]) {
  const sourceById = new Map(source.map(answer => [answer.questionId, answer]))
  return props.questions.map(question => sourceById.get(question.id) ?? {
    questionId: question.id,
    value: getEmptyCustomQuestionAnswerValue(question)
  })
}

function updateAnswer(index: number, value: string | boolean) {
  answers.value = proposalAnswers.value.map((answer, currentIndex) => currentIndex === index
    ? { ...answer, value }
    : answer)
  Reflect.deleteProperty(questionErrors.value, props.questions[index]?.id ?? '')
}

function applyProposal(nextProposal: AccountEventEntryTalkProposal | null) {
  proposal.value = nextProposal
  emit('hasProposalChange', Boolean(nextProposal))
  resetForm({
    values: {
      title: nextProposal?.title ?? '',
      abstract: nextProposal?.abstract ?? '',
      demoOrSlidesUrl: nextProposal?.demoOrSlidesUrl ?? '',
      questionSetRevision: nextProposal?.questionSetRevision ?? props.questionSetRevision,
      answers: answersForQuestions(nextProposal?.answers ?? [])
    }
  })
}

watch(() => props.proposal, (nextProposal) => {
  applyProposal(nextProposal)
}, { immediate: true })

const saveDraft = handleSubmit(async (values) => {
  actionPending.value = true
  errorMessage.value = ''
  try {
    const response = await apiFetch<ApiDataResponse<AccountEventEntryTalkProposal>>(`/api/events/${props.eventId}/talk-proposals/me`, {
      method: proposal.value ? 'PATCH' : 'POST',
      body: values
    })
    applyProposal(response.data)
    emit('updated')
    toast.add({ title: 'Draft saved', color: 'success' })
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    actionPending.value = false
  }
})

async function runAction(action: 'submit' | 'withdraw' | 'revise') {
  if (action === 'submit') {
    const issues = getTalkProposalAnswerIssues(props.questions, proposalAnswers.value, true)
    questionErrors.value = Object.fromEntries(issues.map(issue => [issue.questionId, issue.message]))
    if (issues.length > 0) return
  }
  actionPending.value = true
  errorMessage.value = ''
  try {
    const response = await apiFetch<ApiDataResponse<AccountEventEntryTalkProposal>>(
      `/api/events/${props.eventId}/talk-proposals/me/actions/${action}`,
      { method: 'POST' }
    )
    applyProposal(response.data)
    emit('updated')
    toast.add({
      title: action === 'submit' ? 'Talk proposal submitted' : action === 'withdraw' ? 'Talk proposal withdrawn' : 'Talk proposal ready to revise',
      color: 'success'
    })
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    actionPending.value = false
  }
}
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
          :disabled="!canEdit"
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
          :disabled="!canEdit"
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
          :disabled="!canEdit"
        />
        <p
          v-if="submitCount > 0 && errors.demoOrSlidesUrl"
          class="text-xs text-error"
        >
          {{ errors.demoOrSlidesUrl }}
        </p>
      </AppFormField>

      <CustomQuestionInput
        v-for="(question, index) in props.questions"
        :key="question.id"
        :question="question"
        :model-value="proposalAnswers[index]?.value ?? getEmptyCustomQuestionAnswerValue(question)"
        :disabled="!canEdit"
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
          @click="runAction('submit')"
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
          @click="runAction('withdraw')"
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
          @click="runAction('revise')"
        >
          Revise proposal
        </AppButton>
      </div>
    </form>
  </AppCard>
</template>
