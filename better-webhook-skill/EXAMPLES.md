# Better Webhook Examples

## Next.js + GitHub

```bash
npm install @better-webhook/core @better-webhook/github @better-webhook/nextjs
```

```ts
// app/api/webhooks/github/route.ts
import { github } from "@better-webhook/github";
import { push, pull_request, issues } from "@better-webhook/github/events";
import { toNextJS } from "@better-webhook/nextjs";
import {
  createWebhookStats,
  createInMemoryReplayStore,
} from "@better-webhook/core";

const stats = createWebhookStats();
const replayStore = createInMemoryReplayStore();

const webhook = github({ secret: process.env.GITHUB_WEBHOOK_SECRET })
  .event(push, async (payload, context) => {
    console.log(
      `[${context.deliveryId}] Push to ${payload.repository.full_name}`,
    );
    console.log(`Ref: ${payload.ref}, Commits: ${payload.commits.length}`);
  })
  .event(pull_request, async (payload) => {
    if (payload.action === "opened") {
      console.log(`New PR #${payload.number}: ${payload.pull_request.title}`);
    }
  })
  .event(issues, async (payload) => {
    console.log(`Issue #${payload.issue.number} ${payload.action}`);
  })
  .onError((error, context) => {
    console.error(`Webhook error for ${context.eventType}:`, error.message);
  })
  .onVerificationFailed((reason, headers) => {
    console.warn("Verification failed:", reason);
  })
  .observe(stats.observer)
  .withReplayProtection({ store: replayStore })
  .maxBodyBytes(1024 * 1024); // 1MB limit

export const POST = toNextJS(webhook);
```

## Next.js + Ragie

```bash
npm install @better-webhook/core @better-webhook/ragie @better-webhook/nextjs
```

```ts
// app/api/webhooks/ragie/route.ts
import { ragie } from "@better-webhook/ragie";
import {
  document_status_updated,
  entity_extracted,
  connection_sync_finished,
} from "@better-webhook/ragie/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = ragie({ secret: process.env.RAGIE_WEBHOOK_SECRET })
  .event(document_status_updated, async (payload) => {
    // Ragie unwraps the envelope automatically — payload is the inner object
    console.log(`Document ${payload.document_id} status: ${payload.status}`);
    // payload.nonce is available for idempotency
  })
  .event(entity_extracted, async (payload) => {
    console.log(
      `Entity ${payload.entity_id} extracted from ${payload.document_name}`,
    );
  })
  .event(connection_sync_finished, async (payload) => {
    console.log(
      `Sync ${payload.sync_id} finished for connection ${payload.connection_id}`,
    );
  })
  .onError((error) => console.error("Ragie webhook error:", error));

export const POST = toNextJS(webhook);
```

## Next.js + Recall.ai

```bash
npm install @better-webhook/core @better-webhook/recall @better-webhook/nextjs
```

```ts
// app/api/webhooks/recall/route.ts
import { recall } from "@better-webhook/recall";
import {
  bot_joining_call,
  bot_in_call_recording,
  bot_done,
  bot_fatal,
  transcript_data,
  participant_events_join,
} from "@better-webhook/recall/events";
import { toNextJS } from "@better-webhook/nextjs";

// Recall secrets must have the "whsec_" prefix
const webhook = recall({ secret: process.env.RECALL_WEBHOOK_SECRET })
  .event(bot_joining_call, async (payload) => {
    console.log("Bot joining call:", payload);
  })
  .event(bot_in_call_recording, async (payload) => {
    console.log("Bot is recording");
  })
  .event(bot_done, async (payload) => {
    console.log("Bot finished");
  })
  .event(bot_fatal, async (payload) => {
    console.error("Bot encountered fatal error");
  })
  .event(transcript_data, async (payload) => {
    console.log("Transcript data received");
  })
  .event(participant_events_join, async (payload) => {
    console.log("Participant joined");
  });

export const POST = toNextJS(webhook);
```

## Express + GitHub

```bash
npm install @better-webhook/core @better-webhook/github @better-webhook/express express
```

```ts
// server.ts
import express from "express";
import { github } from "@better-webhook/github";
import { push, pull_request } from "@better-webhook/github/events";
import { toExpress } from "@better-webhook/express";

const app = express();

const webhook = github({ secret: process.env.GITHUB_WEBHOOK_SECRET })
  .event(push, async (payload) => {
    console.log(
      `Push to ${payload.repository.full_name}: ${payload.commits.length} commits`,
    );
  })
  .event(pull_request, async (payload) => {
    console.log(`PR #${payload.number} ${payload.action}`);
  })
  .onError((error, context) => {
    console.error(`Error handling ${context.eventType}:`, error);
  });

// IMPORTANT: express.raw() is required for signature verification
app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook),
);

// Regular JSON routes work normally alongside webhook routes
app.use(express.json());
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(3000, () => console.log("Server running on port 3000"));
```

## Express + Multiple Providers with Stats

```bash
npm install @better-webhook/core @better-webhook/github @better-webhook/ragie @better-webhook/express express
```

```ts
// server.ts
import express from "express";
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { ragie } from "@better-webhook/ragie";
import { document_status_updated } from "@better-webhook/ragie/events";
import { toExpress } from "@better-webhook/express";
import { createWebhookStats } from "@better-webhook/core";

const app = express();
const stats = createWebhookStats();

const githubWebhook = github().event(push, async (payload) => {
  console.log(`Push to ${payload.repository.full_name}`);
});

const ragieWebhook = ragie().event(document_status_updated, async (payload) => {
  console.log(`Document ${payload.document_id}: ${payload.status}`);
});

app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(githubWebhook, { observer: stats.observer }),
);

app.post(
  "/webhooks/ragie",
  express.raw({ type: "application/json" }),
  toExpress(ragieWebhook, { observer: stats.observer }),
);

// Stats endpoint
app.use(express.json());
app.get("/stats", (req, res) => res.json(stats.snapshot()));

app.listen(3000);
```

## Hono + GitHub

```bash
npm install @better-webhook/core @better-webhook/github @better-webhook/hono hono
```

```ts
// src/index.ts
import { Hono } from "hono";
import { github } from "@better-webhook/github";
import { push, pull_request } from "@better-webhook/github/events";
import { toHono } from "@better-webhook/hono";

const app = new Hono();

const webhook = github({ secret: process.env.GITHUB_WEBHOOK_SECRET })
  .event(push, async (payload) => {
    console.log(`Push to ${payload.repository.full_name}`);
  })
  .event(pull_request, async (payload) => {
    console.log(`PR #${payload.number}: ${payload.pull_request.title}`);
  });

app.post("/webhooks/github", toHono(webhook));

export default app;
```

For Node.js runtimes (e.g., `@hono/node-server`), use `toHonoNode`:

```ts
import { toHonoNode } from "@better-webhook/hono";

app.post("/webhooks/github", toHonoNode(webhook));
```

## NestJS + GitHub

```bash
npm install @better-webhook/core @better-webhook/github @better-webhook/nestjs
```

```ts
// main.ts — enable raw body
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // REQUIRED for signature verification
  });
  await app.listen(3000);
}
bootstrap();
```

```ts
// webhooks.controller.ts
import { Controller, Post, Req, Res } from "@nestjs/common";
import { Response } from "express";
import { github } from "@better-webhook/github";
import { push, pull_request } from "@better-webhook/github/events";
import { toNestJS } from "@better-webhook/nestjs";

@Controller("webhooks")
export class WebhooksController {
  private webhook = github({ secret: process.env.GITHUB_WEBHOOK_SECRET })
    .event(push, async (payload) => {
      console.log(`Push to ${payload.repository.full_name}`);
    })
    .event(pull_request, async (payload) => {
      console.log(`PR #${payload.number}: ${payload.pull_request.title}`);
    });

  @Post("github")
  async handleGitHub(@Req() req: any, @Res() res: Response) {
    const result = await toNestJS(this.webhook)(req);
    return res.status(result.statusCode).json(result.body);
  }
}
```

## GCP Cloud Functions

```bash
npm install @better-webhook/core @better-webhook/ragie @better-webhook/gcp-functions @google-cloud/functions-framework
```

```ts
// index.ts — 2nd Gen Cloud Functions
import { http } from "@google-cloud/functions-framework";
import { ragie } from "@better-webhook/ragie";
import { document_status_updated } from "@better-webhook/ragie/events";
import { toGCPFunction } from "@better-webhook/gcp-functions";

const webhook = ragie({ secret: process.env.RAGIE_WEBHOOK_SECRET }).event(
  document_status_updated,
  async (payload) => {
    console.log(`Document ${payload.document_id} is now ${payload.status}`);
  },
);

http("webhookHandler", toGCPFunction(webhook));
```

```ts
// index.ts — 1st Gen Cloud Functions (exports style)
import { ragie } from "@better-webhook/ragie";
import { document_status_updated } from "@better-webhook/ragie/events";
import { toGCPFunction } from "@better-webhook/gcp-functions";

const webhook = ragie().event(document_status_updated, async (payload) => {
  console.log(`Document ${payload.document_id}: ${payload.status}`);
});

export const webhookHandler = toGCPFunction(webhook);
```

## Custom Provider

```bash
npm install @better-webhook/core
```

```ts
// webhooks/my-provider.ts
import {
  customWebhook,
  defineEvent,
  createHmacVerifier,
  z,
} from "@better-webhook/core";

// 1. Define event schemas with Zod
const OrderSchema = z.object({
  orderId: z.string(),
  status: z.enum(["pending", "completed", "cancelled"]),
  amount: z.number(),
  currency: z.string(),
});

const PaymentSchema = z.object({
  paymentId: z.string(),
  orderId: z.string(),
  amount: z.number(),
  method: z.string(),
});

// 2. Define typed events (tree-shakeable)
export const order_created = defineEvent({
  name: "order.created",
  schema: OrderSchema,
  provider: "my-ecommerce" as const,
});

export const payment_completed = defineEvent({
  name: "payment.completed",
  schema: PaymentSchema,
  provider: "my-ecommerce" as const,
});

// 3. Build the webhook handler
export const webhook = customWebhook({
  name: "my-ecommerce",
  getEventType: (headers) => headers["x-event-type"],
  getDeliveryId: (headers) => headers["x-delivery-id"],
  verify: createHmacVerifier({
    algorithm: "sha256",
    signatureHeader: "x-webhook-signature",
    signaturePrefix: "v1=",
  }),
})
  .event(order_created, async (payload) => {
    console.log(
      `New order ${payload.orderId}: ${payload.amount} ${payload.currency}`,
    );
  })
  .event(payment_completed, async (payload) => {
    console.log(`Payment ${payload.paymentId} for order ${payload.orderId}`);
  });
```

## Custom Provider with Envelope Unwrapping

For providers that wrap payloads in an envelope (like `{ type: "...", data: { ... } }`):

```ts
import {
  customWebhook,
  defineEvent,
  createHmacVerifier,
  z,
} from "@better-webhook/core";

const webhook = customWebhook({
  name: "my-provider",
  getEventType: (_headers, body) => {
    // Event type is in the body, not headers
    if (body && typeof body === "object" && "type" in body) {
      return (body as { type: string }).type;
    }
    return undefined;
  },
  getPayload: (body) => {
    // Unwrap the actual payload from the envelope
    if (body && typeof body === "object" && "data" in body) {
      return (body as { data: unknown }).data;
    }
    return body;
  },
  verify: createHmacVerifier({
    algorithm: "sha256",
    signatureHeader: "x-signature",
  }),
});
```

## Custom Provider without Verification

For trusted internal webhook sources (e.g., internal microservices):

```ts
import { customWebhook, defineEvent, z } from "@better-webhook/core";

const internalEvent = defineEvent({
  name: "task.completed",
  schema: z.object({ taskId: z.string(), result: z.unknown() }),
  provider: "internal" as const,
});

const webhook = customWebhook({
  name: "internal",
  verification: "disabled", // No signature verification
  getEventType: (headers) => headers["x-event-type"],
}).event(internalEvent, async (payload) => {
  console.log(`Task ${payload.taskId} completed`);
});
```

## Replay Protection with Custom Redis Store

```ts
import {
  type AtomicReplayStore,
  type ReplayReserveResult,
} from "@better-webhook/core";
import Redis from "ioredis";

class RedisReplayStore implements AtomicReplayStore {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async reserve(
    key: string,
    inFlightTtlSeconds: number,
  ): Promise<ReplayReserveResult> {
    // SET NX with TTL — atomic check-and-set
    const result = await this.redis.set(
      `replay:${key}`,
      "in-flight",
      "EX",
      inFlightTtlSeconds,
      "NX",
    );
    return result === "OK" ? "reserved" : "duplicate";
  }

  async commit(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(`replay:${key}`, "committed", "EX", ttlSeconds);
  }

  async release(key: string): Promise<void> {
    await this.redis.del(`replay:${key}`);
  }
}

// Usage
const redis = new Redis(process.env.REDIS_URL);
const store = new RedisReplayStore(redis);

const webhook = github().withReplayProtection({ store }).event(push, handler);
```

## Observability — Logging Observer

```ts
import { type WebhookObserver } from "@better-webhook/core";

const loggingObserver: WebhookObserver = {
  onRequestReceived: (event) => {
    console.log(
      `[webhook] Received ${event.provider} webhook (${event.rawBodyBytes} bytes)`,
    );
  },
  onVerificationFailed: (event) => {
    console.warn(
      `[webhook] Verification failed for ${event.provider}: ${event.reason}`,
    );
  },
  onSchemaValidationFailed: (event) => {
    console.error(
      `[webhook] Schema validation failed for ${event.eventType}: ${event.error}`,
    );
  },
  onHandlerFailed: (event) => {
    console.error(
      `[webhook] Handler ${event.handlerIndex} failed for ${event.eventType}:`,
      event.error,
    );
  },
  onCompleted: (event) => {
    console.log(
      `[webhook] ${event.provider}/${event.eventType} -> ${event.status} (${event.durationMs.toFixed(1)}ms)`,
    );
  },
};

const webhook = github().observe(loggingObserver).event(push, handler);
```

## Observability — Metrics Observer (Prometheus-style)

```ts
import { type WebhookObserver } from "@better-webhook/core";

const metricsObserver: WebhookObserver = {
  onCompleted: (event) => {
    // Emit to your metrics system
    metrics.histogram("webhook_duration_ms", event.durationMs, {
      provider: event.provider,
      event_type: event.eventType ?? "unknown",
      status: String(event.status),
      success: String(event.success),
    });
    metrics.increment("webhook_requests_total", {
      provider: event.provider,
      event_type: event.eventType ?? "unknown",
      status: String(event.status),
    });
  },
  onVerificationFailed: (event) => {
    metrics.increment("webhook_verification_failures_total", {
      provider: event.provider,
    });
  },
};
```

## Secret Management Patterns

```ts
// Option 1: Explicit secret in provider (recommended for most cases)
const webhook = github({ secret: process.env.GITHUB_WEBHOOK_SECRET });

// Option 2: Secret in adapter options (overrides provider secret)
// Useful when the same webhook builder serves multiple environments
export const POST = toNextJS(webhook, {
  secret: process.env.GITHUB_WEBHOOK_SECRET,
});

// Option 3: Automatic env var resolution (no explicit secret needed)
// The SDK checks these env vars automatically:
//   1. GITHUB_WEBHOOK_SECRET  (for github provider)
//   2. RAGIE_WEBHOOK_SECRET   (for ragie provider)
//   3. RECALL_WEBHOOK_SECRET  (for recall provider)
//   4. WEBHOOK_SECRET          (generic fallback)
const webhook = github(); // Will use GITHUB_WEBHOOK_SECRET or WEBHOOK_SECRET from env

// Option 4: For custom providers, the env var pattern is {UPPERCASED_NAME}_WEBHOOK_SECRET
// e.g., for name: "my-provider" it checks MY_PROVIDER_WEBHOOK_SECRET
```

## Body Size Limits

```ts
// On the builder (applies to all adapters)
const webhook = github()
  .maxBodyBytes(512 * 1024) // 512KB
  .event(push, handler);

// Or per-adapter (overrides builder setting)
export const POST = toNextJS(webhook, {
  maxBodyBytes: 1024 * 1024, // 1MB
});
```

## Multiple Event Handlers for Same Event

The builder supports registering multiple handlers for the same event. They execute sequentially:

```ts
const webhook = github()
  .event(push, async (payload) => {
    // First handler: log the event
    console.log(`Push to ${payload.repository.full_name}`);
  })
  .event(push, async (payload) => {
    // Second handler: process the event
    await processDeployment(payload);
  });
```

## Using Handler Context

Every handler receives a second `context` parameter with metadata:

```ts
const webhook = github().event(push, async (payload, context) => {
  console.log(`Event type: ${context.eventType}`); // "push"
  console.log(`Provider: ${context.provider}`); // "github"
  console.log(`Delivery ID: ${context.deliveryId}`); // GitHub delivery GUID
  console.log(`Received at: ${context.receivedAt}`); // Date object
  console.log(`Raw body: ${context.rawBody}`); // original request body string
  console.log(`Headers: ${JSON.stringify(context.headers)}`); // normalized headers
});
```
