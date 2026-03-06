# @better-webhook/stripe

[![npm](https://img.shields.io/npm/v/@better-webhook/stripe?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/stripe)

Type-safe Stripe webhook handling for `better-webhook`.

## Features

- Typed Stripe event payloads for:
  - `charge.failed`
  - `checkout.session.completed`
  - `payment_intent.succeeded`
- Automatic `Stripe-Signature` verification (`t=...,v1=...`)
- Timestamp freshness checks (default tolerance: 300 seconds)
- Replay key support via Stripe event id (`body.id`)
- Tree-shakeable event exports from `@better-webhook/stripe/events`

## Installation

```bash
npm install @better-webhook/stripe @better-webhook/core
# or
pnpm add @better-webhook/stripe @better-webhook/core
# or
yarn add @better-webhook/stripe @better-webhook/core
```

## Quick Start

```ts
import { stripe } from "@better-webhook/stripe";
import {
  charge_failed,
  checkout_session_completed,
  payment_intent_succeeded,
} from "@better-webhook/stripe/events";

const webhook = stripe({ secret: process.env.STRIPE_WEBHOOK_SECRET })
  .event(charge_failed, async (payload) => {
    console.log(payload.data.object.failure_code);
  })
  .event(checkout_session_completed, async (payload) => {
    console.log(payload.data.object.payment_status);
  })
  .event(payment_intent_succeeded, async (payload) => {
    console.log(payload.data.object.latest_charge);
  });
```

## Signature Verification

Stripe signatures are verified from `Stripe-Signature` using the signed payload
`${timestamp}.${rawBody}` and HMAC-SHA256. Verification behavior:

- Parses `t=<unix_timestamp>` strictly
- Uses only `v1` signatures (ignores other schemes such as `v0`)
- Supports multiple `v1` values for endpoint secret rotation
- Rejects timestamps outside the configured tolerance window (default `300s`)
- Freshness uses absolute skew (`|now - t|`) and rejects both stale and far-future
  timestamps outside tolerance

Use the raw request body exactly as sent by Stripe. Body mutation before
verification will invalidate the signature.

## Replay and Delivery Contract

- `replayKey` is derived from Stripe event id (`body.id`)
- `deliveryId` is intentionally `undefined` for Stripe because Stripe does not
  provide a dedicated delivery-id header contract

When replay protection is enabled in `@better-webhook/core`, Stripe dedupe is
driven by `body.id`.

## Payload Caveats

Some Stripe fields in webhook payloads are expandable and/or nullable. The
schemas in this package account for common real-world variants:

- `customer`, `payment_intent`, and `latest_charge` can be either ids or
  expanded objects (or `null` when documented as nullable)
- `checkout.session.metadata` is nullable in Stripe API responses

## Environment Variables

When no explicit secret is provided, Better Webhook resolves:

1. `STRIPE_WEBHOOK_SECRET`
2. `WEBHOOK_SECRET`

## License

MIT
