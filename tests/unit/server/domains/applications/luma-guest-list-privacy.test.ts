import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

const repositoryRoot = fileURLToPath(new URL('../../../../../', import.meta.url))

// Guest emails and statuses of the private Luma guest list must never reach a client.
// Only these modules may touch the table. Every other module gets counts from `countEventLumaGuests`.
const modulesAllowedToTouchTheGuestTable = [
  'server/database/schema.ts',
  'server/domains/applications/luma-guest-list.ts',
  'server/domains/applications/luma-guest-list-sync.ts'
]

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return sourceFiles(path)
    }

    return /\.(?:ts|vue)$/u.test(entry.name) ? [path] : []
  })
}

test('only the guest list modules read or write the private Luma guest table', () => {
  const modulesTouchingTheGuestTable = ['server', 'shared', 'app']
    .flatMap(directory => sourceFiles(join(repositoryRoot, directory)))
    .filter(file => /eventLumaGuests|event_luma_guests/u.test(readFileSync(file, 'utf8')))
    .map(file => relative(repositoryRoot, file).split(sep).join('/'))
    .sort()

  expect(modulesTouchingTheGuestTable).toEqual([...modulesAllowedToTouchTheGuestTable].sort())
})
