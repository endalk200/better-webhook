# @better-webhook/recall

## 0.3.4

### Patch Changes

- 36e29d4: fix: improve schema inference for Zod-compatible event validators and clarify Recall payload docs
- Updated dependencies [36e29d4]
  - @better-webhook/core@0.12.3

## 0.3.3

### Patch Changes

- Updated dependencies [b98de71]
  - @better-webhook/core@0.12.2

## 0.3.2

### Patch Changes

- Updated dependencies [6163009]
  - @better-webhook/core@0.12.1

## 0.3.1

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.12.0

## 0.3.0

### Minor Changes

- 70a65f0: Expand Recall webhook coverage across recording, transcript, calendar, and SDK upload events while tightening signature verification and replay handling.

## 0.2.4

### Patch Changes

- Clarified dependency note: verified-but-unhandled status overrides were added
  in `@better-webhook/core`; `@better-webhook/recall` continues to use the
  default `204` response for verified but unhandled events.
- Updated dependencies [b547738]
  - @better-webhook/core@0.11.4

## 0.2.3

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.11.3

## 0.2.2

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.11.2

## 0.2.1

### Patch Changes

- Updated dependencies
  - @better-webhook/core@0.11.1

## 0.2.0

### Minor Changes

- Updated dependencies
  - @better-webhook/core@0.11.0 (replay protection + strict verification ordering)
- Expose normalized replay metadata (`webhook-id`/`svix-id` and timestamp) for
  core replay protection.

## 0.1.1

### Patch Changes

- Updated dependencies [89d0e5b]
  - @better-webhook/core@0.10.0

## 0.1.0

### Minor Changes

- feat: initial release of recall.ai provider and logic for handling recall.ai webhooks in CLI
