<script setup lang="ts">
import type {
  ParticipantAiKnowledgeLevelInput
} from '~/domains/applications/participant-application'
import type {
  ParticipantRegistrationDraft,
  ParticipantRegistrationFieldId,
  ResolvedParticipantRegistrationDefinition
} from '~/domains/applications/participant-registration-definition'

import ParticipantRegistrationField from './ParticipantRegistrationField.vue'
import {
  aiKnowledgeLevelOptionLabels,
  aiKnowledgeLevelValues
} from '~/domains/applications/participant-application'
import { participantRegistrationSectionDomId } from '~/domains/applications/participant-registration-definition'

const props = defineProps<{
  draft: ParticipantRegistrationDraft
  definition: ResolvedParticipantRegistrationDefinition
  errors: Record<string, string>
  disabled?: boolean
}>()

const emit = defineEmits<{
  updateSelectedTrackId: [value: string]
  updateAiKnowledgeLevel: [value: ParticipantAiKnowledgeLevelInput]
  updateWhyThisEvent: [value: string]
  updateProofOfExecutionUrl: [value: string]
}>()

const selectedTrack = computed(() => props.definition.application.trackOptions
  .find(track => track.id === props.draft.selectedTrackId) ?? null)

function required(fieldId: ParticipantRegistrationFieldId) {
  return props.definition.application.fields.find(field => field.id === fieldId)?.required ?? false
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
      v-if="props.definition.application.showTrackSelection"
      field-id="selectedTrackId"
      label="Track"
      required
      label-for="participant-registration-track"
      :error="props.errors.selectedTrackId"
    >
      <AppSelect
        id="participant-registration-track"
        :model-value="props.draft.selectedTrackId"
        :disabled="props.disabled"
        @update:model-value="emit('updateSelectedTrackId', String($event ?? ''))"
      >
        <option value="">
          Choose your track
        </option>
        <option
          v-for="track in props.definition.application.trackOptions"
          :key="track.id"
          :value="track.id"
        >
          {{ track.name }}
        </option>
      </AppSelect>
      <template
        v-if="selectedTrack"
        #helper
      >
        <AppMarkdownRenderer
          :source="selectedTrack.shortDescription"
          class="max-w-[68ch]"
        />
      </template>
    </ParticipantRegistrationField>

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
  </section>
</template>
