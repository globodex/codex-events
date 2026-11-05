import { createRequire } from 'node:module'
import { Linter } from 'eslint'
import importX from 'eslint-plugin-import-x'
import ts from 'typescript'
import { createVueLanguagePlugin, forEachEmbeddedCode, getDefaultCompilerOptions } from '@vue/language-core'
import { expect, test } from 'vitest'

const require = createRequire(import.meta.url)

test.each([
  ['ESM', importX],
  ['CommonJS', require('eslint-plugin-import-x') as typeof importX]
])('enforces import boundaries with the patched %s plugin and minimatch 11', (_, plugin) => {
  const linter = new Linter()
  const config = {
    plugins: { imports: plugin },
    rules: { 'imports/no-internal-modules': ['error', { forbid: ['zod/**'] }] }
  } as const

  expect(linter.verify('import { z } from "zod"', config)).toEqual([])
  expect(linter.verify('import { z } from "zod/v4"', config)).toMatchObject([
    { ruleId: 'imports/no-internal-modules', messageId: 'noAllowed' }
  ])
})

test('preserves URL strings inside Vue loop scopes during type generation', () => {
  const plugin = createVueLanguagePlugin<string>(ts, {}, getDefaultCompilerOptions(), id => id)
  const source = '<script setup lang="ts">\nconst items = [{ url: "" }]\n</script>'
    + '<template><div v-for="item in items" :key="item.url">'
    + '<AppInput v-model="item.url" placeholder="https://example.com" />'
    + '</div></template>'
  const code = plugin.createVirtualCode!('/test.vue', 'vue', ts.ScriptSnapshot.fromString(source))!
  const script = [...forEachEmbeddedCode(code)].find(code => code.id === 'script_ts')!
  const generated = script.snapshot.getText(0, script.snapshot.getLength())
  const parsed = ts.createSourceFile('test.ts', generated, ts.ScriptTarget.Latest)

  expect((parsed as ts.SourceFile & { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics).toEqual([])
  expect(generated).not.toContain('https:/*')
})
