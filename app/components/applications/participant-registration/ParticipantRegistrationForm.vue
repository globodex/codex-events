<script setup lang="ts">
import type { PublicEvent } from '~/domains/events/presentation'
import type {
  ParticipantApplicationSubmittedTransition,
  ParticipantApplicationSubmissionPolicy,
  ParticipantRegistrationTeamMemberHint
} from '~/domains/applications/participant-application'
import type {
  ParticipantRegistrationDraft,
  ParticipantRegistrationProfileFieldKey,
  ResolvedParticipantRegistrationDefinition
} from '~/domains/applications/participant-registration-definition'

import ParticipantRegistrationApplicationSection from './ParticipantRegistrationApplicationSection.vue'
import ParticipantRegistrationCommitmentsSection from './ParticipantRegistrationCommitmentsSection.vue'
import ParticipantRegistrationParticipationSection from './ParticipantRegistrationParticipationSection.vue'
import ParticipantRegistrationProfileSection from './ParticipantRegistrationProfileSection.vue'
import ParticipantRegistrationProgressRail from './ParticipantRegistrationProgressRail.vue'
import ParticipantRegistrationTalkProposalSection from './ParticipantRegistrationTalkProposalSection.vue'
import type { CustomQuestionAnswerValue } from '#shared/domains/events/custom-questions'
import { formatEventLocation } from '~/domains/events/presentation'
import { participantRegistrationSectionDomId } from '~/domains/applications/participant-registration-definition'
import { useParticipantRegistrationController } from './useParticipantRegistrationController'

const draft = defineModel<ParticipantRegistrationDraft>({ required: true })

const props = withDefaults(defineProps<{
  definition: ResolvedParticipantRegistrationDefinition
  event: Pick<PublicEvent,
  | 'eventType'
  | 'slug'
  | 'state'
  | 'city'
  | 'country'
  | 'autoApproveApplications'
  >
  submissionPolicy: ParticipantApplicationSubmissionPolicy
  inPersonCommitmentDateLabel: string
  isSubmitting?: boolean
  profileError?: string
  submissionError?: string
  submissionTransition?: ParticipantApplicationSubmittedTransition | null
  isLoading?: boolean
  workspaceErrorMessage?: string
  submitLabel?: string
  submissionErrorTitle?: string
}>(), {
  submissionErrorTitle: 'Application submission failed'
})

const emit = defineEmits<{
  submitApplication: []
}>()

const formRoot = useTemplateRef<HTMLElement>('formRoot')
const submissionErrorRoot = useTemplateRef<HTMLElement>('submissionErrorRoot')
const controller = useParticipantRegistrationController({
  draft,
  definition: () => props.definition
})
const canRenderSubmissionForm = computed(() => props.event.state === 'registration_open')
const eventLocationLabel = computed(() => formatEventLocation(props.event))
const submissionPolicyReason = computed(() => {
  if (props.submissionPolicy.isAllowed || !props.submissionPolicy.reason) return ''
  return new Set([
    'Complete the required profile fields before submitting this application.',
    'Accept the current application terms before submitting.',
    'Confirm in-person attendance commitment before submitting this application.'
  ]).has(props.submissionPolicy.reason)
    ? ''
    : props.submissionPolicy.reason
})
// An event that confirms people automatically has no review step, so its button says "Register".
const resolvedSubmitLabel = computed(() =>
  props.submitLabel ?? (props.event.autoApproveApplications ? 'Register' : 'Submit application')
)
const postSubmissionText = computed(() => {
  if (props.event.eventType === 'hackathon') {
    return props.event.autoApproveApplications
      ? 'After you register, you can create a team or join one while team formation is open.'
      : 'After you apply, we will review your application. If approved, you can create a team or join one while team formation is open.'
  }

  return props.event.autoApproveApplications
    ? 'After you register, you will find everything for the day under My events.'
    : 'After you apply, we will review your application. You will find the decision under My events.'
})

function updateProfileField(key: ParticipantRegistrationProfileFieldKey, value: string) {
  draft.value.profileForm[key] = value
}

function updateTeamMember(index: number, key: keyof ParticipantRegistrationTeamMemberHint, value: string) {
  const member = draft.value.teamMemberHints[index]
  if (member) member[key] = value
}

function updateTalkProposalAnswer(index: number, value: CustomQuestionAnswerValue) {
  const proposal = draft.value.talkProposal
  if (!proposal) return
  proposal.answers = proposal.answers.map((answer, currentIndex) => currentIndex === index
    ? { ...answer, value }
    : answer)
}

async function handleSubmitAttempt() {
  if (!formRoot.value || props.isSubmitting) return
  if (!await controller.validateSubmitAttempt(formRoot.value) || !props.submissionPolicy.isAllowed) return
  emit('submitApplication')
}

watch(() => props.profileError || props.submissionError, async (error) => {
  if (!error) return
  await nextTick()
  submissionErrorRoot.value?.scrollIntoView({ block: 'center' })
  submissionErrorRoot.value?.focus({ preventScroll: true })
})
</script>

<template>
  <section class="space-y-4">
    <AppAlert
      v-if="props.isLoading"
      color="neutral"
      variant="soft"
      title="Loading registration"
      description="Checking your application status and terms."
    />

    <AppAlert
      v-else-if="props.workspaceErrorMessage"
      color="error"
      variant="soft"
      title="Registration unavailable"
      :description="props.workspaceErrorMessage"
    />

    <article
      v-else-if="props.submissionTransition"
      class="rounded-xl border border-success/30 bg-success/10 px-6 py-6"
    >
      <div class="flex items-start gap-4">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
          <AppIcon
            name="i-lucide-loader-circle"
            class="size-5 animate-spin motion-reduce:animate-none"
          />
        </span>
        <div class="space-y-1.5">
          <h2 class="text-[20px] font-semibold text-highlighted">
            {{ props.submissionTransition.title }}
          </h2>
          <p class="text-[13px] leading-5 text-toned">
            {{ props.submissionTransition.description }}
          </p>
        </div>
      </div>
    </article>

    <template v-else-if="canRenderSubmissionForm">
      <div
        v-if="props.profileError || props.submissionError"
        ref="submissionErrorRoot"
        tabindex="-1"
        class="outline-none"
      >
        <AppAlert
          color="error"
          variant="soft"
          :title="props.profileError ? 'We could not update your details' : props.submissionErrorTitle"
          :description="props.profileError || props.submissionError"
        />
      </div>

      <form
        ref="formRoot"
        class="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8"
        data-testid="participant-registration-form"
        novalidate
        @submit.prevent="handleSubmitAttempt"
      >
        <div class="min-w-0 space-y-5 pb-4">
          <div
            :id="props.definition.talkProposal ? participantRegistrationSectionDomId('registration') : undefined"
            :tabindex="props.definition.talkProposal ? -1 : undefined"
            class="space-y-5 outline-none"
          >
            <ParticipantRegistrationProfileSection
              :draft="draft"
              :definition="props.definition"
              :errors="controller.displayedErrors.value"
              :disabled="props.isSubmitting"
              :section-label="props.definition.talkProposal ? 'Event registration' : undefined"
              @update-field="updateProfileField"
            />

            <AppAlert
              v-if="submissionPolicyReason"
              color="neutral"
              variant="soft"
              :description="submissionPolicyReason"
            />

            <ParticipantRegistrationApplicationSection
              :draft="draft"
              :definition="props.definition"
              :errors="controller.displayedErrors.value"
              :disabled="props.isSubmitting"
              @update-ai-knowledge-level="draft.aiKnowledgeLevel = $event"
              @update-why-this-event="draft.whyThisEvent = $event"
              @update-proof-of-execution-url="draft.proofOfExecutionUrl = $event"
              @update-registration-answer="(questionId, value) => { draft.registrationAnswers[questionId] = value }"
            />

            <ParticipantRegistrationParticipationSection
              :draft="draft"
              :definition="props.definition"
              :event-type="props.event.eventType"
              :errors="controller.displayedErrors.value"
              :disabled="props.isSubmitting"
              @update-team-intent="draft.teamIntent = $event"
              @update-team-member="updateTeamMember"
            />

            <ParticipantRegistrationCommitmentsSection
              :draft="draft"
              :definition="props.definition"
              :event-slug="props.event.slug"
              :event-location-label="eventLocationLabel"
              :in-person-commitment-date-label="props.inPersonCommitmentDateLabel"
              :errors="controller.displayedErrors.value"
              :disabled="props.isSubmitting"
              @update-in-person-attendance-commitment="draft.inPersonAttendanceCommitment = $event"
              @update-terms-accepted="draft.termsAccepted = $event"
            />
          </div>

          <ParticipantRegistrationTalkProposalSection
            v-if="props.definition.talkProposal && draft.talkProposal"
            :draft="draft.talkProposal"
            :definition="props.definition"
            :errors="controller.displayedErrors.value"
            :disabled="props.isSubmitting"
            @update-title="draft.talkProposal.title = $event"
            @update-abstract="draft.talkProposal.abstract = $event"
            @update-demo-or-slides-url="draft.talkProposal.demoOrSlidesUrl = $event"
            @update-answer="updateTalkProposalAnswer"
          />

          <section
            :id="participantRegistrationSectionDomId('confirmation')"
            tabindex="-1"
            class="scroll-mt-24 space-y-3 outline-none"
          >
            <h2 class="text-[14px] font-semibold text-highlighted">
              Review and submit
            </h2>
            <p class="text-[12px] text-muted">
              {{ controller.readinessText.value }}
            </p>
            <AppButton
              type="submit"
              color="primary"
              variant="solid"
              :loading="props.isSubmitting"
              :disabled="props.isSubmitting"
              :class="props.definition.talkProposal ? 'w-full sm:w-auto lg:hidden' : 'w-full sm:w-auto'"
            >
              {{ resolvedSubmitLabel }}
            </AppButton>
          </section>

          <p
            v-if="!props.definition.talkProposal"
            class="text-[11px] leading-4 text-muted"
          >
            {{ postSubmissionText }}
          </p>
        </div>

        <div class="hidden lg:block">
          <ParticipantRegistrationProgressRail
            :evaluation="controller.evaluation.value"
            :progress-percent="controller.progressPercent.value"
            :submit-label="resolvedSubmitLabel"
            :show-submit="Boolean(props.definition.talkProposal)"
            :submitting="props.isSubmitting"
            @navigate="formRoot && controller.navigateToSection(formRoot, $event)"
          />
        </div>
      </form>
    </template>

    <AppAlert
      v-else
      color="neutral"
      variant="soft"
      title="Registration closed"
      description="Registration closed while you were on this page. Head back to the event page for the latest status."
    />
  </section>
</template>
