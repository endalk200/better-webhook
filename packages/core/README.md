# @better-webhook/core

Provider-agnostic Webhook Handling Pipeline for Better Webhook.

```ts
import {
  createMemoryIdempotencyStore,
  createWebhookEndpoint,
} from "@better-webhook/core";
import { stripe } from "@better-webhook/stripe";

const endpoint = createWebhookEndpoint({
  provider: stripe({ signingSecret: process.env.STRIPE_WEBHOOK_SECRET! }),
  endpointIdentity: "stripe-production",
  idempotencyStore: createMemoryIdempotencyStore(),
  handlers: {
    "invoice.paid": async ({ event }) => {
      event.payload.status;
    },
    "*": async ({ event }) => {
      event.type;
    },
  },
});
```

Core owns the closed pipeline: raw body read, provider verification, replay protection, event envelope extraction, optional event-level idempotency, handler dispatch, telemetry, and response mapping. Event handlers are registered when the endpoint is created. Their return values are ignored; resolving succeeds and throwing fails.

Default responses are `200` for handled, ignored, and completed duplicate events; `409` for in-progress idempotency reservations; `400` for invalid signatures, replay rejects, and unsupported input; and `500` for handler errors. Response bodies are intentionally minimal.

Idempotency is disabled unless an `IdempotencyStore` is configured. When configured, `endpointIdentity` is required and keys are based on provider, endpoint identity, and provider event id. Replay stores are also explicit. Provider timestamp tolerance still runs by default when the provider exposes a signed timestamp.

Adapters must pass unmodified raw body bytes and signature-relevant headers. Duplicate raw headers should be preserved when the framework exposes them, and adapter packages declare their capability limits.

Initial non-goals include production storage adapters, secret resolvers, multi-provider endpoints, general middleware, Edge, browser, and CommonJS support.
