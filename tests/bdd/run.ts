import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { join } from 'node:path'

import { getStablePersonas } from './support/personas.ts'
import { seedPlatformFixtures } from './support/platform-fixtures.ts'

const loopback = '127.0.0.1'
const passThrough = [
  'PATH', 'HOME', 'USERPROFILE', 'SystemRoot', 'TMPDIR', 'TEMP', 'TMP',
  'CI', 'PLAYWRIGHT_BROWSERS_PATH', 'FORCE_COLOR', 'NO_COLOR'
]

async function localOrigin() {
  const server = createServer()
  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, loopback, () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Could not reserve a loopback port for BDD.'))
        return
      }
      server.close(error => error ? reject(error) : resolve(address.port))
    })
  })
  return `http://${loopback}:${port}`
}

async function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const executable = join(process.cwd(), 'node_modules', '.bin', command)
  const result = await Bun.spawn([executable, ...args], {
    env,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  }).exited

  if (result !== 0) {
    throw new Error(`${command} exited with status ${result}.`)
  }
}

async function runSuite(args: string[]) {
  const root = join(process.cwd(), '.wrangler')
  await mkdir(root, { recursive: true })
  const directory = await mkdtemp(join(root, 'bdd-'))
  const env = Object.fromEntries(passThrough.map(name => [name, process.env[name]]))
  env.CODEX_EVENTS_BDD = '1'
  env.CODEX_EVENTS_BDD_RUN_DIR = directory
  env.LOCAL_D1_STATE_ROOT = join(directory, 'state')

  try {
    env.BDD_BASE_URL = await localOrigin()
    env.NUXT_AUTH0_APP_BASE_URL = env.BDD_BASE_URL
    env.NUXT_MCP_ALLOWED_HOSTNAMES = loopback
    env.NUXT_MCP_ALLOWED_ORIGIN_HOSTNAMES = loopback
    env.NUXT_MCP_RESOURCE_URL = `${env.BDD_BASE_URL}/mcp`
    seedPlatformFixtures(getStablePersonas(), env)
    await run('bddgen', [], env)
    await run('playwright', ['test', ...args], env)
    await rm(directory, { recursive: true, force: true })
  } catch (error) {
    await rm(env.LOCAL_D1_STATE_ROOT, { recursive: true, force: true })
    await rm(join(directory, 'nuxt'), { recursive: true, force: true })
    await rm(join(directory, 'generated'), { recursive: true, force: true })
    console.error(`BDD artifacts: ${directory}`)
    throw error
  }
}

const [mode, ...filters] = process.argv.slice(2)
if (mode === 'topology') {
  await runSuite(['--project', 'authenticated', '--grep', '@task-432-5-7', ...filters])
} else if (mode === 'destructive') {
  await runSuite(['--project', 'destructive', ...filters])
} else {
  const args = mode === undefined ? [] : [mode, ...filters]
  await runSuite(['--project', 'public', '--project', 'authenticated', ...args])
  await runSuite(['--project', 'destructive', ...args])
}
