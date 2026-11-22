import type { ThirdPartyNoticeRecord, ThirdPartyNoticesPayload } from '../../shared/types/third-party-notices'

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

interface PackageJsonShape {
  name?: string
  version?: string
  license?: unknown
  licenses?: unknown
  homepage?: unknown
  repository?: unknown
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

const runtimeScopeLabel = 'Installed runtime dependencies from package.json and their resolved transitive dependencies.'
const licenseFilePatterns = [
  /^LICENSE$/i,
  /^LICENCE$/i,
  /^LICENSE\.[A-Za-z0-9._-]+$/i,
  /^LICENCE\.[A-Za-z0-9._-]+$/i,
  /^COPYING$/i,
  /^COPYING\.[A-Za-z0-9._-]+$/i
]
const noticeFilePatterns = [
  /^NOTICE$/i,
  /^NOTICE\.[A-Za-z0-9._-]+$/i
]

function readJsonFile<T>(filePath: string) {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function normalizePackageLicense(packageJson: PackageJsonShape) {
  if (isNonEmptyString(packageJson.license)) {
    return packageJson.license.trim()
  }

  if (Array.isArray(packageJson.licenses)) {
    const licenses = packageJson.licenses
      .flatMap((entry) => {
        if (isNonEmptyString(entry)) {
          return [entry.trim()]
        }

        if (entry && typeof entry === 'object' && 'type' in entry && isNonEmptyString(entry.type)) {
          return [entry.type.trim()]
        }

        return []
      })

    return licenses.length > 0 ? licenses.join(' OR ') : null
  }

  if (packageJson.license && typeof packageJson.license === 'object' && 'type' in packageJson.license && isNonEmptyString(packageJson.license.type)) {
    return packageJson.license.type.trim()
  }

  return null
}

function normalizeUrlCandidate(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  if (trimmedValue.startsWith('git+')) {
    return trimmedValue.slice(4).replace(/\.git$/i, '')
  }

  if (trimmedValue.startsWith('git://')) {
    return `https://${trimmedValue.slice('git://'.length).replace(/\.git$/i, '')}`
  }

  return trimmedValue.replace(/\.git$/i, '')
}

export function normalizePackageUrl(value: unknown) {
  if (isNonEmptyString(value)) {
    return normalizeUrlCandidate(value)
  }

  if (value && typeof value === 'object' && 'url' in value && isNonEmptyString(value.url)) {
    return normalizeUrlCandidate(value.url)
  }

  return null
}

function findPackageMetadataFile(directoryPath: string, patterns: RegExp[]) {
  const candidates = readdirSync(directoryPath, {
    withFileTypes: true
  })
    .filter(entry => entry.isFile() && patterns.some(pattern => pattern.test(entry.name)))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'))

  return candidates[0] ?? null
}

export function readPackageMetadataText(directoryPath: string, patterns: RegExp[]) {
  const fileName = findPackageMetadataFile(directoryPath, patterns)

  if (!fileName) {
    return {
      fileName: null,
      text: null
    }
  }

  return {
    fileName,
    text: readFileSync(join(directoryPath, fileName), 'utf8').trim()
  }
}

export function findInstalledPackageDirectory(packageName: string, startDirectory: string) {
  let currentDirectory = resolve(startDirectory)

  while (true) {
    const candidateDirectory = join(currentDirectory, 'node_modules', ...packageName.split('/'))

    try {
      if (statSync(candidateDirectory).isDirectory()) {
        return candidateDirectory
      }
    } catch {
      // Fall through to the next ancestor directory.
    }

    const parentDirectory = dirname(currentDirectory)

    if (parentDirectory === currentDirectory) {
      return null
    }

    currentDirectory = parentDirectory
  }
}

function getRegistryUrl(packageName: string, version: string) {
  return `https://www.npmjs.com/package/${encodeURIComponent(packageName)}/v/${encodeURIComponent(version)}`
}

function collectDependencyEntries(packageJson: PackageJsonShape) {
  return [
    ...Object.keys(packageJson.dependencies ?? {}).map(packageName => ({
      packageName,
      optional: false
    })),
    ...Object.keys(packageJson.optionalDependencies ?? {}).map(packageName => ({
      packageName,
      optional: true
    }))
  ].sort((left, right) => left.packageName.localeCompare(right.packageName, 'en'))
}

export function collectRuntimeThirdPartyNotices(projectRoot: string) {
  const rootDirectory = resolve(projectRoot)
  const rootPackageJson = readJsonFile<PackageJsonShape>(join(rootDirectory, 'package.json'))
  const pendingPackages = Object.keys(rootPackageJson.dependencies ?? {}).map(packageName => ({
    packageName,
    startDirectory: rootDirectory,
    optional: false
  }))
  const visitedPackageDirectories = new Set<string>()
  const collectedPackages: ThirdPartyNoticeRecord[] = []

  while (pendingPackages.length > 0) {
    const nextPackage = pendingPackages.shift()

    if (!nextPackage) {
      continue
    }

    const packageDirectory = findInstalledPackageDirectory(nextPackage.packageName, nextPackage.startDirectory)

    if (!packageDirectory) {
      if (nextPackage.optional) {
        continue
      }

      throw new Error(`Unable to resolve installed runtime dependency "${nextPackage.packageName}" from ${nextPackage.startDirectory}.`)
    }

    const packageKey = resolve(packageDirectory)

    if (visitedPackageDirectories.has(packageKey)) {
      continue
    }

    visitedPackageDirectories.add(packageKey)

    const packageJson = readJsonFile<PackageJsonShape>(join(packageDirectory, 'package.json'))
    const packageName = packageJson.name?.trim() || basename(packageDirectory)
    const packageVersion = packageJson.version?.trim()

    if (!packageVersion) {
      throw new Error(`Installed package "${packageName}" is missing a version in ${join(packageDirectory, 'package.json')}.`)
    }

    const { fileName: licenseFileName, text: licenseText } = readPackageMetadataText(packageDirectory, licenseFilePatterns)
    const { fileName: noticeFileName, text: noticeText } = readPackageMetadataText(packageDirectory, noticeFilePatterns)

    collectedPackages.push({
      homepageUrl: normalizePackageUrl(packageJson.homepage),
      license: normalizePackageLicense(packageJson),
      licenseFileName,
      licenseText,
      name: packageName,
      noticeFileName,
      noticeText,
      registryUrl: getRegistryUrl(packageName, packageVersion),
      repositoryUrl: normalizePackageUrl(packageJson.repository),
      version: packageVersion
    })

    for (const dependencyEntry of collectDependencyEntries(packageJson)) {
      pendingPackages.push({
        packageName: dependencyEntry.packageName,
        startDirectory: packageDirectory,
        optional: dependencyEntry.optional
      })
    }
  }

  return collectedPackages.sort((left, right) => {
    if (left.name === right.name) {
      return left.version.localeCompare(right.version, 'en')
    }

    return left.name.localeCompare(right.name, 'en')
  })
}

function formatGeneratedAtLabel(generatedAt: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC'
  }).format(generatedAt)
}

export function formatThirdPartyNoticesPayload(
  notices: ThirdPartyNoticeRecord[],
  generatedAt: Date = new Date()
) {
  return {
    generatedAtIso: generatedAt.toISOString(),
    generatedAtLabel: formatGeneratedAtLabel(generatedAt),
    notices,
    scopeLabel: runtimeScopeLabel
  } satisfies ThirdPartyNoticesPayload
}

export function writeThirdPartyNoticesPayload(projectRoot: string, outputPath: string) {
  const notices = collectRuntimeThirdPartyNotices(projectRoot)
  const payload = formatThirdPartyNoticesPayload(notices)

  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  return notices
}

if (import.meta.main) {
  try {
    const projectRoot = process.cwd()
    const outputPath = join(projectRoot, 'public', 'third-party-notices.generated.json')
    const notices = writeThirdPartyNoticesPayload(projectRoot, outputPath)

    process.stdout.write(`Generated ${notices.length} runtime third-party notices at ${outputPath}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate third-party notices.'
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}
