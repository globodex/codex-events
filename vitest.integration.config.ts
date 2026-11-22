import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '#server': fileURLToPath(new URL('./server', import.meta.url)),
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '#ai-knowledge': fileURLToPath(new URL('./shared/domains/applications/ai-knowledge.ts', import.meta.url)),
      '#proof-of-execution-links': fileURLToPath(new URL('./shared/domains/applications/proof-of-execution-links.ts', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/support/isolate-codex-auth.ts'],
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    maxWorkers: 1
  }
})
