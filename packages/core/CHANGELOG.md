# @better-webhook/core

## 0.11.0

### Minor Changes

- 89d0e5b: Add an opt-in request body size guard for webhook processing.

  Adapters now accept `maxBodyBytes` and pass it to core processing. When the
  request body exceeds the configured limit, processing returns `413` with
  `Payload too large`, emits a new `onBodyTooLarge` observability event, and
  still emits `onCompleted` with status `413`.

  This change is non-breaking and disabled by default unless `maxBodyBytes` is
  configured via adapter options, `process()` options, or `WebhookBuilder.maxBodyBytes()`.

## 0.10.0

### Minor Changes

- 89d0e5b: Add an opt-in request body size guard for webhook processing.

  Adapters now accept `maxBodyBytes` and pass it to core processing. When the
  request body exceeds the configured limit, processing returns `413` with
  `Payload too large`, emits a new `onBodyTooLarge` observability event, and
  still emits `onCompleted` with status `413`.

  This change is non-breaking and disabled by default unless `maxBodyBytes` is
  configured via adapter options, `process()` options, or `WebhookBuilder.maxBodyBytes()`.

## 0.9.0

### Minor Changes

- chore: improvement in error handling, body parsing and other stability improvements

## 0.8.1

### Patch Changes

- Add explicit opt out to avoid authentication bypass in @better-webhook/core

## 0.8.0

### Minor Changes

- adds tree-shakeability feature for provider packages

## 0.7.0

### Minor Changes

- Add observability to the core package, resolve nonce parsing issue with ragie provider and update docs

## 0.6.2

### Patch Changes

- add body as additional argument to getEventType and fix ragie webhook payload issues

## 0.6.1

### Patch Changes

- Format readme and add badges

## 0.6.0

### Minor Changes

- Add deliveryId in context, fix dashboard UI issues and improve version inconsistencies

## 0.5.0

### Minor Changes

- Adds ragie provider and dashboard UI

## 0.4.0

### Minor Changes

- Minor refactor of the core module to improve readability, maintainability, and performance.

## 0.3.0

### Minor Changes

- Adds request context and updates docs

## 0.2.0

### Minor Changes

- Initial release
