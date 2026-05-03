import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as core from '@actions/core'
import { run } from '@validate-skills/main'

let tempDir: string
let outputFile: string
let summaryFile: string
const originalEnv = { ...process.env }
let originalStdoutWrite: typeof process.stdout.write

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'validate-skills-main-'))
  outputFile = join(tempDir, 'output')
  summaryFile = join(tempDir, 'summary')
  process.env.GITHUB_OUTPUT = outputFile
  process.env.GITHUB_STEP_SUMMARY = summaryFile
  // Pre-create the files synchronously (core.appendFileSync requires them)
  writeFileSync(outputFile, '')
  writeFileSync(summaryFile, '')
  // Reset the summary singleton's cached file path so it picks up the new env var
  ;(core.summary as unknown as Record<string, unknown>)._filePath = undefined
  // Suppress GitHub annotation lines (`::error::` / `::warning::`) that
  // @actions/core writes to stdout — otherwise they bubble up as real CI
  // annotations when `bun test` runs inside `bun run all` in the runner.
  // Test assertions inspect GITHUB_OUTPUT contents, not stdout, so this is safe.
  originalStdoutWrite = process.stdout.write.bind(process.stdout)
  process.stdout.write = ((chunk: unknown, ...args: unknown[]) => {
    if (typeof chunk === 'string' && chunk.startsWith('::')) {
      return true
    }
    // biome-ignore lint/suspicious/noExplicitAny: forwarding to original
    return (originalStdoutWrite as any)(chunk, ...args)
  }) as typeof process.stdout.write
})

afterEach(() => {
  process.stdout.write = originalStdoutWrite
  rmSync(tempDir, { recursive: true, force: true })
  process.env = { ...originalEnv }
})

describe('main integration', () => {
  test('runs end-to-end against good fixture and emits outputs', async () => {
    process.env.INPUT_PATH = join(
      import.meta.dir,
      '..',
      '__fixtures__',
      'marketplace',
      'good',
    )
    await run()
    const output = readFileSync(outputFile, 'utf-8')
    expect(output).toContain('error-count')
    expect(output).toMatch(/error-count<<.*\n0\n/)
  })

  test('failing fixture surfaces non-zero error-count', async () => {
    process.env.INPUT_PATH = join(
      import.meta.dir,
      '..',
      '__fixtures__',
      'marketplace',
      'triggers-broken-source',
    )
    await run()
    const output = readFileSync(outputFile, 'utf-8')
    expect(output).toMatch(/error-count<<.*\n[1-9]/)
  })

  test('non-existent path emits failure', async () => {
    process.env.INPUT_PATH = join(tempDir, 'does-not-exist')
    await run()
    // core.setFailed records a failure but does not throw; in a test
    // context process.exitCode is set to 1.
    expect(process.exitCode).toBe(1)
    process.exitCode = 0 // reset for next test
  })
})
