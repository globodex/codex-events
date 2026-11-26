<script setup lang="ts">
import type {
  AccountEventEntryAccess,
  AccountEventEntryEvent,
  AccountEventEntryPage,
  AccountEventEntryParticipation
} from '#shared/domains/events/account-event-entry-page'
import type { AccountEventPrizesPage } from '#shared/domains/events/account-event-prizes-page'
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
import type { AccountEventAgendaPage } from '#shared/domains/events/program'
import type { AccountEventPageVisibility } from '~/domains/events/account-workspace-page'
import {
  buildVersionedEventImageUrl,
  formatEventHeaderSummary,
  resolveEventDetailBackgroundImageUrl
} from '~/domains/events/presentation'
import type { EventParticipationRankSummary } from '~/domains/events/participation'
import { isApplicationEffectivelyCheckedIn } from '#shared/domains/applications/check-in'
import { buildEventCertificatePath } from '#shared/domains/events/certificates'
import { canViewEventProgram } from '#shared/domains/events/program'
import type {
  ParticipantApiDataResponse,
  ParticipantApplicationRecord
} from '~/domains/applications/participant-application'

import { Switch as UiSwitch } from '~/components/ui/switch'
import {
  LazyAccountEventsAccountEventAdminOperationsPanel as LazyAccountEventAdminOperationsPanel,
  LazyAccountEventsAccountEventCertificatesPanel as LazyAccountEventCertificatesPanel,
  LazyAccountEventsAccountEventCreditsPanel as LazyAccountEventCreditsPanel,
  LazyAccountEventsAccountEventFeedbackPanel as LazyAccountEventFeedbackPanel,
  LazyAccountEventsAccountEventGalleryPanel as LazyAccountEventGalleryPanel,
  LazyAccountEventsAccountEventJudgePanel as LazyAccountEventJudgePanel,
  LazyAccountEventsAccountEventParticipantTeamPanel as LazyAccountEventParticipantTeamPanel,
  LazyAccountEventsAccountEventParticipantVisibilityPanel as LazyAccountEventParticipantVisibilityPanel,
  LazyAccountEventsAccountEventParticipantWorkspacePanel as LazyAccountEventParticipantWorkspacePanel,
  LazyAccountEventsOrganismsAccountEventProgramAgenda as LazyAccountEventProgramAgenda,
  LazyAccountEventsAccountEventPublishedRosterPanel as LazyAccountEventPublishedRosterPanel,
  LazyAccountEventsAccountEventRoleRosterPanel as LazyAccountEventRoleRosterPanel,
  LazyAccountEventsAccountEventTalkProposalPanel as LazyAccountEventTalkProposalPanel,
  LazyAccountEventsAccountEventTalkProposalReviewPanel as LazyAccountEventTalkProposalReviewPanel,
  LazyAccountEventsOrganismsAccountEventChallengeChoice as LazyAccountEventChallengeChoice,
  LazyAccountEventsOrganismsAccountEventChallengeList as LazyAccountEventChallengeList,
  LazyAccountEventsOrganismsAccountEventChallengePage as LazyAccountEventChallengePage,
  LazyAccountEventsOrganismsAccountEventTracksPanel as LazyAccountEventTracksPanel,
  LazyPublicEventsEventAgendaPanel as LazyEventAgendaPanel,
  LazyPublicEventsEventPrizeList as LazyEventPrizeList,
  LazyPublicEventsEventPublishedProjectsShowcase as LazyEventPublishedProjectsShowcase,
  LazyPublicEventsEventDetailsCard as LazyEventDetailsCard,
  LazyPublicEventsEventWinnersShowcase as LazyEventWinnersShowcase
} from '#components'
import AccountEventParticipationRankNotice from '~/components/account/events/AccountEventParticipationRankNotice.vue'
import AccountEventNextStepCard from '~/components/account/events/organisms/AccountEventNextStepCard.vue'
import AccountEventStaffInstructionsPanel from '~/components/account/events/organisms/AccountEventStaffInstructionsPanel.vue'
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
  getAccountEventPageForTab,
  getAccountEventWorkspaceBackLink,
  getAccountEventTabLabel,
  resolveAccountEventScopedId,
  shouldPreserveAccountEventTabSelection,
  type AccountEventWorkspaceTab
} from '~/domains/events/account-workspace-tabs'
import { getAccountEventSeoContent } from '~/domains/events/account-workspace-seo'
import {
  getEventParticipationOutcomeNotice,
  getSelectedBuildTrackOverviewTrack,
  showsEventStateBesideOwnStatus
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
import { normalizeSessionQueryValue, normalizeTabQueryValue, resolveTabQueryValue } from '~/lib/query-values'
import { useApiClient } from '~/composables/useApiClient'
import { usePolling } from '~/composables/usePolling'
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
  useParticipantListRead
} from '~/composables/useParticipantListRead'

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
const { clearReads } = useAuthorizationCache()
const { actor, refresh: refreshActor } = useAccountBootstrap()

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
// A direct link to a tab that the entry page does not feed loads that tab's own page instead.
const isDirectNonEntryNavigation = computed(() =>
  Boolean(requestedTab.value)
  && getAccountEventPageForTab(requestedWorkspaceTab.value) !== 'entry'
)
// The entry page also feeds the header and the tab bar of every tab. Once it is loaded it stays
// enabled, so a refresh from another tab (for example after a check-in step) reloads it at once.
const isEntryPageLoaded = shallowRef(false)
const entryPageRequest = useAccountEventPageRequest<AccountEventEntryPage>(slug, 'entry', {
  enabled: () => isEntryPageLoaded.value || !isDirectNonEntryNavigation.value
})
watch(entryPageRequest.data, (data) => {
  isEntryPageLoaded.value = Boolean(data)
}, { immediate: true })
const initialPageFamily = resolveInitialAccountEventPageFamily({
  isDirectNonEntryNavigation: isDirectNonEntryNavigation.value,
  selectedTab: requestedWorkspaceTab.value
})
const pageState = useAccountEventPageState({
  initialPageFamily,
  slug,
  authorizationGeneration: entryPageRequest.authorizationGeneration
})
const entryPage = computed(() => entryPageRequest.data.value?.page ?? null)
const pageShell = pageState.pageShell
const pageVisibility = shallowRef<AccountEventPageVisibility | null>(null)
const event = computed<AccountWorkspaceEvent | null>(() =>
  entryPage.value?.event ?? pageShell.value?.event ?? null
)
const accessRecord = shallowRef<AccountEventAccessRecord | null>(null)
const participationRecord = shallowRef<AccountEventEntryParticipation | null>(null)
const participantCreditOffers = computed(() => entryPage.value?.participantCredits ?? [])
const talkProposal = computed(() => entryPage.value?.talkProposal ?? null)
const talkProposalReviews = computed(() => entryPage.value?.talkProposalReviews ?? [])
watch([entryPage, pageShell], ([page, shell]) => {
  accessRecord.value = page?.access ?? shell?.access ?? null
  participationRecord.value = page?.participation ?? null
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
    ?? (currentEvent && actor.value?.kind === 'platform_user'
      ? hasEventJudgingAccess(actor.value, currentEvent.id)
      : false)
})
const canAdmin = computed(() => {
  const currentEvent = event.value

  return entryPageRequest.data.value?.visibility.canManage
    ?? pageVisibility.value?.canManage
    ?? (currentEvent && actor.value?.kind === 'platform_user'
      ? hasEventAdminAccess(actor.value, currentEvent.id)
      : false)
})
const canViewParticipantsAndTeams = computed(() => {
  const currentEvent = event.value

  return pageVisibility.value?.canViewParticipantsAndTeams
    ?? (currentEvent && actor.value?.kind === 'platform_user'
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
  if (actor.value?.kind !== 'platform_user' || !event.value) {
    return null
  }

  return actor.value.eventRoles.find(role => role.eventId === event.value?.id) ?? null
})
const currentStaffTrackId = computed(() =>
  currentEventRole.value?.isStaff ? currentEventRole.value.staffTrackId : null
)
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
  actor.value?.kind === 'platform_user'
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

  return actor.value?.kind === 'platform_user'
    && event.value?.state === 'completed'
    && application?.status === 'approved'
    && application.isCheckedIn
    && !application.certificateRevokedAt
})
const isCertificateGenerationDisabled = computed(() => Boolean(participationRecord.value?.application?.certificateHiddenAt))
const selectedTrackId = computed(() => participationRecord.value?.application?.selectedTrackId ?? null)
const accountEventTracks = computed(() => event.value?.tracks ?? [])
const canSelectParticipantTrack = computed(() =>
  (applicationStatus.value === 'submitted' || applicationStatus.value === 'approved')
  && event.value?.state !== 'completed'
  && accountEventTracks.value.length > 0
)
// The track list on Overview. The selected track notice links to it.
const eventTracksPanelId = 'event-tracks'
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
    actor.value?.kind !== 'platform_user'
    || !canManageParticipantCertificateGeneration.value
    || isCertificateGenerationDisabled.value
  ) {
    return null
  }

  return buildEventCertificatePath(slug.value, actor.value.platformUser.id)
})
const isCertificateVisibilityPending = ref(false)
const pendingSelectedTrackId = ref<string | null>(null)

// The open tracks and challenges on the Overview tab, and the participant's choice among them.
const overviewChallenges = computed(() => entryPage.value?.challenges ?? [])
const selectedChallengeId = computed(() => participationRecord.value?.application?.selectedChallengeId ?? null)
const canChooseChallenge = computed(() => applicationStatus.value === 'approved' && event.value?.state !== 'completed')
const pendingChallengeId = ref<string | null>(null)

/** Saves the participant's choice. Null clears it. `cardId` names the card that shows the saving. */
async function chooseChallenge(challengeId: string | null, cardId: string) {
  pendingChallengeId.value = cardId

  try {
    const response = await apiFetch<ParticipantApiDataResponse<ParticipantApplicationRecord>>(
      `/api/events/${workspaceEventId.value}/applications/me/actions/select-challenge`,
      { method: 'POST', body: { challengeId } }
    )

    updateParticipationRecordApplication(response.data)
    toast.add({ title: challengeId ? 'Choice saved' : 'Choice cleared', color: 'success' })
  } catch (error) {
    toast.add({
      title: 'Your choice could not be saved',
      description: normalizeParticipantApiError(error).message,
      color: 'error'
    })
  } finally {
    pendingChallengeId.value = null
  }
}

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
  hasPublishedPrizes: false,
  hasPublishedStaff: false,
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
  query: pageState.queryForPage('prizes')
})
const prizesPage = computed(() => prizesPageRequest.data.value?.page ?? null)
const selectedTeamSlug = computed(() => normalizeTeamSlugQueryValue(route.query.team))
const selectedJudgeAssignmentId = computed(() => normalizeJudgeAssignmentIdQueryValue(route.query.assignment))
const workspacePageRequest = useAccountEventPageRequest<AccountEventWorkspacePage>(slug, 'workspace', {
  enabled: () => activeSection.value === 'workspace',
  query: pageState.queryForPage('workspace')
})
const programPageRequest = useAccountEventPageRequest<AccountEventAgendaPage>(slug, 'program', {
  enabled: () => activeSection.value === 'program',
  query: pageState.queryForPage('program')
})
const programPage = computed(() => programPageRequest.data.value?.page)
// The sessions and the map are shown only while this person may still read them, so a program
// that was loaded before a withdrawal is not shown.
const canViewProgram = computed(() => canViewEventProgram({
  isEventAdmin: canAdmin.value,
  isStaff: currentEventRole.value?.isStaff ?? false,
  approved: applicationStatus.value === 'approved'
}))
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
// What the participant list request asks the server for. The participant search and "Load more"
// replace it.
const participantListRead = shallowRef(createParticipantListRead())
const participantsPageRequest = useAccountEventPageRequest<AccountEventParticipantsPage>(slug, 'participants', {
  enabled: shouldLoadParticipantsPage,
  query: computed(() => ({
    ...pageState.queryForPage('participants'),
    participantSearch: participantListRead.value.searchText,
    participantRows: participantListRead.value.rows
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
// Keep an open review in sync with its mutation response. Its queue and inbox are read again on return.
function applyJudgeAssignment(review: AccountJudgeAssignmentWorkspacePage, assignment: AccountJudgeAssignmentWorkspacePage['assignment']) {
  const eventSlug = review.event.slug
  const key = `account-event-judge-assignment:${eventSlug}:${review.assignment.id}`
  // A skipped review can return a replacement assigned to another judge.
  const displayingAssignment = assignment.id === review.assignment.id && assignmentPageRequest.data.value === review
  if (displayingAssignment) {
    assignmentPageRequest.data.value = { ...review, assignment }
    const queue = judgingPageRequest.data.value
    if (queue?.page.event.id === review.event.id) {
      // The editor uses the queue to offer the next unstarted assignment.
      const assignments = queue.page.assignments.map(row => row.id === assignment.id ? assignment : row)
      judgingPageRequest.data.value = { ...queue, page: { ...queue.page, assignments } }
    }
  }
  clearReads([key, 'judge-workspace-inbox'], displayingAssignment ? key : undefined)
  void judgingPageRequest.refreshFor(eventSlug)
}
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
const participantsPageIsLoading = computed(() =>
  participantsPageRequest.isLoading.value && !participantsPage.value
)
const {
  isLoadingMore: isLoadingMoreParticipants,
  isSearching: isSearchingParticipants,
  loadMore: loadMoreParticipants,
  searchText: participantSearchText
} = useParticipantListRead({
  page: participantsPage,
  isReading: participantsPageRequest.pending,
  serverRead: participantListRead
})

const rostersPageRequest = useAccountEventPageRequest<AccountEventRostersPage>(slug, 'rosters', {
  enabled: () => activeSection.value === 'judges' || activeSection.value === 'staff',
  query: pageState.queryForPage('rosters')
})
const rostersPage = computed(() => rostersPageRequest.data.value?.page ?? null)
const selectedPageRequest = computed(() => {
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
    default: return null
  }
})
const shellRequest = computed(() => {
  if (shouldLoadAssignmentPage.value) return assignmentPageRequest
  return isDirectNonEntryNavigation.value ? selectedPageRequest.value : entryPageRequest
})
watchEffect(() => {
  const selectedPage = selectedPageRequest.value?.data.value

  pageState.applySelectedPageState({
    entryPagePresent: Boolean(entryPage.value),
    shell: selectedPage?.shell
  })
  pageVisibility.value = entryPageRequest.data.value?.visibility ?? selectedPage?.visibility ?? null
})
const participationRank = computed<EventParticipationRankSummary | null>(() => entryPage.value?.participantRank ?? null)
async function refreshAccountEvent() {
  await entryPageRequest.refresh()
}

// A check-in step can unlock adding photos and can change agenda sessions that have a second
// version for checked-in participants. So the Gallery tab and the Agenda tab read their pages
// again on the next visit.
async function refreshAfterCheckInStep() {
  await Promise.all([refreshAccountEvent(), galleryPageRequest.refresh(), programPageRequest.refresh()])
}

async function refreshMemberTeam(eventSlug: string) {
  await Promise.all([
    teamsPageRequest.refreshFor(eventSlug),
    workspacePageRequest.refreshFor(eventSlug),
    entryPageRequest.refreshFor(eventSlug)
  ])
}

async function refreshAttendance(eventSlug: string) {
  await Promise.all([
    participantsPageRequest.refreshFor(eventSlug),
    certificatesPageRequest.refreshFor(eventSlug)
  ])
}

// The tab pages that show more to a confirmed participant. A withdrawal removes them from this
// device, so the next visit asks the server again.
function clearConfirmedParticipantPages() {
  programPageRequest.clear()
  galleryPageRequest.clear()
  workspacePageRequest.clear()
  teamsPageRequest.clear()
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
// What a participant can open at the event. The next-step card lists the entries in this order,
// with the names and the order of the tabs. The card shows every entry after check-in, and the
// entries that are open before check-in already while the participant still has to check in.
// Add one entry here for every new activity.
const participantActivities = computed(() => {
  const activities: Array<{ label: string, to: string }> = []

  if (availableTabs.value.includes('program')) {
    activities.push({ label: 'Agenda', to: `/account/events/${slug.value}?tab=program` })
  }

  if (availableTabs.value.includes('gallery')) {
    activities.push({ label: 'Gallery', to: `/account/events/${slug.value}?tab=gallery` })
  }

  return activities
})
// "How to get there" opens the Agenda tab with the first session that has a room selected, so the
// map shows where to go.
const nextStepWayHref = computed(() => availableTabs.value.includes('program')
  ? `/account/events/${slug.value}?tab=program&session=first`
  : null)
// The session or agenda block that a link to the Agenda tab names (`normalizeSessionQueryValue`).
const linkedAgendaSession = computed(() => normalizeSessionQueryValue(route.query.session))
// The workshop or the challenge whose page the Agenda tab opens beside the agenda, by its session id
// or challenge id.
const linkedWorkshop = computed(() => normalizeSessionQueryValue(route.query.workshop))
const linkedChallenge = computed(() => normalizeSessionQueryValue(route.query.challenge))
// Without a program, the Agenda tab shows the challenge page beside the public agenda.
const linkedChallengeWithoutProgram = computed(() =>
  programPage.value?.challenges.find(challenge => challenge.id === linkedChallenge.value))
// Fullscreen of a workshop or challenge page also hides the header of this page.
const presentationMode = usePresentationMode()

function closePage() {
  void navigateTo({ query: { ...route.query, workshop: undefined, challenge: undefined } }, { replace: true })
}

// The address names the session or agenda block selected on the Agenda tab, so a shared link opens the
// same selection. A selection on the agenda also closes an open workshop or challenge page.
function linkAgendaSelection(id: string | null) {
  void navigateTo({
    query: { ...route.query, workshop: undefined, challenge: undefined, session: id ?? undefined }
  }, { replace: true })
}

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
// The header shows the state of the event only when it tells this person something new.
const showEventStateBadge = computed(() =>
  showsEventStateBesideOwnStatus(event.value?.state ?? 'draft', applicationStatus.value)
)
const showOverviewApplicationStatusBanner = computed(() =>
  shouldShowParticipantOverviewStatusBanner(applicationStatus.value)
)
const participantApplication = computed(() => participationRecord.value?.application ?? null)
// The next-step card is for a confirmed participant of an event that uses the check-in flow.
// A completed event has no next step.
const showNextStepCard = computed(() =>
  entryPage.value?.checkInFlowEnabled === true
  && applicationStatus.value === 'approved'
  && event.value?.state !== 'completed'
)

// Until a confirmed participant is checked in, the Overview with its next step and the Agenda tab
// read their data again every few seconds. They change by themselves once the event team checks the
// participant in, and the reading stops then.
const waitsForCheckIn = computed(() =>
  (activeSection.value === 'overview' && showNextStepCard.value && !participantApplication.value?.isCheckedIn)
  || (activeSection.value === 'program' && programPage.value?.waitingForCheckIn === true))
usePolling(refreshAfterCheckInStep, waitsForCheckIn)

// Where the Gallery tab sends a participant who has to finish the check-in flow first: the
// overview, while it shows the next-step card. A direct link to Gallery loads only
// the gallery page, so galleryPage.mustFinishCheckInFlowToAddPhotos also proves Overview has it.
const nextStepHref = computed(() =>
  event.value?.state !== 'completed'
  && (showNextStepCard.value || galleryPage.value?.mustFinishCheckInFlowToAddPhotos === true)
    ? `/account/events/${slug.value}`
    : null
)
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
const withdrawalDescription = 'If you withdraw, you lose your place at this event.'

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
const detailSummary = computed(() => event.value ? formatEventHeaderSummary(event.value) : '')
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
        selectedChallengeId: nextApplication.selectedChallengeId,
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
    clearConfirmedParticipantPages()
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
      <!-- Headings, times and highlighted cards of the workspace sit straight on the picture, so light mode washes it white for them. -->
      <div class="absolute inset-0 bg-gradient-to-b from-white/40 via-white/50 to-white/60 dark:from-black/35 dark:via-black/55 dark:to-black/76" />
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.22),transparent_46%)] dark:bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.10),transparent_48%)]" />
    </div>

    <section
      v-show="!presentationMode.active.value"
      class="relative z-10 border-b border-black/8 bg-white/42 backdrop-blur-lg dark:border-white/[0.08] dark:bg-black/48"
    >
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
                    v-if="showEventStateBadge"
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
                <!-- The event builder is the one place where an event is changed. Its code, with
                     the editors, is loaded only when the admin opens it. -->
                <AppButton
                  v-if="canAdmin"
                  :to="`/admin/events/builder/${slug}`"
                  no-prefetch
                  color="neutral"
                  variant="outline"
                  size="sm"
                  data-testid="account-event-edit"
                >
                  <template #leading>
                    <AppIcon
                      name="i-lucide-pencil"
                      class="size-3.5"
                    />
                  </template>
                  Edit event
                </AppButton>
              </div>

              <p class="text-[15px] text-neutral-700 dark:text-[#A3A3A3]">
                {{ detailSummary }}
              </p>
            </div>
          </div>

          <nav
            ref="accountTabListRef"
            aria-label="Account event sections"
            role="tablist"
            class="account-event-tab-list flex items-center gap-4 overflow-x-auto sm:gap-6"
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
      <AppAlert
        v-if="getAccountEventPageForTab(activeSection) === 'entry' && entryPageRequest.error.value"
        color="error"
        title="Event workspace unavailable"
        :description="entryPageRequest.errorMessage.value"
      />
      <p
        v-else-if="getAccountEventPageForTab(activeSection) === 'entry' && !entryPage"
        class="text-sm text-muted"
        role="status"
      >
        Loading event…
      </p>
      <section
        v-else-if="activeSection === 'overview'"
        id="account-tab-panel-overview"
        role="tabpanel"
        aria-labelledby="account-tab-overview"
        class="space-y-7"
      >
        <!-- After check-in the event's credit offers stand below the next step with its activities. -->
        <AccountEventNextStepCard
          v-if="showNextStepCard"
          :is-checked-in="participantApplication?.isCheckedIn ?? false"
          :way-href="nextStepWayHref"
          :activities="participantActivities"
        />

        <!-- The server sends the offers only once this person can claim them or has claimed them. -->
        <LazyAccountEventCreditsPanel
          v-if="participantCreditOffers.length > 0"
          :event-id="event.id"
          :offers="participantCreditOffers"
          @updated="refreshAccountEvent"
        />

        <LazyAccountEventChallengeChoice
          v-if="overviewChallenges.length > 0"
          :event-id="event.id"
          :challenges="overviewChallenges"
          :selected-challenge-id="selectedChallengeId"
          :can-choose="canChooseChallenge"
          :pending-challenge-id="pendingChallengeId"
          @choose="chooseChallenge"
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
                    This is the track you'll follow for this Build event. Review its resources or choose another track below.
                  </p>
                </div>
              </div>

              <AppButton
                :to="`#${eventTracksPanelId}`"
                color="neutral"
                variant="solid"
                trailing-icon="i-lucide-arrow-down"
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
                      class="w-full rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC] lg:w-auto"
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
                class="rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
              >
                View certificate
              </AppButton>
            </div>
          </div>
        </section>

        <EventOverviewPanel :description="event.description" />

        <LazyEventDetailsCard
          :event="event"
          :discord-server-url="event.discordServerUrl ?? null"
          :slides-url="event.slidesUrl ?? null"
          :show-address="canViewRestrictedEventDetails"
        />

        <LazyAccountEventTracksPanel
          :id="eventTracksPanelId"
          class="scroll-mt-6"
          :tracks="accountEventTracks"
          :selected-track-id="selectedTrackId"
          :can-select-track="canSelectParticipantTrack"
          :pending-track-id="pendingSelectedTrackId"
          :viewer-mode="accountTrackViewerMode"
          :staff-track-id="currentStaffTrackId"
          @select-track="selectParticipantTrack"
        />

        <template v-if="applicationStatus === 'approved'">
          <section v-if="showApprovedOverviewActions">
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
                    class="rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
                  >
                    Open Workspace
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
                  class="mt-4 rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
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
                  class="mt-4 rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
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
                class="mt-4 rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
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

        <!--
          Withdrawing asks for a confirmation that names the consequence, so the page shows the
          action only. A person who cannot withdraw any more reads the reason below the button.
        -->
        <div
          v-if="applicationStatus === 'submitted' || applicationStatus === 'approved'"
          class="flex flex-col items-start gap-2"
        >
          <AppButton
            color="error"
            variant="ghost"
            size="sm"
            :loading="isWithdrawApplicationPending"
            :disabled="!withdrawApplicationAvailability.isAllowed || isWithdrawApplicationPending"
            @click="withdrawOwnApplication"
          >
            Withdraw from this event
          </AppButton>
          <p
            v-if="!withdrawApplicationAvailability.isAllowed && withdrawApplicationAvailability.reason"
            class="text-sm text-neutral-600 dark:text-[#A3A3A3]"
          >
            {{ withdrawApplicationAvailability.reason }}
          </p>
        </div>
      </section>

      <section
        v-else-if="activeSection === 'call-for-talks'"
        id="account-tab-panel-call-for-talks"
        role="tabpanel"
        aria-labelledby="account-tab-call-for-talks"
        class="space-y-8"
      >
        <LazyAccountEventTalkProposalPanel
          v-if="applicationStatus === 'submitted' || applicationStatus === 'approved' || talkProposal"
          :key="`${talkProposal?.id ?? event.id}:${event.talkProposalQuestionsRevision}:${talkProposal?.status ?? 'new'}`"
          :event="event"
          :application-status="applicationStatus"
          :proposal="talkProposal"
          :refresh-page="entryPageRequest.refreshFor"
        />

        <LazyAccountEventTalkProposalReviewPanel
          v-if="canViewParticipantsAndTeams"
          :event="event"
          :can-decide="canAdmin"
          :entries="talkProposalReviews"
          :refresh-page="entryPageRequest.refreshFor"
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
          :refresh-after-submission="workspacePageRequest.refreshFor"
          :refresh-teams="refreshMemberTeam"
          :load-error-message="workspacePageRequest.errorMessage.value"
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
        <AppAlert
          v-if="prizesPageRequest.error.value"
          color="error"
          title="Prizes unavailable"
          :description="prizesPageRequest.errorMessage.value"
        />
        <template v-else-if="prizesPage">
          <template v-if="event.state === 'completed'">
            <LazyEventWinnersShowcase :winners="prizesPage.winners" />
            <LazyEventPublishedProjectsShowcase
              v-if="prizesPage.publishedProjects.length"
              :projects="prizesPage.publishedProjects"
            />
          </template>

          <LazyEventPrizeList
            v-else
            :prizes="prizesPage.prizes"
          />
        </template>
        <p
          v-else
          role="status"
          class="text-sm text-muted"
        >
          Loading prizes…
        </p>
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
          :description="programPageRequest.errorMessage.value"
        />
        <template v-else-if="programPage">
          <LazyAccountEventProgramAgenda
            v-if="programPage.program && canViewProgram"
            :key="programPage.program.eventId"
            :program="programPage.program"
            :agenda-items="event.agendaItems"
            :challenges="programPage.challenges"
            :linked-session="linkedAgendaSession"
            :linked-workshop="linkedWorkshop"
            :linked-challenge="linkedChallenge"
            :refresh-page="programPageRequest.refresh"
            @close-page="closePage"
            @link-selection="linkAgendaSelection"
          />
          <!--
            A person who does not read the program sees the public agenda blocks with the sessions
            that the organizer made public. The challenges that this person may read stand next
            to them, without a map, and a challenge page takes their place while it is open.
          -->
          <div
            v-else
            class="flex flex-col gap-6 lg:flex-row lg:items-start"
          >
            <LazyEventAgendaPanel
              v-if="event.agendaItems.length"
              class="min-w-0 lg:flex-1"
              :agenda-items="event.agendaItems"
              :public-sessions="programPage.publicSessions"
            />
            <LazyAccountEventChallengePage
              v-if="linkedChallengeWithoutProgram"
              :class="event.agendaItems.length ? 'min-w-0 lg:flex-1' : 'w-full'"
              :event-id="event.id"
              :challenge="linkedChallengeWithoutProgram"
              :rooms="[]"
              :refresh-page="programPageRequest.refresh"
              @close="closePage"
            />
            <LazyAccountEventChallengeList
              v-else-if="programPage.challenges.length"
              :class="event.agendaItems.length ? 'lg:w-80 lg:shrink-0' : 'w-full'"
              :event-id="event.id"
              :challenges="programPage.challenges"
              :floor-plans="[]"
              :selected-challenge-id="null"
            />
          </div>
        </template>
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
          :event-slug="slug"
          :event-id="workspaceEventId"
          :can-manage="canAdmin || canJudge || canViewParticipantsAndTeams"
          :page="galleryPage"
          :next-step-href="nextStepHref"
          :load-error-message="galleryPageRequest.errorMessage.value"
          :refresh-page="galleryPageRequest.refreshFor"
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
          :load-error-message="rostersPageRequest.errorMessage.value"
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
        <!-- The server sends the general staff instructions only to staff and event admins. -->
        <AccountEventStaffInstructionsPanel
          v-if="rostersPage && rostersPage.staffInstructions !== null"
          :event-id="workspaceEventId"
          :source="rostersPage.staffInstructions"
          :can-edit="canAdmin"
          :refresh-page="rostersPageRequest.refresh"
        />

        <LazyAccountEventPublishedRosterPanel
          :event-id="workspaceEventId"
          role="staff"
          title="Staff"
          description="Meet the people supporting this event behind the scenes."
          :page="rostersPage"
          :load-error-message="rostersPageRequest.errorMessage.value"
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
          :load-error-message="rostersPageRequest.errorMessage.value"
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
          :is-loading="feedbackPageRequest.isLoading.value"
          :load-error-message="feedbackPageRequest.errorMessage.value"
        />
      </section>

      <section
        v-else-if="activeSection === 'judging'"
        id="account-tab-panel-judging"
        role="tabpanel"
        aria-labelledby="account-tab-judging"
      >
        <LazyAccountEventJudgePanel
          :selected-assignment-id="selectedJudgeAssignmentId"
          :page="judgingPage"
          :is-loading="judgingPageRequest.isLoading.value"
          :load-error-message="judgingPageRequest.errorMessage.value"
          :assignment-page="assignmentPage"
          :assignment-page-error-message="assignmentPageRequest.errorMessage.value"
          :on-saved="applyJudgeAssignment"
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
          :event-slug="slug"
          section="participants"
          :page="null"
          :participants-page="participantsPage"
          :can-manage="canAdmin"
          :is-loading="participantsPageIsLoading"
          :is-searching-participants="isSearchingParticipants"
          :is-loading-more-participants="isLoadingMoreParticipants"
          :load-error-message="participantsPageRequest.errorMessage.value"
          :refresh-page="refreshAttendance"
          @load-more-participants="loadMoreParticipants"
        />

        <LazyAccountEventParticipantVisibilityPanel
          v-else-if="canViewParticipantsAndTeams"
          v-model:search="participantSearchText"
          :event-id="workspaceEventId"
          :event-slug="slug"
          :page="participantsPage"
          :is-loading="participantsPageIsLoading"
          :is-searching="isSearchingParticipants"
          :is-loading-more="isLoadingMoreParticipants"
          :error-message="participantsPageRequest.errorMessage.value"
          :refresh-page="refreshAttendance"
          @load-more="loadMoreParticipants"
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
          :refresh-page="refreshAttendance"
          :is-loading="certificatesPageRequest.isLoading.value"
          :load-error-message="certificatesPageRequest.errorMessage.value"
        />
      </section>

      <section
        v-else-if="activeSection === 'teams'"
        id="account-tab-panel-teams"
        role="tabpanel"
        aria-labelledby="account-tab-teams"
        class="space-y-8"
      >
        <AppAlert
          v-if="teamsPageRequest.error.value"
          color="error"
          title="Teams unavailable"
          :description="teamsPageRequest.errorMessage.value"
        />
        <LazyAccountEventParticipantTeamPanel
          v-else-if="teamsPage"
          :page="teamsPage"
          :refresh-teams="teamsPageRequest.refreshFor"
          :selected-team-slug="selectedTeamSlug"
          :show-operational-team-states="canViewParticipantsAndTeams || canAdmin"
        />
        <AppAlert
          v-else
          title="Loading teams"
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
          :event-slug="slug"
          section="submissions"
          :page="submissionsPage"
          :can-manage="canAdmin"
          :is-loading="submissionsPageRequest.isLoading.value"
          :load-error-message="submissionsPageRequest.errorMessage.value"
          :refresh-page="submissionsPageRequest.refreshFor"
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
          :event-slug="slug"
          section="operations"
          :page="operationsPage"
          :can-manage="canAdmin"
          :is-loading="operationsPageRequest.isLoading.value"
          :load-error-message="operationsPageRequest.errorMessage.value"
          :refresh-page="operationsPageRequest.refreshFor"
        />
      </section>
    </AppContainer>
  </div>
  <AppContainer
    v-else-if="shouldLoadAssignmentPage && assignmentPage"
    class="max-w-none py-6"
  >
    <LazyJudgingOrganismsJudgeAssignmentWorkspacePanel
      :key="assignmentPage.assignment.id"
      :page="assignmentPage"
      :on-saved="applyJudgeAssignment"
    />
  </AppContainer>
  <div
    v-else-if="shellRequest?.isLoading.value"
    class="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-muted"
  >
    Loading event…
  </div>
  <AppAlert
    v-else-if="shellRequest?.error.value"
    color="error"
    variant="soft"
    title="Event workspace unavailable"
    :description="shellRequest.errorMessage.value"
  />
</template>
