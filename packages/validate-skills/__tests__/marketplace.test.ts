import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { discover } from '@validate-skills/discover'
import { validateMarketplace } from '@validate-skills/validators/marketplace'

const FIXTURE = join(import.meta.dir, '..', '__fixtures__', 'marketplace')

async function runOn(subdir: string) {
  const root = join(FIXTURE, subdir)
  const discovery = await discover(root)
  return validateMarketplace(root, discovery)
}

describe('validateMarketplace', () => {
  test('good marketplace passes silently', async () => {
    const issues = await runOn('good')
    expect(issues.filter((i) => i.level === 'error')).toEqual([])
    expect(issues.filter((i) => i.level === 'warning')).toEqual([])
  })

  test('invalid JSON triggers ERROR', async () => {
    const issues = await runOn('triggers-invalid-json')
    expect(issues.some((i) => i.code === 'marketplace/invalid-json')).toBe(true)
  })

  test('root array triggers ERROR', async () => {
    const issues = await runOn('triggers-root-array')
    expect(issues.some((i) => i.code === 'marketplace/not-object')).toBe(true)
  })

  test('missing plugins array triggers ERROR', async () => {
    const issues = await runOn('triggers-no-plugins')
    expect(issues.some((i) => i.code === 'marketplace/no-plugins')).toBe(true)
  })

  test('entry missing required fields triggers ERROR', async () => {
    const issues = await runOn('triggers-missing-fields')
    expect(
      issues.some(
        (i) =>
          i.code === 'marketplace/missing-field' &&
          i.message.includes('description'),
      ),
    ).toBe(true)
    expect(
      issues.some(
        (i) =>
          i.code === 'marketplace/missing-field' &&
          i.message.includes('source'),
      ),
    ).toBe(true)
  })

  test('duplicate names trigger ERROR', async () => {
    const issues = await runOn('triggers-duplicate')
    expect(issues.some((i) => i.code === 'marketplace/duplicate-name')).toBe(
      true,
    )
  })

  test('broken source path triggers ERROR', async () => {
    const issues = await runOn('triggers-broken-source')
    expect(issues.some((i) => i.code === 'marketplace/source-missing')).toBe(
      true,
    )
  })

  test('plugin.json with skills/commands fields triggers ERROR', async () => {
    const issues = await runOn('triggers-unsupported-fields')
    expect(
      issues.some(
        (i) =>
          i.code === 'plugin-manifest/unsupported-field' &&
          i.message.includes('skills'),
      ),
    ).toBe(true)
    expect(
      issues.some(
        (i) =>
          i.code === 'plugin-manifest/unsupported-field' &&
          i.message.includes('commands'),
      ),
    ).toBe(true)
  })

  test('missing category/homepage triggers WARNING', async () => {
    const issues = await runOn('warns-missing-optional')
    expect(
      issues.some(
        (i) =>
          i.code === 'marketplace/missing-optional' &&
          i.level === 'warning' &&
          i.message.includes('category'),
      ),
    ).toBe(true)
    expect(
      issues.some(
        (i) =>
          i.code === 'marketplace/missing-optional' &&
          i.level === 'warning' &&
          i.message.includes('homepage'),
      ),
    ).toBe(true)
  })

  test('top-level skill does NOT trigger orphan (only plugins are publishable)', async () => {
    const issues = await runOn('warns-orphan')
    const orphans = issues.filter((i) => i.code === 'marketplace/orphan')
    expect(orphans).toEqual([])
  })

  test('orphan plugin triggers WARNING (not ERROR)', async () => {
    const issues = await runOn('warns-orphan-plugin')
    const orphan = issues.find((i) => i.code === 'marketplace/orphan')
    expect(orphan).toBeDefined()
    expect(orphan?.level).toBe('warning')
  })
})
