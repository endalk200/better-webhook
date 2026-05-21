# @better-webhook/nextjs

Turn a Next.js Route Handler into a Better Webhook endpoint without losing the
raw request bytes required for provider signature verification.

`@better-webhook/nextjs` is the framework adapter for Next.js App Router route
handlers. It translates a Fetch-style `Request` into the Raw Delivery Request
contract expected by `@better-webhook/core`, then converts the core response
back into a standard `Response`.

## Why use this package?

- Keep signature verification inside the Better Webhook pipeline.
- Read `request.arrayBuffer()` before any JSON parsing changes the body.
- Preserve signature-relevant Fetch header values.
- Return provider-friendly HTTP responses from core's response policy.
- Keep framework request objects out of event handlers.

## Installation

Install the Next.js adapter with core and a provider package:

```sh
pnpm add @better-webhook/core @better-webhook/nextjs @better-webhook/stripe
```

## Getting started

Create a Next.js route handler that delegates the POST request to a Better
Webhook endpoint:

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

Configure your provider to send webhook deliveries to this route, for example
`https://example.com/api/webhooks/stripe`.

## How it fits with Better Webhook

`@better-webhook/nextjs` is a Framework Adapter. It does not implement provider
verification, replay protection, idempotency, event parsing, or handler
dispatch. Those stay in `@better-webhook/core` and the selected provider
package.

This package only adapts:

- Next.js route handler requests to core Raw Delivery Requests.
- Core Webhook Responses to Fetch `Response` objects.

## Behavior and safety notes

The adapter reads `request.arrayBuffer()` and passes those bytes to core without
JSON parsing or reserialization. That matters because providers such as Stripe
sign the exact raw request body.

Next.js route handlers expose Fetch `Headers`. Fetch headers preserve
signature-relevant values, but they do not expose duplicate raw header lines.
The exported `nextjsRawHeaderCapabilities` value records that capability limit.

Event handlers receive Better Webhook's framework-neutral Handler Context. They
do not receive the Next.js request object.

## API summary

- `createNextRouteHandler(endpoint)`: returns a Next.js-compatible POST handler.
- `toRawDeliveryRequest(request)`: converts a Fetch-style request into a core
  Raw Delivery Request.
- `toNextResponse(response)`: converts a core Webhook Response into `Response`.
- `nextjsRawHeaderCapabilities`: describes raw body and raw header preservation.
- `NextWebhookRequest`: minimal request shape accepted by the adapter.

## Runtime support and limits

- Node.js 18 or newer.
- ESM-only package with TypeScript declarations.
- Use the Next.js Node.js runtime for the initial SDK release.
- Edge runtime support is out of scope for now.
