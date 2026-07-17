# github-actions

Shared GitHub Actions for `matcra587` repositories.

> [!IMPORTANT]
> When calling actions or reusable workflows from another repo, it is
> recommended to pin `uses:` to a full commit SHA. Do not use moving tags
> such as `v1` or branch names such as `main`.

## Actions

*   [`await-gates`](packages/await-gates/README.md) —
  Wait for named workflow gates to pass for a commit (composite; used by
  release workflows to gate tag publishes on the tagged commit's CI).
*   [`homebrew-publish-formula`](packages/homebrew-publish-formula/README.md) —
  Render and publish a Homebrew formula from GoReleaser archives.
*   [`validate-skills`](packages/validate-skills/README.md) —
  Validate Claude Code skills, agents, commands, and the marketplace
  catalogue (frontmatter, agentskills.io spec, marketplace consistency).
  Supports per-validator scoping for named-step CI workflows.

## Reusable Workflows

### `security.yml`

One security workflow for every repo: `actionlint` and `zizmor` for workflow
changes, `govulncheck` for Go vulnerabilities, `bun audit` for JavaScript /
TypeScript dependency advisories, `uv audit` for Python dependency
advisories, and dependency review for PR dependency diffs. Jobs gate
themselves at runtime instead of needing caller configuration:

*   A `languages` job queries linguist (the repository languages API) and
    exposes the full language set; `govulncheck` skips itself when the repo
    contains no Go, `bun audit` when it has no JavaScript/TypeScript (or no
    Bun lockfile), `uv audit` when it has no Python (or no uv.lock). New
    language scanners gate on the same output.
*   Dependency review runs only on pull requests against public repositories
    (the dependency-diff API needs GitHub Advanced Security on private repos).
*   `zizmor-advanced-security` is suppressed on private repositories, where
    GHAS code scanning is a paid feature.

To force a job off, pass `skip` — a whitespace-separated list of job names
(`actionlint`, `zizmor`, `govulncheck`, `bun-audit`, `uv-audit`,
`dependency-review`).
Entries are verified; unknown names fail the workflow rather than silently
leaving the scan running.

```yaml
on:
  pull_request:
  push:
    branches: [main]

jobs:
  security:
    uses: matcra587/github-actions/.github/workflows/security.yml@<reviewed-commit-sha>
    permissions:
      contents: read
    with:
      actionlint-args: |-
        -color
      zizmor-inputs: ./.github/
      zizmor-persona: pedantic
      zizmor-version: "1.24.1"
```

Set `zizmor-advanced-security: true` and add `security-events: write` to the
caller job permissions only when uploading SARIF to code scanning (public
repositories, or private ones would need GHAS — the workflow suppresses the
upload there regardless).

`security.yml` replaces the retired `workflow-lint.yml`; existing consumers
pinned to a `workflow-lint` commit SHA keep working, since reusable workflows
resolve against the pinned commit.

### `go-release.yml`

Publishes a Go package release on a version-tag push: waits for the caller's
gate workflows to go green for the tagged commit, composes the release body
from the tag's changie notes (emoji-decorated kind headings, the commits
since the previous tag, and a compare link), and publishes through
GoReleaser. The committed `CHANGELOG.md` stays plain — decoration exists
only in the release body.

```yaml
on:
  push:
    tags:
      - 'v[0-9]*.[0-9]*.[0-9]*'

permissions: {}

jobs:
  release:
    uses: matcra587/github-actions/.github/workflows/go-release.yml@<reviewed-commit-sha>
    permissions:
      contents: write
      actions: read
    with:
      gates: test.yml lint.yml security.yml
```

Caller contract: `.changes/<tag>.md` must exist in the tagged tree (commit
the changie batch before tagging), `.goreleaser.yaml` must not set
`changelog.disable: true` (GoReleaser silently ignores `--release-notes`
and publishes an empty body when the changelog step is disabled), and the
tagged commit must have been the tip of a pushed branch so the gate
workflows ran for its exact SHA.

## Releases

Use the `release` workflow to publish a reviewed commit.

The workflow:

1.  Installs Bun `1.3.13`.
2.  Runs `bun ci` and `bun run all`.
3.  Fails if bundled action output differs from the committed files.
4.  Creates an immutable version tag and GitHub release for the selected commit.

It does not create or move major tags such as `v1`. Release notes include the
reviewed commit SHA; consumers should pin to that SHA.

## Development

This repo uses Bun for development and Node for published action runtime.

```bash
bun install
bun run all
bun run homebrew:local
bun run validate-skills:local
```

Each action lives under `packages/<action-name>`. Add future actions, such
as a Nix publisher, as separate packages with their own `action.yml`, source,
tests, and bundled `dist/index.js`.
