import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

const workflowSource = readFileSync(
  new URL('../../../../.github/workflows/deploy-test.yml', import.meta.url),
  'utf8'
)

describe('test deployment workflow account workspace gate', () => {
  test('requires the local Chromium topology job before test deployment', () => {
    expect(workflowSource).toContain('account-workspace-topology:')
    expect(workflowSource).toContain('if: ${{ github.event_name == \'push\' || github.event_name == \'pull_request\' }}')
    expect(workflowSource).toContain('run: bun run test:bdd:account-workspace')
    expect(workflowSource).toContain('      - account-workspace-topology')
  })

  test('keeps the full BDD suite outside the push-time deployment dependency', () => {
    expect(workflowSource).toContain('bdd-suite:')
    expect(workflowSource).toContain('if: ${{ github.event_name == \'workflow_dispatch\' || github.event_name == \'schedule\' }}')
    expect(workflowSource).not.toContain('      - bdd-suite\n')
  })
})
