/**
 * Core gate-await logic, decoupled from octokit and real time so tests can
 * drive it with scripted payloads and a fake clock.
 */

export interface GateRun {
  status: string
  conclusion: string | null
}

export interface GatesClient {
  /** Resolve a ref (branch, tag, or SHA) to a commit SHA. Annotated tags dereference. */
  resolveSha(ref: string): Promise<string>
  /** Latest push-event run of a workflow file for a commit, or undefined if none exists yet. */
  latestPushRun(workflow: string, sha: string): Promise<GateRun | undefined>
}

export interface Clock {
  /** Monotonic seconds. */
  now(): number
  sleep(seconds: number): Promise<void>
}

export interface AwaitGatesOptions {
  /** Gates: workflow files that must each have a successful push run. */
  gates: string[]
  ref: string
  deadlineSeconds: number
  graceSeconds: number
  pollSeconds: number
}

export class GateError extends Error {}

/**
 * Wait for every gate to complete successfully for the commit `ref`
 * resolves to. Returns the resolved SHA. Throws GateError when a gate
 * fails, never appears within the grace period, or the overall deadline
 * elapses.
 */
export async function awaitGates(
  client: GatesClient,
  options: AwaitGatesOptions,
  clock: Clock,
  log: (message: string) => void = () => {},
): Promise<string> {
  const sha = await client.resolveSha(options.ref)
  const deadline = clock.now() + options.deadlineSeconds

  for (const gate of options.gates) {
    log(`awaiting ${gate} gate for ${sha}`)
    const grace = clock.now() + options.graceSeconds

    for (;;) {
      const run = await client.latestPushRun(gate, sha)

      if (run === undefined) {
        if (clock.now() > grace) {
          throw new GateError(
            `no push run of ${gate} found for ${sha} — only pushed branch tips get gate runs; tag a commit that was the tip of a push`,
          )
        }
      } else if (run.status === 'completed') {
        if (run.conclusion === 'success') {
          log(`${gate} gate succeeded for ${sha}`)
          break
        }
        throw new GateError(
          `${gate} gate for ${sha} concluded: ${run.conclusion ?? 'unknown'}`,
        )
      }

      if (clock.now() > deadline) {
        throw new GateError(`timed out waiting for the ${gate} gate on ${sha}`)
      }
      await clock.sleep(options.pollSeconds)
    }
  }

  return sha
}
