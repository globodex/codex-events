<script setup lang="ts">
import type {
  AccountEventEntryAccess,
  AccountEventEntryEvent,
  AccountEventEntryPage,
  AccountEventEntryParticipantCreditOffer,
  AccountEventEntryParticipation,
  AccountEventEntryRankSummary,
  AccountEventEntryTalkProposal,
  AccountEventEntryTalkProposalReview
} from '#shared/domains/events/account-event-entry-page'
import type {
  AccountEventPrizesPage,
  AccountEventPrize,
  AccountEventPublishedProject,
  AccountEventWinner
} from '#shared/domains/events/account-event-prizes-page'
import type { AccountEventCertificatesPage } from '#shared/domains/events/account-event-certificates-page'
import type { AccountEventFeedbackPage } from '#shared/domains/events/account-event-feedback-page'
import type { AccountEventGalleryPage } from '#shared/domains/events/account-event-gallery-page'
import type {
  AccountEventParticipantsPage
} from '#shared/domains/events/account-event-participants-page'
import type { AccountEventTeamsPage } from '#shared/domains/events/account-event-teams-page'
import type { AccountEventWorkspacePage } from '#shared/domains/events/account-event-workspace-page'
import type { AccountEventRostersPage } from '#shared/domains/events/account-event-rosters-page'
import type { AccountEventOperationsPage } from '#shared/domains/events/account-event-operations-page'
import type { AccountEventSubmissionsPage } from '#shared/domains/events/account-event-submissions-page'
import type {
  AccountEventJudgingPage,
  AccountJudgeAssignmentWorkspacePage
} from '#shared/domains/events/account-event-judging-page'
import type { AccountEventSettingsPage } from '#shared/domains/events/account-event-settings-page'
import type { ParticipantEventProgram } from '#shared/domains/events/program'
import type { AccountEventPageVisibility } from '~/domains/events/account-workspace-page'
import {
  buildVersionedEventImageUrl,
  formatAccountEventHeaderSummary,
  resolveEventDetailBackgroundImageUrl
} from '~/domains/events/presentation'
import type { EventParticipationRankSummary } from '~/domains/events/participation'
import { isApplicationEffectivelyCheckedIn } from '#shared/domains/applications/check-in'
import type { CheckInFlowProgress, CheckInFlowSettings } from '#shared/domains/applications/check-in-flow'
import { hasParticipantFinishedCheckInFlow } from '#shared/domains/applications/check-in-flow'
import { resolveEventCreditClaimAccess } from '#shared/domains/credits/claim-access'
import { buildEventCertificatePath } from '#shared/domains/events/certificates'
import type {
  ParticipantApiDataResponse,
  ParticipantApplicationRecord
} from '~/domains/applications/participant-application'

import { Switch as UiSwitch } from '~/components/ui/switch'
import {
  LazyAccountEventsAccountEventAdminOperationsPanel as LazyAccountEventAdminOperationsPanel,
  LazyAccountEventsAccountEventAdminSettingsPanel as LazyAccountEventAdminSettingsPanel,
  LazyAccountEventsAccountEventCertificatesPanel as LazyAccountEventCertificatesPanel,
  LazyAccountEventsAccountEventCreditsPanel as LazyAccountEventCreditsPanel,
  LazyAccountEventsAccountEventFeedbackPanel as LazyAccountEventFeedbackPanel,
  LazyAccountEventsAccountEventGalleryPanel as LazyAccountEventGalleryPanel,
  LazyAccountEventsAccountEventJudgePanel as LazyAccountEventJudgePanel,
  LazyAccountEventsAccountEventParticipantTeamPanel as LazyAccountEventParticipantTeamPanel,
  LazyAccountEventsAccountEventParticipantVisibilityPanel as LazyAccountEventParticipantVisibilityPanel,
  LazyAccountEventsAccountEventParticipantWorkspacePanel as LazyAccountEventParticipantWorkspacePanel,
  LazyAccountEventsAccountEventProgramAgenda as LazyAccountEventProgramAgenda,
  LazyAccountEventsAccountEventPublishedRosterPanel as LazyAccountEventPublishedRosterPanel,
  LazyAccountEventsAccountEventRoleRosterPanel as LazyAccountEventRoleRosterPanel,
  LazyAccountEventsAccountEventTalkProposalPanel as LazyAccountEventTalkProposalPanel,
  LazyAccountEventsAccountEventTalkProposalReviewPanel as LazyAccountEventTalkProposalReviewPanel,
  LazyAccountEventsOrganismsAccountEventTracksPanel as LazyAccountEventTracksPanel,
  LazyPublicEventsEventAgendaPanel as LazyEventAgendaPanel,
  LazyPublicEventsEventPrizeList as LazyEventPrizeList,
  LazyPublicEventsEventPublishedProjectsShowcase as LazyEventPublishedProjectsShowcase,
  LazyPublicEventsEventTimeline as LazyEventTimeline,
  LazyPublicEventsEventWinnersShowcase as LazyEventWinnersShowcase
} from '#components'
import AccountEventParticipationRankNotice from '~/components/account/events/AccountEventParticipationRankNotice.vue'
import AccountEventNextStepCard from '~/components/account/events/organisms/AccountEventNextStepCard.vue'
import EventOverviewPanel from '~/components/public/events/EventOverviewPanel.vue'
import EventStateBadge from '~/components/public/events/EventStateBadge.vue'
import {
  hasEventAdminAccess,
  hasEventJudgingAccess,
  hasEventParticipantVisibilityAccess
} from '~/domains/events/access'
import {
  canAccessAccountEventWorkspace,
  accountEventWorkspaceTabs,
  getAccountEventWorkspaceBackLink,
  getAccountEventTabLabel,
  resolveAccountEventScopedId,
  shouldPreserveAccountEventTabSelection,
  type AccountEventWorkspaceTab
} from '~/domains/events/account-workspace-tabs'
import { getAccountEventSeoContent } from '~/domains/events/account-workspace-seo'
import {
  getEventParticipationOutcomeNotice,
  getSelectedBuildTrackOverviewTrack
} from '~/domains/events/participation'
import {
  formatParticipantApplicationStatus,
  getParticipantApplicationSubmittedNoticeContent,
  getParticipantApplicationWithdrawalAvailability,
  getParticipantApplicationStatusColor,
  isParticipantApplicationSubmittedNotice,
  normalizeParticipantApiError,
  shouldShowParticipantOverviewStatusBanner,
  summarizeParticipantApplicationStatus
} from '~/domains/applications/participant-application'
import {
  hasEventEnteredSubmissionPhase
} from '~/domains/submissions/team-submission'
import { normalizeJudgeAssignmentIdQueryValue } from '~/domains/judging/query'
import { buildAccountEventTeamsTabHref, normalizeTeamSlugQueryValue } from '~/domains/teams/query'
import { normalizeTabQueryValue, resolveTabQueryValue } from '~/lib/query-values'
import { useApiClient } from '~/composables/useApiClient'
import {
  useAccountEventPageRequest,
  useAccountJudgeAssignmentPageRequest
} from '~/composables/useAccountEventPageRequest'
import {
  resolveInitialAccountEventPageFamily,
  useAccountEventPageState
} from '~/composables/useAccountEventPageState'
import {
  createParticipantListRead,
  useParticipantListSearch
} from '~/composables/useParticipantListSearch'

definePageMeta({
  middleware: ['require-platform-account']
})

interface VerifyLumaEmailResponse {
  application: ParticipantApplicationRecord
  lumaEmail: string | null
  verificationStatus: 'synced' | 'not_found' | 'not_synced'
}

type AccountWorkspaceEvent = AccountEventEntryEvent
type AccountEventAccessRecord = AccountEventEntryAccess

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? '').trim())
const { actor, refresh: refreshActor } = useAccountLifecycleActor()

if (!slug.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Event not found.'
  })
}

const apiFetch = useApiClient()
const toast = useToast()
const requestedTab = computed(() => normalizeTabQueryValue(route.query.tab))
const requestedWorkspaceTab = computed<AccountEventWorkspaceTab>(() => {
  const normalizedTab = requestedTab.value

  return normalizedTab && accountEventWorkspaceTabs.includes(normalizedTab as AccountEventWorkspaceTab)
    ? normalizedTab as AccountEventWorkspaceTab
    : 'overview'
})
const isDirectNonEntryNavigation = computed(() =>
  Boolean(requestedTab.value)
  && !['overview', 'credits', 'details', 'call-for-talks'].includes(requestedWorkspaceTab.value)
)
const entryPageRequest = useAccountEventPageRequest<AccountEventEntryPage>(slug, 'entry', {
  enabled: () => !isDirectNonEntryNavigation.value,
  query: computed(() => requestedTab.value === 'details'
    ? { includeAdminEventConfiguration: true }
    : {})
})
const initialPageFamily = resolveInitialAccountEventPageFamily({
  isDirectNonEntryNavigation: isDirectNonEntryNavigation.value,
  selectedTab: requestedWorkspaceTab.value
})
const pageState = useAccountEventPageState({
  initialPageFamily,
  slug,
  authorizationGeneration: entryPageRequest.authorizationGeneration
})
const includePrizesAdminEventConfiguration = shallowRef(requestedTab.value === 'prizes')
watch(requestedTab, (tab) => {
  if (tab === 'prizes') {
    includePrizesAdminEventConfiguration.value = true
  }
}, { immediate: true })
const prizesPageQuery = computed(() => ({
  ...pageState.queryForPage('prizes'),
  ...(includePrizesAdminEventConfiguration.value
    ? { includeAdminEventConfiguration: true }
    : {})
}))
const entryPage = computed(() => entryPageRequest.data.value?.page ?? null)
const pageShell = pageState.pageShell
const pageVisibility = shallowRef<AccountEventPageVisibility | null>(null)
const selectedPagePending = ref(false)
const selectedPageError = shallowRef<unknown | null>(null)
const event = computed<AccountWorkspaceEvent | null>(() =>
  entryPage.value?.event ?? pageShell.value?.event ?? null
)
const programLink = computed(() => {
  const itemId = event.value?.programItemId
  const item = itemId && event.value?.agendaItems.find(item => item.id === itemId)
  if (!item) {
    return undefined
  }

  return {
    itemId: item.id,
    title: item.title,
    href: `/account/events/${encodeURIComponent(slug.value)}?tab=program`
  }
})
const accessRecord = shallowRef<AccountEventAccessRecord | null>(null)
const participationRecord = shallowRef<AccountEventEntryParticipation | null>(null)
const participantCreditOffers = shallowRef<AccountEventEntryParticipantCreditOffer[]>([])
const adminCreditOffers = computed(() => entryPage.value?.adminCredits ?? [])
const hasRetainedTalkProposal = ref(false)
const talkProposal = shallowRef<AccountEventEntryTalkProposal | null>(null)
const talkProposalReviews = shallowRef<AccountEventEntryTalkProposalReview[]>([])
const participantRank = shallowRef<AccountEventEntryRankSummary | null>(null)
const isEntryPending = computed(() => entryPageRequest.pending.value || selectedPagePending.value)
const entryError = computed(() => entryPageRequest.error.value ?? selectedPageError.value)
const entryErrorMessage = computed(() => entryError.value
  ? normalizeParticipantApiError(entryError.value).message
  : '')
watch([entryPage, pageShell], ([page, shell]) => {
  if (!page) {
    accessRecord.value = shell?.access ?? null
    participationRecord.value = null
    participantCreditOffers.value = []
    hasRetainedTalkProposal.value = false
    talkProposal.value = null
    talkProposalReviews.value = []
    participantRank.value = null
    return
  }

  accessRecord.value = page.access
  participationRecord.value = page.participation
  participantCreditOffers.value = page.participantCredits
  hasRetainedTalkProposal.value = Boolean(page.talkProposal)
  talkProposal.value = page.talkProposal
  talkProposalReviews.value = page.talkProposalReviews
  participantRank.value = page.participantRank
}, { immediate: true })
const isWithdrawApplicationPending = ref(false)
const withdrawApplicationErrorMessage = ref('')
const lumaEmailForm = ref('')
const lumaEmailVerificationErrorMessage = ref('')
const isLumaEmailVerificationPending = ref(false)
const isCompetitionEvent = computed(() => event.value?.eventType === 'hackathon')
const workspaceEventId = computed(() => resolveAccountEventScopedId({
  accessRecordId: accessRecord.value?.id,
  eventId: event.value?.id ?? ''
}))
const canJudge = computed(() => {
  const currentEvent = event.value

  return pageVisibility.value?.canJudge
    ?? (currentEvent && actor.value.kind === 'platform_user'
      ? hasEventJudgingAccess(actor.value, currentEvent.id)
      : false)
})
const canAdmin = computed(() => {
  const currentEvent = event.value

  return entryPageRequest.data.value?.visibility.canManage
    ?? pageVisibility.value?.canManage
    ?? (currentEvent && actor.value.kind === 'platform_user'
      ? hasEventAdminAccess(actor.value, currentEvent.id)
      : false)
})
const canViewParticipantsAndTeams = computed(() => {
  const currentEvent = event.value

  return pageVisibility.value?.canViewParticipantsAndTeams
    ?? (currentEvent && actor.value.kind === 'platform_user'
      ? hasEventParticipantVisibilityAccess(actor.value, currentEvent.id)
      : false)
})
watch([entryPage, canAdmin, canJudge, canViewParticipantsAndTeams], ([page, canManage, canReview, canView]) => {
  if (!page || !event.value) {
    return
  }

  if (!canAccessAccountEventWorkspace({
    hasAccessRecord: Boolean(page.access),
    canJudge: canReview,
    canManage,
    canViewParticipantsAndTeams: canView
  })) {
    void navigateTo(`/events/${slug.value}`, {
      redirectCode: 302,
      replace: true
    })
    return
  }
}, { immediate: true })

const workspaceBackLink = computed(() => getAccountEventWorkspaceBackLink({
  canManage: canAdmin.value,
  canViewParticipantsAndTeams: canViewParticipantsAndTeams.value
}))
const applicationStatus = computed(() =>
  entryPage.value?.applicationStatus ?? participationRecord.value?.application?.status ?? accessRecord.value?.applicationStatus ?? null
)
const currentEventRole = computed(() => {
  if (actor.value.kind !== 'platform_user' || !event.value) {
    return null
  }

  return actor.value.eventRoles.find(role => role.eventId === event.value?.id) ?? null
})
const currentStaffTrackId = computed(() =>
  currentEventRole.value?.isStaff ? currentEventRole.value.staffTrackId : null
)
const hasStaffCreditAccess = computed(() => currentEventRole.value?.isStaff === true)
const accountTrackViewerMode = computed<'participant' | 'all-staff' | 'track-staff'>(() => {
  if (canAdmin.value) {
    return 'all-staff'
  }

  if (!currentEventRole.value?.isStaff) {
    return 'participant'
  }

  return currentStaffTrackId.value ? 'track-staff' : 'all-staff'
})
const accountLumaEmail = computed(() =>
  actor.value.kind === 'platform_user'
    ? actor.value.platformUser.lumaEmail ?? ''
    : ''
)
watch(accountLumaEmail, (nextEmail) => {
  if (!isLumaEmailVerificationPending.value) {
    lumaEmailForm.value = nextEmail
  }
}, {
  immediate: true
})
const canManageParticipantCertificateGeneration = computed(() => {
  const application = participationRecord.value?.application

  return actor.value.kind === 'platform_user'
    && event.value?.state === 'completed'
    && application?.status === 'approved'
    && application.isCheckedIn
    && !application.certificateRevokedAt
})
const isCertificateGenerationDisabled = computed(() => Boolean(participationRecord.value?.application?.certificateHiddenAt))
const selectedTrackId = computed(() => participationRecord.value?.application?.selectedTrackId ?? null)
const accountEventTracks = computed(() => event.value?.tracks ?? [])
const selectedParticipantTrack = computed(() => {
  const normalizedSelectedTrackId = selectedTrackId.value?.trim() ?? ''

  if (!normalizedSelectedTrackId) {
    return null
  }

  return accountEventTracks.value.find(track => track.id === normalizedSelectedTrackId) ?? null
})
const canSelectParticipantTrack = computed(() =>
  accountTrackViewerMode.value === 'participant'
  && (applicationStatus.value === 'submitted' || applicationStatus.value === 'approved')
  && event.value?.state !== 'completed'
  && accountEventTracks.value.length > 0
)
const showTrackSelectionOverviewPrompt = computed(() =>
  canSelectParticipantTrack.value && !selectedParticipantTrack.value
)
const selectedBuildTrackOverviewTrack = computed(() => {
  const currentEvent = event.value

  return currentEvent
    ? getSelectedBuildTrackOverviewTrack({
        eventType: currentEvent.eventType,
        applicationStatus: applicationStatus.value,
        canSelectTrack: canSelectParticipantTrack.value,
        selectedTrackId: selectedTrackId.value,
        tracks: accountEventTracks.value
      })
    : null
})
const showSelectedBuildTrackOverviewNotice = computed(() =>
  Boolean(selectedBuildTrackOverviewTrack.value)
)
const participantCertificatePath = computed(() => {
  if (
    actor.value.kind !== 'platform_user'
    || !canManageParticipantCertificateGeneration.value
    || isCertificateGenerationDisabled.value
  ) {
    return null
  }

  return buildEventCertificatePath(slug.value, actor.value.platformUser.id)
})
const isCertificateVisibilityPending = ref(false)
const pendingSelectedTrackId = ref<string | null>(null)

async function setCertificateGenerationDisabled(disabled: boolean) {
  const application = participationRecord.value?.application

  if (!application || isCertificateVisibilityPending.value) {
    return
  }

  isCertificateVisibilityPending.value = true

  try {
    const response = await apiFetch<ParticipantApiDataResponse<ParticipantApplicationRecord>>(
      `/api/events/${workspaceEventId.value}/applications/me/actions/set-certificate-visibility`,
      {
        method: 'POST',
        body: { hidden: disabled }
      }
    )

    updateParticipationRecordApplication(response.data)
    await refreshAccountEvent()
    toast.add({
      title: response.data.certificateHiddenAt
        ? 'Certificate generation disabled'
        : 'Certificate generation enabled',
      color: 'success'
    })
  } catch (error) {
    toast.add({
      title: 'Certificate generation could not be changed',
      description: normalizeParticipantApiError(error).message,
      color: 'error'
    })
  } finally {
    isCertificateVisibilityPending.value = false
  }
}
const tabAccess = computed(() => entryPage.value?.tabVisibility ?? pageShell.value?.tabVisibility ?? {
  availableTabs: ['overview'] as AccountEventWorkspaceTab[],
  showPrizeConfiguration: false,
  showAgendaConfigurationInDetails: false,
  hasPublishedPrizes: false,
  hasPublishedStaff: false,
  hasCreditInventory: false,
  hasEligibleTalkProposalApplicant: false,
  hasGallery: false
})
const availableTabs = computed<AccountEventWorkspaceTab[]>(() => tabAccess.value.availableTabs)
function buildWorkspaceSectionLocation(nextSection: AccountEventWorkspaceTab) {
  const nextQuery = {
    ...route.query
  }

  if (nextSection !== 'teams') {
    delete nextQuery.team
  }

  if (nextSection !== 'judging') {
    delete nextQuery.assignment
  }

  if (nextSection === 'overview') {
    delete nextQuery.tab
  } else {
    nextQuery.tab = nextSection
  }

  return {
    path: route.path,
    query: nextQuery,
    hash: route.hash
  }
}

const visibleTabs = computed(() =>
  availableTabs.value.map(tab => ({
    id: tab,
    label: getAccountEventTabLabel(tab, {
      eventState: event.value?.state
    }),
    to: buildWorkspaceSectionLocation(tab)
  }))
)
const isRequestedTabPending = computed(() =>
  shouldPreserveAccountEventTabSelection({
    tab: requestedWorkspaceTab.value,
    hasEntryPage: Boolean(entryPage.value),
    hasPageShell: Boolean(pageShell.value)
  })
  || (isDirectNonEntryNavigation.value && !entryPage.value && !pageShell.value)
)
const activeSection = computed<AccountEventWorkspaceTab>(() => {
  if (isRequestedTabPending.value) {
    return requestedWorkspaceTab.value
  }

  return resolveTabQueryValue(route.query.tab, availableTabs.value, 'overview')
})
const prizesPageRequest = useAccountEventPageRequest<AccountEventPrizesPage>(slug, 'prizes', {
  enabled: () => activeSection.value === 'prizes',
  query: prizesPageQuery
})
const prizesPage = computed(() => prizesPageRequest.data.value?.page ?? null)
const prizes = computed<AccountEventPrize[]>(() => prizesPage.value?.prizes ?? [])
const prizesPageIsLoading = computed(() => prizesPageRequest.pending.value)
const prizesPageErrorMessage = computed(() => prizesPageRequest.error.value
  ? normalizeParticipantApiError(prizesPageRequest.error.value).message
  : '')
const settingsPageRequest = useAccountEventPageRequest<AccountEventSettingsPage>(slug, 'settings', {
  enabled: () => activeSection.value === 'settings' && (isDirectNonEntryNavigation.value || canAdmin.value),
  query: pageState.queryForPage('settings')
})
const settingsPage = computed(() => settingsPageRequest.data.value?.page ?? null)
const settingsPageIsLoading = computed(() => settingsPageRequest.pending.value)
const settingsPageErrorMessage = computed(() => settingsPageRequest.error.value
  ? normalizeParticipantApiError(settingsPageRequest.error.value).message
  : '')
const selectedTeamSlug = computed(() => normalizeTeamSlugQueryValue(route.query.team))
const selectedJudgeAssignmentId = computed(() => normalizeJudgeAssignmentIdQueryValue(route.query.assignment))
const workspacePageRequest = useAccountEventPageRequest<AccountEventWorkspacePage>(slug, 'workspace', {
  enabled: () => activeSection.value === 'workspace',
  query: pageState.queryForPage('workspace')
})
const programPageRequest = useAccountEventPageRequest<ParticipantEventProgram>(slug, 'program', {
  enabled: () => activeSection.value === 'program',
  query: pageState.queryForPage('program')
})
const programPage = computed(() => programPageRequest.data.value?.page)
const galleryPageRequest = useAccountEventPageRequest<AccountEventGalleryPage>(slug, 'gallery', {
  enabled: () => activeSection.value === 'gallery',
  query: pageState.queryForPage('gallery')
})
const feedbackPageRequest = useAccountEventPageRequest<AccountEventFeedbackPage>(slug, 'feedback', {
  enabled: () => activeSection.value === 'feedback',
  query: pageState.queryForPage('feedback')
})
const shouldLoadParticipantsPage = computed(() =>
  activeSection.value === 'participants'
  && (
    isDirectNonEntryNavigation.value
    || (
      entryPageRequest.status.value === 'success'
      && (canAdmin.value || canViewParticipantsAndTeams.value)
    )
  )
)
// What the participant list request asks the server for. The participant search replaces it.
const participantListRead = shallowRef(createParticipantListRead())
const participantsPageRequest = useAccountEventPageRequest<AccountEventParticipantsPage>(slug, 'participants', {
  enabled: shouldLoadParticipantsPage,
  query: computed(() => ({
    ...pageState.queryForPage('participants'),
    participantSearch: participantListRead.value.searchText
  })),
  // A watched value is part of the request key. See `ParticipantListRead` for why it is needed.
  watch: [() => participantListRead.value.askedAt]
})
const certificatesPageRequest = useAccountEventPageRequest<AccountEventCertificatesPage>(slug, 'certificates', {
  enabled: () => activeSection.value === 'certificates',
  query: pageState.queryForPage('certificates')
})
const teamsPageRequest = useAccountEventPageRequest<AccountEventTeamsPage>(slug, 'teams', {
  enabled: () => activeSection.value === 'teams',
  query: computed(() => ({
    ...pageState.queryForPage('teams'),
    selectedTeamSlug: selectedTeamSlug.value
  }))
})
const operationsPageRequest = useAccountEventPageRequest<AccountEventOperationsPage>(slug, 'operations', {
  enabled: () => activeSection.value === 'operations' && (isDirectNonEntryNavigation.value || canAdmin.value),
  query: pageState.queryForPage('operations')
})
const submissionsPageRequest = useAccountEventPageRequest<AccountEventSubmissionsPage>(slug, 'submissions', {
  enabled: () => activeSection.value === 'submissions' && (isDirectNonEntryNavigation.value || canAdmin.value),
  query: pageState.queryForPage('submissions')
})
const judgingPageRequest = useAccountEventPageRequest<AccountEventJudgingPage>(slug, 'judging', {
  enabled: () => activeSection.value === 'judging' && !selectedJudgeAssignmentId.value,
  query: pageState.queryForPage('judging')
})
const shouldLoadAssignmentPage = computed(() =>
  activeSection.value === 'judging' && Boolean(selectedJudgeAssignmentId.value)
)
const assignmentPageRequest = useAccountJudgeAssignmentPageRequest<AccountJudgeAssignmentWorkspacePage | null>(
  slug,
  computed(() => selectedJudgeAssignmentId.value ?? ''),
  {
    default: () => null,
    enabled: shouldLoadAssignmentPage
  }
)
const workspacePage = computed(() => workspacePageRequest.data.value?.page ?? null)
const galleryPage = computed(() => galleryPageRequest.data.value?.page ?? null)
const feedbackPage = computed(() => feedbackPageRequest.data.value?.page ?? null)
const participantsPage = computed(() => participantsPageRequest.data.value?.page ?? null)
const certificatesPage = computed(() => certificatesPageRequest.data.value?.page ?? null)
const teamsPage = computed(() => teamsPageRequest.data.value?.page ?? null)
const operationsPage = computed(() => operationsPageRequest.data.value?.page ?? null)
const submissionsPage = computed(() => submissionsPageRequest.data.value?.page ?? null)
const judgingPage = computed(() => judgingPageRequest.data.value?.page ?? null)
const assignmentPage = computed(() => assignmentPageRequest.data.value ?? null)
const workspacePageIsLoading = computed(() => workspacePageRequest.pending.value)
const galleryPageIsLoading = computed(() => galleryPageRequest.pending.value)
const feedbackPageIsLoading = computed(() => feedbackPageRequest.pending.value)
// The participant list shows its loading state only while it has nothing to show. A search or a
// refresh keeps the loaded rows on screen until the new answer arrives.
const participantsPageIsLoading = computed(() =>
  participantsPageRequest.pending.value && !participantsPage.value
)
const {
  isSearching: isSearchingParticipants,
  searchText: participantSearchText
} = useParticipantListSearch({
  page: participantsPage,
  isReading: participantsPageRequest.pending,
  serverRead: participantListRead
})
const certificatesPageIsLoading = computed(() => certificatesPageRequest.pending.value)
const teamsPageIsLoading = computed(() => teamsPageRequest.pending.value)
const operationsPageIsLoading = computed(() => operationsPageRequest.pending.value)
const submissionsPageIsLoading = computed(() => submissionsPageRequest.pending.value)
const judgingPageIsLoading = computed(() => judgingPageRequest.pending.value)
const assignmentPageIsLoading = computed(() => assignmentPageRequest.pending.value)
const workspacePageErrorMessage = computed(() => workspacePageRequest.error.value
  ? normalizeParticipantApiError(workspacePageRequest.error.value).message
  : '')
const galleryPageErrorMessage = computed(() => galleryPageRequest.error.value
  ? normalizeParticipantApiError(galleryPageRequest.error.value).message
  : '')
const feedbackPageErrorMessage = computed(() => feedbackPageRequest.error.value
  ? normalizeParticipantApiError(feedbackPageRequest.error.value).message
  : '')
const participantsPageErrorMessage = computed(() => participantsPageRequest.error.value
  ? normalizeParticipantApiError(participantsPageRequest.error.value).message
  : '')
const certificatesPageErrorMessage = computed(() => certificatesPageRequest.error.value
  ? normalizeParticipantApiError(certificatesPageRequest.error.value).message
  : '')
const teamsPageErrorMessage = computed(() => teamsPageRequest.error.value
  ? normalizeParticipantApiError(teamsPageRequest.error.value).message
  : '')
const operationsPageErrorMessage = computed(() => {
  return operationsPageRequest.error.value
    ? normalizeParticipantApiError(operationsPageRequest.error.value).message
    : ''
})
const submissionsPageErrorMessage = computed(() => submissionsPageRequest.error.value
  ? normalizeParticipantApiError(submissionsPageRequest.error.value).message
  : '')
const judgingPageErrorMessage = computed(() => judgingPageRequest.error.value
  ? normalizeParticipantApiError(judgingPageRequest.error.value).message
  : '')
const assignmentPageErrorMessage = computed(() => assignmentPageRequest.error.value
  ? normalizeParticipantApiError(assignmentPageRequest.error.value).message
  : '')

const rostersPageRequest = useAccountEventPageRequest<AccountEventRostersPage>(slug, 'rosters', {
  enabled: () => activeSection.value === 'judges' || activeSection.value === 'staff',
  query: pageState.queryForPage('rosters')
})
const rostersPage = computed(() => rostersPageRequest.data.value?.page ?? null)
const rostersPageIsLoading = computed(() => rostersPageRequest.pending.value)
const rostersPageErrorMessage = computed(() => rostersPageRequest.error.value
  ? normalizeParticipantApiError(rostersPageRequest.error.value).message
  : '')
const selectedPageRequestState = computed(() => {
  const request = (() => {
    switch (requestedWorkspaceTab.value) {
      case 'prizes': return prizesPageRequest
      case 'workspace': return workspacePageRequest
      case 'program': return programPageRequest
      case 'gallery': return galleryPageRequest
      case 'feedback': return feedbackPageRequest
      case 'judges':
      case 'staff': return rostersPageRequest
      case 'participants': return participantsPageRequest
      case 'certificates': return certificatesPageRequest
      case 'teams': return teamsPageRequest
      case 'submissions': return submissionsPageRequest
      case 'judging': return judgingPageRequest
      case 'operations': return operationsPageRequest
      case 'settings': return settingsPageRequest
      default: return null
    }
  })()

  return request
    ? {
        data: request.data.value,
        error: request.error.value,
        pending: request.pending.value,
        visibility: request.data.value?.visibility
      }
    : {
        data: null,
        error: null,
        pending: false,
        visibility: null
      }
})
watchEffect(() => {
  const requestState = selectedPageRequestState.value

  pageState.applySelectedPageState({
    entryPagePresent: Boolean(entryPage.value),
    shell: requestState.data?.shell
  })
  pageVisibility.value = entryPageRequest.data.value?.visibility
    ?? requestState.visibility
    ?? null
  selectedPagePending.value = !entryPage.value && requestState.pending
  selectedPageError.value = !entryPage.value ? requestState.error : null
})
const winners = computed<AccountEventWinner[]>(() => prizesPage.value?.winners ?? [])
const publishedProjects = computed<AccountEventPublishedProject[]>(() => prizesPage.value?.publishedProjects ?? [])
const participationRank = computed<EventParticipationRankSummary | null>(() => participantRank.value)
async function refreshAccountEvent() {
  if (activeSection.value === 'prizes') {
    await prizesPageRequest.refresh()
    return
  }

  await entryPageRequest.refresh()
}

async function refreshSettingsPage() {
  await settingsPageRequest.refresh()
}
const accountTabListRef = ref<HTMLElement | null>(null)
const activeSectionSeo = computed(() => getAccountEventSeoContent(activeSection.value, event.value?.name ?? ''))

function scrollActiveTabIntoView() {
  if (!import.meta.client) {
    return
  }

  void nextTick(() => {
    const activeTabElement = accountTabListRef.value?.querySelector<HTMLElement>(
      `#account-tab-${activeSection.value}`
    )

    activeTabElement?.scrollIntoView({
      block: 'nearest',
      inline: 'center'
    })
  })
}

watchEffect(() => {
  const normalizedTab = normalizeTabQueryValue(route.query.tab)
  const resolvedTab = resolveTabQueryValue(route.query.tab, availableTabs.value, 'overview')

  if (isRequestedTabPending.value) {
    return
  }

  if (!normalizedTab && resolvedTab === 'overview') {
    return
  }

  if (normalizedTab === resolvedTab) {
    return
  }

  void navigateTo(buildWorkspaceSectionLocation(resolvedTab), { replace: true })
})

watch(activeSection, () => {
  scrollActiveTabIntoView()
}, {
  flush: 'post'
})

onMounted(() => {
  scrollActiveTabIntoView()

  if (!applicationSubmittedNoticeVisible.value || !isParticipantApplicationSubmittedNotice(route.query.notice)) {
    return
  }

  const nextQuery = {
    ...route.query
  }

  delete nextQuery.notice

  void navigateTo({
    path: route.path,
    query: nextQuery,
    hash: route.hash
  }, { replace: true })
})

const teamTabTargetSlug = computed(() =>
  participationRecord.value?.activeTeam?.slug
  ?? accessRecord.value?.team?.slug
  ?? selectedTeamSlug.value
)
const workspaceTabHref = computed(() => `/account/events/${slug.value}?tab=workspace`)
const teamsTabHref = computed(() => buildAccountEventTeamsTabHref(slug.value, teamTabTargetSlug.value))
const detailsTabHref = computed(() => `/account/events/${slug.value}?tab=details`)
// Where a participant reads the agenda: the Agenda tab when the event has sessions, otherwise
// the agenda on the Details tab.
const agendaHref = computed(() => availableTabs.value.includes('program')
  ? `/account/events/${slug.value}?tab=program`
  : detailsTabHref.value)
// What a checked-in participant can open, in the order the next-step card lists it.
// Add one entry here for every new activity.
const participantActivities = computed(() => {
  const activities = [{ label: 'Agenda', to: agendaHref.value }]

  if (availableTabs.value.includes('credits')) {
    activities.push({ label: 'Credits', to: `/account/events/${slug.value}?tab=credits` })
  }

  return activities
})
const applicationSubmittedNoticeVisible = ref(isParticipantApplicationSubmittedNotice(route.query.notice))
const applicationStatusLabel = computed(() =>
  applicationStatus.value ? formatParticipantApplicationStatus(applicationStatus.value) : ''
)
const applicationStatusColor = computed(() => {
  if (!applicationStatus.value) {
    return 'neutral'
  }

  return getParticipantApplicationStatusColor(applicationStatus.value)
})
const applicationStatusSummary = computed(() =>
  applicationStatus.value
    ? summarizeParticipantApplicationStatus(applicationStatus.value, event.value?.state ?? 'draft', event.value?.eventType ?? 'meetup')
    : ''
)
const applicationSubmittedNoticeContent = computed(() =>
  getParticipantApplicationSubmittedNoticeContent({
    applicationStatus: applicationStatus.value,
    eventType: event.value?.eventType ?? 'meetup',
    autoApproveApplications: event.value?.autoApproveApplications ?? false
  })
)
const participantOutcomeNotice = computed(() =>
  participationRecord.value
    ? getEventParticipationOutcomeNotice(participationRecord.value)
    : null
)
const participantRankTeamName = computed(() =>
  participationRecord.value?.activeTeam?.name
  ?? participationRecord.value?.latestTeam?.name
  ?? null
)
const showHeaderApplicationStatusSummary = computed(() =>
  Boolean(applicationStatusSummary.value) && applicationStatus.value !== 'approved'
)
const showOverviewApplicationStatusBanner = computed(() =>
  shouldShowParticipantOverviewStatusBanner(applicationStatus.value)
)
const participantApplication = computed(() => participationRecord.value?.application ?? null)
// The check-in flow of this event and how far the participant is in it, for the next-step card.
const checkInFlowSettings = computed<CheckInFlowSettings>(() => ({
  checkInFlowEnabled: entryPage.value?.checkInFlowEnabled ?? false,
  questionnaireQuestions: entryPage.value?.questionnaireQuestions ?? []
}))
const checkInFlowProgress = computed<CheckInFlowProgress>(() => ({
  isCheckedIn: participantApplication.value?.isCheckedIn ?? false,
  questionnaireCompletedAt: entryPage.value?.questionnaireCompletedAt ?? null
}))
// The next-step card is for a confirmed participant of an event that uses the check-in flow.
// A completed event has no next step.
const showNextStepCard = computed(() =>
  checkInFlowSettings.value.checkInFlowEnabled
  && applicationStatus.value === 'approved'
  && event.value?.state !== 'completed'
)
// What the credit claim rule says about this person. It decides what the Credits tab offers.
const creditClaimAccess = computed(() => resolveEventCreditClaimAccess({
  isEventStaff: hasStaffCreditAccess.value,
  isApprovedParticipant: applicationStatus.value === 'approved',
  checkInFlowEnabled: checkInFlowSettings.value.checkInFlowEnabled,
  hasFinishedCheckInFlow: hasParticipantFinishedCheckInFlow(checkInFlowProgress.value, checkInFlowSettings.value)
}))
// Where the Credits tab sends a participant who has to finish the check-in flow first: the
// overview, while it shows the next-step card.
const creditsNextStepHref = computed(() => showNextStepCard.value ? `/account/events/${slug.value}` : null)
const lumaSyncStatus = computed(() => participantApplication.value?.lumaSyncStatus ?? null)
const showLumaSyncNotice = computed(() =>
  participantApplication.value?.status === 'approved'
  && ['not_synced', 'approve_failed', 'approve_synced'].includes(lumaSyncStatus.value ?? '')
)
const isLumaSyncSuccessful = computed(() => lumaSyncStatus.value === 'approve_synced')
const lumaSyncStatusLabel = computed(() => isLumaSyncSuccessful.value ? 'Luma synced' : 'Luma not synced')
const lumaSyncNoticeTitle = computed(() =>
  isLumaSyncSuccessful.value
    ? 'Your Luma registration is synced'
    : 'We could not match your Luma registration'
)
const lumaSyncNoticeDescription = computed(() =>
  isLumaSyncSuccessful.value
    ? 'Your Luma email is registered for this event.'
    : 'Check that this is the same email you used on Luma for this event. If it matches a guest on the event list, your event access will show as synced.'
)
const showOverviewStatusNotices = computed(() =>
  applicationSubmittedNoticeVisible.value
  || showOverviewApplicationStatusBanner.value
  || showSelectedBuildTrackOverviewNotice.value
  || Boolean(participantOutcomeNotice.value)
  || showLumaSyncNotice.value
)
const showApprovedOverviewActions = computed(() =>
  applicationStatus.value === 'approved' && isCompetitionEvent.value && event.value !== null && !hasEventEnteredSubmissionPhase(event.value)
)
const applicationStatusNoticeTitle = computed(() => {
  switch (applicationStatus.value) {
    case 'submitted':
      return 'Approval pending'
    case 'approved':
      return 'Approved for this event'
    case 'rejected':
      return 'Not approved'
    case 'withdrawn':
      return 'Participation withdrawn'
    default:
      return 'Application status'
  }
})
const applicationStatusNoticeColor = computed(() => {
  if (!applicationStatus.value) {
    return 'neutral'
  }

  if (applicationStatus.value === 'submitted') {
    return 'warning'
  }

  if (applicationStatus.value === 'rejected') {
    return 'error'
  }

  return 'neutral'
})
const withdrawApplicationAvailability = computed(() =>
  getParticipantApplicationWithdrawalAvailability({
    applicationStatus: applicationStatus.value,
    hasActiveTeamMembership: Boolean(participationRecord.value?.activeTeam)
  })
)
const withdrawalDescription = 'If you withdraw, you will no longer be eligible to participate or attend in person through this application.'

const approvedOverviewTeamActionTitle = computed(() =>
  participationRecord.value?.activeTeam ? 'Continue in your workspace' : 'Open your workspace'
)
const approvedOverviewTeamActionDescription = computed(() => {
  const activeTeam = participationRecord.value?.activeTeam

  if (activeTeam) {
    return `You're already on ${activeTeam.name}. Use Workspace to manage your team state and submission in one place.`
  }

  return 'Everyone participates through a team. Workspace is where you confirm solo participation or create a team, while Teams is where you browse the wider directory.'
})
const approvedOverviewDetailsActionDescription = 'Check the schedule, location, and full address before the event starts.'
const showTeamAndSubmissionCards = computed(() =>
  isCompetitionEvent.value && event.value !== null && hasEventEnteredSubmissionPhase(event.value)
)
const canViewRestrictedEventDetails = computed(() =>
  applicationStatus.value === 'approved'
  || canJudge.value
  || canViewParticipantsAndTeams.value
)

const detailBackgroundImageUrl = computed(() => {
  const currentEvent = event.value

  return currentEvent
    ? buildVersionedEventImageUrl(
        resolveEventDetailBackgroundImageUrl(currentEvent),
        currentEvent.displayBackgroundImageRevision,
        'background'
      )
    : undefined
})
const detailBackgroundImageStyle = computed(() => detailBackgroundImageUrl.value
  ? { backgroundImage: `url(${JSON.stringify(detailBackgroundImageUrl.value)})` }
  : undefined)
const detailSummary = computed(() => event.value ? formatAccountEventHeaderSummary(event.value) : '')
function updateAccessRecordApplicationStatus(nextStatus: ParticipantApplicationRecord['status']) {
  if (accessRecord.value) {
    accessRecord.value = {
      ...accessRecord.value,
      applicationStatus: nextStatus
    }
  }
}

function updateParticipationRecordApplication(nextApplication: ParticipantApplicationRecord) {
  if (participationRecord.value) {
    participationRecord.value = {
      ...participationRecord.value,
      application: {
        id: nextApplication.id,
        userId: nextApplication.userId,
        status: nextApplication.status,
        lumaSyncStatus: nextApplication.lumaSyncStatus,
        submittedAt: nextApplication.submittedAt,
        withdrawnAt: nextApplication.withdrawnAt,
        reviewedAt: nextApplication.reviewedAt,
        checkedInAt: nextApplication.checkedInAt,
        isCheckedIn: isApplicationEffectivelyCheckedIn(nextApplication),
        certificateHiddenAt: nextApplication.certificateHiddenAt,
        certificateRevokedAt: nextApplication.certificateRevokedAt,
        selectedTrackId: nextApplication.selectedTrackId,
        updatedAt: nextApplication.updatedAt
      }
    }
  }
}

async function verifyLumaEmail() {
  if (isLumaEmailVerificationPending.value) {
    return
  }

  const lumaEmail = lumaEmailForm.value.trim()

  if (!lumaEmail) {
    lumaEmailVerificationErrorMessage.value = 'Enter the email you used for this event on Luma.'
    return
  }

  isLumaEmailVerificationPending.value = true
  lumaEmailVerificationErrorMessage.value = ''

  try {
    const currentEvent = event.value
    if (!currentEvent) return

    const response = await apiFetch<ParticipantApiDataResponse<VerifyLumaEmailResponse>>(
      `/api/events/${currentEvent.id}/applications/me/actions/verify-luma-email`,
      {
        method: 'POST',
        body: {
          lumaEmail
        }
      }
    )

    updateParticipationRecordApplication(response.data.application)

    if (response.data.verificationStatus !== 'not_found' && response.data.lumaEmail) {
      lumaEmailForm.value = response.data.lumaEmail
      await refreshActor()
    }
    await refreshAccountEvent()

    if (response.data.verificationStatus === 'synced') {
      toast.add({
        title: 'Luma email verified',
        description: 'Your Luma registration is synced for this event.',
        color: 'success'
      })
      return
    }

    if (response.data.verificationStatus === 'not_found') {
      lumaEmailVerificationErrorMessage.value = 'We still could not find this email on the Luma event guest list.'
      return
    }

    lumaEmailVerificationErrorMessage.value = 'We found your Luma email, but the event access sync did not finish. Try again in a moment.'
  } catch (error) {
    lumaEmailVerificationErrorMessage.value = normalizeParticipantApiError(error).message
  } finally {
    isLumaEmailVerificationPending.value = false
  }
}

async function selectParticipantTrack(trackId: string) {
  if (!canSelectParticipantTrack.value || pendingSelectedTrackId.value || selectedTrackId.value === trackId) {
    return
  }

  pendingSelectedTrackId.value = trackId

  try {
    const response = await apiFetch<ParticipantApiDataResponse<ParticipantApplicationRecord>>(
      `/api/events/${workspaceEventId.value}/applications/me/actions/select-track`,
      {
        method: 'POST',
        body: {
          trackId
        }
      }
    )

    updateParticipationRecordApplication(response.data)
    await refreshAccountEvent()
    toast.add({
      title: 'Track selected',
      description: 'Your event track was updated.',
      color: 'success'
    })
  } catch (error) {
    toast.add({
      title: 'Track could not be selected',
      description: normalizeParticipantApiError(error).message,
      color: 'error'
    })
  } finally {
    pendingSelectedTrackId.value = null
  }
}

async function withdrawOwnApplication() {
  if (!import.meta.client || !withdrawApplicationAvailability.value.isAllowed || isWithdrawApplicationPending.value) {
    if (!withdrawApplicationAvailability.value.isAllowed) {
      withdrawApplicationErrorMessage.value = withdrawApplicationAvailability.value.reason ?? ''
    }

    return
  }

  const confirmed = window.confirm(
    `Withdraw from this event?\n\n${withdrawalDescription}`
  )

  if (!confirmed) {
    return
  }

  isWithdrawApplicationPending.value = true
  withdrawApplicationErrorMessage.value = ''

  try {
    const currentEvent = event.value
    if (!currentEvent) return

    const response = await apiFetch<ParticipantApiDataResponse<ParticipantApplicationRecord>>(
      `/api/events/${currentEvent.id}/applications/me/actions/withdraw`,
      {
        method: 'POST'
      }
    )

    updateAccessRecordApplicationStatus(response.data.status)
    updateParticipationRecordApplication(response.data)
    await refreshAccountEvent()
    applicationSubmittedNoticeVisible.value = false
    toast.add({
      title: 'Participation withdrawn',
      description: 'You are no longer eligible to participate in this event.',
      color: 'success'
    })
  } catch (error) {
    withdrawApplicationErrorMessage.value = normalizeParticipantApiError(error).message
  } finally {
    isWithdrawApplicationPending.value = false
  }
}

useSeoMeta({
  title: () => activeSectionSeo.value.title,
  description: () => activeSectionSeo.value.description
})
</script>

<template>
  <div
    v-if="event"
    class="relative isolate pb-16"
  >
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

    <section class="relative z-10 border-b border-black/8 bg-white/42 backdrop-blur-lg dark:border-white/[0.08] dark:bg-black/48">
      <AppContainer class="max-w-none pb-0 pt-2 sm:pt-3">
        <NuxtLink
          :to="workspaceBackLink.to"
          class="inline-flex items-center gap-2 text-[13px] font-medium text-neutral-600 transition-colors hover:text-highlighted dark:text-[#A3A3A3] dark:hover:text-white"
        >
          <AppIcon
            name="i-lucide-arrow-left"
            class="size-4"
          />
          {{ workspaceBackLink.label }}
        </NuxtLink>

        <div class="mt-3 border-b border-black/8 pb-0 dark:border-white/[0.08]">
          <div class="space-y-2 pb-4">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0 flex flex-wrap items-center gap-3">
                  <h1 class="text-[28px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
                    {{ event.name }}
                  </h1>
                  <EventStateBadge
                    :state="event.state"
                    :registration-opens-at="event.registrationOpensAt"
                    :registration-closes-at="event.registrationClosesAt"
                    class="shrink-0"
                  />
                  <AppBadge
                    v-if="applicationStatus"
                    :color="applicationStatusColor"
                    variant="soft"
                    class="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
                  >
                    {{ applicationStatusLabel }}
                  </AppBadge>
                </div>
              </div>

              <p class="text-[15px] text-neutral-700 dark:text-[#A3A3A3]">
                {{ detailSummary }}
              </p>
            </div>

            <p
              v-if="showHeaderApplicationStatusSummary"
              class="text-[14px] text-neutral-600 dark:text-[#A3A3A3]"
            >
              {{ applicationStatusSummary }}
            </p>
          </div>

          <nav
            ref="accountTabListRef"
            aria-label="Account event sections"
            role="tablist"
            class="account-event-tab-list flex items-center gap-5 overflow-x-auto"
          >
            <AppSectionTab
              v-for="tab in visibleTabs"
              :id="`account-tab-${tab.id}`"
              :key="tab.id"
              :to="tab.to"
              :selected="activeSection === tab.id"
              :aria-controls="`account-tab-panel-${tab.id}`"
            >
              {{ tab.label }}
            </AppSectionTab>
          </nav>
        </div>
      </AppContainer>
    </section>

    <AppContainer class="relative z-10 max-w-none space-y-7 pt-6">
      <section
        v-if="activeSection === 'overview'"
        id="account-tab-panel-overview"
        role="tabpanel"
        aria-labelledby="account-tab-overview"
        class="space-y-7"
      >
        <AccountEventNextStepCard
          v-if="showNextStepCard"
          :event-id="event.id"
          :settings="checkInFlowSettings"
          :progress="checkInFlowProgress"
          :agenda-href="agendaHref"
          :activities="participantActivities"
          :refresh-page="refreshAccountEvent"
        />

        <div
          v-if="showOverviewStatusNotices"
          class="space-y-4"
        >
          <AppAlert
            v-if="applicationSubmittedNoticeVisible"
            data-testid="account-event-application-submitted-notice"
            color="success"
            variant="soft"
            :title="applicationSubmittedNoticeContent.title"
            :description="applicationSubmittedNoticeContent.description"
          />

          <AppAlert
            v-if="showOverviewApplicationStatusBanner"
            :color="applicationStatus === 'approved' ? 'success' : applicationStatusNoticeColor"
            variant="soft"
            :title="applicationStatusNoticeTitle"
            :description="applicationStatusSummary"
          />

          <section
            v-if="showSelectedBuildTrackOverviewNotice"
            data-testid="account-event-selected-track-notice"
            class="rounded-xl !border !border-sky-500/25 !bg-sky-500/[0.12] px-4 py-4 text-sky-950 !shadow-[0_18px_44px_-34px_rgba(2,132,199,0.7)] !backdrop-blur-xl dark:!border-sky-300/30 dark:!bg-sky-300/[0.10] dark:text-sky-100"
          >
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div class="flex min-w-0 gap-4">
                <div
                  class="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-600 text-white shadow-[0_12px_28px_-18px_rgba(2,132,199,0.9)] dark:bg-sky-400 dark:text-sky-950"
                  aria-hidden="true"
                >
                  <AppIcon
                    name="i-lucide-map"
                    class="size-5"
                  />
                </div>

                <div class="min-w-0 space-y-2">
                  <div class="flex flex-wrap items-center gap-3">
                    <h2 class="text-base font-semibold text-current">
                      Your selected track
                    </h2>
                    <AppBadge
                      color="info"
                      variant="outline"
                      class="rounded-full bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] dark:bg-black/20"
                    >
                      Track selected
                    </AppBadge>
                  </div>

                  <p class="text-2xl font-semibold tracking-normal text-current">
                    {{ selectedBuildTrackOverviewTrack?.name }}
                  </p>
                  <p class="max-w-[56rem] text-sm leading-6 text-current/85">
                    This is the track you'll follow for this Build event. Open Details to review track resources or choose another track.
                  </p>
                </div>
              </div>

              <AppButton
                :to="detailsTabHref"
                color="neutral"
                variant="solid"
                trailing-icon="i-lucide-arrow-up-right"
                class="w-fit shrink-0 rounded-lg bg-white px-4 py-2 text-sky-950 hover:bg-white/90 dark:bg-white dark:text-sky-950 dark:hover:bg-sky-50"
              >
                Change track
              </AppButton>
            </div>
          </section>

          <section
            v-if="showLumaSyncNotice"
            data-testid="account-event-luma-sync-notice"
            class="rounded-xl !border px-4 py-4 !shadow-none !backdrop-blur-xl"
            :class="isLumaSyncSuccessful
              ? '!border-success/20 !bg-success/10 text-success'
              : '!border-warning/25 !bg-warning/10 text-warning'"
          >
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div
                class="grid size-9 shrink-0 place-items-center rounded-lg text-white"
                :class="isLumaSyncSuccessful ? 'bg-success' : 'bg-warning'"
                aria-hidden="true"
              >
                <AppIcon
                  :name="isLumaSyncSuccessful ? 'i-lucide-check-square' : 'i-lucide-triangle-alert'"
                  class="size-5"
                />
              </div>

              <div class="min-w-0 flex-1 space-y-4">
                <div class="space-y-2">
                  <div class="flex flex-wrap items-center gap-3">
                    <h2 class="text-base font-semibold text-current">
                      {{ lumaSyncNoticeTitle }}
                    </h2>
                    <AppBadge
                      :color="isLumaSyncSuccessful ? 'success' : 'warning'"
                      variant="outline"
                      class="rounded-full bg-white/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] dark:bg-black/20"
                    >
                      {{ lumaSyncStatusLabel }}
                    </AppBadge>
                  </div>

                  <p class="text-sm leading-6 text-current/90">
                    {{ lumaSyncNoticeDescription }}
                  </p>
                </div>

                <form
                  v-if="!isLumaSyncSuccessful"
                  class="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_auto]"
                  @submit.prevent="verifyLumaEmail"
                >
                  <AppFormField
                    name="account-event-luma-email"
                    label="Luma email"
                  >
                    <AppInput
                      id="account-event-luma-email"
                      v-model="lumaEmailForm"
                      type="email"
                      placeholder="you@example.com"
                      :disabled="isLumaEmailVerificationPending"
                      class="border-warning/25 bg-white/80 text-highlighted focus:border-warning/45 dark:border-warning/30 dark:bg-black/20"
                    />
                  </AppFormField>

                  <div class="flex items-end">
                    <AppButton
                      type="submit"
                      color="neutral"
                      variant="solid"
                      icon="i-lucide-circle-check"
                      :loading="isLumaEmailVerificationPending"
                      class="w-full rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-[#ECECEC] lg:w-auto"
                    >
                      Verify Luma email
                    </AppButton>
                  </div>
                </form>

                <p
                  v-if="lumaEmailVerificationErrorMessage"
                  class="text-sm font-medium text-current"
                >
                  {{ lumaEmailVerificationErrorMessage }}
                </p>
              </div>
            </div>
          </section>

          <AppAlert
            v-if="participantOutcomeNotice"
            :color="participantOutcomeNotice.color"
            variant="soft"
            :title="participantOutcomeNotice.title"
            :description="participantOutcomeNotice.description"
          />
        </div>

        <AccountEventParticipationRankNotice
          :event-state="event.state"
          :team-name="participantRankTeamName"
          :rank-summary="participationRank"
        />

        <section
          v-if="canManageParticipantCertificateGeneration"
          data-testid="account-event-certificate-panel"
          class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5"
        >
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="space-y-1">
              <h2 class="text-lg font-semibold text-highlighted dark:text-white">
                Your participation certificate
              </h2>
              <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
                {{ isCertificateGenerationDisabled
                  ? 'Certificate generation is disabled. Nobody can view this certificate until you enable generation again.'
                  : 'You checked in at this event. View, share, or download your certificate.' }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <div class="flex items-start gap-3 rounded-xl border border-black/8 bg-black/[0.02] px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <UiSwitch
                  id="certificate-generation-toggle"
                  :model-value="isCertificateGenerationDisabled"
                  :disabled="isCertificateVisibilityPending"
                  data-testid="certificate-generation-toggle"
                  class="data-[state=checked]:bg-red-500 dark:data-[state=checked]:bg-red-500"
                  @update:model-value="setCertificateGenerationDisabled(Boolean($event))"
                />
                <div class="space-y-1">
                  <label
                    for="certificate-generation-toggle"
                    class="block text-sm font-medium text-highlighted dark:text-white"
                  >
                    Disable certificate generation
                  </label>
                  <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                    {{ isCertificateGenerationDisabled ? 'Certificate generation disabled' : 'Certificate generation enabled' }}
                  </p>
                </div>
              </div>

              <AppButton
                v-if="participantCertificatePath"
                :to="participantCertificatePath"
                color="neutral"
                variant="solid"
                trailing-icon="i-lucide-arrow-up-right"
                class="rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
              >
                View certificate
              </AppButton>
            </div>
          </div>
        </section>

        <EventOverviewPanel :description="event.description" />

        <AppButton
          v-if="programLink"
          :to="programLink.href"
          :label="programLink.title"
          trailing-icon="i-lucide-arrow-right"
        />

        <section
          v-if="showTrackSelectionOverviewPrompt"
          class="rounded-xl !border !border-sky-500/20 !bg-sky-500/[0.08] px-5 py-5 !shadow-[0_12px_32px_-28px_rgba(2,132,199,0.55)] !backdrop-blur-xl dark:!border-sky-300/25 dark:!bg-sky-300/[0.08]"
          data-testid="account-event-track-selection-prompt"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div class="space-y-1">
              <h2 class="text-lg font-semibold text-highlighted dark:text-white">
                Choose your track
              </h2>
              <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
                Open Details and choose the track you want to participate in before reviewing track resources.
              </p>
            </div>

            <AppButton
              :to="detailsTabHref"
              color="neutral"
              variant="solid"
              trailing-icon="i-lucide-arrow-up-right"
              class="w-fit rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
            >
              Open Details
            </AppButton>
          </div>
        </section>

        <template v-if="applicationStatus === 'approved'">
          <section
            v-if="showApprovedOverviewActions"
            class="grid gap-4 lg:grid-cols-2"
          >
            <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5">
              <div class="flex h-full flex-col gap-4">
                <div class="space-y-1 border-b border-black/8 pb-3 dark:border-white/[0.08]">
                  <h2 class="text-lg font-semibold text-highlighted dark:text-white">
                    {{ approvedOverviewTeamActionTitle }}
                  </h2>
                  <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
                    {{ approvedOverviewTeamActionDescription }}
                  </p>
                </div>

                <div>
                  <AppButton
                    :to="workspaceTabHref"
                    color="neutral"
                    variant="solid"
                    trailing-icon="i-lucide-arrow-up-right"
                    class="rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
                  >
                    Open Workspace
                  </AppButton>
                </div>
              </div>
            </div>

            <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5">
              <div class="flex h-full flex-col gap-4">
                <div class="space-y-1 border-b border-black/8 pb-3 dark:border-white/[0.08]">
                  <h2 class="text-lg font-semibold text-highlighted dark:text-white">
                    Review the event details
                  </h2>
                  <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
                    {{ approvedOverviewDetailsActionDescription }}
                  </p>
                </div>

                <div>
                  <AppButton
                    :to="detailsTabHref"
                    color="neutral"
                    variant="solid"
                    trailing-icon="i-lucide-arrow-up-right"
                    class="rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
                  >
                    Open Details
                  </AppButton>
                </div>
              </div>
            </div>
          </section>

          <section
            v-if="showTeamAndSubmissionCards"
            class="grid gap-4 lg:grid-cols-2"
          >
            <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5">
              <h2 class="text-xl font-semibold text-highlighted dark:text-white">
                Workspace
              </h2>

              <template v-if="participationRecord?.activeTeam">
                <p class="mt-2 text-sm text-neutral-600 dark:text-[#A3A3A3]">
                  Current team: <span class="font-semibold text-highlighted dark:text-white">{{ participationRecord.activeTeam.name }}</span>
                </p>
                <p class="mt-2 text-sm text-neutral-600 dark:text-[#A3A3A3]">
                  Role: {{ participationRecord.activeTeam.membershipRole }} • {{ participationRecord.activeTeam.activeMemberCount }} active members
                </p>

                <AppButton
                  :to="workspaceTabHref"
                  color="neutral"
                  variant="solid"
                  trailing-icon="i-lucide-arrow-up-right"
                  class="mt-4 rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
                >
                  Go to Workspace
                </AppButton>
              </template>

              <template v-else>
                <p class="mt-2 text-sm text-neutral-600 dark:text-[#A3A3A3]">
                  You are approved for this event, but you do not have an active team yet.
                </p>

                <AppButton
                  :to="workspaceTabHref"
                  color="neutral"
                  variant="solid"
                  trailing-icon="i-lucide-arrow-up-right"
                  class="mt-4 rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
                >
                  Go to Workspace
                </AppButton>
              </template>
            </div>

            <div class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5">
              <h2 class="text-xl font-semibold text-highlighted dark:text-white">
                Teams
              </h2>

              <p class="mt-3 text-sm text-neutral-600 dark:text-[#A3A3A3]">
                Browse every active team in the event, including solo and multi-person teams.
              </p>
              <p class="mt-2 text-sm text-neutral-600 dark:text-[#A3A3A3]">
                Join actions appear there only when a team is open to new members and team formation is still open.
              </p>

              <AppButton
                :to="teamsTabHref"
                color="neutral"
                variant="solid"
                trailing-icon="i-lucide-arrow-up-right"
                class="mt-4 rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
              >
                Open Teams
              </AppButton>
            </div>
          </section>
        </template>

        <AppAlert
          v-if="withdrawApplicationErrorMessage"
          color="error"
          variant="soft"
          title="Unable to withdraw participation"
          :description="withdrawApplicationErrorMessage"
        />

        <section
          v-if="applicationStatus === 'submitted' || applicationStatus === 'approved'"
          class="rounded-xl !border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 px-5 py-5"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div class="space-y-2">
              <p class="text-sm font-semibold text-highlighted dark:text-white">
                Withdraw from this event
              </p>
              <p class="text-sm text-neutral-600 dark:text-[#A3A3A3]">
                {{ withdrawalDescription }}
              </p>
              <p
                v-if="!withdrawApplicationAvailability.isAllowed && withdrawApplicationAvailability.reason"
                class="text-sm text-neutral-600 dark:text-[#A3A3A3]"
              >
                {{ withdrawApplicationAvailability.reason }}
              </p>
            </div>

            <AppButton
              color="error"
              variant="soft"
              :loading="isWithdrawApplicationPending"
              :disabled="!withdrawApplicationAvailability.isAllowed || isWithdrawApplicationPending"
              @click="withdrawOwnApplication"
            >
              Withdraw participation
            </AppButton>
          </div>
        </section>
      </section>

      <section
        v-else-if="activeSection === 'credits'"
        id="account-tab-panel-credits"
        role="tabpanel"
        aria-labelledby="account-tab-credits"
        class="space-y-8"
      >
        <LazyAccountEventCreditsPanel
          :event-id="event.id"
          :can-manage="canAdmin"
          :claim-access="creditClaimAccess"
          :next-step-href="creditsNextStepHref"
          :participant-credits="participantCreditOffers"
          :admin-credits="adminCreditOffers"
          @updated="refreshAccountEvent"
        />
      </section>

      <section
        v-else-if="activeSection === 'call-for-talks'"
        id="account-tab-panel-call-for-talks"
        role="tabpanel"
        aria-labelledby="account-tab-call-for-talks"
        class="space-y-8"
      >
        <LazyAccountEventTalkProposalPanel
          v-if="applicationStatus === 'submitted' || applicationStatus === 'approved' || hasRetainedTalkProposal"
          :event-id="event.id"
          :application-status="applicationStatus"
          :opens-at="event.talkProposalOpensAt"
          :closes-at="event.talkProposalClosesAt"
          :questions="event.talkProposalQuestions"
          :question-set-revision="event.talkProposalQuestionsRevision"
          :proposal="talkProposal"
          @has-proposal-change="hasRetainedTalkProposal = $event"
          @updated="refreshAccountEvent"
        />

        <LazyAccountEventTalkProposalReviewPanel
          v-if="canViewParticipantsAndTeams"
          :event-id="event.id"
          :event-state="event.state"
          :can-decide="canAdmin"
          :entries="talkProposalReviews"
          :questions="event.talkProposalQuestions"
          @updated="refreshAccountEvent"
        />
      </section>

      <section
        v-else-if="activeSection === 'workspace'"
        id="account-tab-panel-workspace"
        role="tabpanel"
        aria-labelledby="account-tab-workspace"
        class="space-y-8"
      >
        <LazyAccountEventParticipantWorkspacePanel
          :event="event"
          :page="workspacePage"
          :is-loading="workspacePageIsLoading"
          :load-error-message="workspacePageErrorMessage"
          :selected-track-id="selectedTrackId"
        />
      </section>

      <section
        v-else-if="activeSection === 'prizes'"
        id="account-tab-panel-prizes"
        role="tabpanel"
        aria-labelledby="account-tab-prizes"
        class="space-y-8"
      >
        <template v-if="event.state === 'completed'">
          <LazyEventWinnersShowcase :winners="winners" />

          <LazyEventPublishedProjectsShowcase
            v-if="publishedProjects.length > 0"
            :projects="publishedProjects"
          />
        </template>

        <LazyEventPrizeList
          v-else
          :prizes="prizes"
        />

        <LazyAccountEventAdminSettingsPanel
          v-if="tabAccess.showPrizeConfiguration"
          :event-id="workspaceEventId"
          :event-data="prizesPage?.adminSettingsEvent ?? null"
          :prizes-data="prizesPage?.prizes ?? []"
          :can-manage="canAdmin"
          :is-loading="prizesPageIsLoading"
          :load-error-message="prizesPageErrorMessage"
          :show-program-settings="false"
          :show-terms-management="false"
          :show-criteria-configuration="false"
          :show-prize-configuration="true"
          @updated="refreshAccountEvent"
        />
      </section>

      <section
        v-else-if="activeSection === 'details'"
        id="account-tab-panel-details"
        role="tabpanel"
        aria-labelledby="account-tab-details"
        class="space-y-7"
      >
        <LazyEventTimeline
          :event="event"
          :discord-server-url="event.discordServerUrl ?? null"
          :slides-url="event.slidesUrl ?? null"
          :show-address="canViewRestrictedEventDetails"
        />

        <LazyAccountEventTracksPanel
          :event-type="event.eventType"
          :tracks="accountEventTracks"
          :selected-track-id="selectedTrackId"
          :can-select-track="canSelectParticipantTrack"
          :pending-track-id="pendingSelectedTrackId"
          :viewer-mode="accountTrackViewerMode"
          :staff-track-id="currentStaffTrackId"
          @select-track="selectParticipantTrack"
        />

        <LazyEventAgendaPanel
          :agenda-items="event.agendaItems"
          :program="programLink"
        />

        <LazyAccountEventAdminSettingsPanel
          v-if="tabAccess.showAgendaConfigurationInDetails"
          :event-id="workspaceEventId"
          :event-data="entryPage?.adminSettingsEvent ?? null"
          :can-manage="canAdmin"
          :is-loading="isEntryPending"
          :load-error-message="entryErrorMessage"
          program-settings-mode="details"
          :show-terms-management="false"
          :show-criteria-configuration="false"
          :show-prize-configuration="false"
          @updated="refreshAccountEvent"
        />
      </section>

      <section
        v-else-if="activeSection === 'program'"
        id="account-tab-panel-program"
        role="tabpanel"
        aria-labelledby="account-tab-program"
      >
        <AppAlert
          v-if="programPageRequest.error.value"
          color="error"
          title="Agenda unavailable"
          :description="normalizeParticipantApiError(programPageRequest.error.value).message"
        />
        <LazyAccountEventProgramAgenda
          v-else-if="programPage"
          :key="programPage.eventId"
          :program="programPage"
        />
        <p
          v-else
          role="status"
          class="text-sm text-muted"
        >
          Loading agenda…
        </p>
      </section>

      <section
        v-else-if="activeSection === 'gallery'"
        id="account-tab-panel-gallery"
        role="tabpanel"
        aria-labelledby="account-tab-gallery"
        class="space-y-8"
      >
        <LazyAccountEventGalleryPanel
          :event-id="workspaceEventId"
          :can-manage="canAdmin || canJudge || canViewParticipantsAndTeams"
          :page="galleryPage"
          :is-loading="galleryPageIsLoading"
          :load-error-message="galleryPageErrorMessage"
        />
      </section>

      <section
        v-else-if="activeSection === 'judges'"
        id="account-tab-panel-judges"
        role="tabpanel"
        aria-labelledby="account-tab-judges"
        class="space-y-8"
      >
        <LazyAccountEventPublishedRosterPanel
          :event-id="workspaceEventId"
          role="judge"
          title="Judges"
          description="Meet the people reviewing submissions for this event."
          :page="rostersPage"
          :is-loading="rostersPageIsLoading"
          :load-error-message="rostersPageErrorMessage"
          :refresh-page="rostersPageRequest.refresh"
          :management-event-id="canAdmin ? workspaceEventId : null"
        />
      </section>

      <section
        v-else-if="activeSection === 'staff'"
        id="account-tab-panel-staff"
        role="tabpanel"
        aria-labelledby="account-tab-staff"
        class="space-y-8"
      >
        <LazyAccountEventPublishedRosterPanel
          :event-id="workspaceEventId"
          role="staff"
          title="Staff"
          description="Meet the people supporting this event behind the scenes."
          :page="rostersPage"
          :is-loading="rostersPageIsLoading"
          :load-error-message="rostersPageErrorMessage"
          :refresh-page="rostersPageRequest.refresh"
          :tracks="event.tracks ?? []"
          :selected-track-id="selectedTrackId"
          :management-event-id="canAdmin ? workspaceEventId : null"
        />

        <LazyAccountEventRoleRosterPanel
          v-if="canAdmin"
          :event-id="workspaceEventId"
          role="admin"
          title="Admins"
          description="Admins can manage the internal workspace for this event. Promoting a judge or staff member keeps their current capability on the admin assignment."
          empty-assigned-message="No admins yet. Add an admin here when someone needs full event management access."
          :page="rostersPage"
          :is-loading="rostersPageIsLoading"
          :load-error-message="rostersPageErrorMessage"
          :refresh-page="rostersPageRequest.refresh"
        />
      </section>

      <section
        v-else-if="activeSection === 'feedback'"
        id="account-tab-panel-feedback"
        role="tabpanel"
        aria-labelledby="account-tab-feedback"
        class="space-y-8"
      >
        <LazyAccountEventFeedbackPanel
          :event-id="workspaceEventId"
          :event-state="event.state"
          :page="feedbackPage"
          :is-loading="feedbackPageIsLoading"
          :load-error-message="feedbackPageErrorMessage"
        />
      </section>

      <section
        v-else-if="activeSection === 'judging'"
        id="account-tab-panel-judging"
        role="tabpanel"
        aria-labelledby="account-tab-judging"
      >
        <LazyAccountEventJudgePanel
          :event-id="workspaceEventId"
          :slug="slug"
          :selected-assignment-id="selectedJudgeAssignmentId"
          :page="judgingPage"
          :is-loading="judgingPageIsLoading"
          :load-error-message="judgingPageErrorMessage"
          :refresh-page="judgingPageRequest.refresh"
          :assignment-page="assignmentPage"
          :assignment-page-is-loading="assignmentPageIsLoading"
          :assignment-page-error-message="assignmentPageErrorMessage"
          :refresh-assignment-page="assignmentPageRequest.refresh"
        />
      </section>

      <section
        v-else-if="activeSection === 'participants'"
        id="account-tab-panel-participants"
        role="tabpanel"
        aria-labelledby="account-tab-participants"
        class="space-y-8"
      >
        <LazyAccountEventAdminOperationsPanel
          v-if="canAdmin"
          v-model:participant-search="participantSearchText"
          :event-id="workspaceEventId"
          section="participants"
          :page="null"
          :participants-page="participantsPage"
          :can-manage="canAdmin"
          :is-loading="participantsPageIsLoading"
          :is-searching-participants="isSearchingParticipants"
          :load-error-message="participantsPageErrorMessage"
          :refresh-page="participantsPageRequest.refresh"
        />

        <LazyAccountEventParticipantVisibilityPanel
          v-else-if="canViewParticipantsAndTeams"
          v-model:search="participantSearchText"
          :event-id="workspaceEventId"
          :page="participantsPage"
          :is-loading="participantsPageIsLoading"
          :is-searching="isSearchingParticipants"
          :error-message="participantsPageErrorMessage"
          :refresh-page="participantsPageRequest.refresh"
        />
      </section>

      <section
        v-else-if="activeSection === 'certificates'"
        id="account-tab-panel-certificates"
        role="tabpanel"
        aria-labelledby="account-tab-certificates"
        class="space-y-8"
      >
        <LazyAccountEventCertificatesPanel
          v-if="canAdmin"
          :event-id="workspaceEventId"
          :event-slug="slug"
          :page="certificatesPage"
          :is-loading="certificatesPageIsLoading"
          :load-error-message="certificatesPageErrorMessage"
        />
      </section>

      <section
        v-else-if="activeSection === 'teams'"
        id="account-tab-panel-teams"
        role="tabpanel"
        aria-labelledby="account-tab-teams"
        class="space-y-8"
      >
        <LazyAccountEventParticipantTeamPanel
          :event="event"
          :page="teamsPage"
          :is-loading="teamsPageIsLoading"
          :load-error-message="teamsPageErrorMessage"
          :selected-team-slug="selectedTeamSlug"
          :show-operational-team-states="canViewParticipantsAndTeams || canAdmin"
        />
      </section>

      <section
        v-else-if="activeSection === 'submissions'"
        id="account-tab-panel-submissions"
        role="tabpanel"
        aria-labelledby="account-tab-submissions"
        class="space-y-8"
      >
        <LazyAccountEventAdminOperationsPanel
          :event-id="workspaceEventId"
          section="submissions"
          :page="submissionsPage"
          :can-manage="canAdmin"
          :is-loading="submissionsPageIsLoading"
          :load-error-message="submissionsPageErrorMessage"
          :refresh-page="submissionsPageRequest.refresh"
        />
      </section>

      <section
        v-else-if="activeSection === 'operations'"
        id="account-tab-panel-operations"
        role="tabpanel"
        aria-labelledby="account-tab-operations"
        class="space-y-8"
      >
        <LazyAccountEventAdminOperationsPanel
          :event-id="workspaceEventId"
          section="operations"
          :page="operationsPage"
          :can-manage="canAdmin"
          :is-loading="operationsPageIsLoading"
          :load-error-message="operationsPageErrorMessage"
          :refresh-page="operationsPageRequest.refresh"
        />
      </section>

      <section
        v-else
        id="account-tab-panel-settings"
        role="tabpanel"
        aria-labelledby="account-tab-settings"
      >
        <LazyAccountEventAdminSettingsPanel
          :event-id="workspaceEventId"
          :page="settingsPage"
          :can-manage="canAdmin"
          :is-loading="settingsPageIsLoading"
          :load-error-message="settingsPageErrorMessage"
          program-settings-mode="settings"
          :show-terms-management="true"
          :show-criteria-configuration="true"
          :show-prize-configuration="false"
          @updated="refreshSettingsPage"
        />
      </section>
    </AppContainer>
  </div>
  <div
    v-else-if="isEntryPending"
    class="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-muted"
  >
    Loading event workspace…
  </div>
  <AppAlert
    v-else-if="entryError"
    color="error"
    variant="soft"
    title="Event workspace unavailable"
    :description="normalizeParticipantApiError(entryError).message"
  />
</template>
