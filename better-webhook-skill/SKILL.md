---
name: better-webhook
description: Type-safe webhook handler SDK and local development CLI for Node.js. Provides typed events, automatic signature verification, replay protection, and framework adapters for Next.js, Express, Hono, NestJS, and GCP Cloud Functions. Supports GitHub, Ragie, and Recall.ai providers with Zod schema validation. Use when building webhook endpoints, handling GitHub/Ragie/Recall webhooks, adding webhook signature verification, creating webhook route handlers, testing webhooks locally, or building custom webhook providers.
---

# Better Webhook

Type-safe webhook handlers for Node.js with automatic signature verification.

## Quick Start

```bash
npm install @better-webhook/core @better-webhook/github @better-webhook/nextjs
```

```ts
// app/api/webhooks/github/route.ts
import { github } from "@better-webhook/github";
import { push, pull_request } from "@better-webhook/github/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github({ secret: process.env.GITHUB_WEBHOOK_SECRET })
  .event(push, async (payload) => {
    console.log(
      `Push to ${payload.repository.full_name}: ${payload.commits.length} commits`,
    );
  })
  .event(pull_request, async (payload) => {
    console.log(
      `PR #${payload.number} ${payload.action}: ${payload.pull_request.title}`,
    );
  })
  .onError(({ error }) => console.error("Webhook error:", error));

export const POST = toNextJS(webhook);
```

## Architecture: Provider -> Builder -> Adapter

1. **Provider** — defines the webhook source (events, verification, payload extraction)
2. **Builder** — `WebhookBuilder` registers event handlers, error handlers, observers, replay protection (immutable — each method returns a new instance)
3. **Adapter** — converts the builder into a framework-specific handler

## Package Selection

| Framework           | Adapter Package                 | Adapter Function                          |
| ------------------- | ------------------------------- | ----------------------------------------- |
| Next.js 13-16       | `@better-webhook/nextjs`        | `toNextJS(webhook)`                       |
| Express 4-5         | `@better-webhook/express`       | `toExpress(webhook)`                      |
| Hono 4              | `@better-webhook/hono`          | `toHono(webhook)` / `toHonoNode(webhook)` |
| NestJS 9-11         | `@better-webhook/nestjs`        | `toNestJS(webhook)`                       |
| GCP Cloud Functions | `@better-webhook/gcp-functions` | `toGCPFunction(webhook)`                  |

| Webhook Source | Provider Package         | Factory Function        |
| -------------- | ------------------------ | ----------------------- |
| GitHub         | `@better-webhook/github` | `github(options?)`      |
| Ragie          | `@better-webhook/ragie`  | `ragie(options?)`       |
| Recall.ai      | `@better-webhook/recall` | `recall(options?)`      |
| Custom         | `@better-webhook/core`   | `customWebhook(config)` |

## Secret Resolution Order

Secrets are resolved in this order (first non-empty wins):

1. Adapter options: `toNextJS(webhook, { secret: "..." })`
2. Provider options: `github({ secret: "..." })`
3. Environment variable: `GITHUB_WEBHOOK_SECRET` (pattern: `{PROVIDER}_WEBHOOK_SECRET`)
4. Environment variable: `WEBHOOK_SECRET` (generic fallback)

## Key Rules

- Always install `@better-webhook/core` + one provider + one adapter
- Import events from `@better-webhook/{provider}/events` for tree-shaking
- Express requires `express.raw({ type: 'application/json' })` middleware on the webhook route
- NestJS requires `rawBody: true` in `NestFactory.create` options
- The builder is immutable — `.event()`, `.onError()`, `.observe()` all return new instances

## Details

- [REFERENCE.md](REFERENCE.md) — Full SDK API reference
- [EXAMPLES.md](EXAMPLES.md) — Complete framework and provider examples
- [CLI.md](CLI.md) — CLI tool for local webhook development
