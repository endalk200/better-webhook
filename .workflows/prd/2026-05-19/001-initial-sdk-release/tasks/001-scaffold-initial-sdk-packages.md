id: 2026-05-19-001-scaffold-initial-sdk-packages
title: Scaffold Initial SDK Packages
type: AFK
created: 2026-05-19

---

## Parent

[Initial SDK Release PRD](../prd.md)

## What to build

Create the initial SDK package shells for core, Stripe provider support, Next.js adapter, Express adapter, and OpenTelemetry support. The packages should follow the accepted Node.js 18+, ESM-only, TypeScript-declaration publishing constraints and integrate with the existing workspace verification commands.

## Acceptance criteria

- [ ] The five initial SDK packages exist in the workspace with package metadata, ESM exports, TypeScript config, and package scripts.
- [ ] Each package participates in workspace lint, typecheck, test, build, and format workflows.
- [ ] Package exports publish TypeScript declarations and do not include CommonJS or browser bundle entrypoints.
- [ ] The workspace can install, build, typecheck, lint, test, and format-check with the new empty package shells.

## Blocked by

None - can start immediately
