import * as core from '@actions/core'
import * as github from '@actions/github'
import type { GatesClient } from '@await-gates/gates'
import { retry } from '@octokit/plugin-retry'
import { throttling } from '@octokit/plugin-throttling'

export function parseRepo(repository: string): [owner: string, repo: string] {
  const [owner, repo] = repository.split('/', 2)
  if (
    owner === undefined ||
    repo === undefined ||
    owner === '' ||
    repo === ''
  ) {
    throw new Error(`repository must be owner/name, got: ${repository}`)
  }
  return [owner, repo]
}

/**
 * GatesClient backed by the GitHub REST API, with the plugin set the
 * `octokit` meta-package ships as standard: retry absorbs transient 5xx
 * failures so a network blip mid-poll doesn't fail the gate, and
 * throttling waits out rate limits (once) instead of erroring.
 * `fetchImpl` exists for tests, which inject canned responses.
 */
export function octokitClient(
  token: string,
  owner: string,
  repo: string,
  fetchImpl: typeof fetch = fetch,
): GatesClient {
  const octokit = github.getOctokit(
    token,
    {
      request: { fetch: fetchImpl },
      throttle: {
        onRateLimit: (
          retryAfter: number,
          _options: unknown,
          _octokit: unknown,
          retryCount: number,
        ) => {
          core.warning(`rate limited; retrying in ${retryAfter}s`)
          return retryCount < 1
        },
        onSecondaryRateLimit: (
          retryAfter: number,
          _options: unknown,
          _octokit: unknown,
          retryCount: number,
        ) => {
          core.warning(`secondary rate limit; retrying in ${retryAfter}s`)
          return retryCount < 1
        },
      },
    },
    retry,
    throttling,
  )
  return {
    async resolveSha(ref) {
      const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref })
      return data.sha
    },
    async latestPushRun(workflow, sha) {
      const { data } = await octokit.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: workflow,
        head_sha: sha,
        event: 'push',
        per_page: 1,
      })
      const run = data.workflow_runs[0]
      return run === undefined
        ? undefined
        : { status: run.status ?? 'queued', conclusion: run.conclusion }
    },
  }
}
