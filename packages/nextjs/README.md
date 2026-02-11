# @better-webhook/nextjs

[![npm](https://img.shields.io/npm/v/@better-webhook/nextjs?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/nextjs)
[![npm monthly](https://img.shields.io/npm/dm/@better-webhook/nextjs?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/nextjs)

**Next.js App Router webhooks in one line.**

Turn any `better-webhook` handler into a Next.js route handler. Zero configuration required.

```ts
// app/api/webhooks/github/route.ts
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github().event(push, async (payload) => {
  console.log(`Push to ${payload.repository.name}`);
});

export const POST = toNextJS(webhook);
```

That's it. Your webhook endpoint is ready.

## Features

- **⚡ Zero config** — Works out of the box with App Router
- **🔒 Automatic verification** — Signatures verified before your handler runs
- **📝 Type safe** — Full TypeScript support
- **🎯 Clean API** — One function, one line

## Installation

```bash
npm install @better-webhook/nextjs @better-webhook/core
# or
pnpm add @better-webhook/nextjs @better-webhook/core
# or
yarn add @better-webhook/nextjs @better-webhook/core
```

## Quick Start

### 1. Install a provider

```bash
npm install @better-webhook/github
```

### 2. Create your route handler

```ts
// app/api/webhooks/github/route.ts
import { github } from "@better-webhook/github";
import { push, pull_request } from "@better-webhook/github/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github()
  .event(push, async (payload) => {
    // Deploy on push to main
    if (payload.ref === "refs/heads/main") {
      await triggerDeployment();
    }
  })
  .event(pull_request, async (payload) => {
    // Comment on new PRs
    if (payload.action === "opened") {
      await postWelcomeComment(payload.pull_request.number);
    }
  });

export const POST = toNextJS(webhook);
```

### 3. Set your secret

```bash
# .env.local
GITHUB_WEBHOOK_SECRET=your-secret-here
```

Done! Point GitHub to `https://your-app.com/api/webhooks/github`.

## Multiple Webhook Providers

Create separate routes for each provider:

```
app/
  api/
    webhooks/
      github/
        route.ts    → /api/webhooks/github
      stripe/
        route.ts    → /api/webhooks/stripe
      slack/
        route.ts    → /api/webhooks/slack
```

Each route is independent with its own secret and handlers.

## Handler Context

Every handler receives a second parameter with metadata about the webhook request:

```ts
const webhook = github().event(push, async (payload, context) => {
  // Access provider info
  console.log(`Provider: ${context.provider}`); // "github"
  console.log(`Event: ${context.eventType}`); // "push"

  // Access headers (including provider-specific ones like delivery ID)
  console.log(`User-Agent: ${context.headers["user-agent"]}`);
  console.log(`Delivery ID: ${context.headers["x-github-delivery"]}`);

  // Timestamp when webhook was received
  console.log(`Received at: ${context.receivedAt.toISOString()}`);

  await processWebhook(payload);
});

export const POST = toNextJS(webhook);
```

### Context Properties

| Property     | Type      | Description                               |
| ------------ | --------- | ----------------------------------------- |
| `eventType`  | `string`  | Event type (e.g., "push", "pull_request") |
| `provider`   | `string`  | Provider name (e.g., "github")            |
| `headers`    | `Headers` | Request headers (lowercase keys)          |
| `rawBody`    | `string`  | Raw request body                          |
| `receivedAt` | `Date`    | Timestamp when webhook was received       |

## Error Handling

Handle errors gracefully:

```ts
const webhook = github()
  .event(push, async (payload, context) => {
    console.log(`[${context.eventType}] Deploying...`);
    await deployToProduction(payload);
  })
  .onError((error, context) => {
    // Log to your error tracking service
    console.error(`Webhook failed: ${context.eventType}`, error);

    // Error details available
    // context.eventType - "push", "pull_request", etc.
    // context.payload - The parsed payload
  })
  .onVerificationFailed((reason, headers) => {
    // Signature verification failed
    // Possible attack or misconfigured secret
    console.warn("Verification failed:", reason);
  });

export const POST = toNextJS(webhook);
```

## Configuration Options

### Custom Secret

Override the environment variable:

```ts
export const POST = toNextJS(webhook, {
  secret: process.env.MY_CUSTOM_SECRET,
});
```

### Success Callback

Track successful webhook processing:

```ts
export const POST = toNextJS(webhook, {
  onSuccess: async (eventType) => {
    // Log to analytics
    await analytics.track("webhook_processed", {
      provider: "github",
      event: eventType,
    });
  },
});
```

## Response Codes

The adapter returns appropriate HTTP status codes:

| Code  | Meaning                                       |
| ----- | --------------------------------------------- |
| `200` | Webhook processed successfully                |
| `204` | No handler registered for this event type     |
| `400` | Invalid JSON body or schema validation failed |
| `401` | Signature verification failed                 |
| `405` | Method not allowed (non-POST request)         |
| `500` | Handler threw an error                        |

## Custom Providers

Works with any `better-webhook` provider:

```ts
import { customWebhook, defineEvent, z } from "@better-webhook/core";
import { toNextJS } from "@better-webhook/nextjs";

const userCreated = defineEvent({
  name: "user.created",
  schema: z.object({
    userId: z.string(),
    email: z.string().email(),
  }),
  provider: "my-service" as const,
});

const webhook = customWebhook({
  name: "my-service",
  getEventType: (headers) => headers["x-event-type"],
}).event(userCreated, async (payload, context) => {
  console.log(`[${context.eventType}] New user: ${payload.userId}`);
  await sendWelcomeEmail(payload.email);
});

export const POST = toNextJS(webhook);
```

## License

MIT
