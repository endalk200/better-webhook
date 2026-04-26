# Release Pipeline and Publishing Understanding

This repo has two separate publishing systems:

- SDK packages are TypeScript npm packages published with Changesets from `main`.
- The CLI is a Go binary distributed through GitHub Releases and npm wrapper packages from annotated `cli/v*` tags.

The split is intentional. `.changeset/config.json` ignores `@better-webhook/cli`, so CLI releases never flow through Changesets.

## Publishable Packages

The public SDK packages are:

- `@better-webhook/core`
- `@better-webhook/express`
- `@better-webhook/gcp-functions`
- `@better-webhook/github`
- `@better-webhook/hono`
- `@better-webhook/nestjs`
- `@better-webhook/nextjs`
- `@better-webhook/otel`
- `@better-webhook/ragie`
- `@better-webhook/recall`
- `@better-webhook/resend`
- `@better-webhook/stripe`

The CLI npm packages are:

- `@better-webhook/cli`
- `@better-webhook/cli-darwin-arm64`
- `@better-webhook/cli-darwin-x64`
- `@better-webhook/cli-linux-arm64`
- `@better-webhook/cli-linux-x64`
- `@better-webhook/cli-win32-x64`

Workspace-only packages such as `@better-webhook/eslint-config` and `@better-webhook/typescript-config` are private/internal support packages and are not part of the release flow.

## Shared Tooling

All repo commands are expected to run through Devbox:

```bash
devbox run -- pnpm run format:check
devbox run -- pnpm run lint
devbox run -- pnpm run check-types
devbox run -- pnpm run test
devbox run -- pnpm run build
```

`devbox.json` pins the toolchain used by local work and CI, including Node, pnpm, Go, GoReleaser, golangci-lint, gofumpt, goimports, just, and Trivy. The root `packageManager` field is advisory for package-manager metadata; Devbox controls the `pnpm` binary used by release commands in CI.

`turbo.json` defines the repo task graph. `build` depends on upstream package builds and emits `dist/**`, `build/**`, `bin/**`, and `.next/**`. `lint`, `check-types`, and `test` depend on upstream builds, which means release verification can rebuild dependencies even when a command looks package-scoped.

## SDK Release Flow

SDK releases are controlled by `.github/workflows/release.yml`.

The workflow runs on pushes to `main` when release-relevant paths change:

- `.changeset/**`
- SDK package directories under `packages/*`
- root package and workspace metadata
- `justfile`
- the release workflow itself

The workflow grants `contents: write`, `pull-requests: write`, and `id-token: write`. The npm auth setup uses `actions/setup-node` with the npm registry, and publishing relies on the registry credentials/trusted-publishing setup available to the workflow.

The SDK workflow does this:

1. Checks out the repo with full history.
2. Installs and validates Devbox.
3. Configures npm registry access.
4. Installs dependencies with `pnpm install --frozen-lockfile`.
5. Restores the Trivy cache.
6. Runs Trivy as a blocking gate only when `TRIVY_ENFORCE=1`; otherwise it records a release report without failing the publish.
7. Runs lint, type check, test, and build. The release workflow does not run `format:check`; formatting is enforced by CI and local release readiness.
8. Runs `changesets/action`.
9. Either opens/updates a release PR or publishes packages.
10. Pushes tags after a successful publish.

Changesets config:

- `baseBranch` is `main`.
- `access` is `public`.
- `commit` is `false`, so version/changelog files are not auto-committed by local `changeset version` commands.
- `updateInternalDependencies` is `patch`, so dependents get patch bumps when internal workspace dependencies change.
- `@better-webhook/cli` is ignored.

Each SDK package builds with `tsup` into `dist`, publishes ESM, CJS, and TypeScript declarations, and restricts npm package contents to `dist`, `README.md`, and `LICENSE`.

Provider packages with event subpath exports include additional `tsup` entries and package `exports` entries. The current event subpaths are `@better-webhook/github/events`, `@better-webhook/ragie/events`, `@better-webhook/recall/events`, `@better-webhook/resend/events`, and `@better-webhook/stripe/events`. Release checks should verify those subpath artifacts exist in `dist`.

## SDK Versioning and Changelogs

Feature PRs should add `.changeset/*.md` files with the user-facing summary and selected semver bumps. They should not manually edit package versions or package changelogs.

When the release PR is created by the Changesets action, it applies the accumulated changesets to package versions, changelogs, and workspace dependency ranges. Merging that release PR back to `main` causes the next release workflow run to publish the packages.

The root script for local versioning is:

```bash
devbox run -- pnpm run changeset:version
```

The matching root script is `changeset:version`; there is no `release:version` script.

## CLI Release Flow

CLI releases are controlled by `.github/workflows/cli-release.yml`.

The workflow runs only when a tag matching `cli/v*` is pushed. The release tag must be annotated, must point to a commit reachable from `origin/main`, and must match the version in `packages/cli/package.json`.

The CLI is a Go module in `packages/cli`. The npm package is private in the workspace so it is not accidentally published by workspace or Changesets tooling. The release workflow generates publishable npm package directories under `packages/cli/dist/npm`.

The CLI workflow does this:

1. Checks out the repo with full history and no persisted GitHub credentials.
2. Installs and validates Devbox.
3. Configures npm registry access.
4. Installs dependencies with `pnpm install --frozen-lockfile`.
5. Runs `pnpm --filter @better-webhook/cli run release:check`.
6. Runs CLI format, lint, type check, and test.
7. Runs GoReleaser to run `go mod tidy` and build archives without publishing.
8. Creates or updates the GitHub Release for the tag.
9. Generates npm wrapper and platform package directories.
10. Publishes native platform packages first.
11. Publishes `@better-webhook/cli` last.

`packages/cli/scripts/validate-release.mjs` enforces:

- A `cli/v<version>` tag exists.
- The tag version equals `packages/cli/package.json`.
- The remote tag is annotated.
- The tagged commit is an ancestor of `origin/main`.
- None of the wrapper or platform packages already exists on npm at that version.
- Prerelease versions use the `beta` npm dist-tag.

`packages/cli/.goreleaser.yml` runs `go mod tidy` before building and builds five targets:

- macOS arm64
- macOS x64
- Linux arm64
- Linux x64
- Windows x64

Windows arm64 is intentionally ignored. GoReleaser injects version, commit, date, and `builtBy=goreleaser` through linker flags.

The npm wrapper package exposes the `bw` bin at `npm/bin/bw.js`. That script resolves the current platform-specific optional dependency and executes its native binary. Unsupported platforms fail with a clear error before trying to spawn a binary.

`packages/cli/scripts/package-npm.mjs` creates:

- One native npm package per supported platform, each containing only `bin`, `README.md`, and `LICENSE`.
- One wrapper package, `@better-webhook/cli`, with `optionalDependencies` pointing to every native platform package at the same version.

Native packages publish before the wrapper so users installing the wrapper can resolve the optional dependency immediately.

## CLI Dist-Tags

The CLI release workflow resolves npm tags from `packages/cli/package.json`:

- Stable versions publish with `--tag latest`.
- Prerelease versions publish with `--tag beta`.

As of this audit on 2026-04-26, npm shows:

- SDK package `latest` tags match the package versions in this repo.
- `@better-webhook/cli` has `beta` at `2.0.0-beta.2`; this branch prepares `2.0.0-beta.3`.
- `@better-webhook/cli` has `latest` at `3.10.1`, which is an older npm package shape with `better-webhook` as its bin.
- `@better-webhook/cli` also has a `dev` dist-tag at `0.0.0-dev`; it is unrelated to the current Go CLI release flow.
- Native CLI packages are published at `2.0.0-beta.2`; their `beta` and `latest` tags both point there.

That means `npm install @better-webhook/cli` currently resolves the old `3.10.1` package, while `npm install @better-webhook/cli@beta` resolves the new Go CLI wrapper. The first stable Go CLI release will move the wrapper's `latest` tag if it is published successfully with a stable semver version.

## CI and Security Gates

`.github/workflows/ci.yml` runs format, lint, type check, test, and build on pushes and pull requests targeting `main` or `develop`.

`.github/workflows/security.yml` runs Trivy on pushes and pull requests. It uploads SARIF to GitHub code scanning. `TRIVY_ENFORCE=1` makes the Trivy scan blocking; otherwise it reports findings without failing the job.

`.github/workflows/security-cache.yml` refreshes Trivy DB caches daily and on manual dispatch.

`.github/workflows/cli-release-dry-run.yml` is a manual packaging rehearsal for the CLI. It runs CLI checks, GoReleaser snapshot packaging, npm package generation, and `npm pack --dry-run` for all generated npm package directories. It does not publish.

## Operational Watch Points

- Run all release commands through `devbox run --`.
- Do not use `pnpm dev` or `pnpm start` as part of release verification.
- If repo-wide lint fails with an `ENOENT` for a temporary `packages/stripe` tsup config file during concurrent build-related work, rerun lint by itself after builds finish.
- The CLI `release:check` intentionally fails if the current CLI version already exists on npm. That is expected after a tag has already published.
- The current checkout is tagged `cli/v2.0.0-beta.2`; rerunning the CLI release check fails because `@better-webhook/cli-darwin-arm64@2.0.0-beta.2` already exists on npm.
- `devbox.json` currently pins `pnpm@10.28.0` while the root `packageManager` field says `pnpm@10.33.0`; CI uses the Devbox-pinned binary unless Devbox is updated.
- SDK docs under `apps/docs/content` can drift from SDK behavior. SDK-facing changes should include a docs review before release.
