# @better-webhook/ragie

[![npm](https://img.shields.io/npm/v/@better-webhook/ragie?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/ragie)
[![npm monthly](https://img.shields.io/npm/dm/@better-webhook/ragie?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/ragie)

**Handle Ragie webhooks with full type safety.**

No more guessing payload shapes. No more manual signature verification. Just beautiful, typed webhook handlers for your Ragie RAG workflows.

```ts
import { ragie } from "@better-webhook/ragie";

const webhook = ragie().event("document_status_updated", async (payload) => {
  // ✨ Full autocomplete for payload.document_id, payload.status, etc.
  console.log(`Document ${payload.document_id} is now ${payload.status}`);
});
```

## Features

- **🔒 Automatic signature verification** — HMAC-SHA256 verification using `X-Signature` header
- **📝 Fully typed payloads** — TypeScript knows every field on every event
- **✅ Schema validated** — Malformed payloads are caught and rejected
- **🎯 Multiple events** — Handle document updates, sync events, and more
- **🔄 Idempotency support** — Built-in `nonce` field for preventing duplicate processing

## Installation

```bash
npm install @better-webhook/ragie @better-webhook/core
# or
pnpm add @better-webhook/ragie @better-webhook/core
# or
yarn add @better-webhook/ragie @better-webhook/core
```

You'll also need a framework adapter:

```bash
# Pick one:
npm install @better-webhook/nextjs   # Next.js App Router
npm install @better-webhook/express  # Express.js
npm install @better-webhook/nestjs   # NestJS
```

## Quick Start

### Next.js

```ts
// app/api/webhooks/ragie/route.ts
import { ragie } from "@better-webhook/ragie";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = ragie()
  .event("document_status_updated", async (payload) => {
    console.log(`Document ${payload.document_id} is ${payload.status}`);

    if (payload.status === "ready") {
      // Document is fully indexed and ready for retrieval
      await notifyDocumentReady(payload.document_id);
    }
  })
  .event("connection_sync_finished", async (payload) => {
    console.log(`Sync ${payload.sync_id} complete!`);
    console.log(`Connection: ${payload.connection_id}`);
    console.log(`Partition: ${payload.partition}`);
    console.log(`Nonce: ${payload.nonce}`);
  });

export const POST = toNextJS(webhook);
```

### Express

```ts
import express from "express";
import { ragie } from "@better-webhook/ragie";
import { toExpress } from "@better-webhook/express";

const app = express();

const webhook = ragie()
  .event("document_status_updated", async (payload) => {
    console.log(`Document ${payload.document_id} status: ${payload.status}`);
  })
  .event("connection_sync_started", async (payload) => {
    console.log(
      `Sync ${payload.sync_id} started for connection ${payload.connection_id}`
    );
  });

app.post(
  "/webhooks/ragie",
  express.raw({ type: "application/json" }),
  toExpress(webhook)
);

app.listen(3000);
```

### NestJS

```ts
import { Controller, Post, Req, Res } from "@nestjs/common";
import { Response } from "express";
import { ragie } from "@better-webhook/ragie";
import { toNestJS } from "@better-webhook/nestjs";

@Controller("webhooks")
export class WebhooksController {
  private webhook = ragie()
    .event("document_status_updated", async (payload) => {
      console.log(`Document ${payload.document_id} is ${payload.status}`);
    })
    .event("connection_sync_finished", async (payload) => {
      console.log(`Sync completed: ${payload.total_creates_count} documents`);
    });

  @Post("ragie")
  async handleRagie(@Req() req: any, @Res() res: Response) {
    const result = await toNestJS(this.webhook)(req);
    return res.status(result.statusCode).json(result.body);
  }
}
```

## Supported Events

| Event                       | Description                                     |
| --------------------------- | ----------------------------------------------- |
| `document_status_updated`   | Document enters indexed, ready, or failed state |
| `document_deleted`          | Document is deleted                             |
| `entity_extracted`          | Entity extraction completes                     |
| `connection_sync_started`   | Connection sync begins                          |
| `connection_sync_progress`  | Periodic sync progress updates                  |
| `connection_sync_finished`  | Connection sync completes                       |
| `connection_limit_exceeded` | Connection page limit exceeded                  |
| `partition_limit_exceeded`  | Partition document limit exceeded               |

## Event Examples

### Document Status Updates

```ts
ragie().event("document_status_updated", async (payload) => {
  const { document_id, status, external_id, partition, nonce } = payload;

  // Use nonce for idempotency
  if (await isProcessed(nonce)) {
    console.log("Already processed this webhook");
    return;
  }

  switch (status) {
    case "indexed":
      console.log(`Document ${document_id} indexed (semantic search ready)`);
      break;

    case "keyword_indexed":
      console.log(`Document ${document_id} keyword indexed`);
      break;

    case "ready":
      console.log(`Document ${document_id} fully ready`);
      // All retrieval features are now functional
      await notifyUserDocumentReady(external_id);
      break;

    case "failed":
      console.error(`Document ${document_id} failed to index`);
      await alertTeam(document_id);
      break;
  }

  await markProcessed(nonce);
});
```

### Connection Sync Events

```ts
ragie()
  .event("connection_sync_started", async (payload) => {
    console.log(`📥 Sync started for connection ${payload.connection_id}`);
    console.log(`Sync ID: ${payload.sync_id}`);
    console.log(`Partition: ${payload.partition}`);
    console.log(`Nonce: ${payload.nonce}`);

    // Store sync start time
    await db.syncs.create({
      id: payload.sync_id,
      connectionId: payload.connection_id,
      startedAt: new Date(),
      metadata: payload.connection_metadata,
    });

    console.log(`Planned changes:`);
    console.log(`  - create: ${payload.create_count}`);
    console.log(`  - update content: ${payload.update_content_count}`);
    console.log(`  - update metadata: ${payload.update_metadata_count}`);
    console.log(`  - delete: ${payload.delete_count}`);
  })
  .event("connection_sync_progress", async (payload) => {
    console.log(`📊 Sync progress for ${payload.sync_id}`);
    console.log(`  Created: ${payload.created_count}/${payload.create_count}`);
    console.log(
      `  Content updated: ${payload.updated_content_count}/${payload.update_content_count}`
    );
    console.log(
      `  Metadata updated: ${payload.updated_metadata_count}/${payload.update_metadata_count}`
    );
    console.log(`  Deleted: ${payload.deleted_count}/${payload.delete_count}`);
    console.log(`  Errors: ${payload.errored_count}`);
    console.log(`Nonce: ${payload.nonce}`);

    // Update progress in database
    await db.syncs.update(payload.sync_id, {
      createdCount: payload.created_count,
      updatedContentCount: payload.updated_content_count,
      updatedMetadataCount: payload.updated_metadata_count,
      deletedCount: payload.deleted_count,
      erroredCount: payload.errored_count,
    });
  })
  .event("connection_sync_finished", async (payload) => {
    console.log(`✅ Sync completed: ${payload.sync_id}`);
    console.log(`Connection: ${payload.connection_id}`);
    console.log(`Partition: ${payload.partition}`);
    console.log(`Nonce: ${payload.nonce}`);

    // Mark sync as complete
    await db.syncs.update(payload.sync_id, {
      completedAt: new Date(),
    });

    // Notify users
    await notifyUsersOfSyncCompletion(payload.connection_id);
  });
```

### Entity Extraction

```ts
ragie().event("entity_extracted", async (payload) => {
  console.log(`Entities extracted from document ${payload.document_id}`);

  // Fetch the extracted entities via Ragie API
  const entities = await ragieClient.getEntities(payload.document_id);

  // Process entities
  for (const entity of entities) {
    await processEntity(entity);
  }
});
```

### Limit Exceeded Events

```ts
ragie()
  .event("connection_limit_exceeded", async (payload) => {
    console.warn(`⚠️ Connection ${payload.connection_id} exceeded page limit`);
    console.warn(`Nonce: ${payload.nonce}`);

    // Alert team about limit
    await alertTeam({
      type: "connection_limit",
      connectionId: payload.connection_id,
      partition: payload.partition,
    });
  })
  .event("partition_limit_exceeded", async (payload) => {
    console.warn(`⚠️ Partition ${payload.partition} exceeded document limit`);
    console.warn(`Nonce: ${payload.nonce}`);

    // Take action
    await createNewPartition(payload.partition);
  });
```

## Idempotency

Ragie includes a `nonce` field in all webhook payloads to help you implement idempotency:

```ts
const processedNonces = new Set<string>();

ragie().event("document_status_updated", async (payload) => {
  // Check if we've already processed this webhook
  if (processedNonces.has(payload.nonce)) {
    console.log("Duplicate webhook, skipping");
    return;
  }

  // Process the webhook
  await processDocument(payload);

  // Mark as processed
  processedNonces.add(payload.nonce);

  // In production, store nonces in a database with TTL
  await redis.setex(`webhook:${payload.nonce}`, 86400, "1");
});
```

## Error Handling

Handle errors gracefully with built-in hooks:

```ts
const webhook = ragie()
  .event("document_status_updated", async (payload) => {
    await riskyOperation(payload);
  })
  .onError((error, context) => {
    console.error(`Error handling ${context.eventType}:`, error);

    // Send to error tracking
    Sentry.captureException(error, {
      tags: { webhook: "ragie", event: context.eventType },
      extra: { eventType: context.eventType },
    });
  })
  .onVerificationFailed((reason, headers) => {
    console.warn("Signature verification failed:", reason);

    // Alert security team
    alertSecurityTeam({
      reason,
      signature: headers["x-signature"],
    });
  });
```

## Configuration

### Webhook Secret

Set your Ragie webhook secret via environment variable (recommended):

```bash
RAGIE_WEBHOOK_SECRET=your-signing-secret-here
```

You can find your signing secret in the Ragie app under "Webhooks" after creating an endpoint.

Or pass it explicitly:

```ts
// At provider level
const webhook = ragie({ secret: "your-signing-secret" }).event(
  "document_status_updated",
  handler
);

// Or at adapter level
export const POST = toNextJS(webhook, { secret: "your-signing-secret" });
```

### Success Callback

Get notified when webhooks are processed successfully:

```ts
export const POST = toNextJS(webhook, {
  onSuccess: (eventType) => {
    metrics.increment("webhook.ragie.success", { event: eventType });
  },
});
```

## TypeScript Types

All payload types are exported for advanced use cases:

```ts
import type {
  RagieDocumentStatusUpdatedEvent,
  RagieConnectionSyncStartedEvent,
  RagieConnectionSyncProgressEvent,
  RagieConnectionSyncFinishedEvent,
  RagieDocumentDeletedEvent,
  RagieEntityExtractedEvent,
  RagieConnectionLimitExceededEvent,
  RagiePartitionLimitExceededEvent,
} from "@better-webhook/ragie";

function handleDocument(payload: RagieDocumentStatusUpdatedEvent) {
  // Full type safety
}
```

Schemas are also exported if you need them:

```ts
import {
  RagieDocumentStatusUpdatedEventSchema,
  RagieConnectionSyncFinishedEventSchema,
} from "@better-webhook/ragie";

// Use for custom validation
const result = RagieDocumentStatusUpdatedEventSchema.safeParse(data);
```

## Development Tips

### Local Testing

Use tools like [ngrok](https://ngrok.com/) or [localtunnel](https://localtunnel.github.io/) to expose your local server:

```bash
# Terminal 1: Start your app
npm run dev

# Terminal 2: Expose it
npx localtunnel --port 3000
```

Then add the generated URL to your Ragie webhook endpoints.

### Testing Webhooks

You can simulate webhooks in the Ragie app by clicking "Test endpoint" on any webhook endpoint.

## Resources

- [Ragie Webhooks Documentation](https://docs.ragie.ai/docs/webhooks)
- [Monitoring Syncs with Webhooks](https://docs.ragie.ai/docs/monitoring-a-sync-using-webhooks)
- [Ragie API Reference](https://docs.ragie.ai/docs/api-reference)

## License

MIT
