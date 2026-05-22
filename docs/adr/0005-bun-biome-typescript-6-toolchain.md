# 0005. Bun, Biome, and TypeScript 6 Toolchain

## Status

Accepted

## Context

Better Webhook previously used pnpm for package management, ESLint for linting, Prettier for formatting, and mixed TypeScript versions across packages and examples. That split made routine contributor workflows depend on several overlapping tools for install, script execution, linting, formatting, and compiler behavior.

The repository still publishes Node.js ESM SDK packages. The package-manager migration must not change runtime semantics, test tools, package exports, or the TypeScript configuration model used by real Node ESM consumers.

## Decision

Use Bun as the repository package manager and script runner. Bun owns dependency installation, the lockfile, workspace filtering, and package script execution. Bun is not the JavaScript runtime for SDK packages, not the compiler, not the bundler, and not the test runner.

Use Biome as the shared formatter and linter through the private `@better-webhook/biome-config` workspace package. Biome replaces ESLint and Prettier together so formatting, import organization, and lint diagnostics are enforced by one toolchain.

Pin repository TypeScript to exact version `6.0.3`. SDK package builds and type checks continue to use `tsc`.

Keep the shared SDK TypeScript configuration on `module` and `moduleResolution` set to `NodeNext`. Better Webhook packages are consumed by real Node.js ESM applications, so shared SDK checks should model Node's package and export semantics rather than bundler-only resolution behavior.

## Consequences

Maintainers use `devbox run -- bun ...` for repository workflows, and CI validates the same package-manager boundary.

The repo has one Bun lockfile and no pnpm workspace or lockfile metadata.

Biome lint failures are treated as errors, and Biome write mode is the supported formatting path.

Node.js remains the runtime boundary for package consumers and Node-based scripts. Vitest remains the TypeScript package test runner, Node's built-in test runner remains where already used, and Go tooling remains responsible for CLI build, lint, type-check, test, and packaging behavior.
