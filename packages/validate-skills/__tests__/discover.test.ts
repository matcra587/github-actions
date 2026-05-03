import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { discover } from '@validate-skills/discover'

const FIXTURE = join(import.meta.dir, '..', '__fixtures__', 'discover')

describe('discover', () => {
  test('classifies skills, agents, commands, plugin manifests, and marketplace', async () => {
    const result = await discover(FIXTURE)

    const skillPaths = result.frontmatter
      .filter((f) => f.type === 'skill')
      .map((f) => f.path)
      .sort()
    expect(skillPaths).toEqual([
      join(
        FIXTURE,
        'plugins',
        'sample-plugin',
        'skills',
        'nested-skill',
        'SKILL.md',
      ),
      join(FIXTURE, 'skills', 'sample-skill', 'SKILL.md'),
    ])

    const agentPaths = result.frontmatter
      .filter((f) => f.type === 'agent')
      .map((f) => f.path)
    expect(agentPaths).toEqual([
      join(FIXTURE, 'plugins', 'sample-plugin', 'agents', 'agent-a.md'),
    ])

    const commandPaths = result.frontmatter
      .filter((f) => f.type === 'command')
      .map((f) => f.path)
    expect(commandPaths).toEqual([
      join(FIXTURE, 'plugins', 'sample-plugin', 'commands', 'cmd-a.md'),
    ])

    expect(result.pluginManifests.map((p) => p.path)).toEqual([
      join(
        FIXTURE,
        'plugins',
        'sample-plugin',
        '.claude-plugin',
        'plugin.json',
      ),
    ])

    expect(result.marketplace?.path).toBe(
      join(FIXTURE, '.claude-plugin', 'marketplace.json'),
    )

    expect(result.skillDirs.sort()).toEqual([
      join(FIXTURE, 'plugins', 'sample-plugin', 'skills', 'nested-skill'),
      join(FIXTURE, 'skills', 'sample-skill'),
    ])

    expect(result.pluginDirs).toEqual([
      join(FIXTURE, 'plugins', 'sample-plugin'),
    ])
  })

  test('does NOT classify .md files inside skill/references as agents/commands', async () => {
    // The notes.md inside skills/sample-skill/references/ must not appear
    // in any frontmatter list.
    const result = await discover(FIXTURE)
    const allPaths = result.frontmatter.map((f) => f.path)
    expect(allPaths.every((p) => !p.includes('/references/'))).toBe(true)
  })

  test('returns empty results for an empty directory', async () => {
    const result = await discover(join(import.meta.dir, '..', 'src')) // src/ has no markers
    expect(result.frontmatter).toEqual([])
    expect(result.pluginManifests).toEqual([])
    expect(result.marketplace).toBeNull()
    expect(result.skillDirs).toEqual([])
    expect(result.pluginDirs).toEqual([])
  })
})
