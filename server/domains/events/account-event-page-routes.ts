import { accountEventEntryPageRoute } from './account-event-entry-page'
import { accountEventFeedbackPageRoute } from './account-event-feedback-page'
import { accountEventGalleryPageRoute } from './account-event-gallery-page'
import { accountEventJudgingPageRoute } from './account-event-judging-page'
import { accountEventOperationsPageRoute } from './account-event-operations-page'
import { accountEventParticipantsPageRoute } from './account-event-participants-page'
import { accountEventPrizesPageRoute } from './account-event-prizes-page'
import { accountEventRostersPageRoute } from './account-event-rosters-page'
import { createAccountEventSettingsPageRoute } from './account-event-settings-page'
import { accountEventSubmissionsPageRoute } from './account-event-submissions-page'
import { accountEventTeamsPageRoute } from './account-event-teams-page'
import { accountEventWorkspacePageRoute } from './account-event-workspace-page'
import { accountEventCertificatesPageRoute } from './account-event-certificates-page'

export const createAccountEventPageRouteDefinitions = (appBaseUrl: string) => ({
  entry: accountEventEntryPageRoute,
  prizes: accountEventPrizesPageRoute,
  operations: accountEventOperationsPageRoute,
  submissions: accountEventSubmissionsPageRoute,
  judging: accountEventJudgingPageRoute,
  settings: createAccountEventSettingsPageRoute(appBaseUrl),
  participants: accountEventParticipantsPageRoute,
  workspace: accountEventWorkspacePageRoute,
  teams: accountEventTeamsPageRoute,
  rosters: accountEventRostersPageRoute,
  gallery: accountEventGalleryPageRoute,
  feedback: accountEventFeedbackPageRoute,
  certificates: accountEventCertificatesPageRoute
} as const)
