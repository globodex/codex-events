import { fileURLToPath } from 'node:url'

const callbackModule = JSON.stringify(`${fileURLToPath(new URL('../../server/domains/events/harfbuzz-free.wasm', import.meta.url))}?module`)
  .replaceAll('<', '\\u003c')
  .replaceAll('>', '\\u003e')
  .replaceAll('\u2028', '\\u2028')
  .replaceAll('\u2029', '\\u2029')

export function certificateHarfBuzzPlugin() {
  return {
    name: 'certificate-harfbuzz',
    transform(code: string, id: string) {
      if (!id.replaceAll('\\', '/').endsWith('/satori/dist/standalone.js')) return

      const replace = (before: string, after: string) => {
        if (!code.includes(before)) throw new Error(`Unsupported HarfBuzz loader: missing ${before}`)
        code = code.replaceAll(before, after)
      }

      // Satori 0.63.2 inlines HarfBuzz. Changed loader sites must fail at build time.
      replace('Q=typeof window=="object"', 'Q=false')
      replace('B=typeof WorkerGlobalScope<"u"', 'B=false')
      replace('C=typeof process=="object"&&((jo=process.versions)==null?void 0:jo.node)&&process.type!="renderer"', 'C=false')
      replace('t.instantiateWasm', 'instantiateCertificateHarfBuzz')
      replace('new WebAssembly.Module(kA)', 'certificateHarfBuzzCallback(BA)')

      return {
        code: `import certificateHarfBuzzModule from 'harfbuzzjs/hb.wasm?module'
import certificateHarfBuzzFreeModule from ${callbackModule}
function instantiateCertificateHarfBuzz(imports, receiveInstance) {
  const instance = new WebAssembly.Instance(certificateHarfBuzzModule, imports)
  receiveInstance(instance)
  return instance.exports
}
function certificateHarfBuzzCallback(signature) {
  if (signature !== 'vi') throw new Error('Unsupported certificate font callback: ' + signature)
  return certificateHarfBuzzFreeModule
}
${code}`,
        map: null
      }
    }
  }
}
