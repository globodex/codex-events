<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'

import { Switch as UiSwitch } from '~/components/ui/switch'
import type {
  SubmissionTrackOption,
  TeamSubmissionActionAvailability,
  TeamSubmissionRequirementConfig,
  TeamSubmissionFormInput,
  TeamSubmissionRecord
} from '~/domains/submissions/team-submission'

import {
  formatTeamSubmissionStatus,
  getTeamSubmissionStatusColor,
  getTeamSubmissionWorkspaceStatus
} from '~/domains/submissions/team-submission'
import { createTeamSubmissionFormSchema } from '~/domains/submissions/team-submission-form'

const props = defineProps<{
  initialTrackId?: string | null
  submission: TeamSubmissionRecord | null
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
  pendingAction?: string | null
}>()

const emit = defineEmits<{
  saveDraft: [fields: TeamSubmissionFormInput]
  submitProject: [fields: TeamSubmissionFormInput]
  withdrawSubmission: []
  togglePublicVisibility: [value: boolean]
}>()

const submissionStatus = computed(() => getTeamSubmissionWorkspaceStatus(props.submission))
const submissionStatusLabel = computed(() => formatTeamSubmissionStatus(submissionStatus.value))
const submissionStatusColor = computed(() => getTeamSubmissionStatusColor(submissionStatus.value))
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
const publicVisibilitySwitchId = computed(() =>
  props.submission ? `participant-submission-public-visibility-${props.submission.id}` : 'participant-submission-public-visibility'
)
const isDraftMutationDisabled = computed(() =>
  Boolean(props.pendingAction) || !(props.submission ? props.updateAvailability : props.createAvailability).isAllowed
)
const publicVisibilityStatusLabel = computed(() =>
  props.submission?.isPubliclyVisible ? 'Visible in the public showcase' : 'Hidden from the public showcase'
)

const validationSchema = computed(() =>
  toTypedSchema(createTeamSubmissionFormSchema({
    trackRequired: requiresTrackSelection.value,
    requireSummary: props.submissionRequirements.requireSubmissionSummary,
    requireRepositoryUrl: props.submissionRequirements.requireSubmissionRepositoryUrl,
    requireDemoUrl: props.submissionRequirements.requireSubmissionDemoUrl
  }))
)

function savedFields(): TeamSubmissionFormInput {
  return {
    projectName: props.submission?.projectName ?? '',
    summary: props.submission?.summary ?? '',
    repositoryUrl: props.submission?.repositoryUrl ?? '',
    demoUrl: props.submission?.demoUrl ?? '',
    trackId: props.submission?.trackId ?? props.initialTrackId ?? null
  }
}

const { errors, submitCount, handleSubmit, defineField, resetForm, meta } = useForm({
  validationSchema,
  initialValues: savedFields()
})
const [projectName] = defineField('projectName')
const [summary] = defineField('summary')
const [repositoryUrl] = defineField('repositoryUrl')
const [demoUrl] = defineField('demoUrl')
const [trackId] = defineField('trackId')

watch([() => props.submission, () => props.initialTrackId], () => {
  if (!meta.value.dirty || props.pendingAction) resetForm({ values: savedFields() })
})

const saveDraft = handleSubmit(fields => emit('saveDraft', fields))
const submitProject = handleSubmit(fields => emit('submitProject', fields))
</script>

<template>
  <AppCard
    data-testid="participant-submission-panel"
    class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
  >
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
            :disabled="Boolean(pendingAction) || !props.publicVisibilityAvailability?.isAllowed"
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
        @submit.prevent="saveDraft"
      >
        <AppFormField
          label="Project name"
          name="participant-submission-project-name"
        >
          <AppInput
            id="participant-submission-project-name"
            v-model="projectName"
            name="participant-submission-project-name"
            size="xl"
            class="w-full"
            :class="submitCount > 0 && errors.projectName ? 'border-error/45 focus:border-error dark:border-error/50' : ''"
            :disabled="isDraftMutationDisabled"
          />
          <p
            v-if="submitCount > 0 && errors.projectName"
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
            v-model="summary"
            name="participant-submission-summary"
            rows="5"
            :class="submitCount > 0 && errors.summary ? 'border-error/45 focus:border-error dark:border-error/50' : 'focus:border-primary'"
            :disabled="isDraftMutationDisabled"
          />
          <p
            v-if="submitCount > 0 && errors.summary"
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
            :model-value="trackId ?? ''"
            name="participant-submission-track"
            :disabled="isDraftMutationDisabled"
            :class="submitCount > 0 && errors.trackId ? 'border-error/45 focus:border-error dark:border-error/50' : ''"
            @update:model-value="trackId = $event ? String($event) : null"
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
            v-if="submitCount > 0 && errors.trackId"
            class="text-xs text-error"
          >
            {{ errors.trackId }}
          </p>
          <p
            v-else-if="trackId"
            class="text-xs text-muted"
          >
            {{ sortedTracks.find(track => track.id === trackId)?.shortDescription }}
          </p>
        </AppFormField>

        <div class="grid gap-4 lg:grid-cols-2">
          <AppFormField
            :label="repositoryUrlLabel"
            name="participant-submission-repository-url"
          >
            <AppInput
              id="participant-submission-repository-url"
              v-model="repositoryUrl"
              name="participant-submission-repository-url"
              type="text"
              size="xl"
              class="w-full"
              :class="submitCount > 0 && errors.repositoryUrl ? 'border-error/45 focus:border-error dark:border-error/50' : ''"
              :disabled="isDraftMutationDisabled"
            />
            <p
              v-if="submitCount > 0 && errors.repositoryUrl"
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
              v-model="demoUrl"
              name="participant-submission-demo-url"
              type="text"
              size="xl"
              class="w-full"
              :class="submitCount > 0 && errors.demoUrl ? 'border-error/45 focus:border-error dark:border-error/50' : ''"
              :disabled="isDraftMutationDisabled"
            />
            <p
              v-if="submitCount > 0 && errors.demoUrl"
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
            :loading="pendingAction === 'create'"
            :disabled="isDraftMutationDisabled"
            data-testid="participant-submission-create"
          >
            Create draft
          </AppButton>

          <template v-else>
            <AppButton
              type="submit"
              color="primary"
              :loading="pendingAction === 'save'"
              :disabled="isDraftMutationDisabled"
              data-testid="participant-submission-save"
            >
              Save changes
            </AppButton>

            <AppButton
              type="button"
              color="primary"
              variant="soft"
              :loading="pendingAction === 'submit'"
              :disabled="!submitAvailability.isAllowed || Boolean(pendingAction)"
              data-testid="participant-submission-submit"
              @click="submitProject"
            >
              Submit project
            </AppButton>

            <AppButton
              type="button"
              color="warning"
              variant="soft"
              :loading="pendingAction === 'withdraw'"
              :disabled="!withdrawAvailability.isAllowed || Boolean(pendingAction)"
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
