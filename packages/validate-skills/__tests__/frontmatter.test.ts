import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { validateFrontmatter } from '@validate-skills/validators/frontmatter'

const FIXTURE = join(import.meta.dir, '..', '__fixtures__', 'frontmatter')

describe('validateFrontmatter', () => {
  test('good agent passes silently', async () => {
    const issues = await validateFrontmatter({
      type: 'agent',
      path: join(FIXTURE, 'good', 'agent', 'agent-good.md'),
    })
    expect(issues).toEqual([])
  })

  test('good command passes silently', async () => {
    const issues = await validateFrontmatter({
      type: 'command',
      path: join(FIXTURE, 'good', 'command-good.md'),
    })
    expect(issues).toEqual([])
  })

  test('good skill passes silently', async () => {
    const issues = await validateFrontmatter({
      type: 'skill',
      path: join(FIXTURE, 'good', 'skill-good.md'),
    })
    expect(issues).toEqual([])
  })

  test('no frontmatter triggers ERROR', async () => {
    const issues = await validateFrontmatter({
      type: 'skill',
      path: join(FIXTURE, 'triggers', 'no-frontmatter.md'),
    })
    expect(issues).toHaveLength(1)
    expect(issues[0]?.level).toBe('error')
    expect(issues[0]?.code).toBe('frontmatter/missing')
  })

  test('agent missing name triggers ERROR', async () => {
    const issues = await validateFrontmatter({
      type: 'agent',
      path: join(FIXTURE, 'triggers', 'agent-missing-name.md'),
    })
    expect(issues.some((i) => i.code === 'frontmatter/missing-name')).toBe(true)
  })

  test('missing description triggers ERROR', async () => {
    const issues = await validateFrontmatter({
      type: 'skill',
      path: join(FIXTURE, 'triggers', 'missing-description.md'),
    })
    expect(
      issues.some((i) => i.code === 'frontmatter/missing-description'),
    ).toBe(true)
  })

  test('YAML parse error triggers ERROR', async () => {
    const issues = await validateFrontmatter({
      type: 'skill',
      path: join(FIXTURE, 'triggers', 'yaml-parse-error.md'),
    })
    expect(issues.some((i) => i.code === 'frontmatter/yaml-parse')).toBe(true)
  })
})
