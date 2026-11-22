import { accountOverviewPageRoute } from './account-overview-page'
import { accountAdminPageRoute, accountStaffPageRoute } from './account-event-dashboards'
import { accountJudgeInboxPageRoute } from '#server/domains/judging/account-judge-inbox-page'
import { accountPrizeRedemptionsPageRoute } from '#server/domains/prize-redemptions/account-workspace-page'

export const accountPageRouteDefinitions = {
  'admin-workspace': accountAdminPageRoute,
  'overview': accountOverviewPageRoute,
  'judging': accountJudgeInboxPageRoute,
  'staff-workspace': accountStaffPageRoute,
  'prize-redemptions-workspace': accountPrizeRedemptionsPageRoute
} as const
