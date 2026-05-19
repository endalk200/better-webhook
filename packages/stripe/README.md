# @better-webhook/stripe

Stripe Provider Definition for Better Webhook.

```ts
import { stripe } from "@better-webhook/stripe";

const provider = stripe({
  signingSecret: process.env.STRIPE_WEBHOOK_SECRET!,
});
```

The provider verifies Stripe `Stripe-Signature` headers with HMAC-SHA256 over the exact raw delivery bytes and does not depend on the official Stripe package. Core applies the default signed timestamp tolerance and optional replay-store tracking.

The curated event map currently includes checkout session, invoice, subscription, and payment intent events. Event payload typing is compile-time ergonomics; runtime validation checks the event envelope metadata needed by the pipeline (`id`, `object`, `type`, `created`, and `data.object`) without fully validating every Stripe object shape. Verified events outside the curated map are still accepted and reach the catch-all handler as unknown Stripe events.
