# @better-webhook/ragie

## 0.3.2

### Patch Changes

- add body as additional argument to getEventType and fix ragie webhook payload issues
- Updated dependencies
  - @better-webhook/core@0.6.2

## 0.3.1

### Patch Changes

- Format readme and add badges
- Updated dependencies
  - @better-webhook/core@0.6.1

## 0.3.0

### Minor Changes

- Add deliveryId in context, fix dashboard UI issues and improve version inconsistencies

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.6.0

## 0.2.0

### Minor Changes

- Adds ragie provider and dashboard UI

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.5.0

## 0.1.0 - 2025-12-25

### Added

- **Initial Release** 🎉
- Full Ragie webhook support with type-safe event handling
- HMAC-SHA256 signature verification using `X-Signature` header
- Support for all Ragie webhook events:
  - `document_status_updated` - Document enters indexed, ready, or failed state
  - `document_deleted` - Document is deleted
  - `entity_extracted` - Entity extraction completes
  - `connection_sync_started` - Connection sync begins
  - `connection_sync_progress` - Periodic sync progress updates
  - `connection_sync_finished` - Connection sync completes
  - `connection_limit_exceeded` - Connection page limit exceeded
  - `partition_limit_exceeded` - Partition document limit exceeded
- Built-in idempotency support with `nonce` field
- Comprehensive TypeScript types and Zod schemas
- Error handling with `onError` and `onVerificationFailed` hooks
- Examples for Express, NestJS, and Next.js
- Complete test suite with 100% coverage
- Detailed README with examples and best practices
