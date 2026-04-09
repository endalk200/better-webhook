# @better-webhook/hono

## 0.4.3

### Patch Changes

- Updated dependencies [36e29d4]
  - @better-webhook/core@0.12.3

## 0.4.2

### Patch Changes

- Updated dependencies [b98de71]
  - @better-webhook/core@0.12.2

## 0.4.1

### Patch Changes

- 6163009: feat: introduce webhook instrumentation API for enhanced observability
- Updated dependencies [6163009]
  - @better-webhook/core@0.12.1

## 0.4.0

### Minor Changes

- Replace the old observer API with request-scoped instrumentation hooks and add the new `@better-webhook/otel` package for OpenTelemetry integration.

  Update the framework adapters and docs to use builder-level `.instrument(...)` wiring instead of adapter-level observer options.

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.12.0

## 0.3.4

### Patch Changes

- b547738: chore: adds status code override for unhandled webhook events that are verified
- Updated dependencies [b547738]
  - @better-webhook/core@0.11.4

## 0.3.3

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.11.3

## 0.3.2

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.11.2

## 0.3.1

### Patch Changes

- Updated `@better-webhook/core` to `0.11.1`, where `CompletedEvent.success` treats HTTP `204` (and `200`) as successful, which can increase observer and metrics success counts.
- Clarified Hono adapter `onSuccess` semantics: the callback runs only for handled `200` responses.
- Updated dependencies
  - @better-webhook/core@0.11.1

## 0.3.0

### Minor Changes

- Updated dependencies
  - @better-webhook/core@0.11.0 (replay protection + strict verification ordering)
- Propagate duplicate replay responses (`409`) from core when replay protection
  is enabled.

## 0.2.0

### Minor Changes

- 89d0e5b: Add an opt-in request body size guard for webhook processing.

  Adapters now accept `maxBodyBytes` and pass it to core processing. When the
  request body exceeds the configured limit, processing returns `413` with
  `Payload too large`, emits a new `onBodyTooLarge` observability event, and
  still emits `onCompleted` with status `413`.

  This change is non-breaking and disabled by default unless `maxBodyBytes` is
  configured via adapter options, `process()` options, or `WebhookBuilder.maxBodyBytes()`.

### Patch Changes

- Updated dependencies [89d0e5b]
  - @better-webhook/core@0.10.0

## 0.1.0

### Minor Changes

- feat: initial hono adapter release for @better-webhook

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.9.0
