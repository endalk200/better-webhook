id: 2026-05-19-010-build-express-adapter-tracer
title: Build Express Adapter Tracer
type: AFK
created: 2026-05-19

---

## Parent

[Initial SDK Release PRD](../prd.md)

## What to build

Build the Express **Framework Adapter** with explicit raw-body setup expectations. The adapter should translate Express request and response objects to and from core while preserving raw delivery bytes and signature-relevant headers available from Express, declaring any raw header capability limits, and proving the path with a Stripe endpoint.

## Acceptance criteria

- [ ] Express adapter exposes middleware or handler integration for a core webhook endpoint.
- [ ] The adapter documents and enforces the raw-body prerequisites needed before parsed body middleware mutates the request.
- [ ] The adapter preserves raw body bytes and duplicate or signature-relevant headers where Express exposes them.
- [ ] The adapter documents which duplicate/raw header information is sourced from Express and where it is unavailable.
- [ ] The adapter translates core responses into Express responses without changing pipeline semantics.
- [ ] Tests cover successful Stripe handling, rejected delivery propagation, raw body expectations, declared header capability limits, header preservation where available, and response translation.

## Blocked by

- [003-preserve-raw-delivery-requests.md](./003-preserve-raw-delivery-requests.md)
- [004-implement-stripe-signature-verification.md](./004-implement-stripe-signature-verification.md)
- [006-finalize-handler-dispatch-and-response-semantics.md](./006-finalize-handler-dispatch-and-response-semantics.md)
