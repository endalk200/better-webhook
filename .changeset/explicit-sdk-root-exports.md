---
"@better-webhook/core": major
"@better-webhook/stripe": major
"@better-webhook/github": major
"@better-webhook/nextjs": patch
"@better-webhook/express": patch
"@better-webhook/otel": patch
---

Make SDK package root entrypoints explicit public API manifests.

Breaking changes:

- `@better-webhook/core` no longer exports the low-level `toWebhookDelivery` and `getHeaderValues` helpers from the package root.
- `@better-webhook/stripe` no longer exports signature parsing, signature construction, or replay-key helper functions from the package root.
- `@better-webhook/github` no longer exports signature parsing, signature construction, replay-key, envelope parsing, or raw header helper functions from the package root.

The provider packages continue to expose provider factories and public event, envelope, payload, and option types. `@better-webhook/github` also continues to expose `knownGitHubEventTypes` and `isKnownGitHubEventType`.

The Next.js, Express, and OpenTelemetry packages keep their existing public root APIs while moving implementation behind explicit root manifests.
