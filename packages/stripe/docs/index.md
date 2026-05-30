# @better-webhook/stripe Agent Guide

## Package role

`@better-webhook/stripe` is the Stripe Provider Definition for Better Webhook. It supplies Stripe signature verification, signed timestamp metadata, replay key generation, Event Envelope extraction, and curated compile-time Event Payload types to `@better-webhook/core`.

This package does not read framework requests, send HTTP responses, own the Webhook Handling Pipeline, or depend on the official Stripe package for webhook verification.

## Install

```sh
npm install @better-webhook/core @better-webhook/stripe
```

Most applications also install a framework adapter:

```sh
npm install @better-webhook/core @better-webhook/stripe @better-webhook/nextjs
```

## Primary APIs

- `stripe(options)`: creates a Stripe `ProviderDefinition`.

`StripeProviderOptions`:

- `signingSecret`: Stripe webhook signing secret for one Webhook Endpoint.

The returned provider has `name: "stripe"` and reports support for signed timestamps and replay keys.

## Types and contracts

Important exported types include `StripeWebhookEvent`, `KnownStripeEvent`, `UnknownStripeEvent`, `KnownStripeEventType`, `StripeEventPayloads`, `StripeEventEnvelope`, `StripeObject`, `StripeCheckoutSession`, `StripeInvoice`, `StripeSubscription`, `StripePaymentIntent`, and `StripeProviderOptions`.

Known event handlers receive typed payloads for the curated map. Unknown verified Stripe events remain accepted with `known: false` and can be handled by the catch-all Event Handler.

Curated event types:

- `checkout.session.completed`
- `checkout.session.expired`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

## Canonical example

```ts
import { createWebhookEndpoint } from "@better-webhook/core";
import { stripe } from "@better-webhook/stripe";

export const endpoint = createWebhookEndpoint({
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

## Behavior defaults

Stripe verification requires a valid `Stripe-Signature` header with a timestamp and at least one `v1` signature. Signatures are checked against exact raw delivery bytes.

Envelope validation requires:

- `id` as a non-empty string.
- `object` equal to `"event"`.
- `type` as a non-empty string.
- `created` as a number.
- `data.object` present.

Core applies default signed timestamp Replay Protection when Stripe verification returns a signed timestamp. If a Replay Store is configured, the replay key combines the timestamp, matched signature, and raw body digest.

## Gotchas

- The Stripe Provider Secret is directly configured; dynamic per-tenant secret resolution is outside the initial SDK design.
- Runtime validation is envelope-only. Stripe payload object shapes are not fully validated at runtime.
- Raw body bytes must be original. Re-serialized JSON will usually fail signature verification.
- Multiple `v1` signatures are supported; any matching signature is accepted.

## Do / do not

Do pair this provider with `@better-webhook/core` and a Framework Adapter.
Do use typed event handlers for curated event types.
Do use `"*"` for verified Stripe events outside the curated map when needed.

Do not parse the request body before verification.
Do not use Stripe event type strings as provider names.
Do not assume compile-time payload types imply full runtime payload validation.
