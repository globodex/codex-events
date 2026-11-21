import { lstatSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

export function resolveLocalBddD1StateRoot(environment: NodeJS.ProcessEnv = process.env) {
  const runDirectory = environment.CODEX_EVENTS_BDD_RUN_DIR
  if (!runDirectory || !isAbsolute(runDirectory) || runDirectory !== resolve(runDirectory)) {
    throw new Error('BDD requires an absolute run directory from the BDD launcher.')
  }

  const stateRoot = join(runDirectory, 'state')
  if (environment.LOCAL_D1_STATE_ROOT !== stateRoot) {
    throw new Error('LOCAL_D1_STATE_ROOT must equal the state directory of the current BDD run.')
  }

  if (!lstatSync(runDirectory, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error('BDD run directory must be an existing directory.')
  }

  const stateDirectory = lstatSync(stateRoot, { throwIfNoEntry: false })
  if (stateDirectory && !stateDirectory.isDirectory()) {
    throw new Error('BDD state directory must be a directory.')
  }

  return stateRoot
}
