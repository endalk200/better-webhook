# @better-webhook/otel

## 0.1.2

### Patch Changes

- Updated dependencies [b98de71]
  - @better-webhook/core@0.12.2

## 0.1.1

### Patch Changes

- 6163009: feat: introduce webhook instrumentation API for enhanced observability
- Updated dependencies [6163009]
  - @better-webhook/core@0.12.1

## 0.1.0

### Minor Changes

- Replace the old observer API with request-scoped instrumentation hooks and add the new `@better-webhook/otel` package for OpenTelemetry integration.

  Update the framework adapters and docs to use builder-level `.instrument(...)` wiring instead of adapter-level observer options.

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.12.0
