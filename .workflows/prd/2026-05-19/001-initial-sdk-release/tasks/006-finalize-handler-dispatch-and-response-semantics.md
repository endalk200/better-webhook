id: 2026-05-19-006-finalize-handler-dispatch-and-response-semantics
title: Finalize Handler Dispatch and Response Semantics
type: AFK
created: 2026-05-19

---

## Parent

[Initial SDK Release PRD](../prd.md)

## What to build

Complete the core dispatch and response policy behavior for handled, ignored, duplicate, rejected, unsupported, and handler-error outcomes. This slice should make provider-facing HTTP behavior consistent and minimal while leaving detailed outcome information to results and telemetry.

## Acceptance criteria

- [ ] Event-specific handlers win over catch-all handlers.
- [ ] Verified unhandled events are ignored successfully by default.
- [ ] Rejected deliveries return failure responses by default.
- [ ] Handler errors return failure responses by default so providers can retry.
- [ ] Successful, ignored, and duplicate outcomes return minimal successful response bodies.
- [ ] Tests cover default response mapping and configurable response policy where exposed.

## Blocked by

- [002-build-core-endpoint-pipeline-tracer.md](./002-build-core-endpoint-pipeline-tracer.md)
