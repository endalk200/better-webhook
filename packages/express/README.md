# @better-webhook/express

[![npm](https://img.shields.io/npm/v/@better-webhook/express?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/express)
[![npm monthly](https://img.shields.io/npm/dm/@better-webhook/express?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/express)

**Express middleware for type-safe webhooks.**

Drop-in middleware that handles signature verification, payload parsing, and type-safe event routing.

```ts
import express from "express";
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { toExpress } from "@better-webhook/express";

const app = express();

const webhook = github().event(push, async (payload) => {
  console.log(`Push to ${payload.repository.name}`);
});

app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook),
);

app.listen(3000);
```

## Features

- **🔌 Drop-in middleware** — Works with your existing Express app
- **🔒 Automatic verification** — Signatures verified before your handler runs
- **📝 Type safe** — Full TypeScript support
- **⚠️ Error handling** — Integrates with Express error handlers

## Installation

```bash
npm install @better-webhook/express @better-webhook/core
# or
pnpm add @better-webhook/express @better-webhook/core
# or
yarn add @better-webhook/express @better-webhook/core
```

## Quick Start

### 1. Install a provider

```bash
npm install @better-webhook/github
```

### 2. Create your Express app

```ts
import express from "express";
import { github } from "@better-webhook/github";
import { push, pull_request } from "@better-webhook/github/events";
import { toExpress } from "@better-webhook/express";

const app = express();

// Create your webhook handler
const webhook = github()
  .event(push, async (payload) => {
    const branch = payload.ref.replace("refs/heads/", "");
    console.log(`Push to ${branch} by ${payload.pusher.name}`);

    if (branch === "main") {
      await triggerDeployment();
    }
  })
  .event(pull_request, async (payload) => {
    if (payload.action === "opened") {
      await notifySlack(`New PR: ${payload.pull_request.title}`);
    }
  });

// Mount with raw body parser (required for signature verification)
app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook),
);

// Your other routes use regular JSON parsing
app.use(express.json());
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
```

### 3. Set your secret

```bash
export GITHUB_WEBHOOK_SECRET=your-secret-here
```

## Important: Raw Body Parsing

Webhook signature verification requires the raw request body. Use `express.raw()` on your webhook routes:

```ts
// ✅ Correct - raw body available for signature verification
app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook),
);

// ❌ Wrong - body is parsed as JSON, signature verification will fail
app.use(express.json());
app.post("/webhooks/github", toExpress(webhook));
```

## Multiple Webhook Providers

Handle multiple providers in the same app:

```ts
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { toExpress } from "@better-webhook/express";

// GitHub webhooks
const githubWebhook = github().event(push, async (payload) => {
  console.log("GitHub push:", payload.repository.name);
});

// Custom internal service
const jobCompleted = defineEvent({
  name: "job.completed",
  schema: JobSchema,
  provider: "internal" as const,
});

const internalWebhook = customWebhook({
  name: "internal",
  getEventType: (headers) => headers["x-event-type"],
}).event(jobCompleted, async (payload) => {
  console.log("Job completed:", payload.jobId);
});

// Mount each on its own route
app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(githubWebhook),
);

app.post(
  "/webhooks/internal",
  express.raw({ type: "application/json" }),
  toExpress(internalWebhook),
);
```

## Error Handling

### Handler Errors

Use the built-in error hooks:

```ts
const webhook = github()
  .event(push, async (payload) => {
    await riskyOperation(payload);
  })
  .onError((error, context) => {
    console.error(`Error in ${context.eventType} handler:`, error);

    // Send to error tracking
    Sentry.captureException(error, {
      tags: { event: context.eventType },
      extra: { deliveryId: context.deliveryId },
    });
  });
```

### Express Error Middleware

Uncaught errors are passed to Express error handlers:

```ts
app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook),
);

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});
```

### Verification Failures

Handle signature verification failures:

```ts
const webhook = github()
  .event(push, handler)
  .onVerificationFailed((reason, headers) => {
    console.warn("Verification failed:", reason);
    // Alert on potential attacks
    alertSecurityTeam({ reason, ip: headers["x-forwarded-for"] });
  });
```

## Configuration Options

### Custom Secret

```ts
app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook, {
    secret: process.env.MY_GITHUB_SECRET,
  }),
);
```

### Success Callback

```ts
app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook, {
    onSuccess: async (eventType) => {
      metrics.increment("webhook.success", { event: eventType });
    },
  }),
);
```

## Response Codes

| Code  | Meaning                                   |
| ----- | ----------------------------------------- |
| `200` | Webhook processed successfully            |
| `204` | No handler registered for this event type |
| `400` | Invalid body or schema validation failed  |
| `401` | Signature verification failed             |
| `500` | Handler threw an error                    |

## TypeScript

Full type safety with your Express app:

```ts
import express, { Request, Response } from "express";
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { toExpress, ExpressMiddleware } from "@better-webhook/express";

const webhook = github().event(push, async (payload) => {
  // payload is fully typed
});

const middleware: ExpressMiddleware = toExpress(webhook);
```

## License

MIT
