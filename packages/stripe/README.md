# @better-webhook/stripe

Verify Stripe webhook signatures and handle typed Stripe events through the
Better Webhook pipeline.

`@better-webhook/stripe` is the Stripe Provider Definition for Better Webhook.
It plugs Stripe signing, event envelope extraction, replay keys, and curated
event payload types into `@better-webhook/core`.

## Why use this package?

- Verify Stripe `Stripe-Signature` headers with HMAC-SHA256.
- Verify signatures against the exact raw delivery bytes.
- Use typed payloads for common Stripe event handlers.
- Accept verified Stripe events outside the curated event map through catch-all
  handling.
- Avoid depending on the official Stripe package for webhook verification.

## Installation

Install the Stripe provider with core and a framework adapter:

```sh
pnpm add @better-webhook/core @better-webhook/stripe @better-webhook/nextjs
```

For Express:

```sh
pnpm add @better-webhook/core @better-webhook/stripe @better-webhook/express
```

## Getting started

Create a Stripe provider and pass it to `createWebhookEndpoint`:

```ts
import { createWebhookEndpoint } from "@better-webhook/core";
import { stripe } from "@better-webhook/stripe";

const endpoint = createWebhookEndpoint({
  provider: stripe({ signingSecret: process.env.STRIPE_WEBHOOK_SECRET! }),
  handlers: {
    "checkout.session.completed": async ({ event }) => {
      event.payload.payment_status;
      event.payload.customer;
    },
    "invoice.paid": async ({ event }) => {
      event.payload.status;
      event.payload.subscription;
    },
    "*": async ({ event }) => {
      if (!event.known) {
        event.type;
      }
    },
  },
});
```

Pair the endpoint with a Framework Adapter such as `@better-webhook/nextjs` or
`@better-webhook/express` so raw request bytes reach core unchanged.

## How it fits with Better Webhook

`@better-webhook/stripe` is a Provider Definition package. It does not read
framework requests, send HTTP responses, or own the Webhook Handling Pipeline.
Those responsibilities belong to framework adapters and `@better-webhook/core`.

This package provides Stripe-specific behavior to core:

- Header parsing for `Stripe-Signature`.
- Signature computation and timing-safe comparison.
- Signed timestamp support for default replay protection.
- Replay key generation for optional Replay Store tracking.
- Event envelope extraction and known event typing.

## Behavior and safety notes

Stripe signatures are verified with HMAC-SHA256 over
`{timestamp}.{rawBodyBytes}`. The raw bytes must be the original delivery body,
not a parsed and stringified JSON object.

Core applies the default signed timestamp tolerance when a Stripe signed
timestamp is present. If you configure a Replay Store, the Stripe replay key
combines the timestamp, matched signature, and raw body digest.

Runtime validation checks the Stripe event envelope metadata needed by the
pipeline: `id`, `object`, `type`, `created`, and `data.object`. It does not
fully validate every Stripe object shape at runtime.

Verified events outside the curated map are still accepted and can reach the
catch-all handler as unknown Stripe events.

## Curated event payloads

The curated event map currently includes:

- `checkout.session.completed`
- `checkout.session.expired`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Known event handlers get compile-time payload ergonomics for those event types.

## API summary

- `stripe(options)`: creates the Stripe Provider Definition.

The package also exports Stripe event, envelope, payload, and provider option
types.

## Runtime support and limits

- Node.js 18 or newer.
- ESM-only package with TypeScript declarations.
- One Stripe provider uses one directly configured signing secret.
- Full runtime validation of every Stripe payload object is out of scope.
