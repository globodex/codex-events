import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, test } from 'vitest'

import {
  collectRuntimeThirdPartyNotices,
  findInstalledPackageDirectory,
  normalizePackageLicense,
  normalizePackageUrl
} from '../../../tools/licenses/generate-third-party-notices'

const temporaryDirectories: string[] = []

function createTemporaryProject() {
  const directoryPath = mkdtempSync(join(tmpdir(), 'codex-third-party-notices-'))
  temporaryDirectories.push(directoryPath)
  return directoryPath
}

function writeJsonFile(filePath: string, value: unknown) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function writePackage(directoryPath: string, packageName: string, packageJson: Record<string, unknown>, extras?: Record<string, string>) {
  const packageDirectory = join(directoryPath, 'node_modules', ...packageName.split('/'))
  mkdirSync(packageDirectory, { recursive: true })
  writeJsonFile(join(packageDirectory, 'package.json'), {
    name: packageName,
    ...packageJson
  })

  for (const [fileName, fileContents] of Object.entries(extras ?? {})) {
    writeFileSync(join(packageDirectory, fileName), fileContents, 'utf8')
  }

  return packageDirectory
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directoryPath = temporaryDirectories.pop()

    if (!directoryPath) {
      continue
    }

    rmSync(directoryPath, {
      force: true,
      recursive: true
    })
  }
})

describe('third-party notices generator', () => {
  test('normalizes common package license shapes', () => {
    expect(normalizePackageLicense({
      license: 'Apache-2.0'
    })).toBe('Apache-2.0')

    expect(normalizePackageLicense({
      license: {
        type: 'MIT'
      }
    })).toBe('MIT')

    expect(normalizePackageLicense({
      licenses: [
        { type: 'MIT' },
        'BSD-3-Clause'
      ]
    })).toBe('MIT OR BSD-3-Clause')
  })

  test('normalizes repository and homepage URLs', () => {
    expect(normalizePackageUrl('git+https://github.com/example/pkg.git')).toBe('https://github.com/example/pkg')
    expect(normalizePackageUrl({
      url: 'git://github.com/example/pkg.git'
    })).toBe('https://github.com/example/pkg')
    expect(normalizePackageUrl('https://example.com/docs')).toBe('https://example.com/docs')
  })

  test('resolves installed packages through nested and hoisted node_modules directories', () => {
    const projectRoot = createTemporaryProject()
    const alphaDirectory = writePackage(projectRoot, 'alpha', {
      version: '1.0.0'
    })
    const nestedNodeModulesDirectory = join(alphaDirectory, 'node_modules')

    mkdirSync(nestedNodeModulesDirectory, { recursive: true })
    writePackage(alphaDirectory, 'charlie', {
      version: '3.0.0'
    })
    writePackage(projectRoot, 'bravo', {
      version: '2.0.0'
    })

    expect(findInstalledPackageDirectory('charlie', alphaDirectory)).toBe(join(alphaDirectory, 'node_modules', 'charlie'))
    expect(findInstalledPackageDirectory('bravo', alphaDirectory)).toBe(join(projectRoot, 'node_modules', 'bravo'))
  })

  test('collects the installed runtime dependency tree and excludes dev-only packages', () => {
    const projectRoot = createTemporaryProject()

    writeJsonFile(join(projectRoot, 'package.json'), {
      dependencies: {
        alpha: '^1.0.0'
      },
      devDependencies: {
        'dev-tool': '^9.0.0'
      }
    })

    const alphaDirectory = writePackage(projectRoot, 'alpha', {
      version: '1.0.0',
      license: 'Apache-2.0',
      homepage: 'https://alpha.example.com',
      repository: {
        url: 'git+https://github.com/example/alpha.git'
      },
      dependencies: {
        bravo: '^2.0.0',
        charlie: '^3.0.0'
      },
      optionalDependencies: {
        'not-installed': '^4.0.0'
      }
    }, {
      LICENSE: 'Alpha license text'
    })

    mkdirSync(join(alphaDirectory, 'node_modules'), { recursive: true })
    writePackage(projectRoot, 'bravo', {
      version: '2.0.0',
      license: {
        type: 'MIT'
      }
    }, {
      LICENCE: 'Bravo licence text',
      NOTICE: 'Bravo notice text'
    })
    writePackage(alphaDirectory, 'charlie', {
      version: '3.0.0',
      licenses: ['BSD-3-Clause']
    })
    writePackage(projectRoot, 'dev-tool', {
      version: '9.0.0',
      license: 'GPL-3.0-only'
    })

    const notices = collectRuntimeThirdPartyNotices(projectRoot)

    expect(notices).toEqual([
      expect.objectContaining({
        homepageUrl: 'https://alpha.example.com',
        license: 'Apache-2.0',
        licenseFileName: 'LICENSE',
        licenseText: 'Alpha license text',
        name: 'alpha',
        noticeFileName: null,
        noticeText: null,
        registryUrl: 'https://www.npmjs.com/package/alpha/v/1.0.0',
        repositoryUrl: 'https://github.com/example/alpha',
        version: '1.0.0'
      }),
      expect.objectContaining({
        license: 'MIT',
        licenseFileName: 'LICENCE',
        licenseText: 'Bravo licence text',
        name: 'bravo',
        noticeFileName: 'NOTICE',
        noticeText: 'Bravo notice text',
        version: '2.0.0'
      }),
      expect.objectContaining({
        license: 'BSD-3-Clause',
        name: 'charlie',
        version: '3.0.0'
      })
    ])
    expect(notices.some(notice => notice.name === 'dev-tool')).toBe(false)
  })
})
