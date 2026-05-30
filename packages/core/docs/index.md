# @better-webhook/core Agent Guide

## Package role

`@better-webhook/core` owns the provider-agnostic Webhook Handling Pipeline. Use it to create one Webhook Endpoint for one Provider Definition, verify raw delivery bytes before parsing, dispatch verified Webhook Events to Event Handlers, apply optional Idempotency and Replay Protection, map pipeline outcomes to HTTP responses, and emit Delivery Observability.

Core does not know Stripe, GitHub, Express, Next.js, or OpenTelemetry-specific behavior. Provider packages supply Provider Definitions. Framework Adapter packages translate framework request/response objects into core contracts.

## Install

```sh
npm install @better-webhook/core
```

Most applications also install one provider package and one framework adapter:

```sh
npm install @better-webhook/core @better-webhook/stripe @better-webhook/nextjs
```

## Primary APIs

- `createWebhookEndpoint(options)`: creates a Webhook Endpoint with handlers registered up front.
- `endpoint.handle(request)`: accepts a `RawDeliveryRequest` and returns a `WebhookResponse`.
- `endpoint.handleWithResult(request)`: returns both the `WebhookResponse` and `PipelineResult`; useful for tests and custom observability.
- `defaultResponsePolicy(result)`: maps pipeline outcomes to default JSON responses.

`createWebhookEndpoint` options:

- `provider`: required `ProviderDefinition`.
- `handlers`: event-specific handlers plus optional `"*"` catch-all handler.
- `endpointIdentity`: required when `idempotencyStore` or `replayStore` is configured.
- `idempotencyStore`: optional event-level coordination store.
- `idempotencyTtlMs`: optional TTL passed to the idempotency store.
- `replayStore`: optional seen-delivery tracking store.
- `replayWindowMs`: timestamp tolerance and replay-store TTL; default is 5 minutes.
- `now`: clock override for signed timestamp replay checks.
- `responsePolicy`: custom `PipelineResult` to `WebhookResponse` mapper.
- `telemetry`: optional Delivery Observability hooks.
- `catchAllHandlerScope`: `"all"` by default; `"unknown"` means the catch-all only handles unknown provider event types.

## Adapter and provider authoring contracts

- `ProviderDefinition`: provider contract with `verify(delivery)` and `extractEvent(delivery)`.
- `RawDeliveryRequest`: framework-neutral request shape with method, URL, raw headers, body, and optional abort signal.
- `RawHeaderCapabilities`: adapter metadata describing raw body and duplicate-header preservation.

## In-memory stores

- `createMemoryIdempotencyStore()`: in-memory `IdempotencyStore` with `size()`.
- `createMemoryReplayStore()`: in-memory `ReplayStore` with `size()`.

These stores are for tests, examples, and local development. They are not durable production coordination stores.

## Types and contracts

Request and delivery contracts:

- `RawHeaderValue`
- `RawDeliveryRequest`
- `RawHeaderCapabilities`
- `WebhookDelivery`

Provider contracts:

- `ProviderDefinition`
- `ProviderVerificationSuccess`
- `ProviderVerificationFailure`
- `ProviderVerificationResult`
- `WebhookEvent`

Handler and endpoint contracts:

- `HandlerContext`
- `EventHandler`
- `EventHandlerMap`
- `CatchAllHandlerScope`
- `CreateWebhookEndpointOptions`
- `WebhookEndpoint`

Coordination contracts:

- `IdempotencyReservation`
- `IdempotencyStore`
- `ReplayStore`

Result, response, and telemetry contracts:

- `PipelineResultStatus`
- `PipelineResult`
- `WebhookResponse`
- `ResponsePolicy`
- `TelemetryDeliveryStart`
- `TelemetryDeliveryEnd`
- `DeliveryTelemetryContext`
- `DeliveryTelemetry`

Event handlers receive a framework-neutral `HandlerContext` with `event`, `delivery`, and optional `signal`. They do not receive Express, Next.js, or provider SDK request objects.

## Canonical example

```ts
import { createWebhookEndpoint, createMemoryIdempotencyStore } from "@better-webhook/core";
import { stripe } from "@better-webhook/stripe";

export const endpoint = createWebhookEndpoint({
  provider: stripe({ signingSecret: process.env.STRIPE_WEBHOOK_SECRET! }),
  endpointIdentity: "stripe-production",
  idempotencyStore: createMemoryIdempotencyStore(),
  handlers: {
    "checkout.session.completed": async ({ event }) => {
      event.payload.payment_status;
    },
    "invoice.paid": async ({ event }) => {
      event.payload.status;
    },
    "*": async ({ event }) => {
      event.type;
    },
  },
});
```

## Behavior defaults

Pipeline order:

1. Read raw body bytes exactly once.
2. Verify the delivery with the Provider Definition.
3. Apply signed timestamp Replay Protection when the provider supplies a signed timestamp.
4. Extract the provider Event Envelope and Event Payload.
5. Validate coordination prerequisites, such as requiring an event id when Idempotency is configured.
6. Apply optional Replay Store tracking.
7. Apply optional event-level Idempotency.
8. Dispatch the specific Event Handler or catch-all Event Handler.
9. Finish telemetry and map the result to an HTTP response.

Default responses:

- `200`: `handled`, `ignored`, `duplicate`.
- `409`: `in_progress`.
- `400`: `rejected`, `unsupported`.
- `500`: `handler_error`.

Idempotency is disabled unless an `IdempotencyStore` is configured. Replay Store tracking is disabled unless a `ReplayStore` is configured. Provider signed timestamp replay checks run when the provider returns `signedTimestamp`.

## Gotchas

- One Webhook Endpoint is bound to one Provider.
- Provider signatures must be verified against unmodified raw body bytes.
- A parsed JSON body is not a valid replacement for raw delivery bytes.
- Handler return values are ignored; resolving succeeds and throwing or rejecting fails.
- Ignored events and completed duplicates return success by default.
- Failed handlers release a reserved idempotency claim by default so a provider retry can process again.
- `endpointIdentity` must be stable when coordination stores are configured because it scopes coordination keys.

## Do / do not

Do create endpoints with all handlers registered up front.
Do use framework adapters to supply `RawDeliveryRequest` correctly.
Do implement durable `IdempotencyStore` and `ReplayStore` implementations for production coordination.

Do not put framework request objects in Event Handlers.
Do not parse JSON before provider verification.
Do not create one endpoint that accepts multiple providers.
Do not use the in-memory stores as production durability.
