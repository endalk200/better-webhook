# @better-webhook/github

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
