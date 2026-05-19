id: 2026-05-19-007-add-event-level-idempotency
title: Add Event-Level Idempotency
type: AFK
created: 2026-05-19

---

## Parent

[Initial SDK Release PRD](../prd.md)

## What to build

Implement configured event-level **Idempotency** in core. The pipeline should reserve provider events before handling, mark them complete only after successful handling, return success for duplicate completed events, and release reservations by default when handlers fail.

## Acceptance criteria

- [ ] Core defines an **Idempotency Store** contract with atomic reservation, completion, and failure handling semantics.
- [ ] Core includes a memory idempotency store for tests and local development.
- [ ] Idempotency is disabled unless an idempotency store is configured.
- [ ] Duplicate completed events skip handler execution and return success.
- [ ] Handler success marks the event complete; handler failure releases the reservation by default.
- [ ] Tests cover reservation, duplicate detection, completion, release-on-failure, no-store behavior, and concurrent delivery behavior where practical.

## Blocked by

- [006-finalize-handler-dispatch-and-response-semantics.md](./006-finalize-handler-dispatch-and-response-semantics.md)
