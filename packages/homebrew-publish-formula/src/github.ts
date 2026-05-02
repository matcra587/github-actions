import type * as github from '@actions/github'

export type Octokit = ReturnType<typeof github.getOctokit>

export function parseRepo(input: string): [owner: string, repo: string] {
  const [owner, repo, extra] = input.split('/')
  if (!owner || !repo || extra) {
    throw new Error(`invalid repository ${input}; expected owner/name`)
  }
  return [owner, repo]
}

export async function findExistingSHA(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<string | undefined> {
  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    })
    if (Array.isArray(response.data) || response.data.type !== 'file') {
      throw new Error(`${path} exists but is not a file`)
    }
    return response.data.sha
  } catch (error) {
    if (isGitHubNotFound(error)) {
      return undefined
    }
    throw error
  }
}

function isGitHubNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 404
  )
}
