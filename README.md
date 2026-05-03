# github-actions

Shared GitHub Actions for `matcra587` repositories.

> [!IMPORTANT]
> When calling actions or reusable workflows from another repo, it is
> recommended to pin `uses:` to a full commit SHA. Do not use moving tags
> such as `v1` or branch names such as `main`.

## Actions

*   [`homebrew-publish-formula`](packages/homebrew-publish-formula/README.md) —
  Render and publish a Homebrew formula from GoReleaser archives.
*   [`validate-skills`](packages/validate-skills/README.md) —
  Validate Claude Code skills, agents, commands, and the marketplace
  catalogue (frontmatter, agentskills.io spec, marketplace consistency).
  Supports per-validator scoping for named-step CI workflows.

## Reusable Workflows

### `workflow-lint.yml`

Runs `actionlint` and `zizmor` for workflow changes. The workflow installs a
pinned `actionlint` through `mise`, then runs the pinned `zizmor` action.

```yaml
on:
  pull_request:
    paths:
      - .github/**

jobs:
  workflow-lint:
    uses: matcra587/github-actions/.github/workflows/workflow-lint.yml@<reviewed-commit-sha>
    permissions:
      contents: read
      security-events: write
    with:
      actionlint-args: |-
        -color
      zizmor-inputs: ./.github/
      zizmor-persona: pedantic
      zizmor-version: "1.24.1"
      zizmor-advanced-security: true
```

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
