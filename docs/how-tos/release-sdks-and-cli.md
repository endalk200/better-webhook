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
devbox run -- bun run changeset
```

Select every affected public SDK package and choose the semver bump. Use an empty changeset only when the PR touches release-watched files but should not publish an SDK package:

```bash
devbox run -- bun run changeset --empty
```

Do not manually edit SDK package versions or SDK changelogs in the feature PR. Changesets generates those in the release PR.

### 2. Verify Locally

Run the full release-quality check set:

```bash
devbox run -- bun run format:check
devbox run -- bun run lint
devbox run -- bun run check-types
devbox run -- bun run test
devbox run -- bun run build
```

The SDK release workflow itself runs format check, lint, type check, test, and build after the Trivy gate.

If formatting fails, apply it and rerun the checks:

```bash
devbox run -- bun run format:write
```

For a narrow package check, use:

```bash
devbox run -- bun --filter @better-webhook/core run build
devbox run -- bun --filter @better-webhook/core run check-types
devbox run -- bun --filter @better-webhook/core run lint
devbox run -- bun --filter @better-webhook/core run test
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
- No `workspace:*` ranges in published runtime `dependencies`.
- Docs changes when SDK behavior changed.
- Passing CI and release workflow checks.

The actual local command behind the versioning step is:

```bash
devbox run -- bun run changeset:version
```

You usually do not need to run it manually because the GitHub workflow handles the release PR.

### 5. Publish

Merge the release PR to `main`.

The next `Release SDK Packages` workflow run publishes packages with:

```bash
devbox run -- bun run release:publish
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

Use this flow for `@better-webhook/cli`. The CLI is not released by Changesets.

### 1. Choose the Version

Edit the CLI package version:

- `packages/cli/package.json`

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
devbox run -- bun run --filter @better-webhook/cli format:check
devbox run -- bun run --filter @better-webhook/cli lint
devbox run -- bun run --filter @better-webhook/cli check-types
devbox run -- bun run --filter @better-webhook/cli test
```

Build and smoke-test the local binary:

```bash
devbox run -- bun run --filter @better-webhook/cli build
devbox run -- bun run --filter @better-webhook/cli cli:built -- version --verbose
```

Run full repo verification before merging:

```bash
devbox run -- bun run format:check
devbox run -- bun run lint
devbox run -- bun run check-types
devbox run -- bun run test
devbox run -- bun run build
```

### 3. Run the Dry Run Workflow

Before publishing, run the manual GitHub workflow:

```text
CLI Release Dry Run
```

It validates formatting, linting, type checks, tests, generated npm package directories, and `npm pack --dry-run` for the CLI npm package.

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
- Build the TypeScript CLI.
- Generate the npm package directory.
- Create or update the GitHub Release for the tag.
- Publish `@better-webhook/cli` to npm.

If `release:check` says a package version already exists on npm, do not rerun the same version as a new release. Bump the CLI version and create a new annotated tag.

### 7. Verify CLI Publishing

For a beta release:

```bash
devbox run -- npm view @better-webhook/cli@beta version dist-tags --json
```

For a stable release:

```bash
devbox run -- npm view @better-webhook/cli version dist-tags --json
```

Also verify the GitHub Release exists for the pushed tag and contains the packed `@better-webhook/cli` npm tarball.

### 8. Verify Current CLI npm State

Before installing or recommending a CLI tag, check the current npm state:

```bash
devbox run -- npm view @better-webhook/cli dist-tags --json
devbox run -- npm view @better-webhook/cli@beta version
devbox run -- npm view @better-webhook/cli@latest version
```

Durable CLI package facts:

- The TypeScript CLI package exposes the `bw` bin.
- Older `@better-webhook/cli@latest` versions may use older package contents until a stable CLI release moves `latest`.
- `@better-webhook/cli@dev` is not part of the current CLI release flow.

Until a stable CLI version is published, use:

```bash
npm install @better-webhook/cli@beta
```

or:

```bash
npx @better-webhook/cli@beta
```

After the first stable CLI release, verify that `@better-webhook/cli@latest` points to the stable CLI version.

## Failure Recovery

If an SDK publish fails before any package is published, fix the issue and rerun the workflow.

If an SDK publish partially succeeds, inspect npm for every package in the release. Changesets will skip already-published versions on rerun, but verify the workflow logs before assuming rerun safety.

If a CLI release fails after the npm package publishes, do not rerun the same version as a new release. The normal validator rejects already-published package versions, so the safer path is usually a new patch or beta version.

If the CLI GitHub Release exists but npm publish failed, compare the release artifacts with the npm package version before deciding whether to delete/recreate anything. Avoid moving or deleting published npm versions; npm package versions are effectively immutable.
