import type { Dirent } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'

export type FrontmatterFile = {
  type: 'agent' | 'command' | 'skill'
  path: string
}

export type PluginManifest = {
  type: 'plugin-manifest'
  path: string
  pluginRoot: string
}

export type MarketplaceFile = {
  type: 'marketplace'
  path: string
}

export type DiscoveryResult = {
  frontmatter: FrontmatterFile[]
  pluginManifests: PluginManifest[]
  marketplace: MarketplaceFile | null
  skillDirs: string[]
  pluginDirs: string[]
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '__fixtures__'])

function classifyMd(filePath: string): FrontmatterFile['type'] | null {
  const normalised = filePath.replace(/\\/g, '/')
  // SKILL.md inside any */skills/<name>/SKILL.md → skill
  if (
    basename(filePath) === 'SKILL.md' &&
    /\/skills\/[^/]+\/SKILL\.md$/.test(normalised)
  ) {
    return 'skill'
  }
  // Inside skill content (e.g. skills/foo/references/bar.md) → not classified
  const inSkillContent =
    /\/skills\/[^/]+\/.+\.md$/.test(normalised) &&
    basename(filePath) !== 'SKILL.md'
  if (inSkillContent) return null
  // Otherwise, top-level agents/ or commands/ in plugin
  if (/\/agents\/[^/]+\.md$/.test(normalised)) return 'agent'
  if (/\/commands\/[^/]+\.md$/.test(normalised)) return 'command'
  return null
}

export async function discover(rootPath: string): Promise<DiscoveryResult> {
  const frontmatter: FrontmatterFile[] = []
  const pluginManifests: PluginManifest[] = []
  const skillDirs: string[] = []
  const pluginDirs: string[] = []
  let marketplace: MarketplaceFile | null = null

  async function walk(dir: string): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.md')) {
          const type = classifyMd(fullPath)
          if (type) {
            frontmatter.push({ type, path: fullPath })
            if (type === 'skill') {
              skillDirs.push(fullPath.slice(0, -'/SKILL.md'.length))
            }
          }
        } else if (
          entry.name === 'marketplace.json' &&
          dir.endsWith('.claude-plugin')
        ) {
          marketplace = { type: 'marketplace', path: fullPath }
        } else if (
          entry.name === 'plugin.json' &&
          dir.endsWith('.claude-plugin')
        ) {
          const pluginRoot = dir.slice(0, -'/.claude-plugin'.length)
          pluginManifests.push({
            type: 'plugin-manifest',
            path: fullPath,
            pluginRoot,
          })
          pluginDirs.push(pluginRoot)
        }
      }
    }
  }

  await walk(rootPath)
  return { frontmatter, pluginManifests, marketplace, skillDirs, pluginDirs }
}
