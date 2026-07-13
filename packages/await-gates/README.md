# await-gates

Wait for a commit's gates before proceeding. A **gate** is a workflow file
that must have a successful push-event run for the commit. Designed for
release workflows that trigger on tag pushes: tags don't get their own CI
runs, so this action blocks until the gates covering the exact tagged
commit go green.

Behavior:

*   Resolves the ref through the API (no checkout needed; annotated tags
    dereference to their commit).
*   Fails fast when a gate concludes anything but `success`.
*   Fails with guidance when no push-event run exists for the commit — only
    pushed branch tips get gate runs, so tag a commit that was the tip of a
    push.

## Usage

```yaml
jobs:
  release:
    permissions:
      actions: read # Required to read the gate runs.
    steps:
      - name: Await gates for tagged commit
        uses: matcra587/github-actions/packages/await-gates@<reviewed-commit-sha>
        with:
          gates: test.yml lint.yml security.yml
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `gates` | (required) | Whitespace-separated workflow file names that must each succeed |
| `ref` | `github.ref_name` | Git ref or SHA to await gates for |
| `repository` | `github.repository` | Repository (owner/name) the gates run in |
| `token` | `github.token` | Token used to read workflow runs (needs `actions: read`) |
| `deadline-seconds` | `900` | Overall time budget for all gates |
| `grace-seconds` | `180` | How long to wait for a gate's run to appear |
| `poll-seconds` | `15` | Interval between polls |

## Outputs

| Output | Description |
|---|---|
| `sha` | The commit SHA the gates were verified against |

## Design notes

Gates are an explicit allowlist of workflow files, not "all check runs on
the commit": waiting on every check would couple releases to unrelated
noise (a failed Dependabot graph update, a slow third-party check). The
polling core (`src/gates.ts`) is pure — tests drive it with scripted run
payloads and a fake clock.
