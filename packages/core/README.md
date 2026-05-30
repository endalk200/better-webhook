# @better-webhook/core

Build webhook endpoints that verify raw provider signatures before parsing,
dispatch typed events, avoid duplicate processing, reject replayed deliveries,
and emit useful telemetry.

`@better-webhook/core` owns the provider-agnostic Webhook Handling Pipeline for
Better Webhook. It gives provider packages, framework adapters, and your
application handlers one consistent runtime model so security-sensitive webhook
behavior does not drift across frameworks.

## Why use this package?

- Verify provider signatures against the exact raw delivery bytes.
- Dispatch verified webhook events to typed event handlers.
- Add event-level idempotency when you configure a durable store.
- Reject stale signed deliveries and optionally remember seen deliveries.
- Customize response mapping without changing pipeline ordering.
- Emit delivery telemetry without recording payload contents by default.

## Installation

Install core with at least one provider package and, in most applications, one
framework adapter:

```sh
pnpm add @better-webhook/core @better-webhook/stripe @better-webhook/nextjs
```

For Express:

```sh
pnpm add @better-webhook/core @better-webhook/stripe @better-webhook/express
```

## Getting started

Create a provider-specific webhook endpoint with its handlers registered up
front:

```ts
import {
  createMemoryIdempotencyStore,
  createWebhookEndpoint,
} from "@better-webhook/core";
import { stripe } from "@better-webhook/stripe";

export const stripeEndpoint = createWebhookEndpoint({
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
  // Optional: "all" is the default. Use "unknown" when the catch-all is only
  // for provider events outside the curated known event map.
  catchAllHandlerScope: "all",
});
```

Then pass the endpoint to a framework adapter such as
`@better-webhook/nextjs` or `@better-webhook/express`.

## How it fits with Better Webhook

Core owns the closed Webhook Handling Pipeline:

1. Read the raw body bytes exactly once.
2. Ask the Provider Definition to verify the delivery.
3. Apply provider timestamp replay protection when available.
4. Extract the provider event envelope and payload.
5. Check optional event-level idempotency.
6. Dispatch the matching event handler or catch-all handler.
7. Finish telemetry and map the result to an HTTP response.

Provider packages such as `@better-webhook/stripe` plug provider semantics into
core. Framework adapters such as `@better-webhook/nextjs` and
`@better-webhook/express` translate framework request and response objects into
core's raw delivery contract.

## Behavior and safety notes

Adapters must pass unmodified raw body bytes and signature-relevant headers into
core. A parsed JSON body is not enough for provider signature verification.

Event handlers succeed by resolving and fail by throwing or rejecting. Handler
return values are ignored because the pipeline controls the HTTP response sent
back to the provider.

Ignored events and completed duplicate events return successful responses by
default. Failed handlers and rejected deliveries return failure responses by
default so providers can retry when appropriate. The `*` handler catches all
events without a specific handler by default; set `catchAllHandlerScope` to
`"unknown"` when you want known events without a specific handler to be ignored
while still observing unknown provider events.

Idempotency is disabled unless an `IdempotencyStore` is configured. When
idempotency or replay-store tracking is configured, `endpointIdentity` is
required so coordination keys can distinguish one webhook endpoint from another.

The in-memory stores are useful for tests, examples, and local development.
They are not durable production coordination stores.

## API summary

- `createWebhookEndpoint(options)`: creates a Webhook Endpoint.
- `defaultResponsePolicy(result)`: maps pipeline results to default HTTP
  responses.
- `createMemoryIdempotencyStore()`: creates an in-memory Idempotency Store.
- `createMemoryReplayStore()`: creates an in-memory Replay Store.

Core also exports the TypeScript contracts used by providers, adapters, stores,
response policies, and telemetry integrations.

## Default responses

- `200`: handled, ignored, or completed duplicate events.
- `409`: an idempotency reservation is already in progress.
- `400`: invalid signatures, replay rejects, invalid event envelopes, or
  unsupported input.
- `500`: event handler errors.

Response bodies are intentionally minimal.

## Runtime support and limits

- Node.js 18 or newer.
- ESM-only package with TypeScript declarations.
- One Webhook Endpoint is bound to one Provider.
- Provider secrets are directly configured for the endpoint.
- General middleware, multi-provider endpoints, Edge runtime, browser runtime,
  and CommonJS support are outside the initial SDK scope.
