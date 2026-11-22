import type { AccountEventWorkspaceTab } from '~/domains/events/account-workspace-tabs'

export function getAccountEventSeoContent(
  tab: AccountEventWorkspaceTab,
  eventName: string
) {
  switch (tab) {
    case 'overview':
      return {
        title: `${eventName} Overview | Codex Events`,
        description: `See your status, timeline, and key details for ${eventName}.`
      }
    case 'workspace':
      return {
        title: `Workspace | ${eventName} | Codex Events`,
        description: `Manage your participation, team workspace, and submission for ${eventName}.`
      }
    case 'credits':
      return {
        title: `Credits | ${eventName} | Codex Events`,
        description: `Claim or manage event credits for ${eventName}.`
      }
    case 'prizes':
      return {
        title: `Prizes | ${eventName} | Codex Events`,
        description: `See the prizes for ${eventName}.`
      }
    case 'program':
      return {
        title: `Agenda | ${eventName} | Codex Events`,
        description: `See the schedule for ${eventName}.`
      }
    case 'challenges':
      return {
        title: `Challenges | ${eventName} | Codex Events`,
        description: `Pick a challenge to work on at ${eventName}.`
      }
    case 'call-for-talks':
      return {
        title: `Call for talks | ${eventName} | Codex Events`,
        description: `Manage or review Talk proposals for ${eventName}.`
      }
    case 'gallery':
      return {
        title: `Gallery | ${eventName} | Codex Events`,
        description: `Browse event gallery photos from ${eventName}.`
      }
    case 'feedback':
      return {
        title: `Feedback | ${eventName} | Codex Events`,
        description: `Review post-event feedback for ${eventName}.`
      }
    case 'judges':
      return {
        title: `Judges | ${eventName} | Codex Events`,
        description: `See who is judging ${eventName}.`
      }
    case 'staff':
      return {
        title: `Staff | ${eventName} | Codex Events`,
        description: `See the staff supporting ${eventName}.`
      }
    case 'judging':
      return {
        title: `Judging | ${eventName} | Codex Events`,
        description: `Review your judging queue and progress for ${eventName}.`
      }
    case 'participants':
      return {
        title: `Participants | ${eventName} | Codex Events`,
        description: `Review participant applications and statuses for ${eventName}.`
      }
    case 'certificates':
      return {
        title: `Certificates | ${eventName} | Codex Events`,
        description: `Confirm who joined ${eventName} and manage participation certificates.`
      }
    case 'teams':
      return {
        title: `Teams | ${eventName} | Codex Events`,
        description: `See the teams taking part in ${eventName}.`
      }
    case 'submissions':
      return {
        title: `Submissions | ${eventName} | Codex Events`,
        description: `See team submissions and submission status for ${eventName}.`
      }
    case 'operations':
      return {
        title: `Manage ${eventName} | Codex Events`,
        description: `Run approvals, judging, and outcomes for ${eventName}.`
      }
    case 'settings':
      return {
        title: `Settings | ${eventName} | Codex Events`,
        description: `Update the configuration, terms, and judging criteria for ${eventName}.`
      }
  }
}
