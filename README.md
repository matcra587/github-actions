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

*   A `context` job resolves repo facts the scanners gate on — the linguist
    language set and the repo visibility; `govulncheck` skips itself when
    the repo contains no Go, `bun audit` when it has no JavaScript/
    TypeScript (or no Bun lockfile), `uv audit` when it has no Python (or
    no uv.lock). New language scanners gate on the same outputs.
*   Dependency review runs only on pull requests against public repositories
    (the dependency-diff API needs GitHub Advanced Security on private repos).
*   `sarif: true` uploads zizmor, govulncheck, and uv audit results to
    GitHub code scanning, and enables CodeQL analysis (language matrix from
    linguist — interpreted languages with `build-mode: none`, Go with
    `autobuild`); everything is suppressed
    on private repositories, where GHAS code scanning is a paid feature.
    Failing on findings is unchanged (govulncheck's SARIF pass is
    artifact-only; uv audit's SARIF mode fails on findings itself).

To force a job off, pass `skip` — a whitespace-separated list of job names
(`actionlint`, `zizmor`, `govulncheck`, `bun-audit`, `uv-audit`, `codeql`,
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

Set `sarif: true` and add `security-events: write` to the caller job
permissions only when uploading SARIF to code scanning (public repositories;
private ones would need GHAS — the workflow suppresses the upload there
regardless).

`security.yml` replaces the retired `workflow-lint.yml`; existing consumers
pinned to a `workflow-lint` commit SHA keep working, since reusable workflows
resolve against the pinned commit.

### `go-ci.yml`

One Go pipeline for every Go repo. Five working jobs — `lint`, `test`,
`cross-compile`, `race`, and an input `validate` — plus a `go-ci` job that
aggregates them into a single check.

It owns the canonical `go test` flags — `-shuffle=on` everywhere, `-race` and
`-coverpkg` in the dedicated job — so adding a flag once applies it to every
consumer that does not override them. **`test-args` and `race-args` replace the
defaults wholesale rather than appending**, so a caller passing
`test-args: "-run TestFoo ./..."` silently loses `-shuffle=on`. Prefer `skip`
over narrowing the args.

*   `os` and `go-versions` are JSON arrays. An empty `go-versions` entry falls
    back to `go-version-file`, so `'["", "stable"]'` tests the pinned toolchain
    plus the current stable release. `fail-fast: false`, so one failing cell
    never cancels the rest.
*   `lint` has no separate `go vet` step: golangci-lint's `default: standard`
    set already includes `govet`. (`cross-compile` does run it, for a reason
    given below.) `go build` *is* run per-OS, since build tags and syscalls do
    differ across platforms.
*   Race and coverage share one job. Coverage lands in the job summary and as
    an artifact; `coverage-threshold` gates the total locally, with no
    third-party uploader.
*   The `lint` job also runs the `fmt --diff`, `go mod tidy -diff` and
    `go fix -diff ./...` checks. Each carries `!cancelled()`, so a golangci-lint
    failure does not hide the other three.
*   `go fix -diff` **replaces golangci-lint's `modernize` linter** — remove it
    from `.golangci.yml` when migrating rather than running both. Repos that
    already ran the linter should see close to nothing; repos that didn't will
    have a backlog to clear with `go fix ./...` first.
*   `cross-compile-targets` runs `go build` **and** `go vet` for each
    `GOOS/GOARCH` pair, so a broken target surfaces on the PR rather than at
    release (`vet` because `build` alone does not typecheck `_test.go` files for
    the target). Caveat: it verifies a plain `CGO_ENABLED=0 go build`, **not**
    the GoReleaser build that actually ships, so release-only flags or tags can
    still break at tag time.
*   `setup-go` exports `GOTOOLCHAIN=local`, so a `go` or `toolchain` directive
    in `go.mod` never pulls a different toolchain than the one installed. One
    consequence: a `go-versions` entry older than `go.mod`'s `go` line fails
    loudly rather than silently upgrading itself, and `"stable"` is a duplicate
    cell whenever the pinned version already is stable.

To force a check off, pass `skip` — a whitespace-separated list of `deps`,
`lint`, `tidy`, `modernize`, `test`, `race`, `cross-compile`. Entries are
verified; an unknown name fails the workflow rather than silently leaving the
check running. Note `deps`, `tidy` and `modernize` are steps inside the `lint`
job, not jobs of their own.

**Private modules.** `go mod download` and `go mod tidy` ignore `go.work` and
resolve module requirements over the network, so a repo with private module
paths must set `goprivate`:

```yaml
    with:
      goprivate: github.com/myorg/*
```

That keeps matching paths off the module proxy and checksum database, and
configures git to fetch them with a token. The default token is the caller's
`GITHUB_TOKEN`, which only reaches the calling repo — for private modules in
*other* repositories, pass a PAT or App token:

```yaml
    secrets:
      MODULE_TOKEN: ${{ secrets.MY_PAT }}
```

**Go 1.26 is required for `modernize`.** `go fix` gained `-diff` in 1.26; skip
that check on older toolchains.

```yaml
on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.event_name == 'push' && github.sha || github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    uses: matcra587/github-actions/.github/workflows/go-ci.yml@<reviewed-commit-sha>
    permissions:
      contents: read
    with:
      os: '["ubuntu-latest", "macos-latest", "windows-latest"]'
      go-versions: '["", "stable"]'
      cross-compile-targets: '["darwin/arm64", "linux/arm64", "windows/amd64"]'
      coverage-threshold: 60
```

The `concurrency` block is the caller's job, not this workflow's. Keying push
runs on the SHA rather than the ref means rapid pushes cancel each other's PR
runs but never cancel a gate that a release tag is waiting on.

**Caller contract:** the test jobs run `go test ./...` with no build tags, so
any suite that touches a network service, a live API, or a container must be
behind a build tag (`//go:build integration`, `live`, and so on) or it will run
on every pull request.

**Require the `go-ci` check in branch protection, not the individual jobs.**
Matrix legs produce per-cell check names that change whenever a caller edits
`os` or `go-versions`, and `skip`ped jobs never report at all — so neither can
be required directly without breaking the ruleset. The `required` job
aggregates them into one stable check that fails if any job failed or was
cancelled, and passes when a job was deliberately skipped.

Security scanning stays in `security.yml`; nothing here duplicates it.

Commands run directly rather than through `mise run`. GitHub caps annotations
at ten per step and mise emits no `::group::` or `::error::` markers, so folding
the pipeline into one task step costs inline PR feedback, collapsible logs and
log search.

`go-ci.yml` replaces the retired `go-test.yml` and `go-lint.yml`; existing
consumers pinned to those commit SHAs keep working, since reusable workflows
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
3.  Fails if any bundled action is missing from git or differs from the
    committed files.
4.  Creates an immutable version tag and GitHub release for the selected commit.

Versions are recorded per kind. Actions are npm packages and carry their own
`packages/<name>/package.json`. Reusable workflows are not packages, so theirs
live in `.github/workflow-versions.json` — bump the version there, then dispatch
the release. `security.yml` predates this and still uses a `package.json`
anchor; it moves separately.

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
