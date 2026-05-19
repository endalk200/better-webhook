id: 2026-05-19-009-build-nextjs-adapter-tracer
title: Build Next.js Adapter Tracer
type: AFK
created: 2026-05-19

---

## Parent

[Initial SDK Release PRD](../prd.md)

## What to build

Build the Next.js **Framework Adapter** for route handlers. The adapter should translate Next.js request and response objects to and from core while preserving raw delivery bytes and signature-relevant headers available from the framework, declaring any raw header capability limits, and proving the path with a Stripe endpoint.

## Acceptance criteria

- [ ] Next.js adapter exposes a route-handler-compatible API for a core webhook endpoint.
- [ ] The adapter preserves raw body bytes and signature-relevant headers available from the Next.js request.
- [ ] The adapter documents whether duplicate raw header lines are available or lost through the Next.js request abstraction.
- [ ] The adapter translates core responses into framework responses without changing pipeline semantics.
- [ ] Tests cover successful Stripe handling, rejected delivery propagation, raw body preservation, declared header capability limits, and response translation.
- [ ] Adapter docs describe raw request constraints and supported Next.js runtime expectations.

## Blocked by

- [003-preserve-raw-delivery-requests.md](./003-preserve-raw-delivery-requests.md)
- [004-implement-stripe-signature-verification.md](./004-implement-stripe-signature-verification.md)
- [006-finalize-handler-dispatch-and-response-semantics.md](./006-finalize-handler-dispatch-and-response-semantics.md)
