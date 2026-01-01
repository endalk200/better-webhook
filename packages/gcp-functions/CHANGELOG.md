# @better-webhook/gcp-functions

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
