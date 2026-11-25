/**
 * Gives every script of a deployment build a name that no earlier release used.
 *
 * Browsers keep the scripts under `/_nuxt/` for a year without asking again. Vite adds the
 * stylesheets that a script preloads after it has named the script from its code, so a script whose
 * code did not change keeps its name while it points to a new stylesheet. A browser that cached the
 * old copy then loads the stylesheet of the earlier release on top of the new one. Mixing the commit
 * of the build (`GITHUB_SHA`, set in GitHub Actions) into every script name prevents that.
 * A build without it, for example a local one, names scripts by their code alone.
 */
export function releaseScriptNamesPlugin() {
  return {
    name: 'release-script-names',
    augmentChunkHash: () => process.env.GITHUB_SHA
  }
}
