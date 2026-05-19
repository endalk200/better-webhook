id: 2026-05-19-005-add-stripe-event-typing-and-unknown-fallback
title: Add Stripe Event Typing and Unknown Fallback
type: AFK
created: 2026-05-19

---

## Parent

[Initial SDK Release PRD](../prd.md)

## What to build

Add the first curated Stripe event map with compile-time **Event Payload** types, runtime **Event Envelope** validation, event-specific handler narrowing, and unknown event fallback behavior. Verified Stripe events outside the curated map should remain handleable through the catch-all **Event Handler**.

## Acceptance criteria

- [ ] Stripe exports a curated event map for common checkout, invoice, subscription, and payment intent events.
- [ ] Known Stripe event handlers receive narrowed event types and payload types.
- [ ] Unknown verified Stripe events are represented by a safe unknown fallback event type.
- [ ] Catch-all handlers can receive known and unknown verified Stripe events.
- [ ] Runtime validation confirms required envelope metadata without attempting full payload schema validation.
- [ ] Type-level tests cover known event narrowing, unknown event fallback, and catch-all handler typing.

## Blocked by

- [004-implement-stripe-signature-verification.md](./004-implement-stripe-signature-verification.md)
