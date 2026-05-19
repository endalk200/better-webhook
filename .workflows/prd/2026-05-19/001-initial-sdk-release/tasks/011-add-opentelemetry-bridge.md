id: 2026-05-19-011-add-opentelemetry-bridge
title: Add OpenTelemetry Bridge
type: AFK
created: 2026-05-19

---

## Parent

[Initial SDK Release PRD](../prd.md)

## What to build

Implement the OpenTelemetry package as `otel(...)` against core telemetry hooks. The bridge should record sanitized **Delivery Observability** for verification, replay protection, idempotency, handler execution, response generation, duplicate status, ignored status, rejected status, and errors without recording payload contents by default.

## Acceptance criteria

- [ ] Core exposes stable telemetry hooks covering the delivery pipeline.
- [ ] The OpenTelemetry package exports `otel(...)` and implements those hooks without requiring core to depend on OpenTelemetry packages.
- [ ] Delivery spans or events include provider, event type when available, verification status, replay status, idempotency status, handler status, response status, and result status.
- [ ] Errors are recorded with sanitized metadata.
- [ ] Payload contents are not recorded by default.
- [ ] Tests verify emitted telemetry behavior for handled, ignored, duplicate, rejected, replay rejected, and handler-error outcomes.

## Blocked by

- [006-finalize-handler-dispatch-and-response-semantics.md](./006-finalize-handler-dispatch-and-response-semantics.md)
- [007-add-event-level-idempotency.md](./007-add-event-level-idempotency.md)
- [008-add-delivery-level-replay-protection.md](./008-add-delivery-level-replay-protection.md)
