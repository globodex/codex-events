<script setup lang="ts">
import type { PublicEventState } from '~/domains/events/presentation'
import type {
  TeamActionAvailability,
  TeamDetailRecord,
  TeamJoinRequestRecord,
  TeamMemberRecord,
  TeamUserSummary
} from '~/domains/teams/workspace'

import { formatTimestamp } from '~/lib/date-formatting'
import {
  getActiveTeamMemberCount,
  formatJoinAvailabilityReason,
  formatTeamJoinRequestStatus,
  formatTeamMemberRole,
  getTeamJoinRequestStatusColor,
  hasTeamReachedMemberLimit,
  isTeamDissolved,
  shouldShowParticipantLeaveTeamAction
} from '~/domains/teams/workspace'
import { Switch as UiSwitch } from '~/components/ui/switch'
import { teamProfileFormSchema } from '~/domains/teams/team-forms'

const props = defineProps<{
  team: TeamDetailRecord
  saveProfile?: (fields: { name: string, bio: string }) => Promise<boolean>
  eventState: PublicEventState
  maxTeamMembers: number
  membership?: TeamMemberRecord | null
  canManageTeam?: boolean
  isTeamLocked?: boolean
  joinAvailability?: TeamActionAvailability
  joinPolicyAvailability?: TeamActionAvailability
  leaveAvailability?: TeamActionAvailability
  pendingJoinRequestId?: string | null
  pendingActionKey?: string | null
  removalAvailabilityByUserId?: Record<string, TeamActionAvailability>
  joinRequests?: TeamJoinRequestRecord[]
}>()

const emit = defineEmits<{
  toggleJoinPolicy: [value: boolean]
  requestJoin: [teamId: string]
  cancelJoinRequest: [requestId: string]
  leaveTeam: []
  copyTeamLink: []
  makeAdmin: [userId: string]
  removeMember: [userId: string]
  approveRequest: [requestId: string]
  rejectRequest: [requestId: string]
}>()
const toast = useToast()

function isActionPending(actionKey: string) {
  return props.pendingActionKey === actionKey
}

function getUserProfileLinks(user?: TeamUserSummary | null) {
  const links: Array<{
    key: 'github' | 'linkedin' | 'x'
    label: 'GitHub' | 'LinkedIn' | 'X'
    href: string
  }> = []

  const githubProfileUrl = user?.githubProfileUrl?.trim()
  const linkedinProfileUrl = user?.linkedinProfileUrl?.trim()
  const xProfileUrl = user?.xProfileUrl?.trim()

  if (githubProfileUrl) {
    links.push({
      key: 'github',
      label: 'GitHub',
      href: githubProfileUrl
    })
  }

  if (linkedinProfileUrl) {
    links.push({
      key: 'linkedin',
      label: 'LinkedIn',
      href: linkedinProfileUrl
    })
  }

  if (xProfileUrl) {
    links.push({
      key: 'x',
      label: 'X',
      href: xProfileUrl
    })
  }

  return links
}

const profile = reactive({ name: '', bio: '' })
const errors = reactive({
  name: '',
  bio: ''
})
const isEditingProfile = ref(false)

const showHeaderLeaveAction = computed(() =>
  props.leaveAvailability && shouldShowParticipantLeaveTeamAction({ state: props.eventState }, props.membership)
)
const showHeaderMembershipAction = computed(() =>
  props.joinAvailability && !props.membership && (props.pendingJoinRequestId || showRequestJoinAction.value)
)
const hasPendingJoinRequests = computed(() =>
  (props.joinRequests ?? []).some(request => request.status === 'pending')
)
const showJoinRequestsPanel = computed(() =>
  Boolean(props.canManageTeam) && (props.team.isOpenToJoinRequests || hasPendingJoinRequests.value)
)
const isSoloWorkspace = computed(() => props.team.workspaceMode === 'solo')
const joinPolicySwitchId = computed(() => `team-join-policy-${props.team.id}`)
const activeMemberCount = computed(() => getActiveTeamMemberCount(props.team))
const isDissolvedTeam = computed(() => isTeamDissolved(props.team))
const showRequestJoinAction = computed(() =>
  !isSoloWorkspace.value && props.team.isOpenToJoinRequests && !isJoinCapacityReached.value
)
const canManageTeamSettings = computed(() =>
  Boolean(props.canManageTeam) && (props.joinPolicyAvailability?.isAllowed ?? true)
)
const showLockedBadge = computed(() =>
  Boolean(props.membership) && Boolean(props.isTeamLocked) && !isDissolvedTeam.value
)
const showParticipantTeamStatusBadge = computed(() =>
  !props.canManageTeam && !isSoloWorkspace.value && !isDissolvedTeam.value
)
const showJoinPolicyToggle = computed(() => !isSoloWorkspace.value && canManageTeamSettings.value)
const joinPolicyStatusText = computed(() =>
  props.team.isOpenToJoinRequests ? 'Open to join requests' : 'Closed to join requests'
)
const isJoinCapacityReached = computed(() =>
  !props.membership && hasTeamReachedMemberLimit(props.maxTeamMembers, activeMemberCount.value)
)
const participantTeamStatusLabel = computed(() =>
  isJoinCapacityReached.value
    ? 'Member limit reached'
    : props.team.isOpenToJoinRequests
      ? 'Open to join requests'
      : 'Closed to join requests'
)
const participantTeamStatusColor = computed(() =>
  isJoinCapacityReached.value
    ? 'warning'
    : props.team.isOpenToJoinRequests
      ? 'success'
      : 'neutral'
)
const showSoloWorkspaceHint = computed(() =>
  isSoloWorkspace.value && Boolean(props.membership)
)
const disabledJoinActionReason = computed(() =>
  props.joinAvailability && !props.joinAvailability.isAllowed
    ? formatJoinAvailabilityReason(props.team, props.joinAvailability) ?? 'Join requests are not available right now.'
    : ''
)
const disabledLeaveActionReason = computed(() =>
  props.leaveAvailability && !props.leaveAvailability.isAllowed
    ? props.leaveAvailability.reason ?? 'Leaving the team is not available right now.'
    : ''
)
const joinActionButtonClass = computed(() =>
  disabledJoinActionReason.value
    ? 'rounded-lg cursor-not-allowed bg-emerald-800 text-white shadow-sm ring-1 ring-emerald-950/20 opacity-100 dark:bg-emerald-300 dark:text-black dark:ring-emerald-100/15'
    : 'rounded-lg bg-emerald-800 text-white shadow-sm ring-1 ring-emerald-950/20 hover:bg-emerald-900 dark:bg-emerald-300 dark:text-black dark:ring-emerald-100/15 dark:hover:bg-emerald-200 dark:hover:text-black'
)

async function submitProfileForm() {
  const result = teamProfileFormSchema.safeParse(profile)
  if (!result.success) {
    const fields = result.error.flatten().fieldErrors
    errors.name = fields.name?.[0] ?? ''
    errors.bio = fields.bio?.[0] ?? ''
    return
  }

  if (await props.saveProfile?.(result.data)) isEditingProfile.value = false
}

function startEditingProfile() {
  profile.name = props.team.name
  profile.bio = props.team.bio ?? ''
  errors.name = ''
  errors.bio = ''
  isEditingProfile.value = true
}

function handleJoinActionClick() {
  if (!props.joinAvailability?.isAllowed) {
    toast.add({
      title: 'Join request unavailable',
      description: disabledJoinActionReason.value || 'Join requests are not available right now.',
      color: 'warning'
    })
    return
  }

  emit('requestJoin', props.team.id)
}
</script>

<template>
  <AppCard
    data-testid="participant-team-workspace-panel"
    class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
  >
    <template #header>
      <div class="space-y-3">
        <div
          v-if="canManageTeamSettings && isEditingProfile"
          class="flex flex-col gap-4"
        >
          <form
            class="flex min-w-0 flex-1 flex-col gap-4"
            @submit.prevent="submitProfileForm"
          >
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div class="flex min-w-0 flex-1 flex-col gap-3">
                <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <AppButton
                    color="neutral"
                    variant="outline"
                    size="sm"
                    icon="i-lucide-copy"
                    class="h-8 w-8 shrink-0 gap-0 px-0"
                    aria-label="Copy team link"
                    @click="emit('copyTeamLink')"
                  >
                    <span class="sr-only">Copy team link</span>
                  </AppButton>

                  <div class="min-w-0 flex-1 space-y-2">
                    <label
                      :for="`team-name-inline-${team.id}`"
                      class="sr-only"
                    >
                      Team name
                    </label>
                    <AppInput
                      :id="`team-name-inline-${team.id}`"
                      v-model="profile.name"
                      size="xl"
                      class="w-full"
                      :class="errors.name ? 'border-error/45 focus:border-error dark:border-error/50' : ''"
                      :disabled="isActionPending(`update-team:${team.id}`)"
                    />
                    <p
                      v-if="errors.name"
                      class="text-xs text-error"
                    >
                      {{ errors.name }}
                    </p>
                  </div>

                  <AppButton
                    type="submit"
                    color="primary"
                    class="shrink-0"
                    :loading="isActionPending(`update-team:${team.id}`)"
                    :disabled="isActionPending(`update-team:${team.id}`)"
                    data-testid="participant-team-update-profile"
                  >
                    Save
                  </AppButton>

                  <AppButton
                    type="button"
                    color="neutral"
                    variant="outline"
                    class="shrink-0"
                    :disabled="isActionPending(`update-team:${team.id}`)"
                    @click="isEditingProfile = false"
                  >
                    Cancel
                  </AppButton>
                </div>

                <div class="space-y-2">
                  <label
                    :for="`team-bio-inline-${team.id}`"
                    class="text-sm font-medium text-highlighted"
                  >
                    Team bio
                  </label>
                  <AppTextarea
                    :id="`team-bio-inline-${team.id}`"
                    v-model="profile.bio"
                    rows="4"
                    placeholder="Share a short introduction about your team, what you are building, or how you work together."
                    :class="errors.bio ? 'border-error/45 focus:border-error dark:border-error/50' : 'focus:border-primary'"
                    :disabled="isActionPending(`update-team:${team.id}`)"
                  />
                  <p
                    v-if="errors.bio"
                    class="text-xs text-error"
                  >
                    {{ errors.bio }}
                  </p>
                </div>
              </div>

              <div class="flex shrink-0 flex-col items-start gap-3 md:items-end">
                <AppBadge
                  v-if="membership"
                  :color="membership.role === 'admin' ? 'primary' : 'neutral'"
                  :variant="membership.role === 'admin' ? 'soft' : 'outline'"
                >
                  {{ membership.role === 'admin' ? 'Team admin' : 'Team member' }}
                </AppBadge>

                <AppBadge
                  v-if="showLockedBadge"
                  color="neutral"
                  variant="outline"
                  class="border-black/16 bg-white/75 text-neutral-700 dark:border-white/[0.18] dark:bg-white/[0.03] dark:text-[#D0D0D0]"
                >
                  Locked
                </AppBadge>

                <AppBadge
                  v-if="isDissolvedTeam"
                  color="error"
                  variant="soft"
                >
                  Dissolved
                </AppBadge>

                <template v-if="!isSoloWorkspace">
                  <div
                    v-if="showJoinPolicyToggle"
                    class="flex items-center gap-3"
                  >
                    <UiSwitch
                      :id="joinPolicySwitchId"
                      :model-value="props.team.isOpenToJoinRequests"
                      :disabled="isActionPending(`update-team-join-policy:${team.id}`)"
                      @update:model-value="emit('toggleJoinPolicy', $event)"
                    />
                    <label
                      :for="joinPolicySwitchId"
                      class="text-sm font-medium text-toned"
                    >
                      {{ joinPolicyStatusText }}
                    </label>
                  </div>

                  <p
                    v-else
                    class="text-sm font-medium text-toned"
                  >
                    {{ joinPolicyStatusText }}
                  </p>
                </template>
              </div>
            </div>
          </form>
        </div>

        <div
          v-else
          class="flex flex-col gap-3 sm:flex-row sm:items-start"
        >
          <div class="min-w-0 space-y-3">
            <div class="flex min-w-0 flex-wrap items-center gap-3">
              <AppButton
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-copy"
                class="h-8 w-8 shrink-0 gap-0 px-0"
                aria-label="Copy team link"
                @click="emit('copyTeamLink')"
              >
                <span class="sr-only">Copy team link</span>
              </AppButton>

              <h2 class="text-2xl font-semibold text-highlighted dark:text-white">
                {{ team.name }}
              </h2>

              <AppButton
                v-if="canManageTeamSettings"
                variant="outline"
                color="neutral"
                size="sm"
                icon="i-lucide-pencil"
                class="h-8 w-8 shrink-0 gap-0 px-0"
                aria-label="Edit team profile"
                data-testid="participant-team-edit-name"
                @click="startEditingProfile"
              >
                <span class="sr-only">Edit team profile</span>
              </AppButton>

              <AppBadge
                v-if="membership"
                :color="membership.role === 'admin' ? 'primary' : 'neutral'"
                :variant="membership.role === 'admin' ? 'solid' : 'outline'"
              >
                {{ membership.role === 'admin' ? 'Team admin' : 'Team member' }}
              </AppBadge>

              <AppBadge
                v-if="showLockedBadge"
                color="neutral"
                variant="outline"
                class="border-black/16 bg-white/75 text-neutral-700 dark:border-white/[0.18] dark:bg-white/[0.03] dark:text-[#D0D0D0]"
              >
                Locked
              </AppBadge>

              <AppBadge
                v-if="isDissolvedTeam"
                color="error"
                variant="soft"
              >
                Dissolved
              </AppBadge>

              <AppBadge
                v-if="!isSoloWorkspace && !isDissolvedTeam"
                color="neutral"
                variant="soft"
              >
                Members {{ activeMemberCount }}/{{ maxTeamMembers }}
              </AppBadge>

              <AppBadge
                v-if="isSoloWorkspace"
                color="secondary"
                variant="outline"
                class="border-violet-700/22 bg-violet-100 text-violet-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:border-violet-300/32 dark:bg-violet-300/14 dark:text-violet-50"
              >
                Solo Team
              </AppBadge>

              <AppBadge
                v-if="showParticipantTeamStatusBadge"
                :color="participantTeamStatusColor"
                variant="outline"
                :class="team.isOpenToJoinRequests ? '' : 'border-black/16 bg-white/75 text-neutral-700 dark:border-white/[0.18] dark:bg-white/[0.03] dark:text-[#D0D0D0]'"
              >
                {{ participantTeamStatusLabel }}
              </AppBadge>
            </div>

            <div class="space-y-1">
              <p
                v-if="!isSoloWorkspace && !isDissolvedTeam"
                class="text-sm text-neutral-600 dark:text-[#A3A3A3]"
              >
                Everyone on the team appears here.
              </p>

              <p
                v-else-if="isDissolvedTeam"
                class="text-sm text-neutral-600 dark:text-[#A3A3A3]"
              >
                This team is dissolved and has no active members.
              </p>

              <p
                v-if="team.bio"
                class="max-w-3xl whitespace-pre-line text-sm text-toned"
              >
                {{ team.bio }}
              </p>
            </div>
          </div>

          <div
            v-if="canManageTeam || showHeaderLeaveAction || showHeaderMembershipAction"
            class="flex shrink-0 flex-wrap items-center justify-end gap-3 self-end sm:ml-auto sm:self-start"
          >
            <div
              v-if="canManageTeam && !isSoloWorkspace"
              class="flex items-center gap-3"
            >
              <template v-if="showJoinPolicyToggle">
                <UiSwitch
                  :id="joinPolicySwitchId"
                  :model-value="props.team.isOpenToJoinRequests"
                  :disabled="isActionPending(`update-team-join-policy:${team.id}`)"
                  @update:model-value="emit('toggleJoinPolicy', $event)"
                />
                <label
                  :for="joinPolicySwitchId"
                  class="text-sm font-medium text-toned"
                >
                  {{ joinPolicyStatusText }}
                </label>
              </template>

              <p
                v-else
                class="text-sm font-medium text-toned"
              >
                {{ joinPolicyStatusText }}
              </p>
            </div>

            <AppButton
              v-if="pendingJoinRequestId && showHeaderMembershipAction"
              color="warning"
              variant="soft"
              :loading="isActionPending(`cancel-join-request:${pendingJoinRequestId}`)"
              :disabled="isActionPending(`cancel-join-request:${pendingJoinRequestId}`)"
              data-testid="participant-team-cancel-pending-request"
              @click="emit('cancelJoinRequest', pendingJoinRequestId)"
            >
              Cancel pending request
            </AppButton>

            <span
              v-else-if="showHeaderMembershipAction && joinAvailability"
              :title="disabledJoinActionReason || undefined"
              class="inline-flex"
            >
              <AppButton
                color="success"
                size="sm"
                trailing-icon="i-lucide-user-plus"
                :class="joinActionButtonClass"
                :loading="joinAvailability.isAllowed && isActionPending(`join-team:${team.id}`)"
                :disabled="joinAvailability.isAllowed && isActionPending(`join-team:${team.id}`)"
                :aria-disabled="!joinAvailability.isAllowed ? 'true' : undefined"
                :title="disabledJoinActionReason || undefined"
                data-testid="participant-team-request-join"
                @click="handleJoinActionClick"
              >
                Request to join
              </AppButton>
            </span>

            <span
              v-if="showHeaderLeaveAction && leaveAvailability"
              :title="disabledLeaveActionReason || undefined"
              class="inline-flex"
            >
              <AppButton
                color="error"
                size="sm"
                :loading="isActionPending(`leave-team:${team.id}`)"
                :disabled="!leaveAvailability.isAllowed || isActionPending(`leave-team:${team.id}`)"
                :title="disabledLeaveActionReason || undefined"
                data-testid="participant-team-leave"
                @click="emit('leaveTeam')"
              >
                Leave team
              </AppButton>
            </span>
          </div>
        </div>
      </div>
    </template>

    <div class="space-y-6">
      <p
        v-if="showSoloWorkspaceHint"
        class="text-sm text-neutral-600 dark:text-[#A3A3A3]"
      >
        You are participating as solo. Leave the team before creating or joining another team.
      </p>

      <section :class="canManageTeam && !isSoloWorkspace ? 'grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]' : 'grid gap-6'">
        <div
          v-if="!isSoloWorkspace"
          class="grid gap-4"
        >
          <p
            v-if="isDissolvedTeam"
            class="rounded-2xl border border-black/8 bg-white/80 px-4 py-4 text-sm text-toned dark:border-white/[0.08] dark:bg-white/[0.03]"
          >
            No active members remain on this team.
          </p>

          <article
            v-for="member in team.members"
            :key="member.id"
            :data-testid="`participant-team-member-${member.userId}`"
            class="rounded-2xl border border-black/8 bg-white/80 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
          >
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-3">
                  <h4 class="text-base font-semibold text-highlighted dark:text-white">
                    {{ member.user?.displayName ?? member.userId }}
                  </h4>

                  <AppBadge
                    :color="member.role === 'admin' ? 'primary' : 'neutral'"
                    variant="soft"
                  >
                    {{ formatTeamMemberRole(member.role) }}
                  </AppBadge>

                  <AppBadge
                    v-if="membership?.id === member.id"
                    color="info"
                    variant="soft"
                  >
                    You
                  </AppBadge>
                </div>

                <p class="text-sm text-toned">
                  <template v-if="member.user?.email">
                    {{ member.user.email }} • Joined {{ formatTimestamp(member.joinedAt) }}
                  </template>
                  <template v-else>
                    Joined {{ formatTimestamp(member.joinedAt) }}
                  </template>
                </p>

                <p
                  v-if="canManageTeam && membership?.id !== member.id && removalAvailabilityByUserId?.[member.userId] && !removalAvailabilityByUserId?.[member.userId]?.isAllowed"
                  class="text-sm text-muted"
                >
                  {{ removalAvailabilityByUserId?.[member.userId]?.reason }}
                </p>

                <div
                  v-if="getUserProfileLinks(member.user).length > 0"
                  class="flex flex-wrap gap-2"
                >
                  <a
                    v-for="link in getUserProfileLinks(member.user)"
                    :key="link.key"
                    :href="link.href"
                    target="_blank"
                    rel="noreferrer"
                    class="inline-flex items-center gap-0.5 rounded-full border border-black/10 px-2 py-0.5 text-xs font-medium text-sky-700 transition hover:border-black/20 hover:text-sky-800 dark:border-white/[0.12] dark:text-sky-300 dark:hover:border-white/[0.22] dark:hover:text-sky-200"
                  >
                    {{ link.label }}
                    <AppIcon
                      name="i-lucide-external-link"
                      class="size-2.5"
                    />
                  </a>
                </div>
              </div>

              <div
                v-if="canManageTeam && membership?.id !== member.id"
                class="flex flex-col items-stretch gap-2 lg:min-w-36"
              >
                <AppButton
                  v-if="member.role !== 'admin'"
                  color="primary"
                  variant="soft"
                  :loading="pendingActionKey === `make-team-admin:${team.id}:${member.userId}`"
                  :disabled="pendingActionKey === `make-team-admin:${team.id}:${member.userId}` || pendingActionKey === `remove-team-member:${team.id}:${member.userId}`"
                  :data-testid="`participant-team-make-admin-${member.userId}`"
                  @click="emit('makeAdmin', member.userId)"
                >
                  Make admin
                </AppButton>

                <AppButton
                  color="warning"
                  variant="soft"
                  :loading="pendingActionKey === `remove-team-member:${team.id}:${member.userId}`"
                  :disabled="!removalAvailabilityByUserId?.[member.userId]?.isAllowed || pendingActionKey === `remove-team-member:${team.id}:${member.userId}` || pendingActionKey === `make-team-admin:${team.id}:${member.userId}`"
                  :data-testid="`participant-team-remove-${member.userId}`"
                  @click="emit('removeMember', member.userId)"
                >
                  Remove member
                </AppButton>
              </div>
            </div>
          </article>
        </div>

        <div
          v-if="showJoinRequestsPanel"
          data-testid="participant-team-join-requests-panel"
          class="space-y-4 rounded-xl border border-black/8 bg-white/78 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-white/[0.10] dark:bg-[#151515]/64 px-5 py-5"
        >
          <div class="space-y-1 border-b border-black/8 pb-3 dark:border-white/[0.08]">
            <h3 class="text-lg font-semibold text-highlighted dark:text-white">
              Join requests
            </h3>
            <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
              Team admins review pending requests here.
            </p>
          </div>

          <div
            v-if="(joinRequests?.length ?? 0) > 0"
            class="grid gap-4"
          >
            <article
              v-for="request in joinRequests"
              :key="request.id"
              :data-testid="`participant-team-join-request-${request.id}`"
              class="rounded-2xl border border-black/8 bg-white/80 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
            >
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0 flex-1 space-y-2">
                  <div class="flex flex-wrap items-center gap-3">
                    <h4 class="text-base font-semibold text-highlighted dark:text-white">
                      {{ request.user?.displayName ?? request.userId }}
                    </h4>

                    <AppBadge
                      :color="getTeamJoinRequestStatusColor(request.status)"
                      variant="soft"
                    >
                      {{ formatTeamJoinRequestStatus(request.status) }}
                    </AppBadge>
                  </div>

                  <p class="text-sm text-toned">
                    {{ request.user?.email ?? request.userId }}
                  </p>

                  <div
                    v-if="getUserProfileLinks(request.user).length > 0"
                    class="flex flex-wrap gap-2"
                  >
                    <a
                      v-for="link in getUserProfileLinks(request.user)"
                      :key="link.key"
                      :href="link.href"
                      target="_blank"
                      rel="noreferrer"
                      class="inline-flex items-center gap-0.5 rounded-full border border-black/10 px-2 py-0.5 text-xs font-medium text-sky-700 transition hover:border-black/20 hover:text-sky-800 dark:border-white/[0.12] dark:text-sky-300 dark:hover:border-white/[0.22] dark:hover:text-sky-200"
                    >
                      {{ link.label }}
                      <AppIcon
                        name="i-lucide-external-link"
                        class="size-2.5"
                      />
                    </a>
                  </div>
                </div>

                <div
                  v-if="request.status === 'pending'"
                  class="grid gap-2 shrink-0 sm:min-w-44"
                >
                  <AppButton
                    :color="isActionPending(`approve-join-request:${request.id}`) ? 'success' : 'neutral'"
                    variant="soft"
                    icon="i-lucide-thumbs-up"
                    label="Approve"
                    class="w-full flex-row-reverse justify-between"
                    :loading="isActionPending(`approve-join-request:${request.id}`)"
                    :disabled="pendingActionKey !== null"
                    :data-testid="`participant-team-approve-request-${request.id}`"
                    @click="emit('approveRequest', request.id)"
                  />

                  <AppButton
                    :color="isActionPending(`reject-join-request:${request.id}`) ? 'error' : 'neutral'"
                    variant="soft"
                    icon="i-lucide-thumbs-down"
                    label="Reject"
                    class="w-full flex-row-reverse justify-between"
                    :loading="isActionPending(`reject-join-request:${request.id}`)"
                    :disabled="pendingActionKey !== null"
                    :data-testid="`participant-team-reject-request-${request.id}`"
                    @click="emit('rejectRequest', request.id)"
                  />
                </div>
              </div>
            </article>
          </div>

          <AppAlert
            v-else
            color="neutral"
            variant="soft"
            title="No join requests yet"
            description="Join requests will appear here once another approved participant asks to join this team."
          />
        </div>
      </section>
    </div>
  </AppCard>
</template>
