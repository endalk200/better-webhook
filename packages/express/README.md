# @better-webhook/express

Express adapter for Better Webhook.

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

The adapter requires `req.rawBody` to be captured before parsed body middleware mutates the request. It uses `req.rawHeaders` when available so duplicate raw header lines can be represented. Framework objects are not exposed to event handlers.
