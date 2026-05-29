# @better-webhook/nextjs Agent Guide

## Package role

`@better-webhook/nextjs` is the Next.js App Router Framework Adapter for Better Webhook. It converts a Fetch-style route handler request into core's `RawDeliveryRequest`, then converts core's `WebhookResponse` into a standard `Response`.

This package does not verify provider signatures, parse provider events, apply Idempotency, apply Replay Protection, or dispatch Event Handlers. Those responsibilities stay in `@better-webhook/core` and the selected provider package.

## Install

```sh
npm install @better-webhook/core @better-webhook/nextjs
```

Most applications also install a provider package:

```sh
npm install @better-webhook/core @better-webhook/nextjs @better-webhook/stripe
```

## Primary APIs

- `createNextRouteHandler(endpoint)`: returns a Next.js-compatible route handler function.
- `toRawDeliveryRequest(request)`: converts a Fetch-style request into core's `RawDeliveryRequest`.
- `toNextResponse(response)`: converts a core `WebhookResponse` into a Fetch `Response`.
- `nextjsRawHeaderCapabilities`: adapter capability metadata.

## Types and contracts

- `NextWebhookRequest`: minimal request shape accepted by the adapter. It needs `method`, `url`, `headers`, `arrayBuffer()`, and optional `signal`.

The adapter reads `request.arrayBuffer()` and passes those bytes to core. It maps `Headers.entries()` into raw header pairs and forwards the abort signal when present.

## Canonical example

```ts
import { createWebhookEndpoint } from "@better-webhook/core";
import { createNextRouteHandler } from "@better-webhook/nextjs";
import { stripe } from "@better-webhook/stripe";

const endpoint = createWebhookEndpoint({
  provider: stripe({ signingSecret: process.env.STRIPE_WEBHOOK_SECRET! }),
  handlers: {
    "checkout.session.completed": async ({ event }) => {
      event.payload.payment_status;
    },
    "invoice.paid": async ({ event }) => {
      event.payload.status;
    },
  },
});

export const runtime = "nodejs";
export const POST = createNextRouteHandler(endpoint);
```

## Behavior defaults

The adapter reports:

- `preservesRawBodyBytes: true`
- `preservesDuplicateHeaders: false`

Fetch `Headers` preserve signature-relevant values but do not expose duplicate raw header lines. The adapter returns whatever status, headers, and body core's response policy produced.

## Gotchas

- Use the Next.js Node.js runtime for the initial SDK release.
- Do not call `request.json()` before passing the request to Better Webhook.
- A route handler request body can only be consumed once; let the adapter read it.
- Event Handlers do not receive the Next.js request object.
- Edge runtime support is outside the initial SDK scope.

## Do / do not

Do export `runtime = "nodejs"` in route files using this adapter.
Do create the endpoint outside the route handler when possible.
Do pass the route request directly to the generated handler.

Do not parse or clone the body before signature verification.
Do not implement provider verification in the route handler.
Do not return custom HTTP responses from Event Handlers.
