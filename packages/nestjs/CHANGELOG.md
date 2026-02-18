# @better-webhook/nestjs

## 0.11.0

### Minor Changes

- Updated dependencies
  - @better-webhook/core@0.11.0 (replay protection + strict verification ordering)
- Propagate duplicate replay responses (`409`) from core when replay protection
  is enabled.

## 0.10.0

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

## 0.9.0

### Minor Changes

- chore: improvement in error handling, body parsing and other stability improvements

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.9.0

## 0.8.1

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.8.1

## 0.8.0

### Minor Changes

- adds tree-shakeability feature for provider packages

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.8.0

## 0.7.0

### Minor Changes

- Add observability to the core package, resolve nonce parsing issue with ragie provider and update docs

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.7.0

## 0.6.2

### Patch Changes

- add body as additional argument to getEventType and fix ragie webhook payload issues
- Updated dependencies
  - @better-webhook/core@0.6.2

## 0.6.1

### Patch Changes

- Format readme and add badges
- Updated dependencies
  - @better-webhook/core@0.6.1

## 0.6.0

### Minor Changes

- Add deliveryId in context, fix dashboard UI issues and improve version inconsistencies

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.6.0

## 0.5.0

### Minor Changes

- Adds ragie provider and dashboard UI

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.5.0

## 0.4.0

### Minor Changes

- Minor refactor of the NestJS module to improve readability, maintainability, and performance.

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.4.0

## 0.3.0

### Minor Changes

- Adds request context and updates docs

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.3.0

## 0.2.0

### Minor Changes

- Initial release

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.2.0
