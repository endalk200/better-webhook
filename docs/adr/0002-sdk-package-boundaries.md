# SDK package boundaries

The SDK is split into a provider-agnostic core package, provider definition packages, framework adapter packages, and an OpenTelemetry implementation package. Core owns the webhook handling pipeline and stable contracts; provider packages plug in provider-specific delivery semantics; framework adapters only translate request and response objects; and the OpenTelemetry package implements core telemetry hooks so security and retry behavior do not drift across providers or frameworks.

Each SDK package exposes public API through its root package entrypoint only. The root `src/index.ts` file is the explicit public API manifest for that package and should contain named exports for the symbols intentionally exposed to users. Implementation files may export symbols for local package structure, but those exports are not public unless re-exported by the root entrypoint.

Provider package root APIs stay focused on provider factories, provider options, provider event/envelope/payload types, and small user-facing event type helpers. Provider crypto, signature parsing, replay-key construction, envelope parsing, and raw header readers are implementation details unless a separate testing or advanced-use API is intentionally designed for them.

Framework adapter root APIs expose the ready-to-use framework integration plus explicit request/response conversion helpers and raw header/body capability metadata. These helpers are part of the adapter responsibility because users may need to compose Better Webhook with custom routing, authentication, logging, or framework-specific error handling while still preserving the core `RawDeliveryRequest` contract.

The core package root API exposes the endpoint factory, public pipeline contracts, response policy contracts, telemetry contracts, and intentionally supported local-development store factories. Low-level request normalization and header lookup helpers are pipeline/provider implementation details, not stable user-facing core API.

Testing-oriented provider helpers, such as signature-header builders and signature parsers, remain package-private until a supported external testing API is intentionally designed. A future testing subpath can be added compatibly, but publishing one now would prematurely stabilize helper shapes around current internals.

The OpenTelemetry package exposes the `otel` telemetry factory and the small structural tracer/span contracts needed by its options type. These package-scoped `OtelTracer` and `OtelSpan` names describe Better Webhook's minimum accepted OpenTelemetry-compatible shape rather than re-exporting official OpenTelemetry API types.
