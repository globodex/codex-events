<script setup lang="ts">
// Shows a confirmed participant the one thing to do next at the event:
// check in, then answer the event questions, then open the event's activities.
import type {
  CheckInFlowProgress,
  CheckInFlowSettings
} from '#shared/domains/applications/check-in-flow'
import type { CustomQuestionAnswer } from '#shared/domains/events/custom-questions'

import {
  getQuestionnaireAnswerIssues,
  hasParticipantFinishedCheckInFlow
} from '#shared/domains/applications/check-in-flow'
import { getEmptyCustomQuestionAnswerValue } from '#shared/domains/events/custom-questions'
import CustomQuestionInput from '~/components/events/molecules/CustomQuestionInput.vue'
import { useApiClient } from '~/composables/useApiClient'
import { normalizeApiError } from '~/lib/api'

const props = defineProps<{
  eventId: string
  settings: CheckInFlowSettings
  progress: CheckInFlowProgress
  /**
   * What the participant can open at the event, in the order shown. An activity that is open
   * before check-in is also listed while the participant still has to check in.
   */
  activities: Array<{ label: string, to: string, openBeforeCheckIn: boolean }>
  /** Reads the page data again. The page does not notice a check-in by itself. */
  refreshPage: () => Promise<unknown>
}>()

const apiFetch = useApiClient()

const nextStep = computed<'check-in' | 'questionnaire' | 'activities'>(() => {
  if (!props.progress.isCheckedIn) {
    return 'check-in'
  }

  return hasParticipantFinishedCheckInFlow(props.progress, props.settings) ? 'activities' : 'questionnaire'
})

const activitiesBeforeCheckIn = computed(() => props.activities.filter(activity => activity.openBeforeCheckIn))

const isReloading = ref(false)
// True once the participant asked for a reload. If the card still shows the check-in step
// afterwards, the hint tells them why nothing changed.
const hasReloaded = ref(false)

async function reloadAfterCheckIn() {
  isReloading.value = true
  await props.refreshPage()
  isReloading.value = false
  hasReloaded.value = true
}

// What the participant typed so far, by question id.
const typedValues = ref<Record<string, string | boolean>>({})
const answers = computed<CustomQuestionAnswer[]>(() =>
  props.settings.questionnaireQuestions.map(question => ({
    questionId: question.id,
    value: typedValues.value[question.id] ?? getEmptyCustomQuestionAnswerValue(question)
  }))
)
const questionErrors = ref<Record<string, string>>({})
const requestError = ref('')
const isSending = ref(false)

function updateAnswer(questionId: string, value: string | boolean) {
  typedValues.value[questionId] = value
  // The message under this question was about the old value.
  Reflect.deleteProperty(questionErrors.value, questionId)
}

async function sendAnswers() {
  const issues = getQuestionnaireAnswerIssues(props.settings.questionnaireQuestions, answers.value)
  questionErrors.value = Object.fromEntries(issues.map(issue => [issue.questionId, issue.message]))

  if (issues.length > 0) {
    return
  }

  isSending.value = true
  requestError.value = ''

  try {
    await apiFetch(`/api/events/${props.eventId}/applications/me/actions/complete-questionnaire`, {
      method: 'POST',
      body: { answers: answers.value }
    })
  } catch (error) {
    requestError.value = normalizeApiError(error).message
  } finally {
    // Read the page again after a failure too: the request fails when this page is out of date,
    // for example after the organizer changed the questions.
    await props.refreshPage()
    isSending.value = false
  }
}
</script>

<template>
  <AppCard data-testid="account-event-next-step">
    <div
      v-if="nextStep === 'check-in'"
      class="space-y-4"
    >
      <h2 class="text-lg font-semibold text-highlighted">
        Check in with the event team
      </h2>
      <p
        v-if="hasReloaded && !isReloading"
        role="status"
        class="text-sm text-muted"
      >
        Your check-in is not recorded yet. Ask the event team at the check-in desk.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <AppButton
          :loading="isReloading"
          :disabled="isReloading"
          @click="reloadAfterCheckIn"
        >
          I've checked in
        </AppButton>
        <AppButton
          v-for="activity in activitiesBeforeCheckIn"
          :key="activity.to"
          :to="activity.to"
          color="neutral"
          variant="ghost"
          trailing-icon="i-lucide-arrow-right"
        >
          {{ activity.label }}
        </AppButton>
      </div>
    </div>

    <form
      v-else-if="nextStep === 'questionnaire'"
      class="space-y-5"
      @submit.prevent="sendAnswers"
    >
      <h2 class="text-lg font-semibold text-highlighted">
        A few questions before you start
      </h2>
      <AppAlert
        v-if="requestError"
        color="error"
        variant="soft"
        title="Your answers were not saved"
        :description="requestError"
      />
      <CustomQuestionInput
        v-for="(question, index) in settings.questionnaireQuestions"
        :key="question.id"
        :question="question"
        :model-value="answers[index]!.value"
        :disabled="isSending"
        :error="questionErrors[question.id]"
        @update:model-value="updateAnswer(question.id, $event)"
      />
      <AppButton
        type="submit"
        :loading="isSending"
        :disabled="isSending"
      >
        Send answers
      </AppButton>
    </form>

    <div
      v-else
      class="space-y-4"
    >
      <h2 class="text-lg font-semibold text-highlighted">
        You're checked in
      </h2>
      <div class="flex flex-wrap gap-3">
        <AppButton
          v-for="activity in activities"
          :key="activity.to"
          :to="activity.to"
          color="neutral"
          variant="solid"
          trailing-icon="i-lucide-arrow-right"
        >
          {{ activity.label }}
        </AppButton>
      </div>
    </div>
  </AppCard>
</template>
