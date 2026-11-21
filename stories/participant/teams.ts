import type { TeamSummaryRecord } from '~/domains/teams/workspace'

export const openToolsTeam: TeamSummaryRecord = {
  id: 'open-tools',
  eventId: 'build-day',
  name: 'Open Tools',
  slug: 'open-tools',
  bio: 'We are making a small tool to find related notes in different workspaces.',
  workspaceMode: 'team',
  isOpenToJoinRequests: true,
  createdByUserId: 'person-open-tools',
  createdAt: '2026-12-05T09:00:00Z',
  updatedAt: '2026-12-05T09:00:00Z',
  activeMemberCount: 2
}
