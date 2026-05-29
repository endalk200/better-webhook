# @better-webhook/express Agent Guide

## Package role

`@better-webhook/express` is the Express Framework Adapter for Better Webhook. It converts an Express-shaped request with a captured raw body into core's `RawDeliveryRequest`, then sends a core `WebhookResponse` through Express.

This package does not verify provider signatures, parse provider events, apply Idempotency, apply Replay Protection, or dispatch Event Handlers. Those responsibilities stay in `@better-webhook/core` and the selected provider package.

## Install

```sh
npm install @better-webhook/core @better-webhook/express
```

Most applications also install a provider package:

```sh
npm install @better-webhook/core @better-webhook/express @better-webhook/stripe
```

## Primary APIs

- `createExpressMiddleware(endpoint)`: returns Express middleware that delegates to a Better Webhook Endpoint.
- `toRawDeliveryRequest(request)`: converts an Express-shaped request into core's `RawDeliveryRequest`.
- `sendExpressResponse(response, webhookResponse)`: writes a core `WebhookResponse` to an Express response.
- `expressRawHeaderCapabilities`: adapter capability metadata.

## Types and contracts

- `ExpressWebhookRequest`: minimal request shape accepted by the adapter.
- `ExpressWebhookResponse`: minimal response shape used by `sendExpressResponse`.
- `ExpressNextFunction`: `next(error?)` callback type.

`ExpressWebhookRequest` must include `rawBody`. It can be a `Buffer`, `Uint8Array`, or `string`. The adapter prefers `request.rawHeaders` when present so duplicate raw header lines are preserved; otherwise it falls back to `request.headers`.

## Canonical example

```ts
import express from "express";
import { createWebhookEndpoint } from "@better-webhook/core";
import {
  createExpressMiddleware,
  type ExpressWebhookRequest,
} from "@better-webhook/express";
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
    const expressRequest = req as ExpressWebhookRequest;
    expressRequest.rawBody = req.body;
    next();
  },
  createExpressMiddleware(endpoint),
);
```

## Behavior defaults

`toRawDeliveryRequest` throws when `request.rawBody` is missing because provider signatures cannot be verified from a parsed or reserialized body. `createExpressMiddleware` catches adapter or endpoint errors and passes them to `next(error)`.

The adapter reports:

- `preservesRawBodyBytes: true`
- `preservesDuplicateHeaders: true`

Duplicate-header preservation depends on Express exposing `req.rawHeaders`.

## Gotchas

- Register webhook routes before global `express.json()` middleware, or exclude webhook routes from parsed body middleware.
- `req.body` only works here when it is the raw body produced by `express.raw()`.
- Event Handlers do not receive Express `req`, `res`, or `next`.
- The adapter does not choose provider response statuses; core's response policy does.

## Do / do not

Do capture raw body bytes before parsed body middleware mutates the request.
Do pass a core `WebhookEndpoint` into `createExpressMiddleware`.
Do keep provider verification in the Better Webhook pipeline.

Do not call `express.json()` before the webhook route if it consumes the body.
Do not reconstruct raw bodies with `JSON.stringify(req.body)`.
Do not put Express response handling inside Event Handlers.
