import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

const pageSource = readFileSync(
  new URL('../../../../app/pages/account/events/[slug]/index.vue', import.meta.url),
  'utf8'
)
const teamsRouteSource = readFileSync(
  new URL('../../../../app/pages/events/[slug]/teams/[[teamSlug]].vue', import.meta.url),
  'utf8'
)
const teamsServerSource = readFileSync(
  new URL('../../../../server/domains/events/account-event-teams-page.ts', import.meta.url),
  'utf8'
)
const participantTeamPanelSource = readFileSync(
  new URL('../../../../app/components/account/events/AccountEventParticipantTeamPanel.vue', import.meta.url),
  'utf8'
)
const settingsPanelSource = readFileSync(
  new URL('../../../../app/components/account/events/AccountEventAdminSettingsPanel.vue', import.meta.url),
  'utf8'
)
const talkControlSource = readFileSync(
  new URL('../../../../app/components/admin/EventTalkProposalControl.vue', import.meta.url),
  'utf8'
)
const simplifiedClaimingPanelSource = readFileSync(
  new URL('../../../../app/components/account/events/AccountEventSimplifiedClaimingPanel.vue', import.meta.url),
  'utf8'
)
const configFormSource = readFileSync(
  new URL('../../../../app/components/admin/EventConfigForm.vue', import.meta.url),
  'utf8'
)
const builderPageSource = readFileSync(
  new URL('../../../../app/pages/admin/events/builder/[eventId].vue', import.meta.url),
  'utf8'
)
const builderWorkspaceSource = readFileSync(
  new URL('../../../../app/components/admin/builder/AdminBuilderWorkspace.vue', import.meta.url),
  'utf8'
)
const builderExtrasBoardSource = readFileSync(
  new URL('../../../../app/components/admin/builder/organisms/AdminBuilderExtrasBoard.vue', import.meta.url),
  'utf8'
)
const dateTimeInputSource = readFileSync(
  new URL('../../../../app/components/AppDateTimeInput.vue', import.meta.url),
  'utf8'
)
const dateTimePickerSource = readFileSync(
  new URL('../../../../app/components/AppDateTimePicker.vue', import.meta.url),
  'utf8'
)

describe('account event parent page request topology', () => {
  test('owns the competition page reads and passes typed page state down', () => {
    expect(pageSource).toContain('useAccountEventPageRequest<AccountEventOperationsPage>(slug, \'operations\'')
    expect(pageSource).toContain('useAccountEventPageRequest<AccountEventParticipantsPage>(slug, \'participants\'')
    expect(pageSource).toContain('useAccountEventPageRequest<AccountEventSubmissionsPage>(slug, \'submissions\'')
    expect(pageSource).toContain('useAccountEventPageRequest<AccountEventJudgingPage>(slug, \'judging\'')
    expect(pageSource).toContain('useAccountJudgeAssignmentPageRequest<AccountJudgeAssignmentWorkspacePage | null>')
    expect(pageSource).toContain(':page="operationsPage"')
    expect(pageSource).toContain(':page="submissionsPage"')
    expect(pageSource).toContain(':page="judgingPage"')
    expect(pageSource).toContain(':assignment-page="assignmentPage"')
    expect(pageSource).not.toContain('<LazyAccountEventJudgePanel\n          :event-id="workspaceEventId"\n          :slug="slug"\n          :selected-assignment-id="selectedJudgeAssignmentId"\n        />')
  })

  test('uses one selected direct-link read with a concurrent event shell', () => {
    expect(pageSource).toContain('} from \'~/domains/events/account-workspace-page\'')
    expect(pageSource).toContain('const isDirectNonEntryNavigation = computed(() =>')
    const prizesRequestSource = pageSource.slice(
      pageSource.indexOf('const prizesPageRequest'),
      pageSource.indexOf('const prizesPage =')
    )
    expect(prizesRequestSource).toContain('query: prizesPageQuery')
    expect(pageSource).toContain('const initialPageFamily = resolveInitialAccountEventPageFamily({')
    expect(pageSource).toContain('const pageState = useAccountEventPageState({')
    expect(pageSource).not.toContain('initialRouteFullPath')
    expect(pageSource).toContain('...pageState.queryForPage(\'participants\')')
    expect(pageSource).toContain('participantSearch: participantListRead.value.searchText')
    expect(pageSource).toContain('query: pageState.queryForPage(\'operations\')')
    expect(pageSource).toContain('pageState.applySelectedPageState')
    expect(pageSource).toContain('enabled: shouldLoadParticipantsPage')
    expect(pageSource).toContain('const participantsPage = computed(() => participantsPageRequest.data.value?.page ?? null)')
    expect(pageSource).toContain(':participants-page="participantsPage"')
    expect(pageSource).not.toContain('selectedParticipantsResponse?.visibility.canManage')
    expect(pageSource).not.toContain('AccountEventParticipantsPageResponse')
    expect(pageSource).toContain('shouldLoadParticipantsPage')
    expect(pageSource).not.toContain('isDirectNonEntryNavigation.value && participantsPageRequest.status.value === \'idle\'')
  })

  test('keeps selected-team navigation in the page request instead of a slug lookup', () => {
    expect(pageSource).toContain('selectedTeamSlug: selectedTeamSlug.value')
    expect(teamsRouteSource).toContain('query: computed(() => ({ selectedTeamSlug: selectedTeamSlug.value }))')
    expect(teamsRouteSource).toContain('route.params.teamSlug || route.query.team')
    expect(teamsServerSource).toContain('query: AccountEventPageQuery')
    expect(teamsServerSource).toContain('query.selectedTeamSlug')
    expect(participantTeamPanelSource).not.toContain('findVisibleTeamBySlug')
  })

  test('owns the settings read and keeps admin controls on props-down/events-up boundaries', () => {
    expect(pageSource).toContain('useAccountEventPageRequest<AccountEventSettingsPage>(slug, \'settings\'')
    expect(pageSource).toContain(':page="settingsPage"')
    expect(pageSource).toContain('@updated="refreshSettingsPage"')
    expect(pageSource).toContain('includeAdminEventConfiguration: true')
    expect(settingsPanelSource).not.toContain('useAccountEventPageRequest')
    expect(settingsPanelSource).not.toContain('useRoute()')
    expect(settingsPanelSource).not.toMatch(/^\s*eventSlug\??:/m)
    expect(settingsPanelSource).toContain('page?: AccountEventSettingsPage | null')
    expect(settingsPanelSource).toContain('emit(\'updated\')')
    expect(talkControlSource).toContain('hasExistingProposal')
    expect(talkControlSource).toContain('<AppDateTimePicker')
    expect(talkControlSource).not.toContain('<AppDateTimeInput')
    expect(talkControlSource).toContain('<AdminCustomQuestionEditor')
    expect(talkControlSource).not.toContain('useApiClient')
    expect(talkControlSource).not.toContain('onMounted')
    expect(simplifiedClaimingPanelSource).toContain('initialStatus: AccountEventSimplifiedClaimingStatus')
    expect(simplifiedClaimingPanelSource).not.toMatch(/useApi(?:Data|Response)/)
    expect(simplifiedClaimingPanelSource).not.toContain('statusUrl')
    expect(configFormSource).toContain('initialSimplifiedClaimingStatus')
    expect(configFormSource).toContain('hasExistingTalkProposal')
    expect(configFormSource).toContain('emit(\'updated\')')
    expect(builderPageSource).toContain('const hasExistingTalkProposal = computed(() => settingsPage.value?.talkProposals.hasExistingProposal ?? false)')
    expect(builderWorkspaceSource).toContain('hasExistingTalkProposal?: boolean')
    expect(builderWorkspaceSource).toContain(':has-existing-talk-proposal="hasExistingTalkProposal"')
    expect(builderExtrasBoardSource).toContain('hasExistingTalkProposal?: boolean')
    expect(builderExtrasBoardSource).toContain(':has-existing-proposal="props.hasExistingTalkProposal ?? false"')
    expect(builderExtrasBoardSource).toContain('question-editor-variant="builder"')
    expect(talkControlSource).toContain(':variant="props.questionEditorVariant"')
    expect(dateTimeInputSource).toContain('<AppDateTimePicker')
    expect(dateTimeInputSource).not.toContain('datetime-local')
    expect(dateTimePickerSource).toContain(':hour-cycle="12"')
  })
})
