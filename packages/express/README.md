# @better-webhook/express

Wire Express to Better Webhook while preserving the raw body bytes and raw
headers required for provider signature verification.

`@better-webhook/express` is the framework adapter for Express applications. It
turns an Express request with a captured `req.rawBody` into the Raw Delivery
Request contract expected by `@better-webhook/core`, then sends the core
Webhook Response through Express.

## Why use this package?

- Keep provider verification inside the Better Webhook pipeline.
- Preserve raw request bytes before body parsers mutate `req.body`.
- Use `req.rawHeaders` when available so duplicate header lines are represented.
- Send consistent provider responses from core's response policy.
- Keep Express request and response objects out of event handlers.

## Installation

Install the Express adapter with core and a provider package:

```sh
pnpm add @better-webhook/core @better-webhook/express @better-webhook/stripe
```

## Getting started

Capture the raw body before parsed body middleware touches the webhook route,
then delegate to the Better Webhook middleware:

```ts
import express from "express";
import { createWebhookEndpoint } from "@better-webhook/core";
import { createExpressMiddleware } from "@better-webhook/express";
import { stripe } from "@better-webhook/stripe";

const app = express();

const endpoint = createWebhookEndpoint({
  provider: stripe({ signingSecret: process.env.STRIPE_WEBHOOK_SECRET! }),
  handlers: {
    "invoice.paid": async ({ event }) => {
      event.payload.status;
    },
  },
});

app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  (req, _res, next) => {
    req.rawBody = req.body;
    next();
  },
  createExpressMiddleware(endpoint),
);
```

If your application uses `express.json()` globally, register the webhook route
before that parser or exclude the webhook route from parsed body middleware.

## How it fits with Better Webhook

`@better-webhook/express` is a Framework Adapter. It does not implement provider
verification, replay protection, idempotency, event parsing, or handler
dispatch. Those stay in `@better-webhook/core` and the selected provider
package.

This package only adapts:

- Express requests with captured raw bodies to core Raw Delivery Requests.
- Core Webhook Responses to Express responses.

## Behavior and safety notes

The adapter requires `req.rawBody`. If `req.rawBody` is missing, conversion to a
Raw Delivery Request throws because provider signatures cannot be verified
against a parsed or reserialized body.

When `req.rawHeaders` is available, the adapter uses it to preserve duplicate
raw header lines. If `req.rawHeaders` is not present, it falls back to
`req.headers`.

Event handlers receive Better Webhook's framework-neutral Handler Context. They
do not receive Express `req`, `res`, or `next`.

## API summary

- `createExpressMiddleware(endpoint)`: creates Express middleware for a Better
  Webhook endpoint.
- `toRawDeliveryRequest(request)`: converts an Express-shaped request into a
  core Raw Delivery Request.
- `sendExpressResponse(response, webhookResponse)`: sends a core Webhook
  Response through Express.
- `expressRawHeaderCapabilities`: describes raw body and raw header
  preservation.
- `ExpressWebhookRequest`, `ExpressWebhookResponse`, `ExpressNextFunction`:
  minimal framework types used by the adapter.

## Runtime support and limits

- Node.js 18 or newer.
- ESM-only package with TypeScript declarations.
- The webhook route must preserve raw body bytes before parsed body middleware.
