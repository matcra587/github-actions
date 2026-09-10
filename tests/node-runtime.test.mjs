import assert from 'node:assert/strict'
import http from 'node:http'
import { test } from 'node:test'

test('GitHub clients work on the action runtime', async (t) => {
  // Import after setting the environment: the toolkit captures proxy defaults.
  const keys = [
    'http_proxy',
    'https_proxy',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'ALL_PROXY',
    'all_proxy',
    'NO_PROXY',
    'no_proxy',
    'GITHUB_API_URL',
  ]
  const previous = new Map(keys.map((key) => [key, process.env[key]]))
  const sockets = new Set()
  let proxyRequests = 0
  const target = http.createServer((_request, response) => {
    response.setHeader('content-type', 'application/json')
    response.end('{"ok":true}')
  })
  const proxy = http.createServer((request, response) => {
    proxyRequests++
    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port: target.address().port,
        path: request.url,
        method: request.method,
      },
      (result) => {
        response.writeHead(result.statusCode, result.headers)
        result.pipe(response)
      },
    )
    upstream.on('error', (error) => response.destroy(error))
    request.pipe(upstream)
  })
  for (const server of [target, proxy]) {
    server.on('connection', (socket) => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
    })
  }
  t.after(async () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    for (const socket of sockets) socket.destroy()
    await Promise.all(
      [target, proxy].map(
        (server) => new Promise((resolve) => server.close(resolve)),
      ),
    )
  })
  for (const key of keys) delete process.env[key]
  for (const server of [target, proxy]) {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  }
  process.env.http_proxy = `http://127.0.0.1:${proxy.address().port}`
  process.env.GITHUB_API_URL = 'http://github-api.invalid'
  const github = await import('@actions/github')

  await t.test(
    'default GitHub fetch uses the configured HTTP proxy',
    async () => {
      const client = github.getOctokit('local-test-token')
      const response = await client.request('GET /probe', {
        request: { signal: AbortSignal.timeout(3000) },
      })
      assert.equal(response.status, 200)
      assert.deepEqual(response.data, { ok: true })
      assert.equal(proxyRequests, 1)
    },
  )

  await t.test(
    'native fetch override works after toolkit initialisation',
    async () => {
      const client = github.getOctokit('local-test-token', {
        baseUrl: `http://127.0.0.1:${target.address().port}`,
        request: { fetch },
      })
      const response = await client.request('GET /probe', {
        request: { signal: AbortSignal.timeout(3000) },
      })
      assert.equal(response.status, 200)
      assert.deepEqual(response.data, { ok: true })
      assert.equal(proxyRequests, 1)
    },
  )
})
