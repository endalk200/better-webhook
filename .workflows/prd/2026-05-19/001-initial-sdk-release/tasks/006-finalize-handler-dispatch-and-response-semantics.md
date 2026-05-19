id: 2026-05-19-006-finalize-handler-dispatch-and-response-semantics
title: Finalize Handler Dispatch and Response Semantics
type: AFK
created: 2026-05-19

---

## Parent

[Initial SDK Release PRD](../prd.md)

## What to build

Complete the core dispatch and response policy behavior for handled, ignored, duplicate, in-progress idempotency reservations, rejected, unsupported, and handler-error outcomes. This slice should make provider-facing HTTP behavior consistent and minimal while leaving detailed outcome information to results and telemetry.

## Acceptance criteria

- [ ] Event-specific handlers win over catch-all handlers.
- [ ] Handled, ignored, and completed duplicate outcomes return `200` by default.
- [ ] In-progress idempotency reservation outcomes return `409` by default.
- [ ] Invalid signatures, replay rejects, and unsupported invalid input return `400` by default.
- [ ] Handler errors return `500` by default so providers can retry.
- [ ] Successful, ignored, and duplicate outcomes return minimal response bodies.
- [ ] Tests cover default response mapping and configurable response policy where exposed.

## Blocked by

- [002-build-core-endpoint-pipeline-tracer.md](./002-build-core-endpoint-pipeline-tracer.md)
