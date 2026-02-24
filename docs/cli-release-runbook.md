# CLI Release Runbook

This runbook documents the production release flow for the `better-webhook` Go CLI.

## Release Channels

- GitHub Releases (primary artifact distribution)
- Homebrew Cask in `endalk200/homebrew-tap` (auto-updated by GoReleaser PR)
- `go install` from module source

## Versioning Strategy

- CLI releases are independent from SDK package releases.
- CLI tags use plain semver tags in the main repo: `vX.Y.Z` (example: `v3.12.0`).
- Do not use prefixed tags like `cli/vX.Y.Z` with OSS GoReleaser in this repo.

## Required Repository Secrets

In `endalk200/better-webhook` repository secrets:

- `HOMEBREW_TAP_TOKEN`
  - Fine-grained PAT or GitHub App token that can write to `endalk200/homebrew-tap`.
  - Minimum scopes/permissions:
    - Contents: Read and write
    - Pull requests: Read and write

## Required Workflow Permissions

The CLI release workflow requires:

- `contents: write` (publish GitHub release assets)
- `id-token: write` (cosign keyless signing via GitHub OIDC)

## Pre-Release Checklist

From repo root:

```bash
devbox run -- just format-check
devbox run -- just lint
devbox run -- just test
devbox run -- just build
```

Optional local smoke check (no publish):

```bash
devbox run -- go run github.com/goreleaser/goreleaser/v2@latest release --snapshot --clean --skip=publish,announce,sign,sbom
```

## Release Procedure

1. Ensure `main` is up to date and CI is green.
2. Create and push a CLI tag:

   ```bash
   git checkout main
   git pull --ff-only
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. Wait for `Release CLI` workflow to complete in `better-webhook`.
4. Confirm release assets exist in GitHub Releases, including:
   - platform archives
   - `checksums.txt`
   - SBOM files
   - `checksums.txt.sigstore.json`
5. Review the Homebrew cask PR opened in `endalk200/homebrew-tap`.
6. Merge the cask PR once checks pass.

Note: `pr-pull` labeling is for formula bottles and is not required for cask-only updates.

## Post-Release Verification

Verify release metadata:

```bash
gh release view vX.Y.Z --repo endalk200/better-webhook
```

Verify Homebrew install:

```bash
brew update
brew install --cask endalk200/tap/better-webhook
better-webhook --version
```

Verify `go install` path:

```bash
go install github.com/endalk200/better-webhook/apps/webhook-cli/cmd/better-webhook@vX.Y.Z
better-webhook --version
```

## Rollback Guidance

If a release is broken:

1. Close or revert the Homebrew tap PR if not merged.
2. If already merged, open a new cask PR pinning to the last known-good version.
3. Create a patch release (recommended) rather than deleting history.
4. If required, mark the bad GitHub release as prerelease and clearly document the issue.

## Nix Readiness Backlog

Planned next phase for Nix support:

1. Choose target destination:
   - dedicated NUR-style repo, or
   - internal nix repo.
2. Add GoReleaser `nix` pipe pointing to that repo with PR mode enabled.
3. Ensure CI environment includes `nix-hash` (required by GoReleaser nix publishing).
4. Keep archive naming stable to avoid churn in Nix derivations.
5. Add a release check that validates generated nix file changes before publish.
