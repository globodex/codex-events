import { readdirSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

import {
  accountEventPageNames as clientPageNames,
  accountEventPagePaths as clientPagePaths
} from '../../../../../app/domains/events/account-workspace-page'
import {
  accountEventPageNames as serverPageNames,
  accountEventPageRoutePaths as serverPagePaths,
  accountJudgeAssignmentWorkspaceRoutePath as serverAssignmentPath
} from '../../../../../server/domains/events/account-event-page-contract'
import { createAccountEventPageRouteDefinitions } from '../../../../../server/domains/events/account-event-page-routes'
import { accountPageRouteDefinitions } from '../../../../../server/domains/accounts/account-page-routes'
import {
  accountEventPageNames as sharedPageNames,
  accountEventPagePaths as sharedPagePaths,
  accountJudgeAssignmentWorkspaceRoutePath as sharedAssignmentPath
} from '../../../../../shared/domains/events/account-event-page-registry'
import {
  accountPageNames,
  accountPagePaths
} from '../../../../../shared/domains/account/account-page-registry'

const accountEventPageRouteDefinitions = createAccountEventPageRouteDefinitions('https://events.example.com')

describe('account-event page registry boundary', () => {
  test('keeps client and server page names and route paths exactly aligned', () => {
    expect(serverPageNames).toEqual(clientPageNames)
    expect(serverPagePaths).toEqual(clientPagePaths)
    expect(clientPageNames).toBe(sharedPageNames)
    expect(clientPagePaths).toBe(sharedPagePaths)
    expect(serverPageNames).toBe(sharedPageNames)
    expect(serverPagePaths).toBe(sharedPagePaths)
    expect(serverAssignmentPath).toBe(sharedAssignmentPath)
  })

  test('matches every physical event route to a named server definition', () => {
    const routeFiles = readdirSync(
      new URL('../../../../../server/api/account/events/[slug]/', import.meta.url)
    )
      .filter(fileName => fileName.endsWith('.get.ts'))
      .sort()

    expect(routeFiles).toEqual(
      [...sharedPageNames].map(pageName => `${pageName}.get.ts`).sort()
    )
    expect(Object.keys(accountEventPageRouteDefinitions).sort()).toEqual(
      [...sharedPageNames].sort()
    )

    for (const pageName of sharedPageNames) {
      expect(accountEventPageRouteDefinitions[pageName].page).toBe(pageName)
      expect(sharedPagePaths[pageName]).toContain(`/api/account/events/:slug/${pageName}`)
    }

    expect(
      readdirSync(new URL('../../../../../server/api/account/events/[slug]/judging/assignments/', import.meta.url))
    ).toContain('[assignmentId].get.ts')
  })

  test('matches global page definitions and physical routes, including prize redemption', () => {
    expect(Object.keys(accountPageRouteDefinitions).sort()).toEqual([...accountPageNames].sort())

    for (const pageName of accountPageNames) {
      expect(accountPageRouteDefinitions[pageName].page).toBe(pageName)
      expect(accountPagePaths[pageName]).toMatch(/^\/api\/(account|prize-redemptions)\//)
    }

    expect(readdirSync(new URL('../../../../../server/api/account/', import.meta.url))).toEqual(
      expect.arrayContaining(['overview.get.ts', 'judging.get.ts', 'staff-workspace.get.ts'])
    )
    expect(readdirSync(new URL('../../../../../server/api/prize-redemptions/', import.meta.url))).toContain(
      'workspace.get.ts'
    )
  })
})
