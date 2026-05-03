import { describe, expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { validateAgentskills } from '@validate-skills/validators/agentskills'

const FIXTURE = join(import.meta.dir, '..', '__fixtures__', 'agentskills')

describe('validateAgentskills', () => {
  test('good skill passes silently', async () => {
    const issues = await validateAgentskills({
      type: 'skill',
      path: join(FIXTURE, 'good', 'sample-skill', 'SKILL.md'),
    })
    expect(issues).toEqual([])
  })

  test('name >64 chars triggers ERROR', async () => {
    const issues = await validateAgentskills({
      type: 'skill',
      path: join(FIXTURE, 'triggers', 'name-too-long', 'SKILL.md'),
    })
    expect(
      issues.some(
        (i) => i.code === 'agentskills/name-too-long' && i.level === 'error',
      ),
    ).toBe(true)
  })

  test('invalid name pattern triggers ERROR', async () => {
    const issues = await validateAgentskills({
      type: 'skill',
      path: join(FIXTURE, 'triggers', 'wrong-name-pattern', 'SKILL.md'),
    })
    expect(
      issues.some(
        (i) => i.code === 'agentskills/name-pattern' && i.level === 'error',
      ),
    ).toBe(true)
  })

  test('name mismatches parent dir triggers ERROR', async () => {
    const issues = await validateAgentskills({
      type: 'skill',
      path: join(FIXTURE, 'triggers', 'name-mismatches-dir', 'SKILL.md'),
    })
    expect(
      issues.some(
        (i) =>
          i.code === 'agentskills/name-dir-mismatch' && i.level === 'error',
      ),
    ).toBe(true)
  })

  test('description >1024 chars triggers ERROR', async () => {
    const issues = await validateAgentskills({
      type: 'skill',
      path: join(FIXTURE, 'triggers', 'description-too-long', 'SKILL.md'),
    })
    expect(
      issues.some(
        (i) =>
          i.code === 'agentskills/description-too-long' && i.level === 'error',
      ),
    ).toBe(true)
  })

  test('compatibility >500 chars triggers WARNING (not ERROR)', async () => {
    const issues = await validateAgentskills({
      type: 'skill',
      path: join(FIXTURE, 'triggers', 'compatibility-too-long', 'SKILL.md'),
    })
    const issue = issues.find(
      (i) => i.code === 'agentskills/compatibility-too-long',
    )
    expect(issue).toBeDefined()
    expect(issue?.level).toBe('warning')
  })

  test('close-miss: name exactly 64 chars passes silently', async () => {
    const dirs = readdirSync(join(FIXTURE, 'close-miss'))
    const exactly64 = dirs.find((d) => d.length === 64)
    if (exactly64 === undefined) throw new Error('close-miss fixture missing')
    const issues = await validateAgentskills({
      type: 'skill',
      path: join(FIXTURE, 'close-miss', exactly64, 'SKILL.md'),
    })
    expect(issues.filter((i) => i.code.startsWith('agentskills/'))).toEqual([])
  })

  test('non-skill files are skipped (return empty)', async () => {
    const issues = await validateAgentskills({
      type: 'agent',
      path: join(FIXTURE, 'good', 'sample-skill', 'SKILL.md'),
    })
    expect(issues).toEqual([])
  })
})
