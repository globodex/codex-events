import { createRequire } from 'node:module'
import { resolve } from 'node:path'

export const localWranglerConfigPath = resolve(process.cwd(), 'wrangler.jsonc')
export const localD1StateRoot = resolve(
  process.cwd(),
  process.env.LOCAL_D1_STATE_ROOT?.trim() || '.wrangler/state'
)
// Wrangler D1 CLI writes to `<persist>/v3/d1`, while getPlatformProxy writes to `<persist>/d1`.
// Point proxy persistence at `<LOCAL_D1_STATE_ROOT>/v3` so both read/write the same DB files.
export const localPlatformPersistPath = resolve(localD1StateRoot, 'v3')

type WranglerModule = typeof import('wrangler')
const require = createRequire(import.meta.url)

async function loadWranglerModule() {
  return require('wrangler') as WranglerModule
}

export async function createLocalPlatformProxy(options?: {
  configPath?: string
  persist?: boolean | { path: string }
}) {
  const { getPlatformProxy } = await loadWranglerModule()
  const useTestBindings = process.env.CODEX_EVENTS_BDD === '1'

  return await getPlatformProxy({
    configPath: options?.configPath ?? localWranglerConfigPath,
    ...(useTestBindings && { envFiles: [], remoteBindings: false }),
    persist: options?.persist ?? {
      path: localPlatformPersistPath
    }
  })
}
