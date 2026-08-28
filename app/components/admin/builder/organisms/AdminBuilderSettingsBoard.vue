<script setup lang="ts">
import { Switch as UiSwitch } from '~/components/ui/switch'
import type { TermsDocument, EventRecord } from '~/domains/events/records'
import type { EventFormState, EventFormTrack } from '~/domains/events/admin-event'
import type { EventImageVersions } from '~/domains/events/presentation'
import {
  formatParticipantsLimitInput,
  parseParticipantsLimitInput
} from '~/domains/events/admin-event'
import type { EventBuilderSettingsGroupDefinition } from '~/domains/events/builder'
import AdminBuilderSettingsGroupCard from '~/components/admin/builder/molecules/AdminBuilderSettingsGroupCard.vue'
import AdminBuilderFrictionGauge from '~/components/admin/builder/molecules/AdminBuilderFrictionGauge.vue'
import AdminBuilderWeightSlider from '~/components/admin/builder/molecules/AdminBuilderWeightSlider.vue'
import AdminMarkdownEditorField from '~/components/admin/AdminMarkdownEditorField.vue'
import AccountEventAdminTermsCard from '~/components/account/events/AccountEventAdminTermsCard.vue'
import EventConfigProgramIdentitySection from '~/components/admin/EventConfigProgramIdentitySection.vue'
import EventTalkProposalControl from '~/components/admin/EventTalkProposalControl.vue'
import AdminBuilderCreditsSection from '~/components/admin/builder/organisms/AdminBuilderCreditsSection.vue'
import type {
  AccountEventSettingsCreditOffer,
  AccountEventSimplifiedClaimingStatus
} from '#shared/domains/events/account-event-settings-page'

const form = defineModel<EventFormState>('form', { required: true })

const props = defineProps<{
  groups: readonly EventBuilderSettingsGroupDefinition[]
  mode: 'create' | 'edit'
  event: EventRecord | null
  requiredApplicationFieldCount: number
  visibleApplicationFieldCount: number
  backgroundImageUploadPending?: boolean
  backgroundImageUploadError?: string
  bannerImageUploadPending?: boolean
  bannerImageUploadError?: string
  imageVersion?: string | number | EventImageVersions | null
  currentApplicationTerms?: TermsDocument | null
  currentWinnerTerms?: TermsDocument | null
  savingTermsDocumentType?: TermsDocument['documentType'] | null
  initialSimplifiedClaimingStatus?: AccountEventSimplifiedClaimingStatus | null
  creditOffers?: AccountEventSettingsCreditOffer[]
  hasExistingTalkProposal?: boolean
}>()

const emit = defineEmits<{
  uploadBackgroundImage: [file: File]
  removeBackgroundImage: []
  uploadBannerImage: [file: File]
  removeBannerImage: []
  saveTerms: [documentType: TermsDocument['documentType'], content: string]
  updated: []
}>()

const applicationTermsDraft = ref('')
const winnerTermsDraft = ref('')

interface ApplicationFieldRow {
  label: string
  visibleKey: keyof EventFormState
  requireKey: keyof EventFormState
}

const applicationFieldRows: ApplicationFieldRow[] = [
  { label: 'X profile', visibleKey: 'applicationXProfileVisible', requireKey: 'requireXProfile' },
  { label: 'LinkedIn profile', visibleKey: 'applicationLinkedinProfileVisible', requireKey: 'requireLinkedinProfile' },
  { label: 'GitHub profile', visibleKey: 'applicationGithubProfileVisible', requireKey: 'requireGithubProfile' },
  { label: 'ChatGPT email', visibleKey: 'applicationChatgptEmailVisible', requireKey: 'requireChatgptEmail' },
  { label: 'OpenAI org ID', visibleKey: 'applicationOpenaiOrgIdVisible', requireKey: 'requireOpenaiOrgId' },
  { label: 'Luma email', visibleKey: 'applicationLumaEmailVisible', requireKey: 'requireLumaEmail' },
  { label: 'Why this event', visibleKey: 'applicationWhyThisEventVisible', requireKey: 'requireWhyThisEvent' },
  { label: 'Proof of execution', visibleKey: 'applicationProofOfExecutionVisible', requireKey: 'requireProofOfExecution' },
  { label: 'Team intent', visibleKey: 'applicationTeamIntentVisible', requireKey: 'requireTeamIntent' },
  { label: 'AI knowledge', visibleKey: 'applicationAiKnowledgeVisible', requireKey: 'requireAiKnowledge' }
]

function isFieldVisible(row: ApplicationFieldRow) {
  return Boolean(form.value[row.visibleKey])
}

function isFieldRequired(row: ApplicationFieldRow) {
  return Boolean(form.value[row.requireKey])
}

function setFieldVisible(row: ApplicationFieldRow, visible: boolean) {
  ;(form.value[row.visibleKey] as boolean) = visible

  if (!visible) {
    ;(form.value[row.requireKey] as boolean) = false
  }
}

function setFieldRequired(row: ApplicationFieldRow, required: boolean) {
  ;(form.value[row.requireKey] as boolean) = required
}

const participantsLimitInput = computed({
  get: () => formatParticipantsLimitInput(form.value.participantsLimit),
  set: (value: string) => {
    form.value.participantsLimit = parseParticipantsLimitInput(value)
  }
})

const blindReviewEnabled = computed(() => form.value.blindReviewCount > 0)

// The two judging modes are independent toggles; at least one stays on, and
// the weight slider only matters while both are active.
function toggleBlindReview() {
  if (blindReviewEnabled.value) {
    if (!form.value.pitchReviewEnabled) {
      return
    }

    form.value.blindReviewCount = 0
    form.value.blindScoreWeightPercent = 0
    form.value.pitchScoreWeightPercent = 100
    return
  }

  form.value.blindReviewCount = 1

  if (form.value.pitchReviewEnabled) {
    form.value.blindScoreWeightPercent = 70
    form.value.pitchScoreWeightPercent = 30
  } else {
    form.value.blindScoreWeightPercent = 100
    form.value.pitchScoreWeightPercent = 0
  }
}

function togglePitchReview() {
  if (form.value.pitchReviewEnabled) {
    if (!blindReviewEnabled.value) {
      return
    }

    form.value.pitchReviewEnabled = false
    form.value.blindScoreWeightPercent = 100
    form.value.pitchScoreWeightPercent = 0
    return
  }

  form.value.pitchReviewEnabled = true

  if (blindReviewEnabled.value) {
    form.value.blindScoreWeightPercent = 70
    form.value.pitchScoreWeightPercent = 30
  } else {
    form.value.blindScoreWeightPercent = 0
    form.value.pitchScoreWeightPercent = 100
  }
}

function addTrack() {
  const track: EventFormTrack = {
    id: crypto.randomUUID(),
    name: '',
    shortDescription: '',
    fullDescription: '',
    staffInstructions: '',
    resources: [],
    displayOrder: form.value.tracks.length
  }

  form.value.tracks.push(track)
}

function removeTrack(id: string) {
  form.value.tracks = form.value.tracks
    .filter(track => track.id !== id)
    .map((track, index) => ({ ...track, displayOrder: index }))
}

function addTrackResource(track: EventFormTrack) {
  track.resources.push({
    id: crypto.randomUUID(),
    title: '',
    url: '',
    description: '',
    displayOrder: track.resources.length
  })
}

function removeTrackResource(track: EventFormTrack, resourceId: string) {
  track.resources = track.resources
    .filter(resource => resource.id !== resourceId)
    .map((resource, index) => ({ ...resource, displayOrder: index }))
}

function groupById(id: string) {
  return props.groups.find(group => group.id === id)
}

const lumaWebhookStatusColor = computed(() => {
  switch (props.event?.lumaWebhookStatus) {
    case 'configured':
      return 'success' as const
    case 'failed':
      return 'error' as const
    default:
      return 'neutral' as const
  }
})
</script>

<template>
  <section class="space-y-3">
    <div>
      <h3 class="text-sm font-semibold text-highlighted">
        More settings
      </h3>
      <p class="text-xs text-muted">
        Everything else the event can use. None of it blocks creating the draft.
      </p>
    </div>

    <div class="space-y-2.5">
      <AdminBuilderSettingsGroupCard
        v-if="groupById('communication')"
        :group="groupById('communication')!"
        :complete="groupById('communication')!.isComplete(form, event)"
      >
        <div class="grid gap-3">
          <AppFormField label="Discord server URL">
            <AppInput
              v-model="form.discordServerUrl"
              placeholder="https://discord.gg/…"
              size="sm"
            />
          </AppFormField>
          <AppFormField label="Luma event URL">
            <AppInput
              v-model="form.lumaEventUrl"
              placeholder="https://lu.ma/…"
              size="sm"
            />
          </AppFormField>
          <AppFormField label="Slides URL">
            <AppInput
              v-model="form.slidesUrl"
              placeholder="https://…"
              size="sm"
            />
          </AppFormField>
        </div>
      </AdminBuilderSettingsGroupCard>

      <AdminBuilderSettingsGroupCard
        v-if="groupById('application-form')"
        :group="groupById('application-form')!"
        :complete="groupById('application-form')!.isComplete(form, event)"
      >
        <div class="space-y-4">
          <AdminBuilderFrictionGauge
            :required-count="requiredApplicationFieldCount"
            :visible-count="visibleApplicationFieldCount"
          />
          <div class="space-y-2">
            <div class="grid grid-cols-[minmax(0,1fr)_4rem_4.5rem] items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              <span>Field</span>
              <span class="text-center">Visible</span>
              <span class="text-center">Required</span>
            </div>
            <!-- Identity fields are always collected; the platform does not allow turning them off. -->
            <div
              v-for="lockedLabel in ['First name', 'Family name']"
              :key="lockedLabel"
              class="grid grid-cols-[minmax(0,1fr)_4rem_4.5rem] items-center gap-2 rounded-lg px-1 py-1 text-sm text-toned"
              title="Always collected. The platform requires it."
            >
              <span class="truncate">{{ lockedLabel }}</span>
              <span class="flex justify-center">
                <UiSwitch
                  :model-value="true"
                  disabled
                  :aria-label="`${lockedLabel} visible, always on`"
                />
              </span>
              <span class="flex justify-center">
                <UiSwitch
                  :model-value="true"
                  disabled
                  :aria-label="`${lockedLabel} required, always on`"
                />
              </span>
            </div>
            <div
              v-for="row in applicationFieldRows"
              :key="row.label"
              class="grid grid-cols-[minmax(0,1fr)_4rem_4.5rem] items-center gap-2 rounded-lg px-1 py-1 text-sm text-toned"
            >
              <span class="truncate">{{ row.label }}</span>
              <span class="flex justify-center">
                <UiSwitch
                  :model-value="isFieldVisible(row)"
                  :aria-label="`${row.label} visible`"
                  @update:model-value="value => setFieldVisible(row, value === true)"
                />
              </span>
              <span class="flex justify-center">
                <UiSwitch
                  :model-value="isFieldRequired(row)"
                  :disabled="!isFieldVisible(row)"
                  :aria-label="`${row.label} required`"
                  @update:model-value="value => setFieldRequired(row, value === true)"
                />
              </span>
            </div>
          </div>
        </div>
      </AdminBuilderSettingsGroupCard>

      <AdminBuilderSettingsGroupCard
        v-if="groupById('capacity')"
        :group="groupById('capacity')!"
        :complete="groupById('capacity')!.isComplete(form, event)"
      >
        <div class="grid gap-3 sm:grid-cols-2">
          <AppFormField
            label="Participant limit"
            description="Empty means unlimited."
          >
            <AppInput
              v-model="participantsLimitInput"
              type="number"
              size="sm"
              placeholder="0"
            />
          </AppFormField>
          <AppFormField
            label="Approvals"
            description="Skip manual review for incoming applications."
          >
            <div class="flex min-h-9 items-center">
              <AppCheckbox
                v-model="form.autoApproveApplications"
                label="Approve applications automatically while below the limit"
              />
            </div>
          </AppFormField>
        </div>
      </AdminBuilderSettingsGroupCard>

      <AdminBuilderSettingsGroupCard
        v-if="groupById('judging')"
        :group="groupById('judging')!"
        :complete="groupById('judging')!.isComplete(form, event)"
      >
        <div class="space-y-4">
          <!-- Modes combine: pick one or both. At least one stays on. -->
          <div class="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              role="checkbox"
              :aria-checked="blindReviewEnabled"
              data-testid="event-builder-judging-mode-blind"
              class="relative rounded-xl border p-3 text-left transition-colors"
              :class="blindReviewEnabled
                ? 'border-black/25 bg-white/95 dark:border-white/[0.28] dark:bg-[#181818]'
                : 'border-black/8 bg-white/88 text-toned hover:border-black/20 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]'"
              @click="toggleBlindReview"
            >
              <AppIcon
                v-if="blindReviewEnabled"
                name="i-lucide-circle-check-big"
                class="absolute right-3 top-3 size-4 text-emerald-500"
              />
              <span class="block pr-6 text-sm font-semibold text-highlighted">Blind review</span>
              <span class="block text-[11px] text-dimmed">
                Assigned judges score each submission independently, without seeing who built it.
              </span>
            </button>
            <button
              type="button"
              role="checkbox"
              :aria-checked="form.pitchReviewEnabled"
              data-testid="event-builder-judging-mode-pitch"
              class="relative rounded-xl border p-3 text-left transition-colors"
              :class="form.pitchReviewEnabled
                ? 'border-black/25 bg-white/95 dark:border-white/[0.28] dark:bg-[#181818]'
                : 'border-black/8 bg-white/88 text-toned hover:border-black/20 dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]'"
              @click="togglePitchReview"
            >
              <AppIcon
                v-if="form.pitchReviewEnabled"
                name="i-lucide-circle-check-big"
                class="absolute right-3 top-3 size-4 text-emerald-500"
              />
              <span class="block pr-6 text-sm font-semibold text-highlighted">Live pitch</span>
              <span class="block text-[11px] text-dimmed">
                Shortlisted teams present on stage and the judges score the pitch.
              </span>
            </button>
            <div
              class="relative rounded-xl border border-dashed border-black/8 p-3 opacity-70 dark:border-white/[0.1]"
              aria-disabled="true"
            >
              <AppBadge
                color="neutral"
                variant="soft"
                size="sm"
                class="absolute right-3 top-3"
              >
                Coming soon
              </AppBadge>
              <span class="block pr-6 text-sm font-semibold text-toned">Audience voting</span>
              <span class="block text-[11px] text-dimmed">
                The room votes for its favorites.
              </span>
            </div>
          </div>

          <AdminBuilderWeightSlider
            v-if="form.pitchReviewEnabled && blindReviewEnabled"
            v-model:blind="form.blindScoreWeightPercent"
            v-model:pitch="form.pitchScoreWeightPercent"
            class="animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none"
          />

          <div class="grid gap-3 sm:grid-cols-2">
            <AppFormField
              v-if="blindReviewEnabled"
              label="Blind reviewers per project"
              description="How many judges score each submission."
            >
              <AppSelect
                v-model.number="form.blindReviewCount"
                size="sm"
              >
                <option :value="1">
                  1 reviewer
                </option>
                <option :value="2">
                  2 reviewers
                </option>
              </AppSelect>
            </AppFormField>
            <AppFormField
              label="Finalists on the shortlist"
              description="How many projects reach the final round."
            >
              <AppInput
                v-model.number="form.shortlistFinalistCount"
                type="number"
                size="sm"
                min="1"
              />
            </AppFormField>
          </div>
        </div>
      </AdminBuilderSettingsGroupCard>

      <AdminBuilderSettingsGroupCard
        v-if="groupById('team-size')"
        :group="groupById('team-size')!"
        :complete="groupById('team-size')!.isComplete(form, event)"
      >
        <AppFormField
          label="Max team members"
          description="Solo participation is always possible."
        >
          <AppInput
            v-model.number="form.maxTeamMembers"
            type="number"
            size="sm"
            min="1"
            max="10"
          />
        </AppFormField>
      </AdminBuilderSettingsGroupCard>

      <AdminBuilderSettingsGroupCard
        v-if="groupById('tracks')"
        :group="groupById('tracks')!"
        :complete="groupById('tracks')!.isComplete(form, event)"
      >
        <div class="space-y-4">
          <div
            v-for="(track, index) in form.tracks"
            :key="track.id"
            class="space-y-3 rounded-xl border border-black/8 p-3 dark:border-white/[0.08]"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Track {{ index + 1 }}
              </p>
              <button
                type="button"
                :aria-label="`Remove track ${index + 1}`"
                class="inline-flex size-7 items-center justify-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-rose-500"
                @click="removeTrack(track.id)"
              >
                <AppIcon
                  name="i-lucide-trash-2"
                  class="size-3.5"
                />
              </button>
            </div>
            <div class="grid gap-3">
              <AppFormField label="Name">
                <AppInput
                  v-model="track.name"
                  size="sm"
                />
              </AppFormField>
              <AdminMarkdownEditorField
                v-model="track.shortDescription"
                :name="`event-builder-track-short-${track.id}`"
                label="Short description"
                :editor-id="`event-builder-track-short-${track.id}`"
                :data-testid="`event-builder-track-short-${track.id}`"
                height="180px"
                required
              />
            </div>
            <AdminMarkdownEditorField
              v-model="track.fullDescription"
              name="fullDescription"
              label="Participant guidelines"
              :editor-id="`event-builder-track-full-${track.id}`"
            />
            <AdminMarkdownEditorField
              v-model="track.staffInstructions"
              name="staffInstructions"
              label="Staff instructions"
              :editor-id="`event-builder-track-staff-${track.id}`"
            />
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <p class="text-xs font-medium text-toned">
                  Resources
                </p>
                <AppButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="addTrackResource(track)"
                >
                  Add resource
                </AppButton>
              </div>
              <div
                v-for="resource in track.resources"
                :key="resource.id"
                class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <AppInput
                  v-model="resource.title"
                  size="sm"
                  placeholder="Title"
                />
                <AppInput
                  v-model="resource.url"
                  size="sm"
                  placeholder="https://…"
                />
                <AppInput
                  v-model="resource.description"
                  size="sm"
                  placeholder="Description"
                />
                <button
                  type="button"
                  aria-label="Remove resource"
                  class="inline-flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-rose-500"
                  @click="removeTrackResource(track, resource.id)"
                >
                  <AppIcon
                    name="i-lucide-trash-2"
                    class="size-3.5"
                  />
                </button>
              </div>
            </div>
          </div>

          <AppButton
            color="neutral"
            variant="outline"
            size="sm"
            data-testid="event-builder-add-track"
            @click="addTrack"
          >
            Add track
            <template #trailing>
              <AppIcon
                name="i-lucide-plus"
                class="size-3.5"
              />
            </template>
          </AppButton>
        </div>
      </AdminBuilderSettingsGroupCard>

      <AdminBuilderSettingsGroupCard
        v-if="groupById('call-for-talks')"
        :group="groupById('call-for-talks')!"
        :complete="groupById('call-for-talks')!.isComplete(form, event)"
      >
        <EventTalkProposalControl
          v-model:enabled="form.talkProposalsEnabled"
          v-model:opens-at="form.talkProposalOpensAt"
          v-model:closes-at="form.talkProposalClosesAt"
          v-model:questions="form.talkProposalQuestions"
          :has-existing-proposal="props.hasExistingTalkProposal ?? false"
          question-editor-variant="builder"
        />
      </AdminBuilderSettingsGroupCard>

      <AdminBuilderSettingsGroupCard
        v-if="groupById('submission-requirements')"
        :group="groupById('submission-requirements')!"
        :complete="groupById('submission-requirements')!.isComplete(form, event)"
      >
        <div class="space-y-2">
          <AppCheckbox
            v-model="form.requireSubmissionSummary"
            label="Require a project summary"
          />
          <AppCheckbox
            v-model="form.requireSubmissionRepositoryUrl"
            label="Require a repository URL"
          />
          <AppCheckbox
            v-model="form.requireSubmissionDemoUrl"
            label="Require a demo URL"
          />
        </div>
      </AdminBuilderSettingsGroupCard>

      <AdminBuilderSettingsGroupCard
        v-if="groupById('luma-sync')"
        :group="groupById('luma-sync')!"
        :complete="groupById('luma-sync')!.isComplete(form, event)"
      >
        <div class="space-y-3">
          <AppBadge
            v-if="mode === 'edit' && event"
            :color="lumaWebhookStatusColor"
            variant="soft"
            size="sm"
          >
            Webhook: {{ event.lumaWebhookStatus ?? 'not configured' }}
          </AppBadge>
          <div class="grid gap-3 sm:grid-cols-2">
            <AppFormField label="Luma event API ID">
              <AppInput
                v-model="form.lumaEventApiId"
                size="sm"
                placeholder="evt-…"
              />
            </AppFormField>
            <AppFormField label="Luma API key">
              <AppInput
                v-model="form.lumaApiKey"
                type="password"
                size="sm"
              />
            </AppFormField>
          </div>
          <p class="text-[11px] text-dimmed">
            The key is stored per event and only used for guest sync. Saving verifies access and registers the guest webhook automatically.
          </p>
        </div>
      </AdminBuilderSettingsGroupCard>

      <AdminBuilderSettingsGroupCard
        v-if="groupById('credits')"
        :group="groupById('credits')!"
        :complete="groupById('credits')!.isComplete(form, event)"
      >
        <AdminBuilderCreditsSection
          v-model:form="form"
          :mode="mode"
          :event="event"
          :offers="props.creditOffers ?? []"
          :simplified-claiming-status="props.initialSimplifiedClaimingStatus ?? null"
          @updated="emit('updated')"
        />
      </AdminBuilderSettingsGroupCard>

      <AdminBuilderSettingsGroupCard
        v-if="groupById('images') && mode === 'edit'"
        :group="groupById('images')!"
        :complete="groupById('images')!.isComplete(form, event)"
      >
        <EventConfigProgramIdentitySection
          v-model:form="form"
          description="Location fields live in the basics section above. Manage imagery here."
          :can-upload-managed-images="true"
          :background-image-upload-pending="backgroundImageUploadPending"
          :background-image-upload-error="backgroundImageUploadError"
          :banner-image-upload-pending="bannerImageUploadPending"
          :banner-image-upload-error="bannerImageUploadError"
          :image-version="imageVersion"
          @upload-background-image="file => emit('uploadBackgroundImage', file)"
          @remove-background-image="emit('removeBackgroundImage')"
          @upload-banner-image="file => emit('uploadBannerImage', file)"
          @remove-banner-image="emit('removeBannerImage')"
        />
      </AdminBuilderSettingsGroupCard>

      <AdminBuilderSettingsGroupCard
        v-if="groupById('terms') && mode === 'edit'"
        :group="groupById('terms')!"
        :complete="groupById('terms')!.isComplete(form, event)"
      >
        <AccountEventAdminTermsCard
          v-model:application-terms-draft="applicationTermsDraft"
          v-model:winner-terms-draft="winnerTermsDraft"
          :current-application-terms="currentApplicationTerms ?? null"
          :current-winner-terms="currentWinnerTerms ?? null"
          :saving-terms-document-type="savingTermsDocumentType ?? null"
          :show-winner-terms="form.eventType === 'hackathon'"
          @save-terms="documentType => emit('saveTerms', documentType, documentType === 'application_terms' ? applicationTermsDraft : winnerTermsDraft)"
        />
      </AdminBuilderSettingsGroupCard>
    </div>
  </section>
</template>
