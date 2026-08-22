<script setup lang="ts">
import {
  formatEventDate,
  formatEventLocation,
  formatEventWindow,
  getEventRegistrationTeamSizeMetaItems,
  getEventEarliestStartAt,
  resolveEventDetailBackgroundImageUrl,
  type PublicEvent
} from '~/domains/events/presentation'
import type {
  ParticipantApplicationRecord,
  ParticipantApiDataResponse,
  ParticipantCurrentTermsResponse,
  ParticipantApplicationTermsDocument,
  ParticipantApplicationSubmittedTransition,
  ParticipantRegistrationTrackOption,
  VisibleEventRecord
} from '~/domains/applications/participant-application'
import type {
  ParticipantRegistrationDraft
} from '~/domains/applications/participant-registration-definition'

import EventStateBadge from '~/components/public/events/EventStateBadge.vue'
import ParticipantRegistrationForm from '~/components/applications/participant-registration/ParticipantRegistrationForm.vue'
import {
  createParticipantTeamMemberHintRows,
  getParticipantApplicationSubmissionPolicy,
  listEventProfileFields,
  normalizeParticipantApiError,
  resolveParticipantApplicationSubmittedTransition,
  resolveParticipantRegistrationEntry
} from '~/domains/applications/participant-application'
import {
  createTalkProposalAnswers,
  isTalkProposalWindowOpen
} from '~/domains/talk-proposals'
import {
  createParticipantRegistrationDraft,
  evaluateParticipantRegistration,
  normalizeParticipantRegistrationProfileForm,
  projectParticipantRegistrationAccountPatch,
  projectParticipantRegistrationApplicationPayload,
  resolveParticipantRegistrationDefinition
} from '~/domains/applications/participant-registration-definition'
import { useApiClient } from '~/composables/useApiClient'

definePageMeta({
  layout: 'event-detail',
  middleware: ['require-auth']
})

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? '').trim())
const apiFetch = useApiClient()
const { actor: accountActor, status: accountActorStatus } = await useAccountLifecycleActor()

if (!slug.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Event not found.'
  })
}

const {
  data: eventData,
  error: eventError
} = await useApiResponse<PublicEvent>(() => `public-event-register:${slug.value}`, () => `/api/public/events/${slug.value}`, {
  cacheScope: 'public',
  watch: [slug]
})

if (eventError.value) {
  throw createError({
    statusCode: eventError.value.statusCode ?? eventError.value.status ?? 500,
    statusMessage: eventError.value.statusMessage ?? 'Unable to load the requested event.'
  })
}

if (!eventData.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Event not found.'
  })
}

const event = computed(() => eventData.value!)
const requestedTalkProposalIntent = computed(() => route.query.intent === 'talk-proposal')
const isTalkProposalRegistration = computed(() =>
  requestedTalkProposalIntent.value
  && event.value.eventType === 'meetup'
  && event.value.talkProposalsEnabled
  && isTalkProposalWindowOpen(event.value.talkProposalOpensAt, event.value.talkProposalClosesAt)
)
const registrationIntent = computed(() => isTalkProposalRegistration.value ? 'talk-proposal' as const : undefined)
const detailBackgroundImageUrl = computed(() => resolveEventDetailBackgroundImageUrl(event.value))
const detailBackgroundImageStyle = computed(() => detailBackgroundImageUrl.value
  ? { backgroundImage: `url(${JSON.stringify(detailBackgroundImageUrl.value)})` }
  : undefined)
const registrationDraft = ref<ParticipantRegistrationDraft>(createParticipantRegistrationDraft())
const profileFields = computed(() => listEventProfileFields(event.value))
const detailSummary = computed(() => [
  formatEventWindow(event.value.registrationOpensAt, event.value.submissionClosesAt ?? event.value.registrationClosesAt),
  formatEventLocation(event.value),
  ...getEventRegistrationTeamSizeMetaItems(event.value)
].join(' • '))
const inPersonCommitmentDateLabel = computed(() =>
  formatEventDate(getEventEarliestStartAt(event.value))
)
const isSavingProfile = ref(false)
const profileSaveError = ref('')
const hasExistingApplication = ref(false)
const currentApplicationTerms = ref<ParticipantApplicationTermsDocument | null>(null)
const workspaceErrorMessage = ref('')
const submissionError = ref('')
const isSubmitting = ref(false)
const submissionTransition = ref<ParticipantApplicationSubmittedTransition | null>(null)
const visibleEventId = ref<string | null>(null)
const registrationTrackOptions = ref<ParticipantRegistrationTrackOption[]>([])
const talkProposalQuestions = ref<NonNullable<VisibleEventRecord['talkProposalQuestions']>>([])
const talkProposalQuestionsRevision = ref(0)

function createDefaultRegistrationRouteState() {
  return {
    visibleEventId: null,
    hasExistingApplication: false,
    currentApplicationTerms: null,
    trackOptions: [],
    talkProposalQuestions: [],
    talkProposalQuestionsRevision: 0,
    workspaceErrorMessage: '',
    redirectTo: null
  }
}

function listRegistrationTrackOptions(event: VisibleEventRecord): ParticipantRegistrationTrackOption[] {
  return [...(event.tracks ?? [])]
    .map(track => ({
      id: track.id,
      name: track.name,
      shortDescription: track.shortDescription,
      displayOrder: track.displayOrder
    }))
    .sort((left, right) =>
      left.displayOrder - right.displayOrder || left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
    )
}

watch(() => accountActor.value, (actor) => {
  if (actor?.kind !== 'platform_user') {
    return
  }

  Object.assign(registrationDraft.value.profileForm, normalizeParticipantRegistrationProfileForm({
    firstName: actor.platformUser.firstName,
    familyName: actor.platformUser.familyName,
    xProfileUrl: actor.platformUser.xProfileUrl,
    linkedinProfileUrl: actor.platformUser.linkedinProfileUrl,
    githubProfileUrl: actor.platformUser.githubProfileUrl
      ?? actor.sessionUser.githubProfileUrl
      ?? '',
    chatgptEmail: actor.platformUser.chatgptEmail,
    openaiOrgId: actor.platformUser.openaiOrgId,
    lumaEmail: actor.platformUser.lumaEmail
  }))
}, { immediate: true })

watch(() => event.value.maxTeamMembers, (maxTeamMembers) => {
  const nextRows = createParticipantTeamMemberHintRows(maxTeamMembers)
  const previousRows = registrationDraft.value.teamMemberHints

  registrationDraft.value.teamMemberHints = nextRows.map((row, index) => ({
    fullName: previousRows[index]?.fullName ?? row.fullName,
    email: previousRows[index]?.email ?? row.email
  }))
}, { immediate: true })

watch(() => currentApplicationTerms.value?.id ?? null, () => {
  registrationDraft.value.termsAccepted = false
})

watch(() => event.value.inPersonEvent, (isInPersonEvent) => {
  if (!isInPersonEvent) {
    registrationDraft.value.inPersonAttendanceCommitment = false
  }
}, { immediate: true })

const accountActorCacheKey = computed(() => {
  if (accountActor.value.kind !== 'platform_user') {
    return accountActor.value.kind
  }

  return `${accountActor.value.platformUser.id}:${accountActor.value.hasAcceptedCurrentPlatformDocuments ? 'accepted' : 'unaccepted'}`
})
const registrationRouteState = await useApiData<{
  visibleEventId: string | null
  hasExistingApplication: boolean
  currentApplicationTerms: ParticipantApplicationTermsDocument | null
  trackOptions: ParticipantRegistrationTrackOption[]
  talkProposalQuestions: NonNullable<VisibleEventRecord['talkProposalQuestions']>
  talkProposalQuestionsRevision: number
  workspaceErrorMessage: string
  redirectTo: {
    to: string
    external?: boolean
  } | null
}>(
  () => `public-event-register-state:${slug.value}:${accountActorCacheKey.value}:${registrationIntent.value ?? 'registration'}`,
  async ({ apiFetch, signal }) => {
    if (accountActor.value.kind !== 'platform_user' || !accountActor.value.hasAcceptedCurrentPlatformDocuments) {
      return {
        visibleEventId: null,
        hasExistingApplication: false,
        currentApplicationTerms: null,
        trackOptions: [],
        talkProposalQuestions: [],
        talkProposalQuestionsRevision: 0,
        workspaceErrorMessage: '',
        redirectTo: null
      }
    }

    try {
      const visibleEventResponse = await apiFetch<ParticipantApiDataResponse<VisibleEventRecord>>(
        `/api/events/slug/${slug.value}`,
        {
          signal
        }
      )
      const resolvedVisibleEventId = visibleEventResponse.data.id
      const ownApplicationResponse = await apiFetch<ParticipantApiDataResponse<ParticipantApplicationRecord | null>>(
        `/api/events/${resolvedVisibleEventId}/applications/me`,
        {
          signal
        }
      )
      const resolvedHasExistingApplication = Boolean(ownApplicationResponse.data)
      const routeResolution = resolveParticipantRegistrationEntry({
        actorKind: accountActor.value.kind,
        hasAcceptedCurrentPlatformDocuments: accountActor.value.hasAcceptedCurrentPlatformDocuments,
        eventSlug: slug.value,
        eventState: event.value.state,
        registrationOpensAt: event.value.registrationOpensAt,
        registrationClosesAt: event.value.registrationClosesAt,
        hasExistingApplication: resolvedHasExistingApplication,
        registrationIntent: registrationIntent.value
      })

      if (routeResolution) {
        return {
          visibleEventId: resolvedVisibleEventId,
          hasExistingApplication: resolvedHasExistingApplication,
          currentApplicationTerms: null,
          trackOptions: [],
          talkProposalQuestions: [],
          talkProposalQuestionsRevision: 0,
          workspaceErrorMessage: '',
          redirectTo: {
            to: routeResolution.to,
            external: routeResolution.external
          }
        }
      }

      const currentTermsResponse = await apiFetch<ParticipantApiDataResponse<ParticipantCurrentTermsResponse>>(
        `/api/events/${resolvedVisibleEventId}/terms/current`,
        {
          signal
        }
      )

      return {
        visibleEventId: resolvedVisibleEventId,
        hasExistingApplication: resolvedHasExistingApplication,
        currentApplicationTerms: currentTermsResponse.data.application_terms,
        trackOptions: listRegistrationTrackOptions(visibleEventResponse.data),
        talkProposalQuestions: registrationIntent.value
          ? (visibleEventResponse.data.talkProposalQuestions ?? [])
          : [],
        talkProposalQuestionsRevision: registrationIntent.value
          ? (visibleEventResponse.data.talkProposalQuestionsRevision ?? 0)
          : 0,
        workspaceErrorMessage: '',
        redirectTo: null
      }
    } catch (error) {
      if (signal.aborted) {
        return createDefaultRegistrationRouteState()
      }

      return {
        visibleEventId: null,
        hasExistingApplication: false,
        currentApplicationTerms: null,
        trackOptions: [],
        talkProposalQuestions: [],
        talkProposalQuestionsRevision: 0,
        workspaceErrorMessage: normalizeParticipantApiError(error).message,
        redirectTo: null
      }
    }
  },
  {
    default: createDefaultRegistrationRouteState,
    watch: [
      slug,
      accountActorCacheKey,
      computed(() => event.value.state),
      computed(() => event.value.registrationOpensAt),
      computed(() => event.value.registrationClosesAt),
      registrationIntent
    ]
  }
)

const isRegistrationRouteStateLoading = computed(() =>
  !submissionTransition.value
  && (
    registrationRouteState.status.value === 'idle'
    || registrationRouteState.status.value === 'pending'
  )
)

async function navigateToRegistrationRedirect(redirectTo: {
  to: string
  external?: boolean
} | null) {
  if (!redirectTo) {
    return
  }

  await navigateTo(
    redirectTo.to,
    redirectTo.external ? { external: true } : undefined
  )
}

await navigateToRegistrationRedirect(registrationRouteState.data.value.redirectTo)

watch(() => registrationRouteState.data.value, (state) => {
  visibleEventId.value = state.visibleEventId
  hasExistingApplication.value = state.hasExistingApplication
  currentApplicationTerms.value = state.currentApplicationTerms
  registrationTrackOptions.value = state.trackOptions
  talkProposalQuestions.value = state.talkProposalQuestions
  talkProposalQuestionsRevision.value = state.talkProposalQuestionsRevision
  workspaceErrorMessage.value = state.workspaceErrorMessage
}, { immediate: true })

watch(
  [isTalkProposalRegistration, talkProposalQuestions, talkProposalQuestionsRevision],
  ([enabled, questions, questionSetRevision]) => {
    if (!enabled) {
      registrationDraft.value.talkProposal = null
      return
    }

    const previous = registrationDraft.value.talkProposal
    registrationDraft.value.talkProposal = {
      title: previous?.title ?? '',
      abstract: previous?.abstract ?? '',
      demoOrSlidesUrl: previous?.demoOrSlidesUrl ?? '',
      questionSetRevision,
      answers: createTalkProposalAnswers(questions, previous?.answers)
    }
  },
  { immediate: true }
)

watch(registrationTrackOptions, (trackOptions) => {
  if (registrationDraft.value.selectedTrackId && !trackOptions.some(track => track.id === registrationDraft.value.selectedTrackId)) {
    registrationDraft.value.selectedTrackId = ''
  }
})

watch(() => registrationRouteState.data.value.redirectTo, async (redirectTo) => {
  await navigateToRegistrationRedirect(redirectTo)
})

const registrationDefinition = computed(() => resolveParticipantRegistrationDefinition({
  event: event.value,
  profileFields: profileFields.value,
  trackOptions: registrationTrackOptions.value,
  maxTeamMembers: event.value.maxTeamMembers,
  currentApplicationTerms: currentApplicationTerms.value,
  talkProposal: isTalkProposalRegistration.value
    ? {
        questions: talkProposalQuestions.value,
        questionSetRevision: talkProposalQuestionsRevision.value
      }
    : null
}))
const registrationEvaluation = computed(() => evaluateParticipantRegistration(
  registrationDefinition.value,
  registrationDraft.value
))
const missingRequiredProfileFieldCount = computed(() => registrationEvaluation.value.sections
  .flatMap(section => section.fields)
  .filter(field => registrationDefinition.value.profile.fieldIds.has(field.id) && field.required && !field.complete)
  .length
)
const participantSubmissionPolicy = computed(() =>
  getParticipantApplicationSubmissionPolicy({
    eventState: event.value.state,
    registrationOpensAt: event.value.registrationOpensAt,
    registrationClosesAt: event.value.registrationClosesAt,
    applicationStatus: hasExistingApplication.value ? 'submitted' : null,
    missingRequiredProfileFieldCount: missingRequiredProfileFieldCount.value,
    hasCurrentApplicationTerms: Boolean(currentApplicationTerms.value),
    hasAcceptedCurrentTerms: registrationDraft.value.termsAccepted,
    requiresInPersonAttendanceCommitment: event.value.inPersonEvent,
    hasAcceptedInPersonAttendanceCommitment: registrationDraft.value.inPersonAttendanceCommitment
  })
)

async function submitParticipantApplication() {
  if (!participantSubmissionPolicy.value.isAllowed) {
    return
  }

  if (!registrationEvaluation.value.readyToSubmit) {
    return
  }

  if (accountActor.value?.kind !== 'platform_user') {
    return
  }

  if (!visibleEventId.value) {
    submissionError.value = 'The current event application route could not be resolved.'
    return
  }

  profileSaveError.value = ''
  submissionError.value = ''
  submissionTransition.value = null
  isSubmitting.value = true
  isSavingProfile.value = true

  try {
    const normalizedProfileForm = normalizeParticipantRegistrationProfileForm(registrationDraft.value.profileForm)
    Object.assign(registrationDraft.value.profileForm, normalizedProfileForm)

    await apiFetch('/api/account', {
      method: 'PATCH',
      body: projectParticipantRegistrationAccountPatch(registrationDefinition.value, registrationDraft.value)
    })
  } catch (error) {
    profileSaveError.value = normalizeParticipantApiError(error).message
    isSubmitting.value = false
    isSavingProfile.value = false
    return
  }

  try {
    await apiFetch(`/api/events/${visibleEventId.value}/applications`, {
      method: 'POST',
      body: projectParticipantRegistrationApplicationPayload(registrationDefinition.value, registrationDraft.value)
    })
  } catch (error) {
    submissionError.value = normalizeParticipantApiError(error).message
    isSubmitting.value = false
    isSavingProfile.value = false
    return
  }

  const nextSubmissionTransition = resolveParticipantApplicationSubmittedTransition(slug.value, {
    autoApproveApplications: event.value.autoApproveApplications,
    talkProposalSubmitted: isTalkProposalRegistration.value
  })

  hasExistingApplication.value = true
  submissionTransition.value = nextSubmissionTransition
  isSubmitting.value = false
  isSavingProfile.value = false

  await nextTick()

  try {
    await navigateTo(nextSubmissionTransition.to, { replace: true })
  } catch {
    // Keep the submitted-state panel visible if the router rejects after the application was created.
  }
}

useSeoMeta({
  title: () => `Apply to ${event.value.name} | Codex Events`,
  description: () => `Complete your application for ${event.value.name}.`
})
</script>

<template>
  <div class="relative isolate">
    <div
      v-if="detailBackgroundImageUrl"
      class="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        class="absolute inset-0 scale-110 bg-cover bg-center bg-no-repeat opacity-55 blur-md saturate-125 contrast-105"
        :style="detailBackgroundImageStyle"
      />
      <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-black/45 to-black/68 dark:from-black/35 dark:via-black/55 dark:to-black/76" />
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.22),transparent_46%)] dark:bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.10),transparent_48%)]" />
    </div>

    <section class="relative z-10 border-b border-black/8 bg-white/52 backdrop-blur-lg dark:border-white/[0.08] dark:bg-black/56">
      <AppContainer class="max-w-[68rem] pb-0 pt-2 sm:pt-3">
        <section class="pb-0">
          <NuxtLink
            :to="`/events/${slug}`"
            class="inline-flex items-center gap-2 text-[13px] font-medium text-neutral-600 transition-colors hover:text-highlighted dark:text-[#A3A3A3] dark:hover:text-white"
          >
            <AppIcon
              name="i-lucide-arrow-left"
              class="size-4"
            />
            Back to event detail
          </NuxtLink>

          <div class="mt-3 border-b border-black/8 pb-0 dark:border-white/[0.08]">
            <div class="space-y-2 pb-4">
              <div class="min-w-0 flex flex-wrap items-center gap-3">
                <h1
                  data-testid="public-event-register-title"
                  class="text-[28px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white"
                >
                  {{ event.name }} Registration
                </h1>
                <EventStateBadge
                  :state="event.state"
                  :registration-opens-at="event.registrationOpensAt"
                  :registration-closes-at="event.registrationClosesAt"
                />
              </div>

              <p class="text-[15px] text-neutral-700 dark:text-[#A3A3A3]">
                {{ detailSummary }}
              </p>
            </div>

            <nav
              aria-hidden="true"
              class="flex items-center gap-5 overflow-x-auto"
            >
              <span class="invisible border-b-2 pb-3 text-[14px] font-medium">
                Overview
              </span>
              <span class="invisible inline-flex items-center gap-2 border-b-2 pb-3 text-[14px] font-medium">
                Prizes
                <span class="rounded-full px-1.5 py-0.5 text-[11px]">
                  0
                </span>
              </span>
            </nav>
          </div>
        </section>
      </AppContainer>
    </section>

    <AppContainer class="relative z-10 max-w-[68rem] space-y-8 pb-10 pt-6 sm:pb-14">
      <AppAlert
        v-if="accountActorStatus === 'pending'"
        color="neutral"
        variant="soft"
        title="Loading account access"
        description="Checking your account."
      />

      <template v-else-if="accountActor?.kind === 'platform_user'">
        <ParticipantRegistrationForm
          v-model="registrationDraft"
          :definition="registrationDefinition"
          :event="event"
          :in-person-commitment-date-label="inPersonCommitmentDateLabel"
          :submission-policy="participantSubmissionPolicy"
          :is-submitting="isSubmitting"
          :is-saving-profile="isSavingProfile"
          :profile-error="profileSaveError"
          :submission-error="submissionError"
          :submission-transition="submissionTransition"
          :is-loading="isRegistrationRouteStateLoading"
          :workspace-error-message="workspaceErrorMessage"
          :submit-label="isTalkProposalRegistration ? 'Register and submit proposal' : undefined"
          :submission-error-title="isTalkProposalRegistration ? 'Registration and proposal submission failed' : undefined"
          @submit-application="submitParticipantApplication"
        />
      </template>
    </AppContainer>
  </div>
</template>
