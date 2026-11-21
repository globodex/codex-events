// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  { ignores: ['storybook-static/**'] },
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
