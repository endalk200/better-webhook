id: 2026-05-19-008-add-delivery-level-replay-protection
title: Add Delivery-Level Replay Protection
type: AFK
created: 2026-05-19

---

## Parent

[Initial SDK Release PRD](../prd.md)

## What to build

Implement delivery-level **Replay Protection** in core. Provider timestamp tolerance should run by default when supported, and optional **Replay Store** tracking should reject previously observed signed **Webhook Deliveries** during the replay protection window.

## Acceptance criteria

- [ ] Provider timestamp tolerance is enforced by default when a provider exposes signed timestamps.
- [ ] Core defines a **Replay Store** contract for short-lived seen-delivery tracking.
- [ ] Core includes a memory replay store for tests and local development.
- [ ] Replay store tracking is disabled unless a replay store is configured.
- [ ] Replay rejection happens before event handler dispatch.
- [ ] Tests cover accepted timestamps, stale timestamps, seen-delivery rejection, no-store behavior, and separation from idempotency.

## Blocked by

- [004-implement-stripe-signature-verification.md](./004-implement-stripe-signature-verification.md)
- [006-finalize-handler-dispatch-and-response-semantics.md](./006-finalize-handler-dispatch-and-response-semantics.md)
