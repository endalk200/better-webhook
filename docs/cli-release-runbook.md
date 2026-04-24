# CLI Release Runbook

This runbook covers the new `2.x` Better Webhook CLI line released from `cli-v*` tags.

## Release boundary

- Official CLI releases publish only from immutable `cli-v<semver>` tags.
- Accepted prerelease identifiers are `alpha`, `beta`, and `rc`.
- Examples:
  - `cli-v2.0.0-alpha.1`
  - `cli-v2.0.0-beta.2`
  - `cli-v2.0.0-rc.1`
  - `cli-v2.0.1`
- Never reuse a version number. Fixes always ship as a new tag.

## Release outputs

- GitHub Releases:
  - canonical home for archives, checksums, Sigstore bundles, SBOMs, and notes
- npm:
  - `@better-webhook/cli`
  - `@better-webhook/cli-darwin-arm64`
  - `@better-webhook/cli-darwin-x64`
  - `@better-webhook/cli-linux-arm64`
  - `@better-webhook/cli-linux-x64`
  - `@better-webhook/cli-windows-x64`
- Homebrew:
  - stable only, pushed directly to `endalk200/tap`
- Nix:
  - validated on every CLI tag
  - documented for stable installs only

## Before you tag

- Run local verification:

```bash
devbox run -- pnpm install --frozen-lockfile
devbox run -- pnpm run format:check
devbox run -- pnpm run lint
devbox run -- pnpm run check-types
devbox run -- pnpm run test
devbox run -- pnpm run build
devbox run -- pnpm run test:cli-release
devbox run -- just cli-format-check
devbox run -- just cli-lint
devbox run -- just cli-test
```

- Confirm the release docs and install guidance are current.
- Confirm the Homebrew tap token is available as `HOMEBREW_TAP_TOKEN`.
- Confirm npm trusted publishing is configured for all six CLI packages.

## Snapshot rehearsal

Use a non-publishing rehearsal before cutting a real tag:

```bash
devbox run -- just release-cli cli-v2.0.0-alpha.1
```

This runs GoReleaser in snapshot mode, reusing the same tag parser and version metadata used by CI. It should not publish GitHub Releases, npm packages, or Homebrew updates.

## Cutting a release

1. Choose the exact tag.
2. Create and push it:

```bash
git tag cli-v2.0.0-alpha.1
git push origin cli-v2.0.0-alpha.1
```

3. Watch `.github/workflows/release-cli.yml`.

## Stable vs prerelease behavior

- Stable tags publish:
  - GitHub Release
  - npm `latest`
  - Homebrew cask update
  - Nix validation
- Prerelease tags publish:
  - GitHub prerelease
  - npm `next`
  - Nix validation
- Prereleases do not publish Homebrew updates in the first version.

## Manual verification after publish

GitHub Releases:

- Confirm the release exists on the expected `cli-v*` tag.
- Confirm archives exist for:
  - `bw-darwin-arm64.tar.gz`
  - `bw-darwin-x64.tar.gz`
  - `bw-linux-arm64.tar.gz`
  - `bw-linux-x64.tar.gz`
  - `bw-windows-x64.zip`
- Confirm `checksums.txt`, Sigstore bundle, and SBOM assets are attached.

npm:

- Confirm the wrapper and all five platform packages published at the exact same version.
- Confirm stable uses dist-tag `latest`.
- Confirm prerelease uses dist-tag `next`.
- Smoke check:

```bash
npx @better-webhook/cli@<version> --version
```

Homebrew:

- Stable only:

```bash
brew update
brew install --cask endalk200/tap/better-webhook
bw --version
```

Nix:

- Confirm `nix flake check` succeeded for the tagged repo state.

## Failure handling

- GitHub Release or npm problem:
  - do not reuse the version
  - document the issue
  - publish a follow-up tag
- Bad npm prerelease:
  - deprecate that prerelease if needed
  - cut a new prerelease tag
- Homebrew sync failure:
  - retry independently against `endalk200/tap`
  - do not republish GitHub Release or npm artifacts
- Never mutate an existing published release in place.
