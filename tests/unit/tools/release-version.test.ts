import { describe, expect, test } from 'vitest'

import {
  parseReleaseVersionCliArgs,
  resolveReleaseVersion
} from '../../../tools/releases/release-version'

describe('release version helper', () => {
  test('derives the package version from a GitHub-style tag', () => {
    expect(resolveReleaseVersion('v1.2.3')).toBe('1.2.3')
    expect(resolveReleaseVersion('2.4.6')).toBe('2.4.6')
    expect(resolveReleaseVersion('v3.0.0-rc.1')).toBe('3.0.0-rc.1')
  })

  test('rejects invalid release tags', () => {
    expect(() => resolveReleaseVersion('release-1.2.3')).toThrow('must be a semantic version')
    expect(() => resolveReleaseVersion('v1.2')).toThrow('must be a semantic version')
  })

  test('parses CLI args for stdout-only and write modes', () => {
    expect(parseReleaseVersionCliArgs(['v1.2.3'])).toEqual({
      tagName: 'v1.2.3',
      write: false,
      packageJsonPath: 'package.json'
    })

    expect(parseReleaseVersionCliArgs(['v1.2.3', '--write', '--path', 'fixtures/package.json'])).toEqual({
      tagName: 'v1.2.3',
      write: true,
      packageJsonPath: 'fixtures/package.json'
    })
  })
})
