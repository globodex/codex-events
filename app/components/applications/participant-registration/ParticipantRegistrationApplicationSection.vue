<script setup lang="ts">
import type {
  ParticipantAiKnowledgeLevelInput
} from '~/domains/applications/participant-application'
import type {
  ParticipantRegistrationDraft,
  ParticipantRegistrationFieldId,
  ResolvedParticipantRegistrationDefinition
} from '~/domains/applications/participant-registration-definition'

import type { CustomQuestionDefinition } from '#shared/domains/events/custom-questions'

import ParticipantRegistrationField from './ParticipantRegistrationField.vue'
import { getEmptyCustomQuestionAnswerValue } from '#shared/domains/events/custom-questions'
import CustomQuestionControl from '~/components/events/molecules/CustomQuestionControl.vue'
import {
  aiKnowledgeLevelOptionLabels,
  aiKnowledgeLevelValues
} from '~/domains/applications/participant-application'
import {
  participantRegistrationQuestionFieldId,
  participantRegistrationSectionDomId
} from '~/domains/applications/participant-registration-definition'

const props = defineProps<{
  draft: ParticipantRegistrationDraft
  definition: ResolvedParticipantRegistrationDefinition
  errors: Record<string, string>
  disabled?: boolean
}>()

const emit = defineEmits<{
  updateAiKnowledgeLevel: [value: ParticipantAiKnowledgeLevelInput]
  updateWhyThisEvent: [value: string]
  updateProofOfExecutionUrl: [value: string]
  updateRegistrationAnswer: [questionId: string, value: string | boolean]
}>()

function required(fieldId: ParticipantRegistrationFieldId) {
  return props.definition.application.fields.find(field => field.id === fieldId)?.required ?? false
}

function questionControlId(question: CustomQuestionDefinition) {
  return `registration-question-${question.id}`
}

/**
 * The label above a question. An acknowledgment is a statement on its checkbox, so its label names
 * the kind of field, like "Attendance confirmation" in the commitments section.
 */
function questionLabel(question: CustomQuestionDefinition) {
  return question.type === 'acknowledgement' ? 'Confirmation' : question.prompt
}
</script>

<template>
  <section
    v-if="props.definition.application.visible"
    :id="participantRegistrationSectionDomId('application')"
    tabindex="-1"
    class="scroll-mt-24 space-y-4 border-b border-black/8 pb-5 outline-none dark:border-white/[0.08]"
  >
    <h2 class="text-[14px] font-semibold text-highlighted">
      Your application
    </h2>

    <ParticipantRegistrationField
      v-if="props.definition.application.showAiKnowledge"
      field-id="aiKnowledgeLevel"
      label="AI Knowledge"
      :required="required('aiKnowledgeLevel')"
      label-for="participant-registration-ai-knowledge"
      :error="props.errors.aiKnowledgeLevel"
    >
      <AppSelect
        id="participant-registration-ai-knowledge"
        :model-value="props.draft.aiKnowledgeLevel"
        :disabled="props.disabled"
        @update:model-value="emit('updateAiKnowledgeLevel', String($event ?? '') as ParticipantAiKnowledgeLevelInput)"
      >
        <option value="">
          Please select
        </option>
        <option
          v-for="level in aiKnowledgeLevelValues"
          :key="level"
          :value="level"
        >
          {{ aiKnowledgeLevelOptionLabels[level] }}
        </option>
      </AppSelect>
    </ParticipantRegistrationField>

    <ParticipantRegistrationField
      v-if="props.definition.application.showWhyThisEvent"
      field-id="whyThisEvent"
      label="Why this event"
      :required="required('whyThisEvent')"
      label-for="participant-registration-why"
      :error="props.errors.whyThisEvent"
    >
      <AppTextarea
        id="participant-registration-why"
        :model-value="props.draft.whyThisEvent"
        :disabled="props.disabled"
        :rows="5"
        placeholder="Share what you plan to build and learn."
        @update:model-value="emit('updateWhyThisEvent', String($event ?? ''))"
      />
    </ParticipantRegistrationField>

    <ParticipantRegistrationField
      v-if="props.definition.application.showProofOfExecution"
      field-id="proofOfExecutionUrl"
      label="Proof of execution links"
      :required="required('proofOfExecutionUrl')"
      label-for="participant-registration-proof"
      :error="props.errors.proofOfExecutionUrl"
    >
      <AppInput
        id="participant-registration-proof"
        :model-value="props.draft.proofOfExecutionUrl"
        :disabled="props.disabled"
        type="text"
        inputmode="url"
        placeholder="https://github.com/your-project, https://demo.example.com"
        @update:model-value="emit('updateProofOfExecutionUrl', String($event ?? ''))"
      />
      <template #helper>
        Separate multiple links with commas.
      </template>
    </ParticipantRegistrationField>

    <ParticipantRegistrationField
      v-for="question in props.definition.application.questions"
      :key="question.id"
      :field-id="participantRegistrationQuestionFieldId(question.id)"
      :label="questionLabel(question)"
      :required="question.required"
      :label-for="question.type === 'acknowledgement' ? undefined : questionControlId(question)"
      :error="props.errors[participantRegistrationQuestionFieldId(question.id)]"
    >
      <CustomQuestionControl
        :id="questionControlId(question)"
        :question="question"
        :model-value="props.draft.registrationAnswers[question.id] ?? getEmptyCustomQuestionAnswerValue(question)"
        :disabled="props.disabled"
        @update:model-value="emit('updateRegistrationAnswer', question.id, $event)"
      />
    </ParticipantRegistrationField>
  </section>
</template>
