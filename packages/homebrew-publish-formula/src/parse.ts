export const supportedOSes = ['darwin', 'linux'] as const
export const homebrewArchBlocks = {
  amd64: 'on_intel',
  x86_64: 'on_intel',
  arm64: 'on_arm',
  aarch64: 'on_arm',
} as const

export type SupportedOS = (typeof supportedOSes)[number]
export type SupportedArch = keyof typeof homebrewArchBlocks

export interface Platform {
  os: SupportedOS
  arch: SupportedArch
}

export function normalizeVersion(version: string): string {
  const normalized = version.trim().replace(/^v/, '')
  if (normalized.length === 0) {
    throw new Error('version must not be empty')
  }
  return normalized
}

export function formulaClassName(name: string): string {
  const className = name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

  if (!/^[A-Z][A-Za-z0-9]*$/.test(className)) {
    throw new Error(`could not derive a valid formula class from ${name}`)
  }

  return className
}

export function parsePlatforms(input: string): Platform[] {
  const platforms = input
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const [os, arch, extra] = value.split('/')
      if (!os || !arch || extra) {
        throw new Error(`invalid platform ${value}; expected os/arch`)
      }
      if (!isSupportedOS(os)) {
        throw new Error(`unsupported operating system ${os}`)
      }
      if (!isSupportedArch(arch)) {
        throw new Error(`unsupported architecture ${arch}`)
      }
      return { os, arch }
    })

  if (platforms.length === 0) {
    throw new Error('at least one platform is required')
  }

  return platforms
}

export function parseList(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean)
}

export function parseChecksums(input: string): Map<string, string> {
  const checksums = new Map<string, string>()

  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      continue
    }

    const [sha, filename, extra] = trimmed.split(/\s+/)
    if (!sha || !filename || extra) {
      throw new Error(`invalid checksum line: ${line}`)
    }
    checksums.set(filename, sha)
  }

  if (checksums.size === 0) {
    throw new Error('checksums file did not contain any checksums')
  }

  return checksums
}

export function archiveName(
  template: string,
  values: {
    name: string
    version: string
    os: string
    arch: string
  },
): string {
  return template
    .replaceAll('{name}', values.name)
    .replaceAll('{version}', values.version)
    .replaceAll('{os}', values.os)
    .replaceAll('{arch}', values.arch)
}

function isSupportedOS(value: string): value is SupportedOS {
  return supportedOSes.includes(value as SupportedOS)
}

function isSupportedArch(value: string): value is SupportedArch {
  return value in homebrewArchBlocks
}
