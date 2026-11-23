<script setup lang="ts">
// The level "Extras" of the event builder: every optional part of an event as a tile. A tile
// shows the state of its option. A click opens that option alone, and the arrow in its frame
// leads back to the tiles.
import type { StagedCredit } from '#shared/domains/credits/draft-credits'
import type { TermsDocument, EventRecord } from '~/domains/events/records'
import type { EventFormState, EventFormTrack } from '~/domains/events/admin-event'
import type {
  EventBuilderExtraContext,
  EventBuilderExtraDefinition,
  EventBuilderExtraId
} from '~/domains/events/builder'
import AdminBuilderChoiceCard from '~/components/admin/builder/molecules/AdminBuilderChoiceCard.vue'
import AdminBuilderExtraPanel from '~/components/admin/builder/molecules/AdminBuilderExtraPanel.vue'
import AdminBuilderExtraTile from '~/components/admin/builder/molecules/AdminBuilderExtraTile.vue'
import AdminBuilderWeightSlider from '~/components/admin/builder/molecules/AdminBuilderWeightSlider.vue'
import AdminMarkdownEditorField from '~/components/admin/AdminMarkdownEditorField.vue'
import AccountEventAdminTermsCard from '~/components/account/events/AccountEventAdminTermsCard.vue'
import EventConfigProgramIdentitySection from '~/components/admin/EventConfigProgramIdentitySection.vue'
import EventTalkProposalControl from '~/components/admin/EventTalkProposalControl.vue'
import AdminCustomQuestionEditor from '~/components/admin/organisms/AdminCustomQuestionEditor.vue'
import AdminEventCriteriaEditor from '~/components/admin/organisms/AdminEventCriteriaEditor.vue'
import AdminEventPrizesEditor from '~/components/admin/organisms/AdminEventPrizesEditor.vue'
import AdminEventVisibilityControl from '~/components/admin/organisms/AdminEventVisibilityControl.vue'
import type { EvaluationCriterion } from '~/domains/judging/criteria-config'
import type { PrizeDefinition } from '~/domains/outcomes/prizes'
import AdminBuilderChallengesEditor from '~/components/admin/builder/organisms/AdminBuilderChallengesEditor.vue'
import AdminBuilderLumaConnection from '~/components/admin/builder/organisms/AdminBuilderLumaConnection.vue'
import AdminBuilderCreditsSection from '~/components/admin/builder/organisms/AdminBuilderCreditsSection.vue'
import AdminBuilderCreditsInfoDialog from '~/components/admin/builder/molecules/AdminBuilderCreditsInfoDialog.vue'
import { moveListItemByIndex } from '~/utils/reorder-list'
import type {
  AccountEventLumaGuestList,
  AccountEventSettingsCreditOffer,
  AccountEventSimplifiedClaimingStatus
} from '#shared/domains/events/account-event-settings-page'

const stagedCredits = defineModel<StagedCredit[]>('stagedCredits', { default: () => [] })

const form = defineModel<EventFormState>('form', { required: true })

/** The extra the organizer has open. Null shows the tiles. */
const openId = defineModel<EventBuilderExtraId | null>('openId', { default: null })

const props = defineProps<{
  /** The extras that fit the event, in the order of their tiles. */
  extras: readonly EventBuilderExtraDefinition[]
  saving: boolean
  mode: 'create' | 'edit'
  event: EventRecord | null
  /** The sessions in the rooms of the event. The tile "Rooms and sessions" shows the number. */
  sessionCount?: number
  /** The saved judging criteria and prizes of a Hackathon. */
  criteria?: EvaluationCriterion[]
  prizes?: PrizeDefinition[]
  backgroundImageUploadPending?: boolean
  backgroundImageUploadError?: string
  bannerImageUploadPending?: boolean
  bannerImageUploadError?: string
  currentApplicationTerms?: TermsDocument | null
  currentWinnerTerms?: TermsDocument | null
  savingTermsDocumentType?: TermsDocument['documentType'] | null
  initialSimplifiedClaimingStatus?: AccountEventSimplifiedClaimingStatus | null
  lumaGuestList?: AccountEventLumaGuestList | null
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
  save: []
  /** True while an extra with its own save button holds a change that is not saved. */
  unsavedChange: [unsaved: boolean]
}>()

defineSlots<{
  /** The editor of "Rooms and sessions". The page owns it, because the page loads and saves it. */
  rooms(): unknown
}>()

// An extra that does not fit the event type anymore is not open.
const openExtra = computed(() => props.extras.find(extra => extra.id === openId.value) ?? null)

// An extra is mounted when the organizer opens it for the first time, and it stays mounted.
// What they typed or opened in it is still there when they come back from another extra.
const mountedIds = ref<EventBuilderExtraId[]>([])

watch(openId, (id) => {
  if (id && !mountedIds.value.includes(id)) {
    mountedIds.value.push(id)
  }
}, { immediate: true })

// A new event keeps its credits in the browser until it is created. A saved event has regular
// offers or simplified giveaways, never both, so the sum counts the ones it has.
const creditCount = computed(() => props.mode === 'create'
  ? stagedCredits.value.reduce((total, offer) => total + offer.values.length, 0)
  : (props.creditOffers ?? []).reduce((total, offer) => total + offer.totalCount, 0)
    + (props.initialSimplifiedClaimingStatus?.totalInventoryCount ?? 0))

const summaryContext = computed<EventBuilderExtraContext>(() => ({
  form: form.value,
  event: props.event,
  creditCount: creditCount.value,
  sessionCount: props.sessionCount ?? 0,
  criteriaCount: props.criteria?.length ?? 0,
  prizeCount: props.prizes?.length ?? 0
}))

// The criteria and the prizes are saved with their own buttons. The page warns before the
// organizer leaves the builder while one of them holds a change that is not saved.
const unsavedExtraIds = ref<EventBuilderExtraId[]>([])

function setExtraUnsaved(id: EventBuilderExtraId, unsaved: boolean) {
  unsavedExtraIds.value = unsavedExtraIds.value.filter(entry => entry !== id)

  if (unsaved) {
    unsavedExtraIds.value.push(id)
  }

  emit('unsavedChange', unsavedExtraIds.value.length > 0)
}

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

/** Moves a track one place up or down. Participants see the tracks in this order. */
function moveTrack(index: number, direction: -1 | 1) {
  form.value.tracks = moveListItemByIndex(form.value.tracks, index, index + direction)
    .map((track, displayOrder) => ({ ...track, displayOrder }))
}

/** Moves a resource of a track one place up or down. */
function moveTrackResource(track: EventFormTrack, index: number, direction: -1 | 1) {
  track.resources = moveListItemByIndex(track.resources, index, index + direction)
    .map((resource, displayOrder) => ({ ...resource, displayOrder }))
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
</script>

<template>
  <section data-testid="event-builder-extras">
    <ul
      v-show="!openExtra"
      class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
    >
      <li
        v-for="extra in extras"
        :key="extra.id"
      >
        <AdminBuilderExtraTile
          class="w-full"
          :icon="extra.icon"
          :title="extra.title"
          :summary="extra.summary(summaryContext)"
          :data-testid="`event-builder-extra-${extra.id}`"
          @click="openId = extra.id"
        />
      </li>
    </ul>

    <!-- One frame per extra. Each block below is the editor of the extra it names. -->
    <template
      v-for="extra in extras"
      :key="extra.id"
    >
      <AdminBuilderExtraPanel
        v-if="mountedIds.includes(extra.id)"
        v-show="openExtra?.id === extra.id"
        :extra="extra"
        @close="openId = null"
      >
        <template
          v-if="extra.id === 'credits'"
          #action
        >
          <AdminBuilderCreditsInfoDialog />
        </template>

        <div
          v-if="extra.id === 'tracks'"
          class="space-y-4"
        >
          <div
            v-for="(track, index) in form.tracks"
            :key="track.id"
            class="space-y-3 rounded-xl border border-black/8 p-3 dark:border-white/[0.08]"
          >
            <div class="flex items-center gap-1">
              <p class="mr-auto text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Track {{ index + 1 }}
              </p>
              <AppButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-arrow-up"
                :aria-label="`Move track ${index + 1} up`"
                :disabled="index === 0"
                class="w-7 rounded-lg px-0"
                @click="moveTrack(index, -1)"
              />
              <AppButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-arrow-down"
                :aria-label="`Move track ${index + 1} down`"
                :disabled="index === form.tracks.length - 1"
                class="w-7 rounded-lg px-0"
                @click="moveTrack(index, 1)"
              />
              <AppButton
                color="error"
                variant="ghost"
                size="xs"
                icon="i-lucide-trash-2"
                :aria-label="`Remove track ${index + 1}`"
                class="w-7 px-0 text-muted hover:text-error rounded-lg"
                @click="removeTrack(track.id)"
              />
            </div>
            <div class="grid gap-3">
              <AppFormField
                :name="`event-builder-track-name-${track.id}`"
                label="Name"
              >
                <AppInput
                  :id="`event-builder-track-name-${track.id}`"
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
                v-for="(resource, resourceIndex) in track.resources"
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
                <div class="flex items-center gap-1">
                  <AppButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-arrow-up"
                    :aria-label="`Move resource ${resourceIndex + 1} up`"
                    :disabled="resourceIndex === 0"
                    class="w-8 px-0"
                    @click="moveTrackResource(track, resourceIndex, -1)"
                  />
                  <AppButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-arrow-down"
                    :aria-label="`Move resource ${resourceIndex + 1} down`"
                    :disabled="resourceIndex === track.resources.length - 1"
                    class="w-8 px-0"
                    @click="moveTrackResource(track, resourceIndex, 1)"
                  />
                  <AppButton
                    color="error"
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-trash-2"
                    aria-label="Remove resource"
                    class="w-8 px-0 text-muted hover:text-error"
                    @click="removeTrackResource(track, resource.id)"
                  />
                </div>
              </div>
            </div>
          </div>

          <AppButton
            color="neutral"
            variant="outline"
            size="sm"
            label="Add track"
            trailing-icon="i-lucide-plus"
            data-testid="event-builder-add-track"
            @click="addTrack"
          />
        </div>

        <AdminBuilderChallengesEditor
          v-if="extra.id === 'challenges'"
          v-model="form.challenges"
        />

        <slot
          v-if="extra.id === 'rooms'"
          name="rooms"
        />

        <AdminBuilderCreditsSection
          v-if="extra.id === 'credits'"
          v-model:staged-credits="stagedCredits"
          v-model:form="form"
          :mode="mode"
          :event="event"
          :offers="props.creditOffers ?? []"
          :simplified-claiming-status="props.initialSimplifiedClaimingStatus ?? null"
          @updated="emit('updated')"
        />

        <div
          v-if="extra.id === 'check-in'"
          class="space-y-4"
        >
          <AppCheckbox
            v-model="form.checkInFlowEnabled"
            label="Show participants their next step on their event page"
          />
          <AdminCustomQuestionEditor
            v-if="form.checkInFlowEnabled"
            v-model="form.questionnaireQuestions"
            variant="builder"
          />
        </div>

        <AppCheckbox
          v-if="extra.id === 'photos'"
          v-model="form.participantPhotosEnabled"
          label="Participants can add photos to the gallery"
        />

        <EventTalkProposalControl
          v-if="extra.id === 'talks'"
          v-model:enabled="form.talkProposalsEnabled"
          v-model:opens-at="form.talkProposalOpensAt"
          v-model:closes-at="form.talkProposalClosesAt"
          v-model:questions="form.talkProposalQuestions"
          :has-existing-proposal="props.hasExistingTalkProposal ?? false"
          question-editor-variant="builder"
        />

        <div
          v-if="extra.id === 'judging'"
          class="space-y-4"
        >
          <!-- Modes combine: pick one or both. At least one stays on. -->
          <div class="grid gap-2 sm:grid-cols-2">
            <AdminBuilderChoiceCard
              role="checkbox"
              label="Blind review"
              description="Assigned judges score each submission independently, without seeing who built it."
              :checked="blindReviewEnabled"
              data-testid="event-builder-judging-mode-blind"
              @click="toggleBlindReview"
            />
            <AdminBuilderChoiceCard
              role="checkbox"
              label="Live pitch"
              description="Shortlisted teams present on stage and the judges score the pitch."
              :checked="form.pitchReviewEnabled"
              data-testid="event-builder-judging-mode-pitch"
              @click="togglePitchReview"
            />
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
            <AppFormField label="Finalists on the shortlist">
              <AppInput
                v-model.number="form.shortlistFinalistCount"
                type="number"
                size="sm"
                min="1"
              />
            </AppFormField>
          </div>
        </div>

        <AdminEventCriteriaEditor
          v-if="extra.id === 'criteria' && event"
          :event-id="event.id"
          :criteria="props.criteria ?? []"
          @saved="emit('updated')"
          @dirty-change="unsaved => setExtraUnsaved('criteria', unsaved)"
        />

        <div
          v-if="extra.id === 'submissions'"
          class="space-y-2"
        >
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

        <AdminEventPrizesEditor
          v-if="extra.id === 'prizes' && event"
          :event-id="event.id"
          :prizes="props.prizes ?? []"
          @saved="emit('updated')"
          @dirty-change="unsaved => setExtraUnsaved('prizes', unsaved)"
        />

        <div
          v-if="extra.id === 'links'"
          class="grid gap-3 sm:grid-cols-3"
        >
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

        <EventConfigProgramIdentitySection
          v-if="extra.id === 'images'"
          v-model:form="form"
          :show-location="false"
          :can-upload-managed-images="true"
          :background-image-upload-pending="backgroundImageUploadPending"
          :background-image-upload-error="backgroundImageUploadError"
          :banner-image-upload-pending="bannerImageUploadPending"
          :banner-image-upload-error="bannerImageUploadError"
          :images="event"
          @upload-background-image="file => emit('uploadBackgroundImage', file)"
          @remove-background-image="emit('removeBackgroundImage')"
          @upload-banner-image="file => emit('uploadBannerImage', file)"
          @remove-banner-image="emit('removeBannerImage')"
        />

        <AccountEventAdminTermsCard
          v-if="extra.id === 'terms'"
          :key="event?.id"
          :current-application-terms="currentApplicationTerms ?? null"
          :current-winner-terms="currentWinnerTerms ?? null"
          :saving-terms-document-type="savingTermsDocumentType ?? null"
          :show-winner-terms="form.eventType === 'hackathon'"
          @save-terms="(type, content) => emit('saveTerms', type, content)"
        />

        <AdminBuilderLumaConnection
          v-if="extra.id === 'luma'"
          v-model:form="form"
          :event="event"
          :saving="saving"
          :luma-guest-list="props.lumaGuestList ?? null"
          @save="emit('save')"
          @updated="emit('updated')"
        />

        <AdminEventVisibilityControl
          v-if="extra.id === 'visibility' && event"
          :event="event"
          @updated="emit('updated')"
        />
      </AdminBuilderExtraPanel>
    </template>
  </section>
</template>
