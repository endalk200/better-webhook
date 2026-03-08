# @better-webhook/resend

[![npm](https://img.shields.io/npm/v/@better-webhook/resend?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/resend)

Type-safe Resend webhook handling for `better-webhook`.

## Features

- Typed webhook envelopes for all 17 documented Resend event types
- Automatic Svix-compatible signature verification using `svix-*` headers
- Default signed timestamp freshness checks (`300` seconds)
- Replay key support via `svix-id`
- Tree-shakeable event exports from `@better-webhook/resend/events`
- Verified but unhandled events acknowledge with `200` to match Resend's delivery contract

## Installation

```bash
npm install @better-webhook/resend @better-webhook/core
# or
pnpm add @better-webhook/resend @better-webhook/core
# or
yarn add @better-webhook/resend @better-webhook/core
```

Install one adapter package too:

```bash
# Pick one:
npm install @better-webhook/nextjs
npm install @better-webhook/express
npm install @better-webhook/nestjs
npm install @better-webhook/hono
npm install @better-webhook/gcp-functions
```

## Quick Start

```ts
import { resend } from "@better-webhook/resend";
import {
  email_bounced,
  email_delivered,
  email_received,
} from "@better-webhook/resend/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = resend({
  secret: process.env.RESEND_WEBHOOK_SECRET,
})
  .event(email_delivered, async (payload) => {
    console.log("delivered:", payload.data.email_id);
  })
  .event(email_bounced, async (payload) => {
    console.log("bounce type:", payload.data.bounce.type);
  })
  .event(email_received, async (payload) => {
    console.log("inbound message:", payload.data.message_id);
  });

export const POST = toNextJS(webhook);
```

## Supported Events

### Email Events

- `email_sent` (`email.sent`)
- `email_scheduled` (`email.scheduled`)
- `email_delivered` (`email.delivered`)
- `email_delivery_delayed` (`email.delivery_delayed`)
- `email_complained` (`email.complained`)
- `email_bounced` (`email.bounced`)
- `email_opened` (`email.opened`)
- `email_clicked` (`email.clicked`)
- `email_received` (`email.received`)
- `email_failed` (`email.failed`)
- `email_suppressed` (`email.suppressed`)

### Domain Events

- `domain_created` (`domain.created`)
- `domain_updated` (`domain.updated`)
- `domain_deleted` (`domain.deleted`)

### Contact Events

- `contact_created` (`contact.created`)
- `contact_updated` (`contact.updated`)
- `contact_deleted` (`contact.deleted`)

## Signature Verification

Resend signs webhook requests with Svix-compatible headers:

- `svix-id`
- `svix-timestamp`
- `svix-signature`

This package verifies the exact raw body using HMAC-SHA256 over:

```text
${svixId}.${svixTimestamp}.${rawBody}
```

using the base64-decoded portion of the `whsec_...` signing secret.

Verification behavior:

- rejects missing `svix-*` headers
- rejects malformed timestamps
- rejects stale or far-future timestamps outside the configured tolerance window
- accepts any valid `v1` entry in a multi-signature `svix-signature` header

Use the raw request body exactly as Resend sent it. Re-serializing JSON before
verification will break the signature.

## Replay Protection and Idempotency

Resend delivers webhooks with at-least-once semantics and may retry or replay
the same message. The provider exposes:

- `context.deliveryId` from `svix-id`
- replay metadata via `svix-id` + `svix-timestamp`

With core replay protection enabled, duplicate `svix-id` values return `409` by
default:

```ts
import { createInMemoryReplayStore } from "@better-webhook/core";

const webhook = resend({ secret: process.env.RESEND_WEBHOOK_SECRET })
  .withReplayProtection({
    store: createInMemoryReplayStore(),
  })
  .event(email_delivered, async (payload) => {
    await persistEvent(payload);
  });
```

For production, use a shared durable replay store so deduplication works across
instances and restarts.

## Payload Notes

- Handlers receive the full Resend webhook envelope: `{ type, created_at, data }`.
- `email.received` webhooks contain metadata only. Fetch the full inbound body,
  headers, and attachments through Resend's receiving APIs if you need message
  content.
- Resend's public docs show `tags` as an object map, while some official
  examples use an array of `{ name, value }`. This package accepts both shapes.

## Environment Variables

When no explicit secret is provided, Better Webhook resolves:

1. `RESEND_WEBHOOK_SECRET`
2. `WEBHOOK_SECRET`

## License

MIT
