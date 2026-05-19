# Better Webhook

Better Webhook helps developers build robust webhook endpoints with provider-aware verification, payload handling, duplicate protection, replay protection, and observability.

## Language

**Webhook Endpoint**:
A developer-owned HTTP endpoint that receives webhook deliveries from exactly one provider.
_Avoid_: Handler, route, callback

**Webhook Handling Pipeline**:
The ordered runtime flow that turns an incoming webhook request into verified, protected, typed application handling.
_Avoid_: Utility chain, middleware stack

**Webhook Delivery**:
One HTTP delivery attempt from a provider to a webhook endpoint.
_Avoid_: Request, webhook, message

**Raw Delivery Request**:
The framework-neutral HTTP request representation that preserves method, URL, raw headers, abort signal, and unmodified raw body bytes for a webhook delivery.
_Avoid_: Framework request, parsed request, fetch request

**Webhook Event**:
The provider-defined business event represented by a webhook delivery payload.
_Avoid_: Delivery, payload, notification

**Event Envelope**:
The provider-defined metadata around a webhook event, such as event id, event type, and creation time.
_Avoid_: Payload, body, wrapper

**Event Payload**:
The provider-defined business data carried by a webhook event.
_Avoid_: Event, envelope, body

**Provider**:
An external service that sends webhook deliveries with its own signing, event, payload, and retry semantics.
_Avoid_: Vendor, integration

**Provider Definition**:
A provider package's implementation of the signing, event extraction, payload typing, and delivery semantics required by the webhook handling pipeline.
_Avoid_: Provider config, plugin, integration adapter

**Provider Secret**:
The directly configured secret a provider uses to sign webhook deliveries for one webhook endpoint.
_Avoid_: Secret resolver, credential, token

**Endpoint Identity**:
A stable developer-configured identifier used to distinguish one webhook endpoint from another in coordination keys and observability.
_Avoid_: Route, URL, handler name

**Framework Adapter**:
A package that translates between a framework's request/response objects and the core webhook handling pipeline.
_Avoid_: Provider adapter, integration, plugin

**Event Handler**:
Application code registered to process one or more verified webhook events.
_Avoid_: Callback, listener, consumer

**Handler Context**:
The framework-neutral values passed to an event handler for a verified webhook event.
_Avoid_: Request context, framework context, logger

**Idempotency**:
When configured, the coordination that lets a webhook endpoint process the same provider event at most once.
_Avoid_: Deduplication, duplicate delivery handling

**Replay Protection**:
The rejection of stale or previously observed signed webhook deliveries before application handling.
_Avoid_: Idempotency, duplicate handling

**Delivery Observability**:
The structured telemetry describing how a webhook delivery moved through verification, replay protection, idempotency, event handling, and response generation.
_Avoid_: Logging, tracing, metrics

**Idempotency Store**:
A durable coordination point used to reserve provider events before application handling.
_Avoid_: Cache, database, lock

**Idempotency Reservation**:
The in-progress claim that one webhook endpoint is currently processing one provider event.
_Avoid_: Duplicate, completion, lock

**Replay Store**:
A short-lived coordination point used to remember signed webhook deliveries during the replay protection window.
_Avoid_: Idempotency store, cache, nonce database

## Relationships

- A **Webhook Endpoint** runs one **Webhook Handling Pipeline** for each incoming delivery.
- A **Webhook Endpoint** belongs to exactly one **Provider**.
- A **Webhook Delivery** contains one **Webhook Event**.
- A **Raw Delivery Request** represents a **Webhook Delivery** before provider verification.
- A **Raw Delivery Request** preserves duplicate headers, header values, and raw body bytes without parsing or normalization that could change provider signature verification.
- A **Webhook Event** contains one **Event Envelope** and one **Event Payload**.
- One **Webhook Event** may be sent through multiple **Webhook Deliveries** when a provider retries delivery.
- A **Provider** defines the signing, event, payload, and retry semantics interpreted by a **Webhook Handling Pipeline**.
- A **Provider Definition** plugs provider-specific semantics into the provider-agnostic **Webhook Handling Pipeline**.
- A **Webhook Endpoint** uses one directly configured **Provider Secret**.
- A **Webhook Endpoint** uses one stable **Endpoint Identity** when configured coordination needs cross-delivery keys.
- A **Framework Adapter** does not implement provider verification, replay protection, idempotency, event parsing, or event dispatch.
- A **Framework Adapter** reports the raw header and raw body capabilities its framework can preserve.
- A **Webhook Handling Pipeline** dispatches verified **Webhook Events** to **Event Handlers**.
- A **Webhook Endpoint** is created with its **Event Handlers** already registered.
- A catch-all **Event Handler** can process verified **Webhook Events** without an event-specific handler.
- A **Handler Context** contains the **Webhook Event**, **Webhook Delivery**, and abort signal.
- An **Event Handler** succeeds by resolving and fails by throwing or rejecting.
- **Idempotency** is evaluated against **Webhook Events**, not individual **Webhook Deliveries**.
- **Replay Protection** is evaluated against **Webhook Deliveries**, not **Webhook Events**.
- A **Webhook Handling Pipeline** verifies raw delivery bytes before parsing the **Webhook Event**.
- A **Webhook Handling Pipeline** reads the raw body bytes exactly once before provider verification.
- A **Webhook Handling Pipeline** checks **Idempotency** before dispatching to **Event Handlers**.
- A **Webhook Handling Pipeline** exposes narrow extension points rather than general middleware.
- **Delivery Observability** describes **Webhook Delivery** processing without recording payload contents by default.
- An **Idempotency Store** supports **Idempotency** for **Webhook Events**.
- A **Replay Store** supports **Replay Protection** for **Webhook Deliveries**.
- An **Idempotency Store** creates an **Idempotency Reservation** before handling and marks it complete only after successful handling.
- Failed **Event Handlers** release the **Idempotency Reservation** by default.
- **Idempotency** is disabled unless a webhook endpoint is configured with an **Idempotency Store**.
- Provider timestamp tolerance is applied by default for **Replay Protection** when a provider supports signed timestamps.
- A **Replay Store** is optional and only adds seen-delivery tracking with provider-derived delivery replay keys when configured.
- A **Replay Store** remembers a signed **Webhook Delivery** only after the pipeline has accepted the delivery as processable enough to reach replay-store evaluation.
- Ignored and duplicate **Webhook Events** return successful responses by default.
- Failed **Event Handlers** return failure responses by default so providers can retry.
- Rejected **Webhook Deliveries** return failure responses by default.
- Provider packages type **Event Payloads** at compile time and validate **Event Envelopes** at runtime by default.

## Example dialogue

> **Dev:** "Should `@better-webhook/core` just expose signature verification helpers?"
> **Domain expert:** "No — the SDK should own the **Webhook Handling Pipeline**, while still exposing lower-level primitives for advanced use."
>
> **Dev:** "If Stripe retries `invoice.paid`, do we process a new **Webhook Event**?"
> **Domain expert:** "No — that is a new **Webhook Delivery** for the same **Webhook Event**."
>
> **Dev:** "Can one SDK **Webhook Endpoint** accept Stripe and GitHub deliveries?"
> **Domain expert:** "No — create one provider-specific **Webhook Endpoint** per provider."
>
> **Dev:** "Does core know that `stripe` is a built-in provider name?"
> **Domain expert:** "No — a Stripe **Provider Definition** is imported from `@better-webhook/stripe` and passed into core."
>
> **Dev:** "Should users always write a switch statement over event types?"
> **Domain expert:** "No — event-specific **Event Handlers** are the initial primary API; a broad single-handler is deferred unless it naturally falls out of lower-level primitives."
>
> **Dev:** "If Stripe retries the same event, should idempotency block the second HTTP attempt?"
> **Domain expert:** "It should block repeated processing of the same **Webhook Event**, while still treating the retry as a valid **Webhook Delivery**."
>
> **Dev:** "If someone resends an old signed request, is that idempotency?"
> **Domain expert:** "No — **Replay Protection** rejects stale or previously observed **Webhook Deliveries** before application handling."
>
> **Dev:** "Can we parse JSON before checking the signature?"
> **Domain expert:** "No — the **Webhook Handling Pipeline** verifies the raw **Webhook Delivery** before parsing the **Webhook Event**."
>
> **Dev:** "Should the Next.js package verify Stripe signatures itself?"
> **Domain expert:** "No — a **Framework Adapter** only adapts request and response types; core and the **Provider Definition** handle the delivery semantics."
>
> **Dev:** "Should observability include the full webhook payload?"
> **Domain expert:** "No — **Delivery Observability** records delivery metadata and processing outcomes, not payload contents by default."
>
> **Dev:** "Can the same Redis instance back both idempotency and replay protection?"
> **Domain expert:** "Yes, but the concepts remain separate: an **Idempotency Store** coordinates event processing, while a **Replay Store** remembers delivery attempts for a short window."
>
> **Dev:** "If the handler crashes after idempotency reservation, should retries be blocked?"
> **Domain expert:** "No — failed **Event Handlers** release the reservation by default so a later **Webhook Delivery** can retry the same **Webhook Event**."
>
> **Dev:** "Does the SDK silently use memory idempotency if no store is configured?"
> **Domain expert:** "No — **Idempotency** is disabled unless the **Webhook Endpoint** is configured with an **Idempotency Store**."
>
> **Dev:** "Does replay protection require a store before it does anything?"
> **Domain expert:** "No — provider timestamp tolerance is applied by default when available; a **Replay Store** only adds seen-delivery tracking."
>
> **Dev:** "Should a signed delivery consume its replay key if the event envelope cannot be extracted?"
> **Domain expert:** "No — the **Replay Store** only remembers a signed **Webhook Delivery** after the pipeline has accepted it as processable enough to reach replay-store evaluation."
>
> **Dev:** "Should ignored events fail so the provider retries?"
> **Domain expert:** "No — ignored and duplicate **Webhook Events** return success by default; failed handling and rejected **Webhook Deliveries** return failure by default."
>
> **Dev:** "Does a typed Stripe payload mean the SDK fully validates every Stripe object at runtime?"
> **Domain expert:** "No — provider packages type **Event Payloads** at compile time and validate **Event Envelopes** at runtime by default."
>
> **Dev:** "Can a webhook endpoint resolve different Stripe secrets per tenant?"
> **Domain expert:** "No — a **Webhook Endpoint** uses one directly configured **Provider Secret** in the initial SDK design."
>
> **Dev:** "How does idempotency distinguish two endpoints receiving similar provider events?"
> **Domain expert:** "Configured coordination uses a stable **Endpoint Identity** as part of its keys."
>
> **Dev:** "Can users register event handlers after endpoint creation?"
> **Domain expert:** "No — a **Webhook Endpoint** is created with its **Event Handlers** already registered."
>
> **Dev:** "What happens to a verified event type without a specific handler?"
> **Domain expert:** "It is ignored by default, unless the **Webhook Endpoint** was created with a catch-all **Event Handler**."
>
> **Dev:** "Can a Next.js route object be used inside an event handler?"
> **Domain expert:** "No — **Handler Context** is framework-neutral and contains only the event, delivery, and abort signal."
>
> **Dev:** "Can an event handler return a custom HTTP response?"
> **Domain expert:** "No — an **Event Handler** succeeds by resolving and fails by throwing or rejecting; the endpoint response is controlled by the pipeline."
>
> **Dev:** "Can core rely directly on a framework request object?"
> **Domain expert:** "No — core receives a **Raw Delivery Request** so raw body bytes remain explicit and framework-neutral."
>
> **Dev:** "Can an adapter pass a parsed JSON body into core?"
> **Domain expert:** "No — a **Raw Delivery Request** must preserve raw body bytes and raw headers so provider signature verification remains correct."
>
> **Dev:** "Can every framework adapter preserve duplicate raw header lines?"
> **Domain expert:** "No — each **Framework Adapter** must report the raw header and raw body capabilities its framework can preserve."
>
> **Dev:** "Is a concurrently processing provider event a completed duplicate?"
> **Domain expert:** "No — it is an **Idempotency Reservation** and must not be acknowledged as a completed duplicate."
>
> **Dev:** "Can users insert middleware before signature verification?"
> **Domain expert:** "No — the **Webhook Handling Pipeline** is closed around security-critical ordering and exposes only narrow extension points."

## Flagged ambiguities

- "Core package" was ambiguous between a primitive utility package and the owner of the full runtime flow — resolved: core owns the **Webhook Handling Pipeline** and exports lower-level primitives as escape hatches.
- "webhook" was ambiguous between an HTTP attempt and the business event inside it — resolved: use **Webhook Delivery** for the HTTP attempt and **Webhook Event** for the provider-defined business event.
- "payload" was ambiguous between the whole request body and business data inside an event — resolved: use **Event Envelope** for event metadata and **Event Payload** for business data.
- "endpoint" was ambiguous between a generic HTTP route and a provider-specific SDK runtime object — resolved: one **Webhook Endpoint** is bound to exactly one **Provider**.
- "provider package" was ambiguous between a framework adapter and a core-known provider switch — resolved: provider packages export **Provider Definitions** that plug into core.
- "secret" was ambiguous between a direct value and a runtime resolver — resolved: a **Provider Secret** is directly configured for one **Webhook Endpoint**.
- "endpoint identity" was implicit in idempotency and replay keys — resolved: use **Endpoint Identity** for stable developer-configured coordination identity.
- "adapter" was ambiguous between provider semantics and framework integration — resolved: **Provider Definitions** handle provider semantics, while **Framework Adapters** only translate request and response types.
- "handler" was ambiguous between the whole endpoint and application event processing code — resolved: use **Webhook Endpoint** for the HTTP-facing SDK object and **Event Handler** for application code that processes verified events.
- "handler context" was ambiguous with framework request context — resolved: **Handler Context** is framework-neutral.
- "idempotent endpoint" was ambiguous between accepting each delivery once and processing each event once — resolved: **Idempotency** applies to **Webhook Events**.
- "idempotency guarantee" was overstated because idempotency is disabled without a store — resolved: **Idempotency** is a configured coordination capability, not an unconditional endpoint guarantee.
- "duplicate" was ambiguous between an in-progress reservation and a completed event — resolved: only completed events are duplicate successes; in-progress **Idempotency Reservations** are distinct.
- "replay protection" was ambiguous with idempotency — resolved: **Replay Protection** applies to signed **Webhook Deliveries** before event handling.
- "store" was ambiguous between durable event coordination and short-lived delivery replay tracking — resolved: use **Idempotency Store** and **Replay Store** separately.
