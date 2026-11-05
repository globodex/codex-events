import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

import { certificateHarfBuzzPlugin } from '../../../tools/build/certificate-harfbuzz'

test('precompiled HarfBuzz callback forwards its pointer to the JavaScript free function', () => {
  const module = new WebAssembly.Module(readFileSync(new URL('../../../server/domains/events/harfbuzz-free.wasm', import.meta.url)))
  const pointers: number[] = []
  const instance = new WebAssembly.Instance(module, { e: { f: (pointer: number) => pointers.push(pointer) } })

  ;(instance.exports.f as (pointer: number) => void)(42)
  expect(pointers).toEqual([42])
})

test('converts the installed HarfBuzz loader to static module initialization', () => {
  const id = fileURLToPath(import.meta.resolve('satori/standalone'))
  const result = certificateHarfBuzzPlugin().transform(readFileSync(id, 'utf8'), id)

  expect(result?.code).toContain('from \'harfbuzzjs/hb.wasm?module\'')
  expect(result?.code).not.toContain('new WebAssembly.Module(kA)')
  expect(result?.code).not.toContain('t.instantiateWasm')
})

test('rejects unsupported loader changes instead of emitting a broken Worker', () => {
  expect(() => certificateHarfBuzzPlugin().transform('', '/node_modules/satori/dist/standalone.js')).toThrow('Unsupported HarfBuzz')
})
