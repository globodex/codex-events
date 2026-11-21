import { dirname, join } from 'node:path'

import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

import { resolveLocalBddD1StateRoot } from './tests/bdd/support/local-d1-state'
import { getBaseUrl } from './tests/bdd/support/personas'

const runDirectory = dirname(resolveLocalBddD1StateRoot())
const origin = new URL(getBaseUrl())

if (process.env.CODEX_EVENTS_BDD !== '1') {
  throw new Error('Start Playwright BDD with bun run test:bdd.')
}

export default defineConfig({
  fullyParallel: true,
  globalSetup: './tests/bdd/support/preflight.ts',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: join(runDirectory, 'report') }]
  ],
  outputDir: join(runDirectory, 'results'),
  use: {
    ...devices['Desktop Chrome'],
    baseURL: origin.origin,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'public', features: 'public' },
    { name: 'authenticated', features: 'authenticated', workers: 1 },
    { name: 'destructive', features: 'authenticated-destructive', workers: 1 }
  ].map(({ name, features, workers }) => ({
    name,
    workers,
    testDir: defineBddConfig({
      features: `tests/bdd/features/${features}/**/*.feature`,
      steps: 'tests/bdd/steps/**/*.ts',
      outputDir: join(runDirectory, 'generated', features)
    }),
    testMatch: ['**/*.spec.js']
  })),
  webServer: {
    command: `nuxt dev --dotenv /dev/null --host 127.0.0.1 --port ${origin.port}`,
    url: origin.origin,
    reuseExistingServer: false,
    timeout: 120_000
  }
})
