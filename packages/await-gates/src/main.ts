import * as core from '@actions/core'
import { awaitGates } from '@await-gates/gates'
import { octokitClient, parseRepo } from '@await-gates/github'

function parseGates(lines: string[]): string[] {
  const gates = lines
    .flatMap((line) => line.split(/\s+/))
    .filter((name) => name !== '')
  if (gates.length === 0) {
    throw new Error('gates input is empty — list the workflow files to await')
  }
  return gates
}

function parseSeconds(name: string): number {
  const raw = core.getInput(name)
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got: ${raw}`)
  }
  return value
}

export async function run(): Promise<void> {
  const gates = parseGates(core.getMultilineInput('gates', { required: true }))
  const ref = core.getInput('ref', { required: true })
  const [owner, repo] = parseRepo(
    core.getInput('repository', { required: true }),
  )
  const client = octokitClient(
    core.getInput('token', { required: true }),
    owner,
    repo,
  )

  const sha = await awaitGates(
    client,
    {
      gates,
      ref,
      deadlineSeconds: parseSeconds('deadline-seconds'),
      graceSeconds: parseSeconds('grace-seconds'),
      pollSeconds: parseSeconds('poll-seconds'),
    },
    {
      now: () => performance.now() / 1000,
      sleep: (seconds) =>
        new Promise((resolve) => setTimeout(resolve, seconds * 1000)),
    },
    core.info,
  )

  core.setOutput('sha', sha)
}
