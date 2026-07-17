import { describe, expect, test } from 'bun:test'
import { octokitClient, parseRepo } from '@await-gates/github'

/**
 * Fake fetch: serves canned JSON payloads keyed by a URL substring, and
 * records every requested URL for assertions. The retry/throttling plugins'
 * own behavior is upstream-tested; these tests cover only our adapter
 * mapping.
 */
function fakeFetch(routes: Record<string, unknown>): {
  fetchImpl: typeof fetch
  requested: string[]
} {
  const requested: string[] = []
  const fetchImpl = ((input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    requested.push(url)
    for (const [substring, payload] of Object.entries(routes)) {
      if (url.includes(substring)) {
        return Promise.resolve(
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      }
    }
    return Promise.resolve(
      new Response('{"message":"Not Found"}', { status: 404 }),
    )
  }) as typeof fetch
  return { fetchImpl, requested }
}

describe('parseRepo', () => {
  test('splits owner/name', () => {
    expect(parseRepo('matcra587/docent')).toEqual(['matcra587', 'docent'])
  })

  test.each(['docent', '/docent', 'matcra587/', ''])(
    'rejects malformed input %j',
    (input) => {
      expect(() => parseRepo(input)).toThrow(/must be owner\/name/)
    },
  )
})

describe('octokitClient', () => {
  test('resolveSha dereferences a ref to its commit sha', async () => {
    const { fetchImpl } = fakeFetch({
      '/commits/v1.2.3': { sha: 'abc123' },
    })
    const client = octokitClient('token', 'owner', 'repo', fetchImpl)
    expect(await client.resolveSha('v1.2.3')).toBe('abc123')
  })

  test('latestPushRun returns undefined when no run exists', async () => {
    const { fetchImpl } = fakeFetch({
      '/actions/workflows/test.yml/runs': { total_count: 0, workflow_runs: [] },
    })
    const client = octokitClient('token', 'owner', 'repo', fetchImpl)
    expect(await client.latestPushRun('test.yml', 'abc123')).toBeUndefined()
  })

  test('latestPushRun maps status and conclusion', async () => {
    const { fetchImpl } = fakeFetch({
      '/actions/workflows/test.yml/runs': {
        total_count: 1,
        workflow_runs: [{ status: 'completed', conclusion: 'success' }],
      },
    })
    const client = octokitClient('token', 'owner', 'repo', fetchImpl)
    expect(await client.latestPushRun('test.yml', 'abc123')).toEqual({
      status: 'completed',
      conclusion: 'success',
    })
  })

  test('latestPushRun defaults a null status to queued', async () => {
    const { fetchImpl } = fakeFetch({
      '/actions/workflows/test.yml/runs': {
        total_count: 1,
        workflow_runs: [{ status: null, conclusion: null }],
      },
    })
    const client = octokitClient('token', 'owner', 'repo', fetchImpl)
    expect(await client.latestPushRun('test.yml', 'abc123')).toEqual({
      status: 'queued',
      conclusion: null,
    })
  })

  test('latestPushRun scopes the query to push runs of the exact sha', async () => {
    const { fetchImpl, requested } = fakeFetch({
      '/actions/workflows/test.yml/runs': { total_count: 0, workflow_runs: [] },
    })
    const client = octokitClient('token', 'owner', 'repo', fetchImpl)
    await client.latestPushRun('test.yml', 'abc123')
    const url = requested[0] ?? ''
    expect(url).toContain('head_sha=abc123')
    expect(url).toContain('event=push')
    expect(url).toContain('per_page=1')
  })
})
