# @better-webhook/hono

[![npm](https://img.shields.io/npm/v/@better-webhook/hono?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/hono)
[![npm monthly](https://img.shields.io/npm/dm/@better-webhook/hono?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/hono)

**Hono adapter for type-safe webhooks.**

Drop-in Hono handler that handles signature verification, payload parsing, and type-safe event routing.

```ts
import { Hono } from "hono";
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { toHono } from "@better-webhook/hono";

const app = new Hono();

const webhook = github().event(push, async (payload) => {
  console.log(`Push to ${payload.repository.name}`);
});

app.post("/webhooks/github", toHono(webhook));

export default app;
```

For a runnable local app, see [`apps/examples/hono-example`](https://github.com/endalk200/better-webhook/tree/main/apps/examples/hono-example).

## Features

- **🔌 Drop-in handler** — Works with any Hono runtime
- **🔒 Automatic verification** — Signatures verified before your handler runs
- **📝 Type safe** — Full TypeScript support
- **🌍 Runtime-agnostic** — Works on Node, Workers, Bun, and Deno

## Installation

```bash
npm install @better-webhook/hono
# or
pnpm add @better-webhook/hono
# or
yarn add @better-webhook/hono
```

## Quick Start

### 1. Install a provider

```bash
npm install @better-webhook/github
```

### 2. Create your Hono app

```ts
import { Hono } from "hono";
import { github } from "@better-webhook/github";
import { push, pull_request } from "@better-webhook/github/events";
import { toHono } from "@better-webhook/hono";

const app = new Hono();

const webhook = github()
  .event(push, async (payload) => {
    const branch = payload.ref.replace("refs/heads/", "");
    console.log(`Push to ${branch} by ${payload.pusher.name}`);
  })
  .event(pull_request, async (payload) => {
    if (payload.action === "opened") {
      await notifySlack(`New PR: ${payload.pull_request.title}`);
    }
  });

app.post("/webhooks/github", toHono(webhook));

export default app;
```

### 3. Set your secret

```bash
export GITHUB_WEBHOOK_SECRET=your-secret-here
```

## Node.js

Use `@hono/node-server` and the `toHonoNode` helper:

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { toHonoNode } from "@better-webhook/hono";

const app = new Hono();

const webhook = github().event(push, async (payload) => {
  console.log(`Push to ${payload.repository.name}`);
});

app.post("/webhooks/github", toHonoNode(webhook));

serve(app);
```

## Cloudflare Workers

```ts
import { Hono } from "hono";
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { toHono } from "@better-webhook/hono";

const app = new Hono();

const webhook = github().event(push, async (payload) => {
  console.log(`Push to ${payload.repository.name}`);
});

app.post("/webhooks/github", toHono(webhook));

export default app;
```

## Bun

```ts
import { Hono } from "hono";
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { toHono } from "@better-webhook/hono";

const app = new Hono();

const webhook = github().event(push, async (payload) => {
  console.log(`Push to ${payload.repository.name}`);
});

app.post("/webhooks/github", toHono(webhook));

export default {
  port: 3000,
  fetch: app.fetch,
};
```

## Deno

```ts
import { Hono } from "hono";
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { toHono } from "@better-webhook/hono";

const app = new Hono();

const webhook = github().event(push, async (payload) => {
  console.log(`Push to ${payload.repository.name}`);
});

app.post("/webhooks/github", toHono(webhook));

Deno.serve(app.fetch);
```

## Raw Body Notes

Webhook signature verification depends on the raw request body. Avoid consuming
`c.req.raw` directly before the adapter runs. If you need the body in middleware,
use HonoRequest methods like `c.req.text()` or `c.req.arrayBuffer()` so the
adapter can reconstruct the raw payload when needed.

## Configuration Options

### Custom Secret

```ts
app.post(
  "/webhooks/github",
  toHono(webhook, {
    secret: process.env.MY_GITHUB_SECRET,
  }),
);
```

### Success Callback

```ts
app.post(
  "/webhooks/github",
  toHono(webhook, {
    onSuccess: async (eventType) => {
      metrics.increment("webhook.success", { event: eventType });
    },
  }),
);
```

### Observer

```ts
import { createWebhookStats } from "@better-webhook/core";

const stats = createWebhookStats();

app.post(
  "/webhooks/github",
  toHono(webhook, {
    observer: stats.observer,
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
| `405` | Request method is not POST                |
| `500` | Handler threw an error                    |

Note: with `app.post(...)`, non-POST requests may return `404` at the routing
layer before the adapter runs. `405` is returned when the adapter itself
receives a non-POST request (for example, via `app.all(...)`).

## License

MIT
