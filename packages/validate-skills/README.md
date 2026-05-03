# validate-skills

GitHub Action that validates Claude Code skills, agents, commands, and the marketplace catalogue on every PR.

## What it checks

**Frontmatter** (per .md file)

*   File has parseable YAML frontmatter
*   Agents have a `name` field
*   All files have a `description` field

**agentskills.io spec** (per `SKILL.md`)

*   `name` ≤ 64 chars, lowercase letters/digits/hyphens, no leading/trailing/consecutive hyphens
*   `name` matches the parent directory name
*   `description` ≤ 1024 chars
*   `compatibility` ≤ 500 chars (warning)

**Marketplace consistency** (`.claude-plugin/marketplace.json` + `plugin.json` files)

*   Valid JSON, root is an object, has `plugins` array
*   Each entry has `name`, `description`, `source` (Anthropic spec)
*   No duplicate names across entries
*   Each entry's `source` path exists on disk
*   `plugin.json` files don't contain unsupported `skills`/`commands`/`agents` array fields
*   Warning: missing `category` / `homepage` (matcra587 convention, not Anthropic spec)
*   Warning: skill or plugin on disk has no marketplace entry (orphan)

## Usage

### Single invocation (runs all validators)

```yaml
name: Validate Skills
on:
  pull_request:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: matcra587/github-actions/packages/validate-skills@<sha>
```

### Per-validator named steps (per-step pass/fail in PR Checks UI)

```yaml
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Validate frontmatter
        uses: matcra587/github-actions/packages/validate-skills@<sha>
        with:
          validators: frontmatter

      - name: Validate agentskills.io spec
        uses: matcra587/github-actions/packages/validate-skills@<sha>
        with:
          validators: agentskills

      - name: Validate marketplace consistency
        uses: matcra587/github-actions/packages/validate-skills@<sha>
        with:
          validators: marketplace
```

## Inputs

| Input        | Default | Purpose                                                                                          |
|--------------|---------|--------------------------------------------------------------------------------------------------|
| `path`       | `.`     | Root directory to scan.                                                                          |
| `validators` | `all`   | Comma-separated subset of `frontmatter`, `agentskills`, `marketplace` — or `all` for the lot.    |

## Outputs

| Output          | Type   | Purpose            |
|-----------------|--------|--------------------|
| `error-count`   | number | Total errors found |
| `warning-count` | number | Total warnings found |

## Failure behaviour

The action exits non-zero iff `error-count > 0`. Warnings are advisory and do not fail the build.

## Development

```bash
cd packages/validate-skills
bun install
bun run all       # typecheck + test + bundle + check-dist
bun test          # tests only
bun run bundle    # rebuild dist/index.js
```

Test fixtures live in `__fixtures__/` with three categories per validator:

*   `good/` — passes silently
*   `triggers/` — verifies each check fires on real violations
*   `close-miss/` — verifies no false positive on edge cases

## License

MIT
