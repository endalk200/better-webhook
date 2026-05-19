# @better-webhook/nextjs

Next.js route handler adapter for Better Webhook.

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
  },
});

export const POST = createNextRouteHandler(endpoint);
```

The adapter reads `request.arrayBuffer()` and passes those bytes to core without JSON parsing or reserialization. Next.js route handlers expose Fetch `Headers`, which preserve signature-relevant values but not duplicate raw header lines. Use the Node.js runtime for this initial SDK release; Edge runtime support is out of scope.
