import { describe, expect, test } from 'bun:test'
import {
  awaitGates,
  type Clock,
  GateError,
  type GateRun,
  type GatesClient,
} from '@await-gates/gates'

/**
 * Fake clock: sleep advances time instantly, so polling loops run their
 * full schedule without wall-clock delay.
 */
function fakeClock(): Clock {
  let seconds = 0
  return {
    now: () => seconds,
    sleep: (s) => {
      seconds += s
      return Promise.resolve()
    },
  }
}

/** Client whose per-workflow payloads play back in sequence; the last entry repeats. */
function scriptedClient(
  sha: string,
  script: Record<string, (GateRun | undefined)[]>,
): GatesClient {
  const cursors: Record<string, number> = {}
  return {
    resolveSha: () => Promise.resolve(sha),
    latestPushRun: (workflow) => {
      const payloads = script[workflow]
      if (payloads === undefined)
        throw new Error(`unscripted workflow: ${workflow}`)
      const cursor = cursors[workflow] ?? 0
      cursors[workflow] = cursor + 1
      return Promise.resolve(payloads[Math.min(cursor, payloads.length - 1)])
    },
  }
}

const options = {
  ref: 'v1.2.3',
  deadlineSeconds: 900,
  graceSeconds: 180,
  pollSeconds: 15,
}

describe('awaitGates', () => {
  test('passes when every gate succeeds and returns the resolved sha', async () => {
    const client = scriptedClient('abc123', {
      'test.yml': [{ status: 'completed', conclusion: 'success' }],
      'lint.yml': [{ status: 'completed', conclusion: 'success' }],
    })
    const sha = await awaitGates(
      client,
      { ...options, gates: ['test.yml', 'lint.yml'] },
      fakeClock(),
    )
    expect(sha).toBe('abc123')
  })

  test('polls a pending gate until it completes', async () => {
    const client = scriptedClient('abc123', {
      'test.yml': [
        { status: 'queued', conclusion: null },
        { status: 'in_progress', conclusion: null },
        { status: 'completed', conclusion: 'success' },
      ],
    })
    const sha = await awaitGates(
      client,
      { ...options, gates: ['test.yml'] },
      fakeClock(),
    )
    expect(sha).toBe('abc123')
  })

  test('fails fast on a failed gate', () => {
    const client = scriptedClient('abc123', {
      'test.yml': [{ status: 'completed', conclusion: 'failure' }],
    })
    expect(
      awaitGates(client, { ...options, gates: ['test.yml'] }, fakeClock()),
    ).rejects.toThrow(
      new GateError('test.yml gate for abc123 concluded: failure'),
    )
  })

  test('fails with tip guidance when no run appears within the grace period', () => {
    const client = scriptedClient('abc123', {
      'test.yml': [undefined],
    })
    expect(
      awaitGates(client, { ...options, gates: ['test.yml'] }, fakeClock()),
    ).rejects.toThrow(/only pushed branch tips get gate runs/)
  })

  test('times out at the deadline while a gate stays pending', () => {
    const client = scriptedClient('abc123', {
      'test.yml': [{ status: 'in_progress', conclusion: null }],
    })
    expect(
      awaitGates(client, { ...options, gates: ['test.yml'] }, fakeClock()),
    ).rejects.toThrow(
      new GateError('timed out waiting for the test.yml gate on abc123'),
    )
  })

  test('a cancelled gate reports its conclusion', () => {
    const client = scriptedClient('abc123', {
      'test.yml': [{ status: 'completed', conclusion: 'cancelled' }],
    })
    expect(
      awaitGates(client, { ...options, gates: ['test.yml'] }, fakeClock()),
    ).rejects.toThrow(
      new GateError('test.yml gate for abc123 concluded: cancelled'),
    )
  })

  test('later gates still verify after an earlier gate passes', () => {
    const client = scriptedClient('abc123', {
      'test.yml': [{ status: 'completed', conclusion: 'success' }],
      'security.yml': [{ status: 'completed', conclusion: 'timed_out' }],
    })
    expect(
      awaitGates(
        client,
        { ...options, gates: ['test.yml', 'security.yml'] },
        fakeClock(),
      ),
    ).rejects.toThrow(
      new GateError('security.yml gate for abc123 concluded: timed_out'),
    )
  })
})
