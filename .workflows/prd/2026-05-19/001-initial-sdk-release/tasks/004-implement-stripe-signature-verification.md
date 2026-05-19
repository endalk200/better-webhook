id: 2026-05-19-004-implement-stripe-signature-verification
title: Implement Stripe Signature Verification
type: AFK
created: 2026-05-19

---

## Parent

[Initial SDK Release PRD](../prd.md)

## What to build

Implement the Stripe **Provider Definition** with directly configured signing secrets, Stripe signature header parsing, raw-byte HMAC verification, timestamp tolerance, event envelope extraction, and compatibility-style tests. The package must not depend on the official Stripe npm package.

## Acceptance criteria

- [ ] Stripe provider configuration accepts a directly passed signing secret and optional timestamp tolerance.
- [ ] Stripe verification uses unmodified raw body bytes and the Stripe signature header.
- [ ] Valid signatures verify and invalid signatures, wrong secrets, stale timestamps, and mutated bodies reject.
- [ ] Multiple Stripe signature values are handled according to Stripe signing semantics.
- [ ] Stripe envelope extraction returns event id, event type, and created time after verification.
- [ ] Compatibility tests use raw byte fixtures and real Stripe signing semantics without the official Stripe package.

## Blocked by

- [002-build-core-endpoint-pipeline-tracer.md](./002-build-core-endpoint-pipeline-tracer.md)
- [003-preserve-raw-delivery-requests.md](./003-preserve-raw-delivery-requests.md)
