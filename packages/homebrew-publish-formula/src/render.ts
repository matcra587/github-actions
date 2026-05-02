import {
  archiveName,
  formulaClassName,
  homebrewArchBlocks,
  type Platform,
  type SupportedArch,
  supportedOSes,
} from '@homebrew/parse'

type HomebrewArchBlock = (typeof homebrewArchBlocks)[SupportedArch]

// Private-use-area sentinels survive JSON.stringify intact and won't appear
// in real input, so rubyString can escape every literal #{ while still
// emitting the deliberate #{version}/#{bin} interpolations we need.
const VERSION_TOKEN = '\u{E000}VERSION\u{E000}'
const BIN_TOKEN = '\u{E000}BIN\u{E000}'

export interface FormulaOptions {
  name: string
  className?: string
  desc: string
  homepage: string
  version: string
  license: string
  platforms: Platform[]
  checksums: Map<string, string>
  archiveNameTemplate: string
  binaryName: string
  modulePath?: string
  buildPackage: string
  headURL: string
  headBranch: string
  headDependsOn?: string
  completionArgs: string[]
  testArgs: string
  testMatch: string
  livecheck: boolean
}

export function renderFormula(options: FormulaOptions): string {
  validateFormulaOptions(options)

  const className = options.className || formulaClassName(options.name)
  const lines: string[] = [
    `class ${className} < Formula`,
    `  desc ${rubyString(options.desc)}`,
    `  homepage ${rubyString(options.homepage)}`,
    `  version ${rubyString(options.version)}`,
    `  license ${rubyString(options.license)}`,
    '',
  ]

  if (options.livecheck) {
    lines.push(
      '  livecheck do',
      '    url :stable',
      '    strategy :github_latest',
      '  end',
      '',
    )
  }

  lines.push(
    '  head do',
    `    url ${rubyString(options.headURL)}, branch: ${rubyString(options.headBranch)}`,
  )
  if (options.headDependsOn) {
    lines.push(`    depends_on ${rubyString(options.headDependsOn)} => :build`)
  }
  lines.push('  end', '')

  renderPlatformBlocks(lines, options)

  lines.push('  def install', '    if build.head?')
  renderHeadInstall(lines, options)
  lines.push(
    '    else',
    `      bin.install ${rubyString(options.binaryName)}`,
    '    end',
  )

  if (options.completionArgs.length > 0) {
    const args = options.completionArgs.map(rubyString).join(', ')
    lines.push(
      '',
      `    generate_completions_from_executable(bin/${rubyString(options.binaryName)}, ${args})`,
    )
  }

  lines.push('  end', '', '  test do')
  const expected =
    options.testMatch === '{version}'
      ? 'version.to_s'
      : rubyString(options.testMatch)
  const testCommand = `${BIN_TOKEN}/${options.binaryName}${options.testArgs ? ` ${options.testArgs}` : ''}`
  lines.push(
    `    assert_match ${expected}, shell_output(${rubyString(testCommand)})`,
    '  end',
    'end',
    '',
  )

  return lines.join('\n')
}

function renderPlatformBlocks(lines: string[], options: FormulaOptions): void {
  for (const os of supportedOSes) {
    const platforms = options.platforms.filter((platform) => platform.os === os)
    if (platforms.length === 0) {
      continue
    }

    lines.push(os === 'darwin' ? '  on_macos do' : '  on_linux do')
    for (const platform of platforms) {
      const archBlock = homebrewArchBlock(platform.arch)
      const concreteArchive = archiveName(options.archiveNameTemplate, {
        name: options.name,
        version: options.version,
        os: platform.os,
        arch: platform.arch,
      })
      const rubyArchive = archiveName(options.archiveNameTemplate, {
        name: options.name,
        version: VERSION_TOKEN,
        os: platform.os,
        arch: platform.arch,
      })
      const sha = options.checksums.get(concreteArchive)
      if (!sha) {
        throw new Error(`missing checksum for ${concreteArchive}`)
      }

      const url = `${options.homepage}/releases/download/v${VERSION_TOKEN}/${rubyArchive}`
      lines.push(
        `    ${archBlock} do`,
        `      url ${rubyString(url)}`,
        `      sha256 ${rubyString(sha)}`,
        '    end',
      )
    }
    lines.push('  end', '')
  }
}

function renderHeadInstall(lines: string[], options: FormulaOptions): void {
  const stdArgs: string[] = []

  if (options.modulePath) {
    lines.push(
      '      head_version = Utils.safe_popen_read("git", "describe", "--tags", "--abbrev=0").strip.delete_prefix("v")',
      '      commits_ahead = Utils.safe_popen_read("git", "rev-list", "v#{head_version}..HEAD", "--count").strip',
      '      head_version = "#{head_version}-#{commits_ahead}" if commits_ahead != "0"',
      '      ldflags = %W[',
      '        -s -w',
      `        -X ${options.modulePath}/internal/version.Version=#{head_version}`,
      `        -X ${options.modulePath}/internal/version.Commit=#{Utils.git_short_head}`,
      `        -X ${options.modulePath}/internal/version.Branch=HEAD`,
      `        -X ${options.modulePath}/internal/version.BuildTime=#{time.iso8601}`,
      `        -X ${options.modulePath}/internal/version.BuildBy=homebrew`,
      '      ]',
    )
    stdArgs.push('ldflags: ldflags')
  }

  // Only emit overrides when they diverge from std_go_args / `go build` defaults.
  if (options.binaryName !== options.name) {
    stdArgs.push(`output: bin/${rubyString(options.binaryName)}`)
  }
  const stdArgsCall = stdArgs.length > 0 ? `(${stdArgs.join(', ')})` : ''
  const pkgArg =
    options.buildPackage === '.' ? '' : `, ${rubyString(options.buildPackage)}`

  lines.push(`      system "go", "build", *std_go_args${stdArgsCall}${pkgArg}`)
}

function validateFormulaOptions(options: FormulaOptions): void {
  for (const field of [
    'name',
    'desc',
    'homepage',
    'version',
    'license',
    'binaryName',
    'buildPackage',
    'headURL',
    'headBranch',
  ] as const) {
    if (options[field].trim().length === 0) {
      throw new Error(`${field} must not be empty`)
    }
  }

  if (!/^[a-z0-9][a-z0-9-]*$/.test(options.name)) {
    throw new Error('name must be a lowercase Homebrew formula name')
  }
}

function homebrewArchBlock(arch: SupportedArch): HomebrewArchBlock {
  return homebrewArchBlocks[arch]
}

function rubyString(value: string): string {
  return JSON.stringify(value)
    .replaceAll('#{', '\\#{')
    .replaceAll(VERSION_TOKEN, '#{version}')
    .replaceAll(BIN_TOKEN, '#{bin}')
}
