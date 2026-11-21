<script setup lang="ts">
import type {
  EventFeedbackEventType,
  EventFeedbackQuestionId,
  EventFeedbackRatingValue,
  EventFeedbackSelectionValue
} from '#shared/domains/events/feedback'

import {
  eventFeedbackNotApplicableLabel,
  eventFeedbackNotApplicableValue,
  eventFeedbackQuestionIds,
  getEventFeedbackQuestions,
  eventFeedbackRatingValues
} from '#shared/domains/events/feedback'
import { normalizeApiError } from '~/lib/api'

const props = defineProps<{
  eventSlug: string
  eventType: EventFeedbackEventType
}>()

function createEmptyRatings() {
  return Object.fromEntries(
    eventFeedbackQuestionIds.map(questionId => [questionId, null])
  ) as Record<EventFeedbackQuestionId, EventFeedbackSelectionValue | null>
}

const ratings = ref(createEmptyRatings())
const comment = ref('')
const isSubmitting = ref(false)
const submitAttempted = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)
const feedbackQuestions = computed(() => getEventFeedbackQuestions(props.eventType))
const visibleQuestionIds = computed(() => feedbackQuestions.value.map(question => question.id))

const missingQuestionCount = computed(() =>
  visibleQuestionIds.value.filter(questionId => ratings.value[questionId] === null).length
)

function isQuestionMissing(questionId: EventFeedbackQuestionId) {
  return submitAttempted.value && ratings.value[questionId] === null
}

function updateRating(questionId: EventFeedbackQuestionId, rating: EventFeedbackSelectionValue) {
  if (isSubmitting.value || submitSuccess.value) {
    return
  }

  ratings.value[questionId] = rating

  if (submitAttempted.value && missingQuestionCount.value === 0) {
    submitError.value = ''
  }
}

async function submitFeedback() {
  if (isSubmitting.value || submitSuccess.value) {
    return
  }

  submitAttempted.value = true
  submitError.value = ''

  if (missingQuestionCount.value > 0) {
    submitError.value = missingQuestionCount.value === 1
      ? 'Select a response for the remaining question before you submit.'
      : `Select a response for the remaining ${missingQuestionCount.value} questions before you submit.`
    return
  }

  isSubmitting.value = true

  try {
    const payload = Object.fromEntries(
      eventFeedbackQuestionIds.map(questionId => [
        questionId,
        ratings.value[questionId] === eventFeedbackNotApplicableValue ? null : ratings.value[questionId]
      ])
    ) as Record<EventFeedbackQuestionId, EventFeedbackRatingValue | null>

    await $fetch(`/api/public/events/${props.eventSlug}/feedback`, {
      method: 'POST',
      body: {
        ...payload,
        comment: comment.value
      }
    })

    submitSuccess.value = true
  } catch (error) {
    submitError.value = normalizeApiError(error).message
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="space-y-6">
    <div
      v-if="!submitSuccess"
      class="space-y-2"
    >
      <h2 class="text-[20px] font-semibold text-highlighted dark:text-white">
        Share Your Feedback
      </h2>
      <p class="max-w-3xl text-sm leading-7 text-neutral-600 dark:text-[#A3A3A3]">
        Rate each part of the event from 1 to 5, or choose Not applicable if you did not use or experience it. This form is anonymous and includes one optional written comment.
      </p>
    </div>

    <AppAlert
      v-if="submitSuccess"
      color="success"
      variant="soft"
      title="Thanks for your feedback"
      description="Your response was recorded."
    />

    <form
      v-else
      class="space-y-6"
      @submit.prevent="submitFeedback"
    >
      <div class="divide-y divide-black/8 overflow-hidden rounded-xl border border-black/8 bg-[#0F0F10]/70 dark:divide-white/[0.08] dark:border-white/[0.08] dark:bg-[#101112]">
        <div
          v-for="question in feedbackQuestions"
          :key="question.id"
          class="px-5 py-5"
        >
          <div class="space-y-3">
            <div
              :id="`event-feedback-${question.id}`"
              class="space-y-3"
              role="radiogroup"
              :aria-label="question.prompt"
              :aria-describedby="isQuestionMissing(question.id) ? `event-feedback-${question.id}-error` : undefined"
              :aria-invalid="isQuestionMissing(question.id) ? 'true' : undefined"
            >
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="space-y-2">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    {{ question.label }}
                  </p>
                  <h3 class="text-lg font-semibold text-highlighted dark:text-white">
                    {{ question.prompt }}
                  </h3>
                </div>

                <AppRatingOption
                  :checked="ratings[question.id] === eventFeedbackNotApplicableValue"
                  :invalid="isQuestionMissing(question.id)"
                  :disabled="isSubmitting"
                  class="shrink-0 px-3 uppercase tracking-[0.14em]"
                  @click="updateRating(question.id, eventFeedbackNotApplicableValue)"
                >
                  {{ eventFeedbackNotApplicableLabel }}
                </AppRatingOption>
              </div>

              <div class="grid grid-cols-5 gap-1.5">
                <AppRatingOption
                  v-for="score in eventFeedbackRatingValues"
                  :key="score"
                  :checked="ratings[question.id] === score"
                  :invalid="isQuestionMissing(question.id)"
                  :disabled="isSubmitting"
                  @click="updateRating(question.id, score)"
                >
                  {{ score }}
                </AppRatingOption>
              </div>
            </div>

            <div class="flex items-center justify-between gap-3 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted sm:text-xs">
              <span>Poor</span>
              <span>Okay</span>
              <span>Excellent</span>
            </div>

            <p
              v-if="isQuestionMissing(question.id)"
              :id="`event-feedback-${question.id}-error`"
              class="px-1 text-[11px] text-error"
            >
              Choose a rating or Not applicable.
            </p>
          </div>
        </div>

        <div class="px-5 py-5">
          <div class="space-y-3">
            <div class="space-y-2">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Optional Comment
              </p>
              <h3 class="text-lg font-semibold text-highlighted dark:text-white">
                Anything else you want to share?
              </h3>
            </div>

            <textarea
              v-model="comment"
              rows="5"
              maxlength="4000"
              :disabled="isSubmitting"
              class="rounded-lg border border-black/8 bg-white text-highlighted transition disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.08] dark:bg-[#111111] focus:border-black/25 dark:focus:border-white/[0.25] w-full px-3 py-3 text-sm leading-6 disabled:opacity-70"
              placeholder="What went especially well, or what should change next time?"
            />
          </div>
        </div>
      </div>

      <div class="space-y-3">
        <AppAlert
          v-if="submitError"
          color="warning"
          variant="soft"
          title="Feedback not submitted"
          :description="submitError"
        />

        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
            Feedback is anonymous.
          </p>

          <AppButton
            type="submit"
            color="neutral"
            variant="solid"
            :loading="isSubmitting"
            class="rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
          >
            Submit Feedback
          </AppButton>
        </div>
      </div>
    </form>
  </section>
</template>
