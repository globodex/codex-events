import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

test('precompiled HarfBuzz callback forwards its pointer to the JavaScript free function', () => {
  const module = new WebAssembly.Module(readFileSync(new URL('../../../server/domains/events/harfbuzz-free.wasm', import.meta.url)))
  const pointers: number[] = []
  const instance = new WebAssembly.Instance(module, { e: { f: (pointer: number) => pointers.push(pointer) } })

  ;(instance.exports.f as (pointer: number) => void)(42)
  expect(pointers).toEqual([42])
})
