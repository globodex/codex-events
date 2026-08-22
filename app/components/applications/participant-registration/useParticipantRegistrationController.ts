import type { Ref } from 'vue'
import type {
  ParticipantRegistrationDraft,
  ParticipantRegistrationFieldId,
  ParticipantRegistrationSectionId,
  ResolvedParticipantRegistrationDefinition
} from '~/domains/applications/participant-registration-definition'

import {
  evaluateParticipantRegistration,
  participantRegistrationSectionDomId
} from '~/domains/applications/participant-registration-definition'

export function useParticipantRegistrationController(options: {
  draft: Ref<ParticipantRegistrationDraft>
  definition: () => ResolvedParticipantRegistrationDefinition
}) {
  const submitAttempted = shallowRef(false)
  const evaluation = computed(() => evaluateParticipantRegistration(
    options.definition(),
    options.draft.value,
    submitAttempted.value
  ))
  const displayedErrors = computed(() => submitAttempted.value ? evaluation.value.errors : {})
  const readinessText = computed(() => {
    const remaining = evaluation.value.requiredCount - evaluation.value.completedRequiredCount
    if (remaining > 0) return `${remaining} required item${remaining === 1 ? '' : 's'} left`
    if (evaluation.value.invalidFieldCount === 1) return '1 field needs attention'
    if (evaluation.value.invalidFieldCount > 1) return `${evaluation.value.invalidFieldCount} fields need attention`
    return 'Ready to submit'
  })
  const progressPercent = computed(() => evaluation.value.requiredCount === 0
    ? 100
    : Math.round((evaluation.value.completedRequiredCount / evaluation.value.requiredCount) * 100)
  )

  function scrollBehavior(): ScrollBehavior {
    if (typeof window === 'undefined') return 'auto'
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  }

  function focusField(root: HTMLElement, fieldId: ParticipantRegistrationFieldId) {
    const field = root.querySelector<HTMLElement>(`[data-registration-field="${CSS.escape(fieldId)}"]`)
    if (!field) return false
    const control = field.matches('input, select, textarea, button, [tabindex]')
      ? field
      : field.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]')

    field.scrollIntoView({ behavior: scrollBehavior(), block: 'center' })
    control?.focus({ preventScroll: true })
    return true
  }

  function focusFirstInvalid(root: HTMLElement) {
    const invalidFieldId = evaluation.value.firstInvalidFieldId
    if (invalidFieldId && focusField(root, invalidFieldId)) return

    const incomplete = evaluation.value.sections
      .flatMap(section => section.fields)
      .find(field => field.required && !field.complete)
    if (incomplete) focusField(root, incomplete.id)
  }

  function navigateToSection(root: HTMLElement, sectionId: ParticipantRegistrationSectionId) {
    const target = root.querySelector<HTMLElement>(`#${CSS.escape(participantRegistrationSectionDomId(sectionId))}`)
    if (!target) return
    target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    target.focus({ preventScroll: true })
  }

  async function validateSubmitAttempt(root: HTMLElement) {
    submitAttempted.value = true
    await nextTick()
    if (evaluation.value.readyToSubmit) return true
    focusFirstInvalid(root)
    return false
  }

  return {
    submitAttempted: readonly(submitAttempted),
    evaluation,
    displayedErrors,
    readinessText,
    progressPercent,
    validateSubmitAttempt,
    navigateToSection,
    focusFirstInvalid
  }
}
