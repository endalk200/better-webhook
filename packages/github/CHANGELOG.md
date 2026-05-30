# @better-webhook/github

## 1.0.2

### Patch Changes

- d23565e: Make SDK package root entrypoints explicit public API manifests.

  Breaking changes:

  - `@better-webhook/core` no longer exports the low-level `toWebhookDelivery` and `getHeaderValues` helpers from the package root.
  - `@better-webhook/stripe` no longer exports signature parsing, signature construction, or replay-key helper functions from the package root.
  - `@better-webhook/github` no longer exports signature parsing, signature construction, replay-key, envelope parsing, or raw header helper functions from the package root.

  The provider packages continue to expose provider factories and public event, envelope, payload, and option types. `@better-webhook/github` also continues to expose `knownGitHubEventTypes` and `isKnownGitHubEventType`.

  The Next.js, Express, and OpenTelemetry packages keep their existing public root APIs while moving implementation behind explicit root manifests.

### Patch Changes

- Updated dependencies [d23565e]
  - @better-webhook/core@1.0.2

## 1.0.1

### Patch Changes

- f23d1eb: Bundle agent-oriented SDK reference docs under `docs/index.md` in each TypeScript SDK package.
- Updated dependencies [f23d1eb]
  - @better-webhook/core@1.0.1

## 1.0.0

### Minor Changes

- Add the GitHub provider definition with SHA-256 signature verification,
  GitHub Event Envelope extraction, known GitHub event typing, unknown-event
  fallback, and GitHub Delivery ID based idempotency and replay keys.

  Include GitHub App-first package documentation covering setup, signature
  verification, supported JSON payloads, event-name dispatch, action metadata,
  manual redelivery behavior, and out-of-scope GitHub API write-back helpers.

### Patch Changes

- Updated dependencies
  - @better-webhook/core@1.0.0
