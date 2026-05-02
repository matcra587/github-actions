# homebrew-publish-formula

Render and publish a Homebrew formula from GoReleaser archives and a
`checksums.txt` file. The action runs on `node24` from `dist/index.js`.

## Basic usage

```yaml
- name: Publish Homebrew formula
  uses: matcra587/github-actions/packages/homebrew-publish-formula@<reviewed-commit-sha>
  with:
    token: ${{ secrets.HOMEBREW_TAP_TOKEN }}
    tap: matcra587/homebrew-tap
    name: peerscout
    desc: Fetch live peers for Cosmos SDK chains
    homepage: https://github.com/matcra587/peerscout
    version: ${{ github.ref_name }}
```

## Advanced usage

```yaml
- name: Publish Homebrew formula
  uses: matcra587/github-actions/packages/homebrew-publish-formula@<reviewed-commit-sha>
  with:
    token: ${{ secrets.HOMEBREW_TAP_TOKEN }}
    tap: matcra587/homebrew-tap
    name: peerscout
    class: Peerscout
    desc: Fetch live peers for Cosmos SDK chains
    homepage: https://github.com/matcra587/peerscout
    version: ${{ github.ref_name }}
    license: MIT
    checksums-file: dist/checksums.txt
    archive-name-template: "{name}_{version}_{os}_{arch}.tar.gz"
    platforms: |-
      darwin/arm64
      linux/amd64
      linux/arm64
    binary-name: peerscout
    module-path: github.com/matcra587/peerscout
    build-package: "."
    head-url: https://github.com/matcra587/peerscout.git
    head-branch: main
    head-depends-on: go
    completion-args: completion
    test-args: version
    test-match: "{version}"
    livecheck: "true"
    branch: main
    commit-message: "peerscout: v{version}"
    dry-run: "false"
```

## Inputs

| Name                    | Required | Default                                | Description                                                              |
| ----------------------- | -------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `token`                 | yes      | —                                      | GitHub token with write access to the tap repository.                    |
| `tap`                   | yes      | —                                      | Tap repository in `owner/name` form.                                     |
| `name`                  | yes      | —                                      | Formula and default binary name.                                         |
| `desc`                  | yes      | —                                      | Formula description.                                                     |
| `homepage`              | yes      | —                                      | Project homepage URL.                                                    |
| `version`               | yes      | —                                      | Release version, with or without a leading `v`.                          |
| `class`                 | no       | PascalCase of `name`                   | Ruby formula class.                                                      |
| `license`               | no       | `MIT`                                  | Formula license.                                                         |
| `checksums-file`        | no       | `dist/checksums.txt`                   | Path to GoReleaser `checksums.txt`.                                      |
| `platforms`             | no       | `darwin/arm64`, `linux/amd64`, `linux/arm64` | Comma or newline separated `os/arch` list.                         |
| `archive-name-template` | no       | `{name}_{version}_{os}_{arch}.tar.gz`  | Archive filename template. Supports `{name}`, `{version}`, `{os}`, `{arch}`. |
| `binary-name`           | no       | value of `name`                        | Installed binary name.                                                   |
| `module-path`           | no       | —                                      | Go module path for HEAD ldflags.                                         |
| `build-package`         | no       | `.`                                    | Package path used for HEAD builds.                                       |
| `head-url`              | no       | `{homepage}.git`                       | HEAD source URL.                                                         |
| `head-branch`           | no       | `main`                                 | HEAD source branch.                                                      |
| `head-depends-on`       | no       | `go`                                   | Build dependency used by the HEAD stanza. Leave empty to omit.           |
| `completion-args`       | no       | `completion`                           | Args for `generate_completions_from_executable`. Empty disables completions. |
| `test-args`             | no       | `version`                              | Arguments passed to the installed binary in the formula test block.      |
| `test-match`            | no       | `{version}`                            | Expected test output. Use `{version}` to assert the formula version.     |
| `livecheck`             | no       | `true`                                 | Add a GitHub latest livecheck block.                                     |
| `branch`                | no       | tap repo default                       | Tap branch to update.                                                    |
| `commit-message`        | no       | `{name}: v{version}`                   | Commit message. Supports `{name}` and `{version}`.                       |
| `dry-run`               | no       | `false`                                | Render the formula without publishing it.                                |

## Outputs

| Name           | Description                                       |
| -------------- | ------------------------------------------------- |
| `formula-path` | Path updated in the tap repository.               |
| `commit-sha`   | Commit SHA returned by GitHub when publishing.    |
