<script setup lang="ts">
import type { PublicEvent } from '~/domains/events/presentation'
import type { AccountEventWorkspacePage } from '#shared/domains/events/account-event-workspace-page'
import type { SubmissionTrackOption, TeamSubmissionFormInput } from '~/domains/submissions/team-submission'
import type { TeamActionAvailability } from '~/domains/teams/workspace'

import {
  LazyAccountEventsAccountEventParticipationRankNotice as LazyAccountEventParticipationRankNotice,
  LazyTeamsParticipantTeamSubmissionPanel as LazyParticipantTeamSubmissionPanel,
  LazyTeamsParticipantTeamWorkspacePanel as LazyParticipantTeamWorkspacePanel
} from '#components'
import { Switch as UiSwitch } from '~/components/ui/switch'
import { teamProfileFormSchema } from '~/domains/teams/team-forms'
import { getEventParticipationOutcomeNotice } from '~/domains/events/participation'
import {
  getCreateTeamAvailability,
  getLeaveTeamAvailability,
  getMemberRemovalAvailability,
  getTeamFormationAvailability,
  getUpdateJoinPolicyAvailability
} from '~/domains/teams/workspace'
import {
  getCreateSubmissionAvailability,
  resolveSelectedTrackPrefillId,
  getSubmitSubmissionAvailability,
  getUpdateSubmissionPublicVisibilityAvailability,
  getUpdateSubmissionAvailability,
  getWithdrawSubmissionAvailability
} from '~/domains/submissions/team-submission'
import {
  buildAbsoluteAccountEventTeamsTabHref,
  buildAccountEventTeamsTabHref
} from '~/domains/teams/query'

const props = defineProps<{
  event: PublicEvent & {
    id: string
    tracks?: SubmissionTrackOption[]
  }
  page: AccountEventWorkspacePage | null
  loadErrorMessage?: string
  refreshAfterSubmission: (eventSlug: string) => Promise<void>
  refreshTeams: (eventSlug: string) => Promise<void>
  selectedTrackId?: string | null
}>()

const toast = useToast()
const { actor, status: actorStatus, error: actorError } = useAccountBootstrap()
const { run, pendingActionKey, mutationError } = useTeamActions(() => props.event, props.refreshTeams)
const createTeamForm = reactive({
  name: '',
  bio: '',
  isOpenToJoinRequests: true
})
const createTeamErrors = reactive({
  name: '',
  bio: ''
})
const createTeamSubmitCount = ref(0)

const ownApplicationStatus = computed(() => props.page?.application?.status ?? null)
const displayedTeam = computed(() => props.page?.ownTeam ?? null)
const displayedTeamMembership = computed(() => props.page?.ownMembership ?? null)
const workspaceOutcomeNotice = computed(() =>
  getEventParticipationOutcomeNotice({
    event: {
      state: props.event.state
    },
    activeTeam: displayedTeam.value
      ? {
          name: displayedTeam.value.name
        }
      : null,
    latestTeam: displayedTeam.value
      ? {
          name: displayedTeam.value.name
        }
      : null,
    outcome: props.page?.outcome ?? null
  })
)
const canManageTeam = computed(() => props.page?.workflow.canManageTeam === true)
const defaultSoloTeamName = computed(() => {
  if (actor.value?.kind !== 'platform_user') {
    return 'Team Solo'
  }

  const fullName = `${actor.value.platformUser.firstName} ${actor.value.platformUser.familyName}`.trim()
  const preferredName = fullName
    || actor.value.platformUser.displayName.trim()
    || actor.value.sessionUser.name?.trim()
    || actor.value.sessionUser.nickname?.trim()
    || 'Solo'

  return `Team ${preferredName}`.trim()
})

const teamFormationAvailability = computed(() =>
  getTeamFormationAvailability(props.event, ownApplicationStatus.value, Boolean(displayedTeam.value))
)
const createTeamAvailability = computed(() =>
  getCreateTeamAvailability(props.event, ownApplicationStatus.value, Boolean(displayedTeam.value))
)
const joinPolicyAvailability = computed(() =>
  getUpdateJoinPolicyAvailability(props.event, canManageTeam.value)
)
const teamsTabHref = computed(() => buildAccountEventTeamsTabHref(props.event.slug))
const submission = computed(() => props.page?.submission ?? null)
const submissionPath = computed(() => `teams/${displayedTeam.value!.id}/submission`)
const {
  run: runSubmission,
  pendingActionKey: pendingSubmissionAction,
  mutationError: submissionError
} = useTeamActions(() => props.event, props.refreshAfterSubmission)
const hasActiveTeamSubmission = computed(() => {
  const status = submission.value?.status
  return status === 'draft' || status === 'submitted'
})
const selectedTrackPrefillId = computed(() => {
  return resolveSelectedTrackPrefillId(props.event.tracks, props.selectedTrackId)
})
const leaveAvailability = computed(() => {
  if (!displayedTeam.value) {
    return {
      isAllowed: false,
      reason: 'The current team could not be loaded.'
    } satisfies TeamActionAvailability
  }

  return getLeaveTeamAvailability(
    props.event,
    displayedTeam.value,
    displayedTeamMembership.value,
    {
      hasActiveSubmission: hasActiveTeamSubmission.value
    }
  )
})
const removalAvailabilityByUserId = computed<Record<string, TeamActionAvailability>>(() => {
  if (!displayedTeam.value) {
    return {}
  }

  return Object.fromEntries(
    displayedTeam.value.members.map(member => [
      member.userId,
      getMemberRemovalAvailability(props.event, displayedTeam.value!, member)
    ])
  )
})
const createSubmissionAvailability = computed(() =>
  getCreateSubmissionAvailability(props.event, submission.value, canManageTeam.value)
)
const updateSubmissionAvailability = computed(() =>
  getUpdateSubmissionAvailability(props.event, submission.value, canManageTeam.value)
)
const submitSubmissionAvailability = computed(() =>
  getSubmitSubmissionAvailability(props.event, submission.value, canManageTeam.value)
)
const withdrawSubmissionAvailability = computed(() =>
  getWithdrawSubmissionAvailability(props.event, submission.value, canManageTeam.value)
)
const publicVisibilityAvailability = computed(() =>
  getUpdateSubmissionPublicVisibilityAvailability(
    props.event,
    submission.value,
    canManageTeam.value,
    Boolean(props.page?.outcome?.isWinner)
  )
)
const showPublicVisibilityToggle = computed(() =>
  Boolean(submission.value) && publicVisibilityAvailability.value.isAllowed
)
const isWorkspaceLoading = computed(() =>
  !props.page
  || actorStatus.value === 'idle' || actorStatus.value === 'pending'
)

function resetCreateTeamErrors() {
  createTeamErrors.name = ''
  createTeamErrors.bio = ''
}

function validateCreateTeamForm() {
  resetCreateTeamErrors()

  const result = teamProfileFormSchema.safeParse(createTeamForm)

  if (result.success) {
    return true
  }

  const fieldErrors = result.error.flatten().fieldErrors
  createTeamErrors.name = fieldErrors.name?.[0] ?? ''
  createTeamErrors.bio = fieldErrors.bio?.[0] ?? ''
  return false
}

async function participateAsSolo() {
  const createdTeam = await run('create-team', 'teams', {
    body: {
      name: defaultSoloTeamName.value,
      bio: '',
      isOpenToJoinRequests: false,
      workspaceMode: 'solo'
    }
  })

  if (!createdTeam) {
    return
  }

  toast.add({
    title: 'Solo participation confirmed',
    description: 'Your solo workspace is now active.',
    color: 'success'
  })
}

async function submitCreateTeamForm() {
  createTeamSubmitCount.value += 1

  if (!validateCreateTeamForm()) {
    return
  }

  const createdTeam = await run('create-team', 'teams', {
    body: {
      name: createTeamForm.name,
      bio: createTeamForm.bio,
      isOpenToJoinRequests: createTeamForm.isOpenToJoinRequests,
      workspaceMode: 'team'
    }
  })

  if (!createdTeam) {
    return
  }

  createTeamForm.name = ''
  createTeamForm.bio = ''
  createTeamForm.isOpenToJoinRequests = true
  createTeamSubmitCount.value = 0
  resetCreateTeamErrors()

  toast.add({
    title: 'Team created',
    description: 'Your team workspace is ready.',
    color: 'success'
  })
}

async function copyCurrentTeamLink() {
  if (!displayedTeam.value || !import.meta.client || !window.isSecureContext || !navigator.clipboard) {
    toast.add({
      title: 'Copy unavailable',
      description: 'This browser could not copy the team link right now.',
      color: 'error'
    })
    return
  }

  try {
    await navigator.clipboard.writeText(buildAbsoluteAccountEventTeamsTabHref(
      window.location.origin,
      props.event.slug,
      displayedTeam.value.slug
    ))

    toast.add({
      title: 'Team link copied',
      description: 'The direct team link was copied to your clipboard.',
      color: 'success'
    })
  } catch {
    toast.add({
      title: 'Copy failed',
      description: 'The team link could not be copied right now.',
      color: 'error'
    })
  }
}

async function submitTeamProfile(fields: { name: string, bio: string }) {
  const team = displayedTeam.value
  if (!team) return false
  const updatedTeam = await run(`update-team:${team.id}`, `teams/${team.id}`, {
    method: 'PATCH',
    body: fields
  })

  if (!updatedTeam) return false

  toast.add({
    title: 'Team profile updated',
    description: 'The team profile was updated.',
    color: 'success'
  })
  return true
}

async function toggleJoinPolicy(nextValue: boolean) {
  const team = displayedTeam.value
  if (!team) return
  const updatedTeam = await run(`update-team-join-policy:${team.id}`, `teams/${team.id}/join-policy`, {
    method: 'PATCH',
    body: { isOpenToJoinRequests: nextValue }
  })

  if (!updatedTeam) {
    return
  }

  toast.add({
    title: 'Join policy updated',
    description: nextValue
      ? 'This team now accepts new join requests.'
      : 'This team is now closed to new join requests.',
    color: 'success'
  })
}

async function leaveCurrentTeam() {
  const team = displayedTeam.value
  if (!team) return
  const result = await run(`leave-team:${team.id}`, `teams/${team.id}/actions/leave`)

  if (!result) {
    return
  }

  toast.add({
    title: 'Team membership updated',
    description: 'You are no longer an active member of this team.',
    color: 'success'
  })
}

function getDisplayedTeamMemberLabel(userId: string) {
  const member = displayedTeam.value?.members.find(entry => entry.userId === userId)
  return member?.user?.displayName ?? member?.user?.email ?? userId
}

async function makeMemberAdmin(userId: string) {
  const memberLabel = getDisplayedTeamMemberLabel(userId)
  const confirmed = window.confirm(
    `Make ${memberLabel} a team admin?\n\nThey will be able to manage members, join requests, and team settings.`
  )

  if (!confirmed) {
    return
  }

  const team = displayedTeam.value
  if (!team) return
  const result = await run(`make-team-admin:${team.id}:${userId}`, `teams/${team.id}/members/${userId}/actions/make-admin`)

  if (!result) {
    return
  }

  toast.add({
    title: 'Team admin updated',
    description: `${memberLabel} can now manage this team.`,
    color: 'success'
  })
}

async function removeMember(userId: string) {
  const memberLabel = getDisplayedTeamMemberLabel(userId)
  const confirmed = window.confirm(
    `Remove ${memberLabel} from this team?`
  )

  if (!confirmed) {
    return
  }

  const team = displayedTeam.value
  if (!team) return
  const result = await run(`remove-team-member:${team.id}:${userId}`, `teams/${team.id}/members/${userId}/actions/remove`)

  if (!result) {
    return
  }

  toast.add({
    title: 'Team member removed',
    description: 'The selected member was removed from the team.',
    color: 'success'
  })
}

async function approveJoinRequest(requestId: string) {
  const request = await run(`approve-join-request:${requestId}`, `team-join-requests/${requestId}/actions/approve`)

  if (!request) {
    if (mutationError.value) {
      toast.add({
        title: 'Unable to approve join request',
        description: mutationError.value,
        color: 'error'
      })
    }
    return
  }

  toast.add({
    title: 'Join request approved',
    description: 'The participant is now an active member of your team.',
    color: 'success'
  })
}

async function rejectJoinRequest(requestId: string) {
  const request = await run(`reject-join-request:${requestId}`, `team-join-requests/${requestId}/actions/reject`)

  if (!request) {
    return
  }

  toast.add({
    title: 'Join request rejected',
    description: 'The pending request was rejected.',
    color: 'success'
  })
}

async function saveSubmissionDraft(fields: TeamSubmissionFormInput) {
  const isNew = !submission.value
  const saved = await runSubmission(isNew ? 'create' : 'save', submissionPath.value, {
    method: isNew ? 'POST' : 'PATCH',
    body: fields
  })
  if (saved) toast.add({ title: isNew ? 'Submission draft created' : 'Submission updated', color: 'success' })
}

async function submitProject(fields: TeamSubmissionFormInput) {
  const saved = await runSubmission('submit', `${submissionPath.value}/actions/submit`, { body: fields })
  if (saved) toast.add({ title: 'Project submitted', color: 'success' })
}

async function withdrawSubmission() {
  const saved = await runSubmission('withdraw', `${submissionPath.value}/actions/withdraw`)
  if (saved) toast.add({ title: 'Submission withdrawn', color: 'success' })
}

async function toggleSubmissionPublicVisibility(isPubliclyVisible: boolean) {
  const saved = await runSubmission('visibility', `${submissionPath.value}/public-visibility`, {
    method: 'PATCH', body: { isPubliclyVisible }
  })
  if (saved) toast.add({ title: 'Project visibility updated', color: 'success' })
}
</script>

<template>
  <div
    data-testid="account-event-workspace-panel"
    class="space-y-6"
  >
    <AppAlert
      v-if="actorError || props.loadErrorMessage"
      color="error"
      variant="soft"
      title="Workspace unavailable"
      :description="actorError?.message || props.loadErrorMessage"
    />

    <AppAlert
      v-else-if="isWorkspaceLoading"
      color="neutral"
      variant="soft"
      title="Loading workspace"
      description="Checking your team and submission access for this event."
    />

    <template v-else-if="actor?.kind === 'platform_user'">
      <AppAlert
        v-if="mutationError"
        color="error"
        variant="soft"
        title="Team action failed"
        :description="mutationError"
      />

      <AppAlert
        v-if="workspaceOutcomeNotice"
        :color="workspaceOutcomeNotice.color"
        variant="soft"
        :title="workspaceOutcomeNotice.title"
        :description="workspaceOutcomeNotice.description"
      />

      <LazyAccountEventParticipationRankNotice
        :event-state="props.event.state"
        :team-name="displayedTeam?.name ?? null"
        :rank-summary="props.page?.rank ?? null"
      />

      <template v-if="displayedTeam">
        <LazyParticipantTeamWorkspacePanel
          :team="displayedTeam"
          :event-state="props.event.state"
          :max-team-members="props.event.maxTeamMembers"
          :membership="displayedTeamMembership"
          :can-manage-team="canManageTeam"
          :is-team-locked="props.event.state !== 'registration_open' && props.event.state !== 'submission_open'"
          :join-policy-availability="joinPolicyAvailability"
          :leave-availability="leaveAvailability"
          :pending-action-key="pendingActionKey"
          :removal-availability-by-user-id="removalAvailabilityByUserId"
          :join-requests="props.page?.joinRequests"
          :save-profile="submitTeamProfile"
          @copy-team-link="copyCurrentTeamLink"
          @toggle-join-policy="toggleJoinPolicy"
          @leave-team="leaveCurrentTeam"
          @make-admin="makeMemberAdmin"
          @remove-member="removeMember"
          @approve-request="approveJoinRequest"
          @reject-request="rejectJoinRequest"
        />
      </template>

      <section
        v-else
        class="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
      >
        <div class="space-y-6">
          <AppCard
            class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
            :ui="{ body: 'p-5' }"
          >
            <div class="space-y-4">
              <div class="space-y-1 border-b border-black/8 pb-3 dark:border-white/[0.08]">
                <h2 class="text-xl font-semibold text-highlighted dark:text-white">
                  Participate as solo
                </h2>
                <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
                  Confirm solo participation now and keep the compact solo workspace until you decide to create or join a larger team.
                </p>
              </div>

              <p class="text-sm text-toned">
                {{ teamFormationAvailability.summary }}
              </p>

              <div>
                <AppButton
                  color="neutral"
                  variant="solid"
                  class="bg-black text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
                  :loading="pendingActionKey === 'create-team'"
                  :disabled="!createTeamAvailability.isAllowed || pendingActionKey === 'create-team'"
                  @click="participateAsSolo"
                >
                  Participate as solo
                </AppButton>
              </div>
            </div>
          </AppCard>

          <AppCard
            class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
            :ui="{ body: 'p-5' }"
          >
            <div class="space-y-4">
              <div class="space-y-1 border-b border-black/8 pb-3 dark:border-white/[0.08]">
                <h2 class="text-xl font-semibold text-highlighted dark:text-white">
                  Join a Team
                </h2>
                <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
                  Browse available teams and send a join request from the Teams tab.
                </p>
              </div>

              <AppButton
                :to="teamsTabHref"
                color="neutral"
                variant="solid"
                trailing-icon="i-lucide-arrow-up-right"
                class="bg-black text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
              >
                Open Teams
              </AppButton>
            </div>
          </AppCard>
        </div>

        <AppCard
          class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
          :ui="{ body: 'p-5' }"
        >
          <div class="space-y-4">
            <div class="space-y-1 border-b border-black/8 pb-3 dark:border-white/[0.08]">
              <h2 class="text-xl font-semibold text-highlighted dark:text-white">
                Create a team
              </h2>
              <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
                Start a regular team now and decide whether to accept join requests from other participants.
              </p>
            </div>

            <p
              v-if="!createTeamAvailability.isAllowed && createTeamAvailability.reason"
              class="text-sm text-muted"
            >
              {{ createTeamAvailability.reason }}
            </p>

            <form
              class="grid gap-4"
              @submit.prevent="submitCreateTeamForm"
            >
              <AppFormField
                label="Team name"
                name="participant-create-team-name"
              >
                <AppInput
                  id="participant-create-team-name"
                  v-model="createTeamForm.name"
                  name="participant-create-team-name"
                  size="xl"
                  :class="createTeamSubmitCount > 0 && createTeamErrors.name ? 'border-error/45 focus:border-error dark:border-error/50' : ''"
                  :disabled="pendingActionKey === 'create-team'"
                />
                <p
                  v-if="createTeamSubmitCount > 0 && createTeamErrors.name"
                  class="text-xs text-error"
                >
                  {{ createTeamErrors.name }}
                </p>
              </AppFormField>

              <AppFormField
                label="Team bio"
                name="participant-create-team-bio"
              >
                <AppTextarea
                  id="participant-create-team-bio"
                  v-model="createTeamForm.bio"
                  name="participant-create-team-bio"
                  rows="4"
                  :class="createTeamSubmitCount > 0 && createTeamErrors.bio ? 'border-error/45 focus:border-error dark:border-error/50' : 'focus:border-primary'"
                  :disabled="pendingActionKey === 'create-team'"
                />
                <p
                  v-if="createTeamSubmitCount > 0 && createTeamErrors.bio"
                  class="text-xs text-error"
                >
                  {{ createTeamErrors.bio }}
                </p>
              </AppFormField>

              <div class="flex items-center gap-3">
                <UiSwitch
                  id="participant-create-team-open-initial"
                  v-model="createTeamForm.isOpenToJoinRequests"
                  :disabled="pendingActionKey === 'create-team'"
                />
                <label
                  for="participant-create-team-open-initial"
                  class="text-sm font-medium text-toned"
                >
                  {{ createTeamForm.isOpenToJoinRequests ? 'Open to join requests' : 'Closed to join requests' }}
                </label>
              </div>

              <div>
                <AppButton
                  type="submit"
                  color="primary"
                  :loading="pendingActionKey === 'create-team'"
                  :disabled="!createTeamAvailability.isAllowed || pendingActionKey === 'create-team'"
                >
                  Create team
                </AppButton>
              </div>
            </form>
          </div>
        </AppCard>
      </section>

      <section
        v-if="displayedTeam"
        data-testid="account-event-submission-panel"
        class="space-y-6"
      >
        <AppCountdownCard
          v-if="props.event.state === 'registration_open'"
          title="Submission window not open yet"
          description="You can prepare your team during registration. Submission details open once the event enters the submission phase."
          :target-at="props.event.submissionOpensAt!"
          target-label="Submission opens at"
          countdown-label="Submission opens in"
          waiting-title="Scheduled opening time reached"
          waiting-description="The scheduled opening time has passed. Submission actions appear once organizers open the submission phase."
          post-target-state="waiting"
          tone="info"
          :show-seconds="true"
          class="rounded-xl"
        />

        <LazyParticipantTeamSubmissionPanel
          v-else-if="props.page?.workflow.canViewSubmission"
          :key="displayedTeam.id"
          :initial-track-id="selectedTrackPrefillId"
          :tracks="props.event.tracks ?? []"
          :submission-requirements="{
            requireSubmissionSummary: props.event.requireSubmissionSummary,
            requireSubmissionRepositoryUrl: props.event.requireSubmissionRepositoryUrl,
            requireSubmissionDemoUrl: props.event.requireSubmissionDemoUrl
          }"
          :submission="submission"
          :mutation-error="submissionError"
          :can-manage-submission="canManageTeam"
          :create-availability="createSubmissionAvailability"
          :update-availability="updateSubmissionAvailability"
          :submit-availability="submitSubmissionAvailability"
          :withdraw-availability="withdrawSubmissionAvailability"
          :public-visibility-availability="publicVisibilityAvailability"
          :show-public-visibility-toggle="showPublicVisibilityToggle"
          :pending-action="pendingSubmissionAction"
          @save-draft="saveSubmissionDraft"
          @submit-project="submitProject"
          @withdraw-submission="withdrawSubmission"
          @toggle-public-visibility="toggleSubmissionPublicVisibility"
        />
      </section>
    </template>

    <AppAlert
      v-else
      color="error"
      variant="soft"
      title="Workspace unavailable"
      description="Participant workspace actions require a platform user session."
    />
  </div>
</template>
