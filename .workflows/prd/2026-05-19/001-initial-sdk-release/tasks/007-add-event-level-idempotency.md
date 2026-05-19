id: 2026-05-19-007-add-event-level-idempotency
title: Add Event-Level Idempotency
type: AFK
created: 2026-05-19

---

## Parent

[Initial SDK Release PRD](../prd.md)

## What to build

Implement configured event-level **Idempotency** in core. The pipeline should require a stable **Endpoint Identity** when idempotency is configured, reserve provider events before handling, mark them complete only after successful handling, return success for duplicate completed events, treat in-progress reservations as distinct from completed duplicates, and release reservations by default when handlers fail.

## Acceptance criteria

- [ ] Core defines an **Idempotency Store** contract with atomic reservation, in-progress reservation, completion, and failure handling semantics.
- [ ] Core includes a memory idempotency store for tests and local development.
- [ ] Idempotency is disabled unless an idempotency store is configured.
- [ ] A stable developer-configured **Endpoint Identity** is required when idempotency is configured.
- [ ] Duplicate completed events skip handler execution and return success.
- [ ] In-progress reservations do not skip as completed duplicates and return `409` by default.
- [ ] Handler success marks the event complete; handler failure releases the reservation by default.
- [ ] Tests cover reservation, in-progress behavior, duplicate completed detection, completion, release-on-failure, required endpoint identity, no-store behavior, and concurrent delivery behavior where practical.

## Blocked by

- [006-finalize-handler-dispatch-and-response-semantics.md](./006-finalize-handler-dispatch-and-response-semantics.md)
