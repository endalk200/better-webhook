# 0006. CI/CD Supply Chain Hardening

## Status

Accepted

## Context

Better Webhook publishes SDK packages and CLI artifacts from GitHub Actions. The workflows install dependencies, run repository quality gates, scan for security issues, create release pull requests, publish npm packages, and upload release artifacts.

The repository already standardizes local and CI execution through Devbox, Bun, Biome, TypeScript, Turbo, Trivy, and Changesets. That toolchain boundary is useful, but the workflows also depend on third-party GitHub Actions and Devbox packages. Mutable action tags and floating Devbox packages make the release and security posture less reproducible than the rest of the repository.

The project has no need for a long-lived `develop` integration branch. Pull requests should target `main`, scheduled checks should run from `main`, and release workflows should be hardened because they use elevated permissions and publish artifacts.

## Decision

Use `main` as the only CI integration branch. Pull request and push workflows target `main`; scheduled workflows run independently from the default branch.

Pin every third-party GitHub Action to a full commit SHA. Keep a trailing comment with the resolved version tag so the workflow remains auditable and maintainable. Local composite actions referenced with `./.github/actions/...` are repository code and do not need commit SHA pins.

Use Dependabot for ecosystems it supports in this repository: GitHub Actions and Bun. Group each ecosystem into a weekly update pull request, and require those pull requests to pass the same CI gates as any other pull request. Do not use auto-merge by default.

Keep Devbox as the CI toolchain boundary. Pin the Devbox CLI version used by CI, pin every Devbox package to an explicit version, and do not use `@latest` entries. Devbox tool updates are manual for now because Dependabot does not manage `devbox.json` package versions.

Separate dependency auditing from broader security scanning. A dedicated dependency audit workflow runs `bun audit --audit-level=moderate` on a weekly schedule and on manual dispatch. Trivy remains the filesystem, secret, misconfiguration, and SARIF-producing security scan.

Keep Trivy report-only by default for pull requests and pushes. The `TRIVY_ENFORCE=1` repository variable switches Trivy into blocking mode when maintainers choose to enforce findings.

Use explicit job timeouts and least-privilege workflow permissions. Release workflows follow the same action-pinning and timeout standards as CI because they publish packages, create releases, and use elevated permissions.

## Consequences

CI and release workflows are more reproducible and less exposed to upstream tag movement in third-party actions.

Workflow updates become slightly noisier because full action SHAs are less readable than version tags. Version comments and grouped Dependabot pull requests keep those updates reviewable.

Devbox CLI and tool upgrades require intentional maintenance until a reliable updater is introduced.

Dependency advisories and repository security findings are easier to triage because Bun audit and Trivy scans fail or report independently.

The repository has a simpler branch model. Long-lived feature work should use branches and pull requests into `main` rather than a separate `develop` branch.
