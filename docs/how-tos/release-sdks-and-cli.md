# How To Release SDKs and CLI

This runbook covers the two release paths in this repo:

- SDK packages: Changesets release PR, then publish from `main`.
- CLI: annotated `cli/v*` tag, then publish GitHub Release artifacts and npm packages.

Run every local command through Devbox.

## Release SDK Packages

Use this flow for `@better-webhook/core`, adapters, providers, and `@better-webhook/otel`.

### 1. Prepare the Change

Add or update the SDK code and tests. If the change affects public SDK behavior or published APIs, review docs under `apps/docs/content`.

Add a changeset:

```bash
devbox run -- pnpm changeset
```

Select every affected public SDK package and choose the semver bump. Use an empty changeset only when the PR touches release-watched files but should not publish an SDK package:

```bash
devbox run -- pnpm changeset --empty
```

Do not manually edit SDK package versions or SDK changelogs in the feature PR. Changesets generates those in the release PR.

### 2. Verify Locally

Run the full release-quality check set:

```bash
devbox run -- pnpm run format:check
devbox run -- pnpm run lint
devbox run -- pnpm run check-types
devbox run -- pnpm run test
devbox run -- pnpm run build
```

The SDK release workflow itself runs lint, type check, test, and build after the Trivy gate. It does not run `format:check`, so run formatting checks before merging.

If formatting fails, apply it and rerun the checks:

```bash
devbox run -- pnpm run format:write
```

For a narrow package check, use:

```bash
devbox run -- pnpm --filter @better-webhook/core run build
devbox run -- pnpm --filter @better-webhook/core run check-types
devbox run -- pnpm --filter @better-webhook/core run lint
devbox run -- pnpm --filter @better-webhook/core run test
```

Replace `@better-webhook/core` with the package being released.

### 3. Merge the Feature PR

Merge the feature PR to `main` with its changeset file.

The `Release SDK Packages` workflow runs on `main`. If unpublished changesets exist, Changesets opens or updates a release PR named `chore: release packages`.

### 4. Review the Release PR

Review the release PR for:

- Correct package version bumps.
- Correct changelog entries.
- Correct workspace dependency updates.
- Docs changes when SDK behavior changed.
- Passing CI and release workflow checks.

The actual local command behind the versioning step is:

```bash
devbox run -- pnpm run changeset:version
```

You usually do not need to run it manually because the GitHub workflow handles the release PR.

### 5. Publish

Merge the release PR to `main`.

The next `Release SDK Packages` workflow run publishes packages with:

```bash
devbox run -- pnpm release:publish
```

through `changesets/action`.

After publish, verify npm:

```bash
devbox run -- npm view @better-webhook/core version dist-tags --json
devbox run -- npm view @better-webhook/express version dist-tags --json
devbox run -- npm view @better-webhook/github version dist-tags --json
```

Check every package included in the release, not only these examples.

## Release the CLI

Use this flow for `@better-webhook/cli` and its native platform packages. The CLI is not released by Changesets.

### 1. Choose the Version

Edit both version locations so they match:

- `packages/cli/package.json`
- `packages/cli/internal/cli/version.go`

Use beta prereleases for beta tags:

```text
2.0.0-beta.3
```

Use stable semver for stable tags:

```text
2.0.0
```

CLI prereleases must use the `beta` channel. Other prerelease identifiers are rejected by `release:check`.

### 2. Verify the CLI Locally

Run the CLI check set:

```bash
devbox run -- pnpm --filter @better-webhook/cli run format:check
devbox run -- pnpm --filter @better-webhook/cli run lint
devbox run -- pnpm --filter @better-webhook/cli run check-types
devbox run -- pnpm --filter @better-webhook/cli run test
```

Build and smoke-test the local binary:

```bash
devbox run -- pnpm --filter @better-webhook/cli run build
devbox run -- pnpm --filter @better-webhook/cli run cli:built -- version --verbose
```

Run full repo verification before merging:

```bash
devbox run -- pnpm run format:check
devbox run -- pnpm run lint
devbox run -- pnpm run check-types
devbox run -- pnpm run test
devbox run -- pnpm run build
```

### 3. Run the Dry Run Workflow

Before publishing, run the manual GitHub workflow:

```text
CLI Release Dry Run
```

It validates formatting, linting, type checks, tests, GoReleaser snapshot packaging, generated npm package directories, and `npm pack --dry-run` for every CLI npm package.

### 4. Merge to Main

Merge the CLI release commit to `main`.

Do not tag an unmerged commit. The release validator checks that the tagged commit is reachable from `origin/main`.

### 5. Create an Annotated Tag

Fetch and check out the merged `main` commit:

```bash
devbox run -- git fetch origin main --tags
devbox run -- git checkout main
devbox run -- git pull --ff-only origin main
```

Create an annotated tag matching the CLI version:

```bash
devbox run -- git tag -a cli/v2.0.0-beta.3 -m "CLI v2.0.0-beta.3"
```

For a stable release:

```bash
devbox run -- git tag -a cli/v2.0.0 -m "CLI v2.0.0"
```

Push the tag:

```bash
devbox run -- git push origin cli/v2.0.0-beta.3
```

The tag push triggers `.github/workflows/cli-release.yml`.

### 6. Watch the CLI Release Workflow

The workflow will:

- Validate the tag and npm availability.
- Run CLI format, lint, type check, and tests.
- Run GoReleaser, which runs `go mod tidy` and builds release artifacts.
- Create or update the GitHub Release for the tag.
- Generate npm package directories.
- Publish native platform packages.
- Publish the wrapper package last.

If `release:check` says a package version already exists on npm, do not rerun the same version as a new release. Bump the CLI version and create a new annotated tag.

### 7. Verify CLI Publishing

For a beta release:

```bash
devbox run -- npm view @better-webhook/cli@beta version dist-tags --json
devbox run -- npm view @better-webhook/cli-darwin-arm64@beta version dist-tags --json
devbox run -- npm view @better-webhook/cli-linux-x64@beta version dist-tags --json
```

For a stable release:

```bash
devbox run -- npm view @better-webhook/cli version dist-tags --json
devbox run -- npm view @better-webhook/cli-darwin-arm64 version dist-tags --json
devbox run -- npm view @better-webhook/cli-linux-x64 version dist-tags --json
```

Also verify the GitHub Release exists for the pushed tag and contains:

- macOS arm64 tarball
- macOS x64 tarball
- Linux arm64 tarball
- Linux x64 tarball
- Windows x64 zip
- checksum file

### 8. Current CLI npm State to Remember

As of 2026-04-26:

- `@better-webhook/cli@beta` is `2.0.0-beta.2`; this branch prepares `2.0.0-beta.3`.
- `@better-webhook/cli@latest` is `3.10.1`, an older package shape with the `better-webhook` bin.
- `@better-webhook/cli@dev` is `0.0.0-dev`; it is not part of the current Go CLI release flow.
- The new Go CLI wrapper exposes the `bw` bin.

Until a stable Go CLI version is published, use:

```bash
npm install @better-webhook/cli@beta
```

or:

```bash
npx @better-webhook/cli@beta
```

After the first stable Go CLI release, verify that `@better-webhook/cli@latest` points to the stable Go CLI version.

## Failure Recovery

If an SDK publish fails before any package is published, fix the issue and rerun the workflow.

If an SDK publish partially succeeds, inspect npm for every package in the release. Changesets will skip already-published versions on rerun, but verify the workflow logs before assuming rerun safety.

If a CLI release fails after some native platform packages publish but before the wrapper publishes, keep the same version only if `release:check` is adjusted or bypassed intentionally by a maintainer. The normal validator rejects any already-published package version, so the safer path is usually a new patch or beta version.

If the CLI GitHub Release exists but npm publish failed, compare the release artifacts with the npm package version before deciding whether to delete/recreate anything. Avoid moving or deleting published npm versions; npm package versions are effectively immutable.
