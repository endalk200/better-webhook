id: 2026-05-19-002-build-core-endpoint-pipeline-tracer
title: Build Core Endpoint Pipeline Tracer
type: AFK
created: 2026-05-19

---

## Parent

[Initial SDK Release PRD](../prd.md)

## What to build

Implement the first end-to-end **Webhook Handling Pipeline** in core using a test **Provider Definition**. This slice should make `createWebhookEndpoint` real enough to accept a **Raw Delivery Request**, verify through the provider contract, extract a **Webhook Event**, dispatch construction-time event-specific **Event Handlers**, ignore unhandled events, and return stable core responses.

## Acceptance criteria

- [ ] Core exposes a provider-agnostic endpoint creation API with construction-time event handlers.
- [ ] A test provider can verify a delivery, extract an event envelope, and drive typed handler dispatch.
- [ ] Event-specific handlers receive a framework-neutral **Handler Context** containing the event, delivery, and abort signal.
- [ ] Verified events without a matching handler are ignored successfully by default.
- [ ] Handler return values are ignored; resolved handlers succeed and thrown or rejected handlers fail.
- [ ] Core pipeline tests cover handled, ignored, rejected, and handler-error paths using the test provider.

## Blocked by

- [001-scaffold-initial-sdk-packages.md](./001-scaffold-initial-sdk-packages.md)
