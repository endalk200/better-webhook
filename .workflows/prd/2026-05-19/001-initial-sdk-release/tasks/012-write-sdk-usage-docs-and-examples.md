id: 2026-05-19-012-write-sdk-usage-docs-and-examples
title: Write SDK Usage Docs and Examples
type: AFK
created: 2026-05-19

---

## Parent

[Initial SDK Release PRD](../prd.md)

## What to build

Write initial SDK documentation and examples that explain the **Webhook Handling Pipeline**, Stripe setup, Next.js and Express adapters, idempotency configuration, replay protection, OpenTelemetry configuration, raw request constraints, typed payload limits, and initial-release non-goals.

## Acceptance criteria

- [ ] Core docs explain the endpoint pipeline, handler registration, handler context, exact default response statuses, idempotency, required endpoint identity for idempotency, replay protection, and extension points.
- [ ] Stripe docs explain signing secret configuration, timestamp tolerance, curated event typing, unknown fallback events, and compile-time typing versus runtime envelope validation.
- [ ] Next.js docs show a raw-body-safe route-handler setup with Stripe.
- [ ] Next.js and Express docs declare raw body and raw header preservation limits.
- [ ] Express docs show the required raw-body setup order and a working Stripe endpoint.
- [ ] OpenTelemetry docs show `otel(...)` configuration and document sanitized payload behavior.
- [ ] Docs clearly state initial non-goals: GitHub, exhaustive Stripe types, production storage adapters, secret resolvers, multi-provider endpoints, middleware, Edge, browser, and CommonJS.
- [ ] Documentation examples are covered by typecheck or tests where practical.

## Blocked by

- [004-implement-stripe-signature-verification.md](./004-implement-stripe-signature-verification.md)
- [005-add-stripe-event-typing-and-unknown-fallback.md](./005-add-stripe-event-typing-and-unknown-fallback.md)
- [007-add-event-level-idempotency.md](./007-add-event-level-idempotency.md)
- [008-add-delivery-level-replay-protection.md](./008-add-delivery-level-replay-protection.md)
- [009-build-nextjs-adapter-tracer.md](./009-build-nextjs-adapter-tracer.md)
- [010-build-express-adapter-tracer.md](./010-build-express-adapter-tracer.md)
- [011-add-opentelemetry-bridge.md](./011-add-opentelemetry-bridge.md)
