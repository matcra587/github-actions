import { describe, expect, test } from 'bun:test'
import {
  formulaClassName,
  normalizeVersion,
  parseChecksums,
  parsePlatforms,
} from '@homebrew/parse'
import { type FormulaOptions, renderFormula } from '@homebrew/render'

const checksums = parseChecksums(`
16297728580c674a7ef806bd1fd2a2cce3b0527ada00677a8f7545a87572c344  peerscout_0.4.1_darwin_arm64.tar.gz
787f41471274639f943b72a5f81e7f8a92784225bd62a3afc21f34e9c8789a96  peerscout_0.4.1_linux_amd64.tar.gz
ee0592d7d270c67f693584f3bea7158892d168666b4cac941a04a95faae04952  peerscout_0.4.1_linux_arm64.tar.gz
`)

describe('formula renderer', () => {
  test('normalizes versions', () => {
    expect(normalizeVersion('v0.4.1')).toBe('0.4.1')
    expect(normalizeVersion('0.4.1')).toBe('0.4.1')
  })

  test('derives class names from formula names', () => {
    expect(formulaClassName('peerscout')).toBe('Peerscout')
    expect(formulaClassName('pagerduty-client')).toBe('PagerdutyClient')
  })

  test('parses platform lists', () => {
    expect(parsePlatforms('darwin/arm64, linux/amd64\nlinux/arm64')).toEqual([
      { os: 'darwin', arch: 'arm64' },
      { os: 'linux', arch: 'amd64' },
      { os: 'linux', arch: 'arm64' },
    ])
  })

  test('rejects unsupported platforms', () => {
    expect(() => parsePlatforms('windows/amd64')).toThrow(
      'unsupported operating system windows',
    )
    expect(() => parsePlatforms('linux/riscv64')).toThrow(
      'unsupported architecture riscv64',
    )
  })

  test('renders a peerscout formula', () => {
    const formula = renderFormula({
      name: 'peerscout',
      desc: 'Fetch live peers for Cosmos SDK chains',
      homepage: 'https://github.com/matcra587/peerscout',
      version: '0.4.1',
      license: 'MIT',
      platforms: parsePlatforms('darwin/arm64,linux/amd64,linux/arm64'),
      checksums,
      archiveNameTemplate: '{name}_{version}_{os}_{arch}.tar.gz',
      binaryName: 'peerscout',
      modulePath: 'github.com/matcra587/peerscout',
      buildPackage: '.',
      headURL: 'https://github.com/matcra587/peerscout.git',
      headBranch: 'main',
      headDependsOn: 'go',
      completionArgs: ['completion'],
      testArgs: 'version',
      testMatch: '{version}',
      livecheck: true,
    })

    expect(formula).toContain('class Peerscout < Formula')
    expect(formula).toContain(
      'url "https://github.com/matcra587/peerscout/releases/download/v#{version}/peerscout_#{version}_darwin_arm64.tar.gz"',
    )
    expect(formula).toContain(
      'sha256 "16297728580c674a7ef806bd1fd2a2cce3b0527ada00677a8f7545a87572c344"',
    )
    expect(formula).toContain(
      'generate_completions_from_executable(bin/"peerscout", "completion")',
    )
    expect(formula).toContain(
      'assert_match version.to_s, shell_output("#{bin}/peerscout version")',
    )
    // Default case matches Homebrew best practice: no output: override and
    // no trailing build-package arg when std_go_args defaults already work.
    expect(formula).toContain(
      'system "go", "build", *std_go_args(ldflags: ldflags)',
    )
    expect(formula).not.toContain('output: bin/')
    expect(formula).not.toContain('# typed:')
    expect(formula).not.toContain('frozen_string_literal')
  })

  test('emits std_go_args overrides when binaryName or buildPackage diverge', () => {
    const formula = renderFormula({
      ...baseOptions,
      modulePath: 'github.com/matcra587/peerscout',
      headDependsOn: 'go',
      binaryName: 'pscout',
      buildPackage: './cmd/main',
    })
    expect(formula).toContain(
      'system "go", "build", *std_go_args(ldflags: ldflags, output: bin/"pscout"), "./cmd/main"',
    )
  })

  test('omits std_go_args call entirely when no overrides apply and no modulePath', () => {
    const formula = renderFormula({
      ...baseOptions,
      // no modulePath, defaults for binaryName and buildPackage
    })
    expect(formula).toContain('system "go", "build", *std_go_args\n')
    expect(formula).not.toContain('ldflags = %W[')
  })

  test('fails when a requested checksum is missing', () => {
    expect(() =>
      renderFormula({
        name: 'peerscout',
        desc: 'Fetch live peers for Cosmos SDK chains',
        homepage: 'https://github.com/matcra587/peerscout',
        version: '0.4.1',
        license: 'MIT',
        platforms: parsePlatforms('darwin/amd64'),
        checksums,
        archiveNameTemplate: '{name}_{version}_{os}_{arch}.tar.gz',
        binaryName: 'peerscout',
        buildPackage: '.',
        headURL: 'https://github.com/matcra587/peerscout.git',
        headBranch: 'main',
        completionArgs: [],
        testArgs: 'version',
        testMatch: '{version}',
        livecheck: false,
      }),
    ).toThrow('missing checksum for peerscout_0.4.1_darwin_amd64.tar.gz')
  })

  test('escapes Ruby interpolation in user-supplied fields', () => {
    const formula = renderFormula({
      ...baseOptions,
      desc: 'evil #{1 + 1} desc',
    })

    // Hostile #{...} in a literal field is neutralised...
    expect(formula).toContain('desc "evil \\#{1 + 1} desc"')
    // ...but the URL still emits a real Ruby #{version} interpolation.
    expect(formula).toContain(
      'url "https://github.com/matcra587/peerscout/releases/download/v#{version}/peerscout_#{version}_darwin_arm64.tar.gz"',
    )
    // And the test block still emits a real #{bin} interpolation.
    expect(formula).toContain(
      'assert_match version.to_s, shell_output("#{bin}/peerscout version")',
    )
  })

  test('parseChecksums rejects malformed input', () => {
    expect(() => parseChecksums('')).toThrow(
      'checksums file did not contain any checksums',
    )
    expect(() => parseChecksums('   \n   ')).toThrow(
      'checksums file did not contain any checksums',
    )
    expect(() => parseChecksums('only-one-token')).toThrow(
      'invalid checksum line',
    )
    expect(() => parseChecksums('a b c d')).toThrow('invalid checksum line')
  })

  test('rejects empty required formula fields', () => {
    expect(() => renderFormula({ ...baseOptions, desc: '' })).toThrow(
      'desc must not be empty',
    )
    expect(() => renderFormula({ ...baseOptions, homepage: '   ' })).toThrow(
      'homepage must not be empty',
    )
  })

  test('rejects non-Homebrew formula names', () => {
    expect(() => renderFormula({ ...baseOptions, name: 'Peerscout' })).toThrow(
      'name must be a lowercase Homebrew formula name',
    )
    expect(() =>
      renderFormula({ ...baseOptions, name: '-leading-dash' }),
    ).toThrow('name must be a lowercase Homebrew formula name')
  })
})

const baseOptions: FormulaOptions = {
  name: 'peerscout',
  desc: 'Fetch live peers for Cosmos SDK chains',
  homepage: 'https://github.com/matcra587/peerscout',
  version: '0.4.1',
  license: 'MIT',
  platforms: parsePlatforms('darwin/arm64'),
  checksums,
  archiveNameTemplate: '{name}_{version}_{os}_{arch}.tar.gz',
  binaryName: 'peerscout',
  buildPackage: '.',
  headURL: 'https://github.com/matcra587/peerscout.git',
  headBranch: 'main',
  completionArgs: [],
  testArgs: 'version',
  testMatch: '{version}',
  livecheck: false,
}
