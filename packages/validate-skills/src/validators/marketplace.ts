import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type { DiscoveryResult } from '@validate-skills/discover'
import { type Issue, isPlainObject } from '@validate-skills/issue'
import {
  type MarketplaceShape,
  readMarketplace,
} from '@validate-skills/parsers/marketplace'

const REQUIRED_FIELDS = ['name', 'description', 'source'] as const
const RECOMMENDED_FIELDS = ['category', 'homepage'] as const
const UNSUPPORTED_PLUGIN_FIELDS = ['skills', 'commands', 'agents'] as const

/**
 * Validates the marketplace catalogue and the plugin manifests on disk.
 *
 * `marketplace` is an optional pre-parsed `MarketplaceShape` (so the
 * caller and this validator don't both read+parse the same file). When
 * `null` and `discovery.marketplace` exists, this function reads the
 * file itself; when `null` and `discovery.marketplace` is also `null`,
 * there's nothing to validate and the function returns `[]`.
 */
export async function validateMarketplace(
  rootPath: string,
  discovery: DiscoveryResult,
  marketplace: MarketplaceShape | null = null,
): Promise<Issue[]> {
  const issues: Issue[] = []

  if (!discovery.marketplace) {
    return issues // nothing to validate; not an error per se
  }

  const mpPath = discovery.marketplace.path
  const shape = marketplace ?? (await readMarketplace(mpPath))

  if (shape.parseError !== null) {
    issues.push({
      level: 'error',
      file: mpPath,
      message: shape.parseError,
      code: 'marketplace/invalid-json',
    })
    return issues
  }

  if (!shape.rootIsObject) {
    issues.push({
      level: 'error',
      file: mpPath,
      message: 'marketplace.json root must be a JSON object',
      code: 'marketplace/not-object',
    })
    return issues
  }

  if (!shape.pluginsIsArray) {
    issues.push({
      level: 'error',
      file: mpPath,
      message: 'marketplace.json missing "plugins" array',
      code: 'marketplace/no-plugins',
    })
    return issues
  }

  // Iterate the raw plugins array (not the entries-only filtered view)
  // so we can flag entries that aren't plain objects with the right code.
  const rawPlugins = (shape.parsed as Record<string, unknown>)
    .plugins as unknown[]
  const seenNames = new Set<string>()
  const referencedSources = new Set<string>()

  rawPlugins.forEach((p, i) => {
    if (!isPlainObject(p)) {
      issues.push({
        level: 'error',
        file: mpPath,
        message: `plugins[${i}]: must be an object`,
        code: 'marketplace/entry-not-object',
      })
      return
    }
    const entry = p
    const name = typeof entry.name === 'string' ? entry.name : '?'
    const tag = `plugins[${i}] (${name})`

    for (const field of REQUIRED_FIELDS) {
      if (!entry[field]) {
        issues.push({
          level: 'error',
          file: mpPath,
          message: `${tag}: missing required field "${field}"`,
          code: 'marketplace/missing-field',
        })
      }
    }

    if (typeof entry.name === 'string') {
      if (seenNames.has(entry.name)) {
        issues.push({
          level: 'error',
          file: mpPath,
          message: `${tag}: duplicate plugin name "${entry.name}"`,
          code: 'marketplace/duplicate-name',
        })
      }
      seenNames.add(entry.name)
    }

    if (typeof entry.source === 'string') {
      const sourcePath = resolve(rootPath, entry.source)
      referencedSources.add(sourcePath)
      if (!existsSync(sourcePath)) {
        issues.push({
          level: 'error',
          file: mpPath,
          message: `${tag}: source path "${entry.source}" does not exist`,
          code: 'marketplace/source-missing',
        })
      }
    }

    for (const field of RECOMMENDED_FIELDS) {
      if (!entry[field]) {
        issues.push({
          level: 'warning',
          file: mpPath,
          message: `${tag}: missing recommended field "${field}"`,
          code: 'marketplace/missing-optional',
        })
      }
    }
  })

  // plugin.json unsupported-fields check
  for (const manifest of discovery.pluginManifests) {
    let pluginParsed: unknown
    try {
      pluginParsed = JSON.parse(await readFile(manifest.path, 'utf-8'))
    } catch (err) {
      issues.push({
        level: 'error',
        file: manifest.path,
        message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
        code: 'plugin-manifest/invalid-json',
      })
      continue
    }
    if (isPlainObject(pluginParsed)) {
      for (const field of UNSUPPORTED_PLUGIN_FIELDS) {
        if (field in pluginParsed) {
          issues.push({
            level: 'error',
            file: manifest.path,
            message: `Unsupported field "${field}" — components are auto-discovered from directories`,
            code: 'plugin-manifest/unsupported-field',
          })
        }
      }
    }
  }

  // orphan check (warning) — plugins on disk with no marketplace entry.
  // Standalone skills are NOT subject to this check by policy: only plugins
  // are publishable through the marketplace.
  for (const pluginDir of discovery.pluginDirs) {
    if (!referencedSources.has(pluginDir)) {
      issues.push({
        level: 'warning',
        file: pluginDir,
        message: `Plugin "${basename(pluginDir)}" exists on disk but no marketplace.json entry references it`,
        code: 'marketplace/orphan',
      })
    }
  }

  return issues
}
