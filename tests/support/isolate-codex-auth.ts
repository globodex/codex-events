import { basename } from 'node:path'

import { vi } from 'vitest'

vi.mock('node:child_process', async (importOriginal) => {
  const native = await importOriginal<typeof import('node:child_process')>()
  const spawn = vi.fn((...args: Parameters<typeof native.spawn>) => {
    if (/^codex(?:\.exe|\.cmd|\.bat)?$/i.test(basename(args[0]))) {
      throw new Error('Tests must use a fixture instead of the host Codex CLI.')
    }

    return native.spawn(...args)
  })

  return { ...native, spawn, default: { ...native.default, spawn } }
})
