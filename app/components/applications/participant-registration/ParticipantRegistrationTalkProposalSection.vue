<script setup lang="ts">
import type {
  ParticipantRegistrationTalkProposalDraft,
  ResolvedParticipantRegistrationDefinition
} from '~/domains/applications/participant-registration-definition'

import TalkProposalQuestionInput from '~/components/talk-proposals/molecules/TalkProposalQuestionInput.vue'
import {
  participantRegistrationSectionDomId,
  participantRegistrationTalkQuestionFieldId
} from '~/domains/applications/participant-registration-definition'

const props = defineProps<{
  draft: ParticipantRegistrationTalkProposalDraft
  definition: ResolvedParticipantRegistrationDefinition
  errors: Record<string, string>
  disabled?: boolean
}>()

const emit = defineEmits<{
  updateTitle: [value: string]
  updateAbstract: [value: string]
  updateDemoOrSlidesUrl: [value: string]
  updateAnswer: [index: number, value: string | boolean]
}>()
</script>

<template>
  <section
    v-if="props.definition.talkProposal"
    :id="participantRegistrationSectionDomId('talk-proposal')"
    tabindex="-1"
    class="space-y-4 border-t border-black/8 pt-5 outline-none dark:border-white/[0.08]"
    data-testid="combined-talk-proposal-section"
  >
    <h2 class="text-[13px] font-medium text-highlighted dark:text-white">
      Talk proposal
    </h2>

    <div data-registration-field="talkProposal.title">
      <AppFormField
        name="combined-talk-proposal-title"
        label="Title *"
      >
        <AppInput
          id="combined-talk-proposal-title"
          :model-value="props.draft.title"
          :disabled="props.disabled"
          @update:model-value="emit('updateTitle', String($event ?? ''))"
        />
        <p
          v-if="props.errors['talkProposal.title']"
          class="text-[11px] text-error"
        >
          {{ props.errors['talkProposal.title'] }}
        </p>
      </AppFormField>
    </div>

    <div data-registration-field="talkProposal.abstract">
      <AppFormField
        name="combined-talk-proposal-abstract"
        label="Abstract *"
      >
        <AppTextarea
          id="combined-talk-proposal-abstract"
          :model-value="props.draft.abstract"
          :disabled="props.disabled"
          :rows="8"
          @update:model-value="emit('updateAbstract', String($event ?? ''))"
        />
        <p
          v-if="props.errors['talkProposal.abstract']"
          class="text-[11px] text-error"
        >
          {{ props.errors['talkProposal.abstract'] }}
        </p>
      </AppFormField>
    </div>

    <div data-registration-field="talkProposal.demoOrSlidesUrl">
      <AppFormField
        name="combined-talk-proposal-url"
        label="Demo or slides URL (optional)"
      >
        <AppInput
          id="combined-talk-proposal-url"
          :model-value="props.draft.demoOrSlidesUrl"
          type="url"
          :disabled="props.disabled"
          @update:model-value="emit('updateDemoOrSlidesUrl', String($event ?? ''))"
        />
        <p
          v-if="props.errors['talkProposal.demoOrSlidesUrl']"
          class="text-[11px] text-error"
        >
          {{ props.errors['talkProposal.demoOrSlidesUrl'] }}
        </p>
      </AppFormField>
    </div>

    <div
      v-for="(question, index) in props.definition.talkProposal.questions"
      :key="question.id"
      :data-registration-field="participantRegistrationTalkQuestionFieldId(question.id)"
    >
      <TalkProposalQuestionInput
        :question="question"
        :model-value="props.draft.answers[index]?.value ?? (question.type === 'acknowledgement' ? false : '')"
        :disabled="props.disabled"
        :error="props.errors[participantRegistrationTalkQuestionFieldId(question.id)]"
        @update:model-value="emit('updateAnswer', index, $event)"
      />
    </div>
  </section>
</template>
