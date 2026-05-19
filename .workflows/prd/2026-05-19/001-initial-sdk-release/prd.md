# Better Webhook Initial SDK Release PRD

## Problem Statement

Developers building webhook endpoints repeatedly rebuild the same fragile pieces: raw-body signature verification, provider-specific event typing, duplicate event protection, replay protection, framework request adaptation, and observability. These concerns are security-sensitive and order-sensitive, but most application code handles them through ad hoc utilities or framework-specific examples that are easy to assemble incorrectly.

Better Webhook needs an initial SDK package set that gives developers a robust **Webhook Handling Pipeline** for a provider-specific **Webhook Endpoint**, while still exposing focused primitives and extension points for advanced use. The first release must prove the architecture with Stripe, Next.js, Express, and OpenTelemetry support without overextending into every provider, runtime, storage backend, or event schema.

## Solution

Build an npm-distributed SDK under `@better-webhook/**` with five initial packages: core, Stripe provider support, Next.js adapter, Express adapter, and OpenTelemetry support.

The SDK will make the **Webhook Endpoint** the main developer-facing object. Each endpoint belongs to exactly one **Provider**, uses one directly configured **Provider Secret**, and runs one closed **Webhook Handling Pipeline** for every **Webhook Delivery**. The pipeline will preserve raw headers, duplicate header values, and unmodified raw body bytes; verify signatures before parsing; apply provider timestamp-based **Replay Protection** where supported; optionally coordinate **Idempotency** through an explicit **Idempotency Store**; extract the **Event Envelope**; type the **Event Payload**; dispatch construction-time **Event Handlers**; record **Delivery Observability**; and return provider-appropriate HTTP responses.

The initial package boundaries are intentionally strict. Core owns the provider-agnostic pipeline, contracts, result model, memory stores, and telemetry hooks. Provider packages export **Provider Definitions** that plug provider semantics into core. Framework adapters only translate framework request and response objects into core's **Raw Delivery Request** and response contract. The OpenTelemetry package implements core telemetry hooks without making core depend directly on OpenTelemetry libraries.

## User Stories

1. As an application developer, I want to create a Stripe **Webhook Endpoint**, so that I can receive Stripe webhook deliveries with less custom security code.
2. As an application developer, I want the SDK to verify Stripe signatures using raw body bytes, so that valid provider deliveries are accepted and tampered deliveries are rejected.
3. As an application developer, I want signature verification to happen before JSON parsing, so that provider signing semantics are preserved.
4. As an application developer, I want one endpoint to belong to exactly one provider, so that provider semantics stay explicit and predictable.
5. As an application developer, I want to configure one directly passed Stripe signing secret, so that the initial endpoint setup is simple and auditable.
6. As an application developer, I want event-specific handlers, so that each handler receives a correctly narrowed **Webhook Event** type.
7. As an application developer, I want handlers registered when the endpoint is created, so that endpoint behavior is immutable and easy to reason about.
8. As an application developer, I want a catch-all handler for verified events without event-specific handlers, so that I can observe or process unmodeled provider events deliberately.
9. As an application developer, I want unhandled verified events to be ignored successfully by default, so that providers do not retry events my app intentionally does not process.
10. As an application developer, I want duplicate completed events to return success by default, so that legitimate provider retries stop retrying after idempotency has already completed.
11. As an application developer, I want handler failures to return failure by default, so that providers can retry when my application did not finish processing.
12. As an application developer, I want rejected deliveries to return failure by default, so that invalid signatures and replay violations are not acknowledged as successful.
13. As an application developer, I want **Idempotency** to deduplicate **Webhook Events** rather than **Webhook Deliveries**, so that provider retry attempts do not repeat business processing.
14. As an application developer, I want idempotency to be disabled unless I configure an **Idempotency Store**, so that the SDK does not pretend in-memory process state is production safety.
15. As an application developer, I want memory idempotency support for tests and local development, so that I can verify duplicate behavior without adding infrastructure.
16. As an application developer, I want idempotency reservation before handler execution, so that concurrent deliveries for the same event do not both process.
17. As an application developer, I want idempotency marked complete only after successful handling, so that failed business work does not get treated as processed.
18. As an application developer, I want failed handlers to release idempotency reservations by default, so that provider retries can recover from transient failures.
19. As an application developer, I want **Replay Protection** to be separate from **Idempotency**, so that stale or repeated signed delivery attempts are treated as security events rather than duplicate business events.
20. As an application developer, I want provider timestamp tolerance enforced by default when the provider supports signed timestamps, so that stale signed requests are rejected without requiring a store.
21. As an application developer, I want optional seen-delivery tracking through a **Replay Store**, so that I can strengthen replay protection when I have shared storage.
22. As an application developer, I want memory replay support for tests and local development, so that replay behavior can be exercised without external infrastructure.
23. As an application developer, I want the handler context to contain only the **Webhook Event**, **Webhook Delivery**, and abort signal, so that handlers remain framework-neutral.
24. As an application developer, I want handler return values ignored, so that HTTP response semantics are controlled consistently by the pipeline instead of individual handlers.
25. As a Next.js developer, I want a Next.js adapter, so that I can expose a Better Webhook endpoint from route handlers without rewriting the pipeline.
26. As an Express developer, I want an Express adapter, so that I can mount a Better Webhook endpoint while preserving raw body bytes.
27. As a framework user, I want adapters to avoid provider verification logic, so that all frameworks share the same security behavior.
28. As an observability-focused developer, I want OpenTelemetry support, so that webhook processing appears in distributed traces and metrics.
29. As a security-conscious developer, I want telemetry to avoid payload contents by default, so that sensitive webhook data is not accidentally exported.
30. As an operator, I want delivery spans and attributes for provider, event type, verification result, replay result, idempotency result, handler result, and response status, so that I can diagnose webhook behavior.
31. As a TypeScript developer, I want Stripe event-specific payload typing for a curated initial set of common events, so that handler code has useful types without claiming total Stripe coverage.
32. As a TypeScript developer, I want unknown Stripe event types to remain verified and catch-all handleable, so that the SDK remains useful when Stripe sends events outside the curated map.
33. As a maintainer, I want provider packages to validate **Event Envelopes** at runtime by default, so that required metadata extraction is reliable.
34. As a maintainer, I want full provider payload runtime validation deferred or optional, so that incomplete schemas do not reject valid provider deliveries.
35. As a maintainer, I want Stripe verification implemented without depending on the official Stripe package initially, so that dependency weight and release coupling stay low.
36. As a maintainer, I want provider compatibility tests using raw bytes and real signature semantics, so that provider packages prove behavior beyond simple happy-path unit tests.
37. As a maintainer, I want core to expose lower-level primitives where appropriate, so that advanced users and adapters can test or compose focused behavior without bypassing the supported endpoint API.
38. As a maintainer, I want the pipeline to expose narrow extension points rather than general middleware, so that users cannot accidentally reorder security-critical steps.
39. As a package consumer, I want the SDK to target Node.js 18+ and ESM, so that the initial package contract is modern and testable.
40. As a package consumer, I want TypeScript declarations published with every SDK package, so that the SDK is usable in typed applications.
41. As a future contributor, I want package boundaries documented, so that provider logic does not drift into adapters or core-specific provider switches.
42. As a future contributor, I want runtime and module-format constraints documented, so that Edge, browser, and CommonJS support are not accidentally assumed.

## Implementation Decisions

- The initial package set is core, Stripe provider support, Next.js adapter, Express adapter, and OpenTelemetry support.
- Core owns the **Webhook Handling Pipeline** and exports provider-agnostic contracts, lower-level primitives, memory stores, result types, telemetry hooks, request and response abstractions, and the endpoint creation API.
- A **Webhook Endpoint** is the high-level core object. It belongs to exactly one **Provider**, uses one directly configured **Provider Secret**, and is created with its **Event Handlers** already registered.
- Provider packages export **Provider Definitions**. Core must not contain a built-in switch over provider names.
- Framework adapters are intentionally thin. They translate framework-specific request and response objects to and from core abstractions and must not reimplement provider verification, replay protection, idempotency, event parsing, event dispatch, or telemetry semantics.
- The OpenTelemetry package implements core telemetry hooks. Core defines the telemetry contract without taking a direct dependency on OpenTelemetry packages.
- The canonical pipeline order is: adapt framework request to raw core request, read raw body bytes exactly once, verify provider signature, enforce replay protection, extract provider event metadata, check idempotency, parse and type or narrow the payload, dispatch the event handler, record result and telemetry, and return the framework response.
- Core uses a small **Raw Delivery Request** abstraction that preserves method, URL, raw headers, duplicate header values, abort signal, and unmodified raw body bytes. Fetch-compatible conveniences may exist, but framework objects are not the core contract.
- Adapters must not pass parsed JSON bodies, reserialized bodies, decompressed bodies, or header-normalized representations into core when those transformations could change provider signature verification semantics.
- Core returns a small provider-agnostic response contract that adapters translate into framework responses.
- General middleware and arbitrary before/after hooks are out of scope for the first release. Extension points are limited to provider config, idempotency store, replay store, telemetry implementation, response policy, and event handlers.
- Event-specific handlers are the primary ergonomic API. A broad single-handler API is not part of the agreed initial shape unless it naturally falls out of lower-level primitives.
- Handler registration is construction-time only. Fluent registration is out of scope for the first release.
- A catch-all event handler is supported through an explicit catch-all handler entry. Event-specific handlers win over the catch-all handler.
- Without a matching event-specific handler or catch-all handler, a verified event is ignored and returns success by default.
- **Handler Context** contains only the **Webhook Event**, **Webhook Delivery**, and abort signal. Framework request or response objects are not exposed to event handlers.
- Handler return values are ignored. A handler succeeds by resolving and fails by throwing or rejecting.
- Default response semantics are: handled events return success, ignored events return success, duplicate completed events return success, invalid signatures return failure, replay rejects return failure, unsupported invalid input returns failure, and handler errors return failure.
- Response bodies should be minimal by default and avoid event details. Detailed outcomes belong in telemetry or logs rather than provider-facing responses.
- **Idempotency** applies to **Webhook Events**, not **Webhook Deliveries**. The default idempotency key is derived from provider identity, endpoint identity, and provider event id when available.
- Idempotency is disabled unless an **Idempotency Store** is configured. Core must not silently enable memory idempotency for production paths.
- Core provides memory idempotency support for tests and local development.
- The **Idempotency Store** contract must support atomic reservation before handling, completion after successful handling, and failure handling that releases the reservation by default.
- If the provider does not expose a stable event id, idempotency cannot be enabled by default and should require an explicit user-supplied key strategy in a later design.
- **Replay Protection** applies to signed **Webhook Deliveries**, not **Webhook Events**.
- Provider timestamp tolerance is applied by default for replay protection when a provider supports signed timestamps.
- A **Replay Store** is optional and only adds seen-delivery tracking during the replay protection window.
- Core provides memory replay support for tests and local development.
- Idempotency store and replay store are separate concepts even if one future backend can implement both interfaces.
- Stripe is the first provider. GitHub and additional providers are deferred.
- The Stripe package implements signature header parsing, HMAC verification, timestamp tolerance, event envelope extraction, event id extraction, event type extraction, created-time extraction, a curated TypeScript event map, and unknown-event fallback behavior.
- The Stripe package does not depend on the official Stripe package initially.
- The first Stripe event map is intentionally curated rather than exhaustive. It should include common checkout, invoice, subscription, and payment intent events and represent all other verified events through an unknown fallback event type.
- Provider packages type **Event Payloads** at compile time and validate **Event Envelopes** at runtime by default.
- Full runtime validation of every provider payload is out of scope for the first release.
- Provider secrets are directly passed values only in the first release. Runtime secret resolvers and tenant-based secret selection are out of scope.
- The OpenTelemetry implementation records delivery-level telemetry for verification, replay protection, idempotency, handler execution, response generation, duplicate status, ignored status, rejected status, and errors.
- Delivery observability must avoid recording payload contents by default.
- The SDK targets Node.js 18+ for the initial release.
- Initial SDK packages are ESM-only and publish TypeScript declarations.
- Edge runtimes, browser usage, and CommonJS compatibility are deferred.
- The package architecture follows the accepted package-boundary decision in the local ADRs.
- The runtime and package format follow the accepted Node.js 18 and ESM-only decision in the local ADRs.

### Deep Modules To Build

- Endpoint pipeline module: encapsulates the end-to-end **Webhook Handling Pipeline** behind a stable endpoint interface.
- Raw body module: handles reading and preserving raw delivery bytes exactly once without normalization, decompression, reserialization, or other byte-changing transformations.
- Provider definition contract module: defines the interface provider packages implement for verification, envelope extraction, payload typing, and capability reporting.
- Result and response policy module: maps pipeline outcomes to stable result statuses and HTTP responses.
- Idempotency coordinator module: encapsulates event-level reservation, completion, duplicate detection, failure release, and TTL behavior behind the **Idempotency Store** contract.
- Replay protection coordinator module: encapsulates timestamp tolerance and optional seen-delivery tracking behind the **Replay Store** contract.
- Handler dispatch module: performs event-specific dispatch, catch-all dispatch, ignored-event behavior, handler failure capture, and abort signal propagation.
- Telemetry contract module: defines delivery observability hooks that core calls consistently without depending on OpenTelemetry.
- Stripe verifier module: encapsulates Stripe signature parsing, signed payload construction, HMAC verification, timestamp tolerance, and failure reasons.
- Stripe envelope module: extracts stable event metadata and returns known or unknown event shapes.
- Framework request adapter modules: convert Next.js and Express request/response objects into and out of core abstractions while preserving raw bytes.
- OpenTelemetry bridge module: converts core telemetry hook calls into OpenTelemetry spans, attributes, events, and error records.

## Testing Decisions

- Tests should verify externally observable behavior: accepted or rejected deliveries, handler invocation, idempotency behavior, replay behavior, response status, typed dispatch behavior, adapter behavior, and emitted telemetry contract calls.
- Tests should avoid asserting private implementation details such as internal helper call ordering unless that ordering is externally security-relevant.
- Core pipeline tests must cover successful handling, ignored events, catch-all handling, handler failure, response policy mapping, raw-body preservation, rejected verification, replay rejection, idempotency duplicate behavior, and idempotency release-on-failure.
- Idempotency coordinator tests must cover atomic reservation semantics, duplicate completed events, release-on-failure, completion-after-success, TTL behavior where applicable, and concurrent delivery scenarios where practical.
- Replay protection tests must cover timestamp tolerance acceptance and rejection, optional seen-delivery tracking, no-store behavior, and separation from idempotency.
- Store interface tests must run against memory stores and should be reusable for future production storage adapters.
- Stripe compatibility tests must use raw byte fixtures and real Stripe signing semantics. They must cover valid signatures, invalid signatures, wrong secrets, stale timestamps, multiple signatures, body mutation after signing, event envelope extraction, unknown event fallback, catch-all dispatch, idempotency with Stripe event ids, and handler failure idempotency release.
- Stripe tests should compare behavior against Stripe's documented signature algorithm rather than merely testing JavaScript object parsing.
- Next.js adapter tests must verify request conversion, raw body preservation, raw header preservation where available, response translation, rejected delivery propagation, and successful handler invocation through the adapter.
- Express adapter tests must verify raw body handling expectations, duplicate/raw header preservation where available, request conversion, response translation, rejected delivery propagation, successful handler invocation, and failure response behavior.
- OpenTelemetry tests must verify that delivery spans or telemetry calls include provider, event type when available, verification status, replay status, idempotency status, handler status, response status, duplicate status, ignored status, and sanitized errors.
- Telemetry tests must verify that payload contents are not recorded by default.
- Type-level tests should verify event-specific handler payload narrowing, catch-all fallback typing, unknown event behavior, provider definition inference, and handler context shape.
- Package tests should verify ESM exports and TypeScript declarations for each initial SDK package.
- Prior art in the current repo includes package-level lint, typecheck, test, build, and format tasks run through the existing monorepo workflow. New SDK packages should integrate into those same verification commands.
- Final verification for implementation work should include formatting check, lint, type checking, tests, and build through the project workflow.

## Out of Scope

- GitHub and additional provider packages.
- Exhaustive Stripe event type coverage.
- Full runtime validation of every Stripe event payload.
- Runtime secret resolvers or tenant-based secret selection.
- Multi-provider webhook endpoints.
- General middleware or arbitrary pipeline hooks.
- Fluent event handler registration.
- Framework-specific objects inside event handlers.
- Handler-controlled HTTP responses.
- Production storage adapters such as Redis, Upstash, or Postgres.
- Managed webhook delivery infrastructure.
- CLI changes, template catalog changes, capture gateway changes, and replay CLI behavior.
- Edge runtime support.
- Browser support.
- CommonJS publishing.
- Browser bundles.
- Provider dashboard automation.

## Further Notes

- The domain glossary in the root context document is the source of truth for terms such as **Webhook Endpoint**, **Webhook Delivery**, **Webhook Event**, **Event Envelope**, **Event Payload**, **Provider Definition**, **Framework Adapter**, **Idempotency**, **Replay Protection**, **Idempotency Store**, **Replay Store**, **Handler Context**, and **Delivery Observability**.
- The package-boundary and Node.js 18 ESM-only decisions are recorded as local ADRs and should be treated as constraints during implementation.
- The initial API should optimize for correctness and consistency over maximal flexibility. Features that weaken security ordering or introduce runtime ambiguity should be deferred until there is a concrete use case and a narrow contract.
- Documentation should make absence of idempotency explicit when no store is configured, and should explain the difference between event-level idempotency and delivery-level replay protection.
- Documentation should explain that typed payloads are compile-time ergonomics in the first release and do not imply full runtime schema validation of all provider payloads.
- Documentation should explain the raw request contract, including why adapters must preserve raw body bytes and signature-relevant headers before JSON parsing or other transformations.
- Documentation should include Next.js and Express examples that demonstrate raw-body-safe setup, Stripe provider configuration, event-specific handlers, catch-all handlers, idempotency configuration, and OpenTelemetry configuration.
