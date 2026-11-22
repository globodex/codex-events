import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const operationsSource = readFileSync(
  new URL('../../../../app/components/account/events/AccountEventAdminOperationsPanel.vue', import.meta.url),
  'utf8'
)
const judgePanelSource = readFileSync(
  new URL('../../../../app/components/account/events/AccountEventJudgePanel.vue', import.meta.url),
  'utf8'
)

describe('judge event page request topology', () => {
  test('removes old event GET fan-out callers while leaving mutations on their existing routes', () => {
    expect(operationsSource).toContain('page: AccountEventOperationsPage | AccountEventSubmissionsPage | null')
    expect(operationsSource).not.toContain('useAccountEventPageRequest')
    expect(operationsSource).not.toMatch(/useApi(?:Data|Response)/)
    expect(operationsSource).not.toContain('listAllPaginatedItems')
    expect(operationsSource).toContain('/api/events/${eventId.value}/actions/start-pitch')
    expect(judgePanelSource).toContain('page: AccountEventJudgingPage | null')
    expect(judgePanelSource).toContain('assignmentPage: AccountJudgeAssignmentWorkspacePage | null')
    expect(judgePanelSource).not.toContain('useAccountEventPageRequest')
  })
})
