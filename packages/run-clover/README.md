# run-clover

Run [gechr/clover](https://github.com/gechr/clover) in the repository that
the job checks out, and publish updates as a pull request. `clover` must be
on the runner PATH. Run [`setup-clover`](../setup-clover/README.md) in an
earlier step of the same job.

Clover keeps version strings in arbitrary files (Dockerfiles, YAML, shell,
HCL, any file with a `clover:` comment or a sidecar) current with their
upstream sources. It complements Dependabot manifest updates. It does not
replace them.

Behavior:

*   The `run` command (default) resolves each directive. It writes the
    updates into the same files. It opens or updates one pull request with
    all of them. If a directive does not resolve, the command exits non-zero.
    The job then stops with a failure.
*   The `lint` command examines each directive offline. It writes nothing.
    Use it as a required pull request check.
*   The `format` command changes directive comments to a standard style.
    Like `run`, it publishes changes as a pull request.
*   The action publishes nothing when the working tree has no changes.
    The pull request step is a no-op. `changed` is `false`.

The caller must run `actions/checkout` first. The action operates on the
files that the job checks out. Check out with
`persist-credentials: false`. The action does not use the checkout
credentials for the push. It uses the `token` input.

## Usage

Scheduled update pull requests:

```yaml
on:
  schedule:
    - cron: "0 6 * * 1"
  workflow_dispatch:

permissions:
  contents: write # Push the clover/update branch.
  pull-requests: write # Open the pull request.

jobs:
  clover:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@<reviewed-commit-sha>
        with:
          persist-credentials: false

      - name: Set up clover
        uses: matcra587/github-actions/packages/setup-clover@<reviewed-commit-sha>
        with:
          version: "0.4.10"

      - name: Update pinned versions
        uses: matcra587/github-actions/packages/run-clover@<reviewed-commit-sha>
        with:
          version: "0.4.10"
```

Pull request check (no writes, no pull request):

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@<reviewed-commit-sha>
    with:
      persist-credentials: false

  - name: Set up clover
    uses: matcra587/github-actions/packages/setup-clover@<reviewed-commit-sha>
    with:
      version: "0.4.10"

  - name: Check clover directives
    uses: matcra587/github-actions/packages/run-clover@<reviewed-commit-sha>
    with:
      command: lint
```

## Inputs

| Input            | Default                    | Description                                                                     |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------- |
| `command`        | `run`                      | The clover command to run. Use `run`, `lint`, or `format`.                       |
| `args`           | `""`                       | Extra arguments for the clover command. Example: `--dry-run`.                   |
| `version`        | `""`                       | Clover version installed by setup-clover. The action uses it in provenance strings only. |
| `token`          | `${{ github.token }}`      | Token for the branch push and the pull request.                                 |
| `pr-branch`      | `clover/update`            | Branch for the pull request. If this branch has a pull request, the action force-updates that pull request. |
| `pr-base`        | `${{ github.ref_name }}`   | Branch that the pull request merges into.                                       |
| `pr-title`       | `chore(deps): update pinned versions` | Pull request title.                                                  |
| `pr-body`        | See `action.yml`           | Pull request body. When you set `version`, the action adds a provenance footer. |
| `pr-labels`      | `""`                       | Labels separated by commas. Each label must be in the repository before the run.  |
| `commit-message` | `chore(deps): update pinned versions` | Commit message for the update.                                       |

## Outputs

| Output    | Description                                                              |
| --------- | ------------------------------------------------------------------------ |
| `changed` | `true` when the command wrote changes to the working tree.                |
| `pr-url`  | URL of the pull request that the action opened or updated. Empty if the action did not open or update a pull request. |

## Tokens and CI runs

Pull requests with the default `GITHUB_TOKEN` start their CI runs in an
approval state. GitHub holds the runs until a user with write access gives
approval. If the CI must run without approval, use a GitHub App token (for
example `actions/create-github-app-token`) or a PAT as the `token` input.

The token must have
`contents: write` for the branch push. It must have `pull-requests: write`
for pull request creation.

## Local development

The self-test workflow tests the two actions against the `.clover.yaml` of
this repository. The `lint` job runs a check. The dry-run job resolves the
directives without writes. Run the same commands locally with a locally
installed clover.
