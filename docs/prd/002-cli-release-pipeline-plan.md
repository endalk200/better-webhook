# Better Webhook CLI Release Pipeline Plan

## Purpose

This document captures the agreed release design for the new `2.x` Better Webhook CLI line built around the new Go/Cobra CLI.

The goal is a robust, secure, industry-standard release pipeline that supports:

- GitHub Releases
- npm
- Homebrew
- Nix

This plan is intentionally separate from the existing SDK package release flow.

## Core Decisions

### Product and command identity

- Product identity remains `better-webhook`
- Repository remains `better-webhook`
- Installed command is `bw`
- npm package is `@better-webhook/cli`
- Homebrew cask remains `better-webhook`

### Versioning and tags

- The new CLI release line starts at `2.0.0-alpha.1`
- This pipeline is for the new `2.x` CLI line only
- Release tags use the format `cli-v<semver>`
- Accepted examples:
  - `cli-v2.0.0-alpha.1`
  - `cli-v2.0.0-beta.2`
  - `cli-v2.0.0-rc.1`
  - `cli-v2.0.1`
- Rejected examples:
  - `v2.0.0`
  - `cli-v2.0.0-alpha-1`
  - `cli-v2`

Supported prerelease identifiers:

- `alpha`
- `beta`
- `rc`

Released versions are immutable:

- once published, a version is never reused
- fixes ship as a new version
- tags are the release boundary

## Release Channels

### GitHub Releases

- Publish stable releases
- Publish prereleases
- Prereleases are visible GitHub prereleases, not drafts
- Stable releases are auto-published with generated notes
- Prereleases are auto-published with generated notes

### npm

- Publish stable releases
- Publish prereleases
- Stable releases publish under dist-tag `latest`
- Prereleases publish under dist-tag `next`

User guidance:

- Stable installs can use global install:
  - `npm install -g @better-webhook/cli`
- Prereleases should not be recommended as global installs
- Prerelease testing should use:
  - `npx @better-webhook/cli@next ...`
  - `npx @better-webhook/cli@2.0.0-alpha.1 ...`

### Homebrew

- Stable only
- No prerelease Homebrew channel in the first version
- Use a custom tap cask
- Use a separate tap repository
- Update the tap by direct push from CI
- Do not use PR-based sync for the tap

### Nix

- Stable only for documented install usage
- No prerelease promotion in the first version
- Validate Nix packaging on every CLI release tag, including prereleases
- Build from source from the tagged repo state
- Do not consume GitHub Release binaries for Nix
- Public install docs should point to explicit stable tags, not `main`

## Distribution Model By Channel

### GitHub Releases

GitHub Releases are the canonical home for:

- platform archives
- checksums
- signatures
- SBOMs
- release notes

### npm distribution model

The npm path should avoid install-time downloads from GitHub Releases.

Use:

- wrapper package: `@better-webhook/cli`
- platform packages:
  - `@better-webhook/cli-darwin-arm64`
  - `@better-webhook/cli-darwin-x64`
  - `@better-webhook/cli-linux-arm64`
  - `@better-webhook/cli-linux-x64`
  - `@better-webhook/cli-windows-x64`

Rules:

- all npm package versions are derived from the release tag
- all wrapper and platform packages publish at the exact same version
- platform packages are internal implementation details
- wrapper package exposes the `bw` executable

### Homebrew distribution model

- Homebrew should install the prebuilt macOS binary via cask
- Homebrew should stay stable-only
- Homebrew should not block GitHub Release and npm publication if tap sync fails

### Nix distribution model

- `flake.nix` lives in the repo
- Nix builds from source
- Nix packaging files are maintained in normal source control

## Repository Layout

Keep the Go CLI separate from the Node workspace packaging layer.

Recommended structure:

- `apps/cli`: standalone Go module, source of truth for the `bw` binary
- `packages/cli`: npm wrapper package
- `packages/cli-*`: npm platform packages
- `flake.nix`: repo-root Nix entrypoint

Do not force the Go module to behave like a PNPM package.

## Workflow Architecture

Use one CLI release workflow triggered only by `cli-v*` tags.

This workflow should be separate from the SDK release workflow.

### High-level workflow shape

1. Validate tag and derive release metadata
2. Run mandatory verification
3. Build release artifacts
4. Smoke test direct archives
5. Assemble npm packages
6. Smoke test npm install path
7. Publish GitHub Release artifacts
8. Publish npm packages
9. Update Homebrew tap for stable releases only
10. Run Nix validation

### Required jobs

#### `verify`

Must block all publish steps.

Responsibilities:

- validate tag grammar
- derive version from tag
- run formatting checks
- run lint
- run tests
- run build checks

There is no publish override, including for prereleases.

#### `build-release-artifacts`

Responsibilities:

- build archives with GoReleaser
- generate checksums
- generate signatures
- generate SBOMs
- prepare GitHub Release assets

#### `smoke-archive`

Responsibilities:

- extract the native archive for the runner
- verify expected layout
- run `bw --version`

#### `package-npm`

Responsibilities:

- stamp npm versions from the tag version
- assemble wrapper and platform packages from built artifacts

#### `smoke-npm`

Responsibilities:

- install the built wrapper package on the current runner
- resolve the current platform package
- run `bw --version`

#### `publish-npm`

Responsibilities:

- publish stable releases to `latest`
- publish prereleases to `next`
- use npm trusted publishing

#### `publish-homebrew`

Responsibilities:

- run only for stable releases
- update the dedicated tap repo directly

Behavior:

- if this job fails, the workflow should be red
- GitHub Release and npm publication should still stand
- Homebrew is retried independently

#### `validate-nix`

Responsibilities:

- validate the flake
- ensure Nix packaging does not rot during prereleases

## Concurrency and Release Discipline

- Releases publish only from immutable `cli-v*` tags
- No official publish from branches
- No official publish from manually entered version values
- Snapshot and rehearsal flows should be separate from official publish
- Workflow concurrency should prevent overlapping releases for the same ref
- `cancel-in-progress` should remain `false` for the release workflow

## Security Baseline

The first version should include a strong supply-chain baseline.

### Required

- npm trusted publishing via GitHub OIDC
- no long-lived `NPM_TOKEN`
- Sigstore `cosign` keyless signing for release checksums
- GitHub artifact attestations for release artifacts
- SBOMs attached to GitHub Releases
- third-party GitHub Actions pinned by commit SHA
- least-privilege permissions at the job level
- verification instructions for users

### Deferred

- Apple signing and notarization
- per-npm-package SBOMs
- automated external post-release verification
- Scoop and Winget
- Homebrew prereleases
- Nix prereleases

## Build and Runtime Constraints

The initial CLI should preserve a pure-Go release model.

- release builds should use `CGO_ENABLED=0`
- no native system library dependencies in the first release pipeline
- no special musl/Alpine split in the first version unless requirements change

### Supported platform matrix

- macOS `arm64`
- macOS `x64`
- Linux `arm64`
- Linux `x64`
- Windows `x64`

Not included initially:

- Windows `arm64`
- Linux `386`
- macOS universal binaries

## Version Output Contract

### Human-facing version output

- `bw --version` prints only the semantic version

Example:

```text
2.0.0-alpha.1
```

### Machine-readable version output

Provide a machine-readable form such as `bw version --json`.

Required fields:

- `schemaVersion`
- `version`
- `commit`
- `date`
- `platform`

Rules:

- `schemaVersion` starts at `1`
- machine-readable output is an explicit compatibility contract
- release automation must fail on version drift

Required equality checks:

- tag version
- `bw --version`
- npm package versions
- GitHub Release version metadata

## Smoke Tests and Verification

Before publish:

- archive smoke test must pass
- npm smoke test must pass
- all normal verification must pass

The first version does not require automated post-release verification.

Instead, provide a manual checklist in the runbook for:

- GitHub Release asset verification
- npm version and dist-tag verification
- Homebrew tap verification on stable releases

## Failure Handling

The runbook should explicitly define failure handling.

### Rules

- never reuse a version number
- never silently mutate a published release
- prefer follow-up releases over rewriting history

### Expected handling

- bad npm stable release: deprecate if needed or publish a fixed follow-up
- bad npm prerelease: deprecate that prerelease version
- GitHub Release issue: document clearly and publish a follow-up tag if needed
- Homebrew sync failure: retry independently

## Documentation Requirements

Create two layers of documentation.

### Internal runbook

Should cover:

- how to cut a CLI release tag
- stable vs prerelease behavior
- required secrets and tokens
- how to rehearse a snapshot release
- manual verification steps
- failure handling and rollback policy

### Public docs

Should cover:

- supported install channels
- stable vs prerelease behavior
- prerelease testing guidance using `npx`
- artifact verification guidance
- release immutability policy

## Implementation Phases

### Phase 1: Normalize repository structure

- keep `apps/cli` as the standalone Go module
- add committed npm wrapper and platform package templates
- add committed Nix files
- remove stale references to the archived CLI release path

### Phase 2: Build the CLI release workflow

- add a dedicated CLI release workflow
- validate tag grammar
- derive version metadata from the tag
- configure GoReleaser for archives, checksums, signatures, SBOMs, and GitHub Release publication

### Phase 3: Add npm publication

- assemble npm packages from built artifacts
- add trusted publishing
- add smoke test install before publish

### Phase 4: Add Homebrew and Nix support

- wire stable-only Homebrew tap updates
- add repo-owned Nix flake
- validate Nix on every CLI tag

### Phase 5: Document and rehearse

- add the maintainer runbook
- update public release policy docs
- document prerelease testing via `npx`
- add snapshot rehearsal guidance

## Current Repository Notes

Important repository-specific notes discovered during planning:

- the repo docs currently describe a CLI release pipeline that is not actually implemented yet

## Open Follow-Ups

- exact token scope and secret management for direct writes to the Homebrew tap repo
- exact npm package assembly scripts and manifest templating
- exact `flake.nix` package and app output naming
- future Apple signing and notarization rollout
