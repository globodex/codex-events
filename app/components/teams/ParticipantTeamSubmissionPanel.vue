<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'

import { Switch as UiSwitch } from '~/components/ui/switch'
import type { PublicEventState } from '~/domains/events/presentation'
import type {
  SubmissionTrackOption,
  TeamSubmissionActionAvailability,
  TeamSubmissionRequirementConfig,
  TeamSubmissionRecord
} from '~/domains/submissions/team-submission'

import {
  formatTeamSubmissionStatus,
  getTeamSubmissionStatusColor,
  getTeamSubmissionWorkspaceStatus
} from '~/domains/submissions/team-submission'
import { createTeamSubmissionFormSchema } from '~/domains/submissions/team-submission-form'
import { cloneFormValues } from '~/utils/form-values'

const form = defineModel<{
  projectName: string
  summary: string
  repositoryUrl: string
  demoUrl: string
  trackId: string | null
}>('form', {
  required: true
})

const props = defineProps<{
  teamId: string
  eventState: PublicEventState
  submission: TeamSubmissionRecord | null
  status: 'idle' | 'pending' | 'success' | 'error'
  errorMessage?: string
  mutationError?: string
  canManageSubmission?: boolean
  tracks?: SubmissionTrackOption[]
  submissionRequirements: TeamSubmissionRequirementConfig
  createAvailability: TeamSubmissionActionAvailability
  updateAvailability: TeamSubmissionActionAvailability
  submitAvailability: TeamSubmissionActionAvailability
  withdrawAvailability: TeamSubmissionActionAvailability
  publicVisibilityAvailability?: TeamSubmissionActionAvailability
  showPublicVisibilityToggle?: boolean
  pendingActionKey?: string | null
}>()

const emit = defineEmits<{
  createDraft: []
  saveChanges: []
  submitProject: []
  withdrawSubmission: []
  togglePublicVisibility: [value: boolean]
}>()

const submissionStatus = computed(() => getTeamSubmissionWorkspaceStatus(props.submission))
const submissionStatusLabel = computed(() => formatTeamSubmissionStatus(submissionStatus.value))
const submissionStatusColor = computed(() => getTeamSubmissionStatusColor(submissionStatus.value))
const createActionKey = computed(() => `create-submission:${props.teamId}`)
const updateActionKey = computed(() => props.submission ? `update-submission:${props.submission.id}` : null)
const submitActionKey = computed(() => props.submission ? `submit-submission:${props.submission.id}` : null)
const withdrawActionKey = computed(() => props.submission ? `withdraw-submission:${props.submission.id}` : null)
const hasMutableSubmission = computed(() =>
  Boolean(props.submission && (props.submission.status === 'draft' || props.submission.status === 'submitted'))
)
const sortedTracks = computed(() =>
  [...(props.tracks ?? [])].sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name))
)
const requiresTrackSelection = computed(() => sortedTracks.value.length > 0)
const summaryLabel = computed(() =>
  props.submissionRequirements.requireSubmissionSummary ? 'Summary (required)' : 'Summary'
)
const repositoryUrlLabel = computed(() =>
  props.submissionRequirements.requireSubmissionRepositoryUrl ? 'Repository URL (required)' : 'Repository URL'
)
const demoUrlLabel = computed(() =>
  props.submissionRequirements.requireSubmissionDemoUrl ? 'Demo URL (required)' : 'Demo URL'
)
const trackSelectionInput = computed({
  get: () => form.value.trackId ?? '',
  set: (value: string) => {
    form.value.trackId = value.trim() || null
  }
})
const isFormReadOnly = computed(() =>
  props.submission
    ? !props.canManageSubmission || !hasMutableSubmission.value
    : !props.canManageSubmission
)
const isCreatePending = computed(() => isActionPending(createActionKey.value))
const isUpdatePending = computed(() => Boolean(updateActionKey.value && isActionPending(updateActionKey.value)))
const isSubmitPending = computed(() => Boolean(submitActionKey.value && isActionPending(submitActionKey.value)))
const isWithdrawPending = computed(() => Boolean(withdrawActionKey.value && isActionPending(withdrawActionKey.value)))
const publicVisibilityActionKey = computed(() =>
  props.submission ? `update-submission-public-visibility:${props.submission.id}` : null
)
const isPublicVisibilityPending = computed(() =>
  Boolean(publicVisibilityActionKey.value && isActionPending(publicVisibilityActionKey.value))
)
const publicVisibilitySwitchId = computed(() =>
  props.submission ? `participant-submission-public-visibility-${props.submission.id}` : 'participant-submission-public-visibility'
)
const isDraftMutationDisabled = computed(() =>
  isFormReadOnly.value
  || (!props.submission && !props.createAvailability.isAllowed)
  || Boolean(props.submission && !props.updateAvailability.isAllowed)
  || isCreatePending.value
  || isUpdatePending.value
)
const publicVisibilityStatusLabel = computed(() =>
  props.submission?.isPubliclyVisible ? 'Visible in the public showcase' : 'Hidden from the public showcase'
)

function isActionPending(actionKey: string) {
  return props.pendingActionKey === actionKey
}

const syncingFromModel = ref(false)
const validationSchema = computed(() =>
  toTypedSchema(createTeamSubmissionFormSchema({
    trackRequired: requiresTrackSelection.value,
    requireSummary: props.submissionRequirements.requireSubmissionSummary,
    requireRepositoryUrl: props.submissionRequirements.requireSubmissionRepositoryUrl,
    requireDemoUrl: props.submissionRequirements.requireSubmissionDemoUrl
  }))
)

const {
  errors,
  submitCount,
  values,
  setValues,
  handleSubmit
} = useForm({
  validationSchema,
  initialValues: cloneFormValues(form.value)
})
const submitAttempted = computed(() => submitCount.value > 0)

watch(() => form.value, (nextForm) => {
  syncingFromModel.value = true
  setValues(cloneFormValues(nextForm), submitCount.value > 0)
  syncingFromModel.value = false
}, {
  deep: true,
  immediate: true
})

watch(values, (nextValues) => {
  if (syncingFromModel.value) {
    return
  }

  Object.assign(form.value, cloneFormValues(nextValues))
}, {
  deep: true
})

const submitSubmissionForm = handleSubmit(() => {
  if (props.submission) {
    emit('saveChanges')
    return
  }

  emit('createDraft')
})

const submitProjectForm = handleSubmit(() => {
  emit('submitProject')
})

function handleSaveAttempt(event?: Event) {
  submitSubmissionForm(event)
}

function handleSubmitProjectAttempt(event?: Event) {
  submitProjectForm(event)
}
</script>

<template>
  <div
    data-testid="participant-submission-panel"
    class="space-y-6"
  >
    <AppAlert
      v-if="status === 'idle' || status === 'pending'"
      color="neutral"
      variant="soft"
      title="Loading submission"
      description="Resolving the current submission record for this team."
    />

    <AppAlert
      v-else-if="status === 'error'"
      color="error"
      variant="soft"
      title="Submission unavailable"
      :description="errorMessage"
    />

    <template v-else>
      <AppCard class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
        <template #header>
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-3">
              <h2 class="text-xl font-semibold text-highlighted dark:text-white">
                Project submission
              </h2>

              <AppBadge
                data-testid="participant-submission-status"
                :color="submissionStatusColor"
                variant="soft"
              >
                {{ submissionStatusLabel }}
              </AppBadge>
            </div>

            <div
              v-if="!canManageSubmission"
              data-testid="participant-submission-admin-warning"
              class="flex items-center gap-2 text-sm text-warning"
            >
              <AppIcon
                name="i-lucide-triangle-alert"
                class="size-4 shrink-0"
              />
              <p>Only team admins can manage the project submission.</p>
            </div>
          </div>
        </template>

        <div class="space-y-4">
          <p
            v-if="mutationError"
            class="text-sm text-error"
          >
            {{ mutationError }}
          </p>
          <p
            v-else-if="canManageSubmission && !submission && !createAvailability.isAllowed && createAvailability.reason"
            class="text-sm text-muted"
          >
            {{ createAvailability.reason }}
          </p>
          <p
            v-else-if="canManageSubmission && submission && !updateAvailability.isAllowed && updateAvailability.reason"
            class="text-sm text-muted"
          >
            {{ updateAvailability.reason }}
          </p>

          <div
            v-if="props.showPublicVisibilityToggle && submission"
            class="rounded-xl border border-black/8 bg-black/[0.02] p-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <label
                  :for="publicVisibilitySwitchId"
                  class="text-sm font-medium text-highlighted dark:text-white"
                >
                  Show this project publicly
                </label>
                <p class="text-sm text-muted">
                  This project will appear below the winners in a separate published projects section after completion.
                </p>
              </div>

              <UiSwitch
                :id="publicVisibilitySwitchId"
                :model-value="submission.isPubliclyVisible"
                :disabled="isPublicVisibilityPending || !props.publicVisibilityAvailability?.isAllowed"
                data-testid="participant-submission-public-visibility-toggle"
                @update:model-value="emit('togglePublicVisibility', $event)"
              />
            </div>

            <p class="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-muted">
              {{ publicVisibilityStatusLabel }}
            </p>
          </div>

          <form
            class="space-y-4"
            @submit.prevent="handleSaveAttempt"
          >
            <AppFormField
              label="Project name"
              name="participant-submission-project-name"
            >
              <AppInput
                id="participant-submission-project-name"
                v-model="form.projectName"
                name="participant-submission-project-name"
                size="xl"
                class="w-full"
                :class="submitAttempted && errors.projectName ? 'border-error/45 focus:border-error dark:border-error/50' : ''"
                :disabled="isDraftMutationDisabled"
              />
              <p
                v-if="submitAttempted && errors.projectName"
                class="text-xs text-error"
              >
                {{ errors.projectName }}
              </p>
            </AppFormField>

            <AppFormField
              :label="summaryLabel"
              name="participant-submission-summary"
            >
              <AppTextarea
                id="participant-submission-summary"
                v-model="form.summary"
                name="participant-submission-summary"
                rows="5"
                :class="submitAttempted && errors.summary ? 'border-error/45 focus:border-error dark:border-error/50' : 'focus:border-primary'"
                :disabled="isDraftMutationDisabled"
              />
              <p
                v-if="submitAttempted && errors.summary"
                class="text-xs text-error"
              >
                {{ errors.summary }}
              </p>
            </AppFormField>

            <AppFormField
              v-if="requiresTrackSelection"
              label="Track"
              name="participant-submission-track"
            >
              <AppSelect
                id="participant-submission-track"
                v-model="trackSelectionInput"
                name="participant-submission-track"
                :disabled="isDraftMutationDisabled"
                :class="submitAttempted && errors.trackId ? 'border-error/45 focus:border-error dark:border-error/50' : ''"
              >
                <option value="">
                  Select a track
                </option>
                <option
                  v-for="track in sortedTracks"
                  :key="track.id"
                  :value="track.id"
                >
                  {{ track.name }}
                </option>
              </AppSelect>
              <p
                v-if="submitAttempted && errors.trackId"
                class="text-xs text-error"
              >
                {{ errors.trackId }}
              </p>
              <p
                v-else-if="form.trackId"
                class="text-xs text-muted"
              >
                {{ sortedTracks.find(track => track.id === form.trackId)?.shortDescription }}
              </p>
            </AppFormField>

            <div class="grid gap-4 lg:grid-cols-2">
              <AppFormField
                :label="repositoryUrlLabel"
                name="participant-submission-repository-url"
              >
                <AppInput
                  id="participant-submission-repository-url"
                  v-model="form.repositoryUrl"
                  name="participant-submission-repository-url"
                  type="text"
                  size="xl"
                  class="w-full"
                  :class="submitAttempted && errors.repositoryUrl ? 'border-error/45 focus:border-error dark:border-error/50' : ''"
                  :disabled="isDraftMutationDisabled"
                />
                <p
                  v-if="submitAttempted && errors.repositoryUrl"
                  class="text-xs text-error"
                >
                  {{ errors.repositoryUrl }}
                </p>
              </AppFormField>

              <AppFormField
                :label="demoUrlLabel"
                name="participant-submission-demo-url"
              >
                <AppInput
                  id="participant-submission-demo-url"
                  v-model="form.demoUrl"
                  name="participant-submission-demo-url"
                  type="text"
                  size="xl"
                  class="w-full"
                  :class="submitAttempted && errors.demoUrl ? 'border-error/45 focus:border-error dark:border-error/50' : ''"
                  :disabled="isDraftMutationDisabled"
                />
                <p
                  v-if="submitAttempted && errors.demoUrl"
                  class="text-xs text-error"
                >
                  {{ errors.demoUrl }}
                </p>
              </AppFormField>
            </div>

            <div class="flex flex-wrap gap-3">
              <AppButton
                v-if="!submission"
                type="submit"
                color="primary"
                :loading="isCreatePending"
                :disabled="!createAvailability.isAllowed || isCreatePending"
                data-testid="participant-submission-create"
              >
                Create draft
              </AppButton>

              <template v-else>
                <AppButton
                  type="submit"
                  color="primary"
                  :loading="isUpdatePending"
                  :disabled="!updateAvailability.isAllowed || isUpdatePending"
                  data-testid="participant-submission-save"
                >
                  Save changes
                </AppButton>

                <AppButton
                  type="button"
                  color="primary"
                  variant="soft"
                  :loading="isSubmitPending"
                  :disabled="!submitAvailability.isAllowed || isSubmitPending"
                  data-testid="participant-submission-submit"
                  @click="handleSubmitProjectAttempt"
                >
                  Submit project
                </AppButton>

                <AppButton
                  type="button"
                  color="warning"
                  variant="soft"
                  :loading="isWithdrawPending"
                  :disabled="!withdrawAvailability.isAllowed || isWithdrawPending"
                  data-testid="participant-submission-withdraw"
                  @click="emit('withdrawSubmission')"
                >
                  Withdraw submission
                </AppButton>
              </template>
            </div>
          </form>
        </div>
      </AppCard>
    </template>
  </div>
</template>
