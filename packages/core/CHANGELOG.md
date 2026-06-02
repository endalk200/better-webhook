# @better-webhook/core

## 1.1.0

### Minor Changes

- 0ddba61: Use GitHub's generated OpenAPI webhook schemas for known event payload types so handlers receive action-aware, fully typed payloads.

  Fix Event Handler map narrowing when a provider event union includes both literal known events and an unknown catch-all string event.

## 1.0.2

### Patch Changes

- d23565e: Make SDK package root entrypoints explicit public API manifests.

  Breaking changes:

  - `@better-webhook/core` no longer exports the low-level `toWebhookDelivery` and `getHeaderValues` helpers from the package root.
  - `@better-webhook/stripe` no longer exports signature parsing, signature construction, or replay-key helper functions from the package root.
  - `@better-webhook/github` no longer exports signature parsing, signature construction, replay-key, envelope parsing, or raw header helper functions from the package root.

  The provider packages continue to expose provider factories and public event, envelope, payload, and option types. `@better-webhook/github` also continues to expose `knownGitHubEventTypes` and `isKnownGitHubEventType`.

  The Next.js, Express, and OpenTelemetry packages keep their existing public root APIs while moving implementation behind explicit root manifests.

## 1.0.1

### Patch Changes

- f23d1eb: Bundle agent-oriented SDK reference docs under `docs/index.md` in each TypeScript SDK package.

## 1.0.0

### Major Changes

- dc87dff: Add the initial v1 SDK package set with the core webhook handling pipeline,
  Stripe provider definition, Next.js and Express adapters, and OpenTelemetry
  bridge.

  Include npm-ready package README files with installation, getting started,
  package positioning, safety notes, API summaries, and runtime support limits.
