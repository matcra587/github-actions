# setup-clover

Install [gechr/clover](https://github.com/gechr/clover) on the runner PATH.
The action verifies the download. It does not run clover commands. Use it
with [`run-clover`](../run-clover/README.md). Or run `clover` in your own
steps.

Behavior:

*   The action resolves the runner OS and architecture. It selects the
    release archive for that OS and architecture.
*   The action downloads the release for the `version` input. It checks the
    archive against the release `checksums.txt`.
*   If the checksum does not match, the job stops with a failure. The job
    also stops when `checksums.txt` has no entry for the archive.
*   The action adds the binary directory to `GITHUB_PATH`. `clover` then
    resolves in all subsequent steps of the job. The action also reports the
    binary path and the installed tag as outputs.

## Usage

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@<reviewed-commit-sha>

  - name: Set up clover
    id: setup
    uses: matcra587/github-actions/packages/setup-clover@<reviewed-commit-sha>
    with:
      version: "0.4.10"

  - name: Use clover in later steps
    run: clover lint
```

## Inputs

| Input     | Default | Description                                                              |
| --------- | ------- | ------------------------------------------------------------------------ |
| `version` | (required) | Clover release version to install. Write it with or without a `v` at the start. |
| `token`   | `${{ github.token }}` | Token for the release download and the attestation check.     |
| `attest`  | `false` | Also verify the archive with `gh attestation verify`.                     |

## Outputs

| Output    | Description                                          |
| --------- | ---------------------------------------------------- |
| `bin`     | Absolute path of the installed clover binary.         |
| `version` | The clover release tag that the action installed.     |

## Supply chain

The archive comes from the `gechr/clover` release for the `version` input.
The action checks the archive against the release `checksums.txt`. If the
checksum does not match, the job stops with a failure. The job also stops
when `checksums.txt` has no entry for the archive.

`attest: true` also verifies the archive with `gh attestation verify`. The
check requires an attestation with the release workflow identity. At this
time, clover releases have no artifact attestations. With this input, you
can turn on the check at a subsequent time. Until upstream publishes
attestations, the check stops the job with a failure.

Checksum verification protects the download. It does not protect against a
compromised release. A compromised release can also change `checksums.txt`.
Pin `version` to one release. Change the value only through review.

## Platforms

This repository tests `ubuntu-latest` and `macos-latest` (Intel and ARM).
Checksum verification uses Node crypto. It works the same on each runner.
Windows runners should work. `unzip` and `gh` are available in the Git Bash
environment. The repository does not test Windows runners.
