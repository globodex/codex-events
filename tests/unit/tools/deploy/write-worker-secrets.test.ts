import { describe, expect, test } from 'vitest'

import { parseScriptArgs } from '../../../../tools/deploy/write-worker-secrets'

describe('Worker secret writer', () => {
  test('parses output and merge arguments', () => {
    expect(parseScriptArgs(['secrets.json', '--merge', 'extra.json'])).toEqual({
      outputPath: 'secrets.json',
      mergePath: 'extra.json'
    })

    expect(() => parseScriptArgs([])).toThrow('Usage:')
    expect(() => parseScriptArgs(['secrets.json', '--merge'])).toThrow('Missing value for --merge')
  })
})
