// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: [
      'storybook-static/**',
      // The Nuxt ESLint preset ignores every folder named "public" ("**/public").
      // That is right only for the static files in the root public/ folder:
      // app/components/public and server/api/public hold source code.
      // The order matters: the first pattern brings every "public" folder back
      // into the lint run, the second one ignores the root folder again.
      '!**/public',
      'public/'
    ]
  },
  {
    name: 'codex-events/runtime-query-guardrails',
    files: ['server/**/*.{ts,tsx,vue}', 'app/**/*.{ts,tsx,vue}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: 'drizzle-orm',
            importNames: ['inArray'],
            message: 'Runtime queries must not use Drizzle inArray/WHERE IN. Use joins, exists-style predicates, direct equality predicates, or explicit per-row point operations instead.'
          }
        ]
      }]
    }
  }
)
