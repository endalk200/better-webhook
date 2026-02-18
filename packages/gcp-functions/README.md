# @better-webhook/gcp-functions

[![npm](https://img.shields.io/npm/v/@better-webhook/gcp-functions?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/gcp-functions)
[![npm monthly](https://img.shields.io/npm/dm/@better-webhook/gcp-functions?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/gcp-functions)

**GCP Cloud Functions webhooks in one line.**

Turn any `better-webhook` handler into a GCP Cloud Functions HTTP handler. Zero configuration required.

```ts
// index.ts
import { http } from "@google-cloud/functions-framework";
import { ragie } from "@better-webhook/ragie";
import { document_status_updated } from "@better-webhook/ragie/events";
import { toGCPFunction } from "@better-webhook/gcp-functions";

const webhook = ragie().event(document_status_updated, async (payload) => {
  console.log(`Document ${payload.document_id} is now ${payload.status}`);
});

http("webhookHandler", toGCPFunction(webhook));
```

That's it. Your webhook endpoint is ready.

## Features

- **⚡ Zero config** — Works out of the box with Cloud Functions
- **🔒 Automatic verification** — Signatures verified before your handler runs
- **📝 Type safe** — Full TypeScript support
- **🎯 Clean API** — One function, one line
- **☁️ Gen 1 & Gen 2** — Supports both Cloud Functions generations
- **📦 Functions Framework v3 & v4** — Compatible with latest `@google-cloud/functions-framework`

## Installation

```bash
npm install @better-webhook/gcp-functions @better-webhook/core
# or
pnpm add @better-webhook/gcp-functions @better-webhook/core
# or
yarn add @better-webhook/gcp-functions @better-webhook/core
```

## Quick Start

### 1. Install a provider package

```bash
# Pick one (or more):
npm install @better-webhook/github
npm install @better-webhook/ragie
npm install @better-webhook/recall
```

### 2. Create your Cloud Function

**2nd Generation (recommended):**

```ts
// index.ts
import { http } from "@google-cloud/functions-framework";
import { ragie } from "@better-webhook/ragie";
import {
  document_status_updated,
  connection_sync_finished,
} from "@better-webhook/ragie/events";
import { toGCPFunction } from "@better-webhook/gcp-functions";

const webhook = ragie({ secret: process.env.RAGIE_WEBHOOK_SECRET })
  .event(document_status_updated, async (payload) => {
    if (payload.status === "ready") {
      await notifyDocumentReady(payload.document_id);
    }
  })
  .event(connection_sync_finished, async (payload) => {
    console.log(`Sync ${payload.sync_id} completed`);
  });

http("webhookHandler", toGCPFunction(webhook));
```

**1st Generation (exports style):**

```ts
// index.ts
import { ragie } from "@better-webhook/ragie";
import { document_status_updated } from "@better-webhook/ragie/events";
import { toGCPFunction } from "@better-webhook/gcp-functions";

const webhook = ragie({ secret: process.env.RAGIE_WEBHOOK_SECRET }).event(
  document_status_updated,
  async (payload) => {
    console.log(`Document ${payload.document_id} status: ${payload.status}`);
  },
);

export const webhookHandler = toGCPFunction(webhook);
```

### 3. Set your secret

Add the secret to your Cloud Function environment variables:

```bash
gcloud functions deploy webhookHandler \
  --runtime nodejs20 \
  --trigger-http \
  --set-env-vars RAGIE_WEBHOOK_SECRET=your-secret-here
```

Done! Point your webhook provider to your Cloud Function URL.

## Handler Context

Every handler receives a second parameter with metadata about the webhook request:

```ts
const webhook = ragie().event(
  document_status_updated,
  async (payload, context) => {
    // Access provider info
    console.log(`Provider: ${context.provider}`); // "ragie"
    console.log(`Event: ${context.eventType}`); // "document_status_updated"

    // Access headers
    console.log(`Content-Type: ${context.headers["content-type"]}`);
    console.log(`Delivery ID: ${context.deliveryId}`);

    // Timestamp when webhook was received
    console.log(`Received at: ${context.receivedAt.toISOString()}`);

    await processDocument(payload);
  },
);

http("webhookHandler", toGCPFunction(webhook));
```

### Context Properties

| Property     | Type                                  | Description                                          |
| ------------ | ------------------------------------- | ---------------------------------------------------- |
| `eventType`  | `string`                              | Event type (e.g., "document_status_updated")         |
| `provider`   | `string`                              | Provider name (e.g., "ragie")                        |
| `deliveryId` | `string \| undefined`                 | Delivery ID extracted by the provider (if available) |
| `headers`    | `Record<string, string \| undefined>` | Request headers (lowercase keys)                     |
| `rawBody`    | `string`                              | Raw request body                                     |
| `receivedAt` | `Date`                                | Timestamp when webhook was received                  |

## Error Handling

Handle errors gracefully:

```ts
const webhook = ragie()
  .event(document_status_updated, async (payload, context) => {
    console.log(`[${context.eventType}] Processing document...`);
    await processDocument(payload);
  })
  .onError((error, context) => {
    // Log to your error tracking service
    console.error(`Webhook failed: ${context.eventType}`, error);
  })
  .onVerificationFailed((reason, headers) => {
    // Signature verification failed
    console.warn("Verification failed:", reason);
  });

http("webhookHandler", toGCPFunction(webhook));
```

## Configuration Options

### Custom Secret

Override the environment variable:

```ts
http(
  "webhookHandler",
  toGCPFunction(webhook, {
    secret: process.env.MY_CUSTOM_SECRET,
  }),
);
```

### Success Callback

Track successful webhook processing:

```ts
http(
  "webhookHandler",
  toGCPFunction(webhook, {
    onSuccess: async (eventType) => {
      // Log to analytics
      await analytics.track("webhook_processed", {
        provider: "ragie",
        event: eventType,
      });
    },
  }),
);
```

### Body Size Guard

```ts
http(
  "webhookHandler",
  toGCPFunction(webhook, {
    maxBodyBytes: 1024 * 1024, // 1MB
  }),
);
```

Use `maxBodyBytes` as an app-layer guard. Keep gateway and platform request-size
limits configured to reject large payloads earlier.

## Raw Body for Signature Verification

For signature verification to work correctly, the raw request body must be available. GCP Cloud Functions with the Functions Framework provide `req.rawBody` automatically.

If you're using a custom setup, ensure raw body is preserved:

```ts
// The adapter checks for raw body in this order:
// 1. req.rawBody (Functions Framework default)
// 2. Buffer body
// 3. String body
// 4. JSON.stringify(req.body) as fallback (may not match original for signature verification)
```

## Response Status Codes

The adapter returns appropriate HTTP status codes:

| Code  | Meaning                                                           |
| ----- | ----------------------------------------------------------------- |
| `200` | Webhook processed successfully                                    |
| `204` | No handler registered for this event type (after verification)    |
| `409` | Duplicate replay key detected (when replay protection is enabled) |
| `400` | Invalid JSON body or schema validation failed                     |
| `401` | Signature verification failed                                     |
| `405` | Method not allowed (non-POST request)                             |
| `413` | Request body exceeds `maxBodyBytes`                               |
| `500` | Handler threw an error                                            |

## Custom Providers

Works with any `better-webhook` provider:

```ts
import { customWebhook, defineEvent, z } from "@better-webhook/core";
import { toGCPFunction } from "@better-webhook/gcp-functions";
import { http } from "@google-cloud/functions-framework";

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

http("webhookHandler", toGCPFunction(webhook));
```

## Deployment

### Using gcloud CLI

```bash
gcloud functions deploy webhookHandler \
  --gen2 \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point webhookHandler \
  --set-env-vars RAGIE_WEBHOOK_SECRET=your-secret
```

### Using Terraform

```hcl
resource "google_cloudfunctions2_function" "webhook" {
  name     = "webhook-handler"
  location = "us-central1"

  build_config {
    runtime     = "nodejs20"
    entry_point = "webhookHandler"
    source {
      storage_source {
        bucket = google_storage_bucket.source.name
        object = google_storage_bucket_object.source.name
      }
    }
  }

  service_config {
    max_instance_count = 10
    available_memory   = "256M"
    timeout_seconds    = 60
    environment_variables = {
      RAGIE_WEBHOOK_SECRET = var.ragie_webhook_secret
    }
  }
}
```

## License

MIT
