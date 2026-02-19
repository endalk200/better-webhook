# @better-webhook/gcp-functions

## 0.5.1

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.11.1

## 0.5.0

### Minor Changes

- Updated dependencies
  - @better-webhook/core@0.11.0 (replay protection + strict verification ordering)
- Propagate duplicate replay responses (`409`) from core when replay protection
  is enabled.

## 0.4.0

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

## 0.3.2

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.9.0

## 0.3.1

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.8.1

## 0.3.0

### Minor Changes

- adds tree-shakeability feature for provider packages

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.8.0

## 0.2.1

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.7.0

## 0.2.0

### Minor Changes

- Initial release of the GCP Cloud Functions adapter for better-webhook
- Support for both 1st and 2nd generation Cloud Functions
- `toGCPFunction` function to convert webhook builders to Cloud Functions handlers
- Full TypeScript support with `GCPFunctionRequest` and `GCPFunctionResponse` types
- Automatic raw body handling for signature verification
- `onSuccess` callback option for tracking successful webhook processing
- Compatible with `@google-cloud/functions-framework` v3.x
