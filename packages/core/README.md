# @better-webhook/core

[![npm](https://img.shields.io/npm/v/@better-webhook/core?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/core)
[![npm monthly](https://img.shields.io/npm/dm/@better-webhook/core?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@better-webhook/core)

**Type-safe webhooks in TypeScript. Verified. Validated. Delightful.**

Stop wrestling with raw webhook payloads. `better-webhook` gives you fully-typed event handlers, automatic signature verification, and schema validation—all with a beautiful, chainable API.

```ts
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";

const webhook = github().event(push, async (payload) => {
  // ✨ payload is fully typed!
  console.log(`${payload.pusher.name} pushed to ${payload.repository.name}`);
});
```

## Why better-webhook?

- **🔒 Secure by default** — HMAC signature verification out of the box
- **📝 Fully typed** — TypeScript autocomplete for every event payload
- **✅ Schema validated** — Zod validation catches malformed webhooks
- **🔗 Chainable API** — Register multiple handlers with elegant fluent syntax
- **🎯 Framework adapters** — First-class support for Next.js, Hono, Express, NestJS, GCP Cloud Functions

## Installation

```bash
npm install @better-webhook/core
# or
pnpm add @better-webhook/core
# or
yarn add @better-webhook/core
```

## Quick Start

The fastest way to get started is with a pre-built provider:

```bash
npm install @better-webhook/github @better-webhook/nextjs
```

```ts
// app/api/webhooks/github/route.ts
import { github } from "@better-webhook/github";
import { push, pull_request } from "@better-webhook/github/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github()
  .event(push, async (payload) => {
    console.log(`Push to ${payload.repository.full_name}`);
    console.log(`Commits: ${payload.commits.length}`);
  })
  .event(pull_request, async (payload) => {
    if (payload.action === "opened") {
      console.log(`New PR: ${payload.pull_request.title}`);
    }
  });

export const POST = toNextJS(webhook);
```

That's it. Your webhook endpoint is:

- ✅ Verifying signatures (set `GITHUB_WEBHOOK_SECRET` env var)
- ✅ Validating payloads against schemas
- ✅ Fully typed with autocomplete
- ✅ Handling multiple event types

If no secret is configured, requests are rejected by default.

## Error Handling

Gracefully handle failures with the built-in error hooks:

```ts
const webhook = github()
  .event(push, async (payload) => {
    await deployToProduction(payload);
  })
  .onError((error, context) => {
    // Called when your handler throws
    console.error(`Failed to handle ${context.eventType}:`, error);
    console.error("Payload:", context.payload);

    // Send to your error tracking service
    Sentry.captureException(error, { extra: context });
  })
  .onVerificationFailed((reason, headers) => {
    // Called when signature verification fails
    console.warn("Webhook verification failed:", reason);
    console.warn("Headers:", headers);

    // Alert on potential attacks
    alertSecurityTeam({ reason, headers });
  });
```

## Handler Context

Every event handler receives a second parameter—`context`—containing metadata about the webhook request. This is useful for logging, debugging, and accessing request details:

```ts
const webhook = github().event(push, async (payload, context) => {
  // Know which provider sent this webhook
  console.log(`Provider: ${context.provider}`); // "github"

  // Access the event type
  console.log(`Event: ${context.eventType}`); // "push"

  // Access the delivery ID (extracted from provider-specific headers)
  console.log(`Delivery ID: ${context.deliveryId}`);

  // Get all request headers (normalized to lowercase)
  console.log(`User-Agent: ${context.headers["user-agent"]}`);

  // Access the raw body for advanced use cases
  console.log(`Raw body length: ${context.rawBody.length}`);

  // Know when the webhook was received
  console.log(`Received at: ${context.receivedAt.toISOString()}`);

  await processWebhook(payload);
});
```

### HandlerContext Properties

| Property     | Type                                | Description                                                     |
| ------------ | ----------------------------------- | --------------------------------------------------------------- |
| `eventType`  | `string`                            | The event type (e.g., "push", "order.created")                  |
| `provider`   | `string`                            | Provider name (e.g., "github", "stripe")                        |
| `deliveryId` | `string \| undefined`               | Unique delivery ID from provider headers (for logging/deduping) |
| `headers`    | `Record<string, string\|undefined>` | Normalized request headers (lowercase keys)                     |
| `rawBody`    | `string`                            | The raw request body as a string                                |
| `receivedAt` | `Date`                              | Timestamp when the webhook was received                         |

### Replay Protection (Built-In)

Use replay protection to enforce deduplication in core with a pluggable store.
By default, duplicate deliveries return `409`.

Replay protection now follows a lifecycle:

1. Reserve replay key before schema/handler execution
2. By default, commit the key only after a successful handled response (e.g. `200`)
3. Release the reservation for unhandled responses (e.g. `204`) or processing failures (`4xx`/`5xx`)

```ts
import { createInMemoryReplayStore } from "@better-webhook/core";

const replayStore = createInMemoryReplayStore({
  maxEntries: 10000,
  cleanupIntervalMs: 60_000,
});

const webhook = github()
  .withReplayProtection({
    store: replayStore,
  })
  .event(push, async (payload) => {
    await processWebhook(payload);
  });
```

Use a shared store (for example Redis) in production so deduplication works
across all app instances.

### Custom Store (Bring Your Own)

If you want your own backend (Redis, SQL, DynamoDB, etc.), implement the
atomic replay store contract:

```ts
import type { ReplayStore } from "@better-webhook/core";

class RedisReplayStore implements ReplayStore {
  async reserve(
    key: string,
    inFlightTtlSeconds: number,
  ): Promise<"reserved" | "duplicate"> {
    const result = await redis.set(key, "1", {
      NX: true,
      EX: inFlightTtlSeconds,
    });
    return result === "OK" ? "reserved" : "duplicate";
  }

  async commit(key: string, ttlSeconds: number): Promise<void> {
    await redis.expire(key, ttlSeconds);
  }

  async release(key: string): Promise<void> {
    await redis.del(key);
  }
}

const webhook = github()
  .withReplayProtection({
    store: new RedisReplayStore(),
  })
  .event(push, handler);
```

### Optional Replay Freshness Policy

You can enforce a replay timestamp tolerance when providers expose signed
timestamps:

```ts
const webhook = recall()
  .withReplayProtection({
    store: createInMemoryReplayStore(),
    policy: {
      ttlSeconds: 24 * 60 * 60,
      timestampToleranceSeconds: 5 * 60,
      key: (context) => {
        const candidate = context.replayKey ?? context.deliveryId;
        return candidate ? `${context.provider}:${candidate}` : undefined;
      },
    },
  })
  .event(bot_done, handler);
```

Provider timestamp support in this repository:

- `@better-webhook/resend`: replay key (`svix-id`) with signed timestamp metadata
- `@better-webhook/recall`: includes signed timestamp metadata
- `@better-webhook/github`: replay key (`x-github-delivery`) only
- `@better-webhook/ragie`: replay key (`nonce`) only

### Manual Deduplication (Fallback)

If you do not enable replay protection, you can still dedupe manually with
`context.deliveryId`:

```ts
const processedIds = new Set<string>();

const webhook = github().event(push, async (payload, context) => {
  if (context.deliveryId && processedIds.has(context.deliveryId)) {
    return;
  }
  if (context.deliveryId) {
    processedIds.add(context.deliveryId);
  }
  await processWebhook(payload);
});
```

### Context in Multiple Handlers

All handlers for the same event receive the same context object:

```ts
const webhook = github()
  .event(push, async (payload, context) => {
    // Log the webhook
    await logger.info(`Received ${context.eventType}`, {
      provider: context.provider,
      receivedAt: context.receivedAt,
    });
  })
  .event(push, async (payload, context) => {
    // Both handlers receive the exact same context
    await processPayload(payload);
  });
```

## Multiple Handlers

Register multiple handlers for the same event—they run sequentially:

```ts
const webhook = github()
  .event(push, async (payload) => {
    // First: Update database
    await db.commits.insertMany(payload.commits);
  })
  .event(push, async (payload) => {
    // Second: Send notifications
    await slack.notify(`New push to ${payload.repository.name}`);
  })
  .event(push, async (payload) => {
    // Third: Trigger CI/CD
    await triggerBuild(payload.after);
  });
```

## Secret Management

Secrets are resolved automatically in this order:

1. **Explicit secret** — Passed to the adapter
2. **Provider default** — Set when creating the provider
3. **Environment variable** — `{PROVIDER}_WEBHOOK_SECRET` (e.g., `GITHUB_WEBHOOK_SECRET`)
4. **Fallback** — `WEBHOOK_SECRET`

Verification is required by default. If no secret can be resolved, the request
is rejected unless verification is explicitly disabled.

Verification runs before unhandled-event routing, so unknown/unsupported events
must still pass signature verification before a `204` is returned.

```ts
// Option 1: Environment variable (recommended)
// Set GITHUB_WEBHOOK_SECRET=your-secret
const webhook = github().event(push, handler);

// Option 2: Explicit secret
const webhook = github({ secret: "your-secret" }).event(push, handler);

// Option 3: At adapter level
export const POST = toNextJS(webhook, { secret: "your-secret" });
```

## Request Body Size Guard

Use `maxBodyBytes` to reject oversized requests with `413` before parsing,
signature verification, schema validation, and handler execution.

```ts
const webhook = github()
  .maxBodyBytes(1024 * 1024) // 1MB builder default
  .event(push, handler);

// Per-request override (adapters pass this through)
await webhook.process({
  headers: { "x-github-event": "push" },
  rawBody: payload,
  maxBodyBytes: 2 * 1024 * 1024, // 2MB
});
```

Use this as an app-layer guard. Keep proxy/framework request-size limits
configured for earlier rejection and better memory protection.

## Creating Custom Providers

Need to handle webhooks from a service we don't have a pre-built provider for? Create your own in minutes:

### Quick Custom Webhook

For one-off integrations, use `customWebhook`:

```ts
import {
  customWebhook,
  createHmacVerifier,
  defineEvent,
  z,
} from "@better-webhook/core";

// Define your event schemas with Zod
const OrderSchema = z.object({
  orderId: z.string(),
  status: z.enum(["pending", "completed", "cancelled"]),
  amount: z.number(),
  customer: z.object({
    id: z.string(),
    email: z.string().email(),
  }),
});

const RefundSchema = z.object({
  refundId: z.string(),
  orderId: z.string(),
  amount: z.number(),
  reason: z.string().optional(),
});

// Create your webhook handler
const orderCreated = defineEvent({
  name: "order.created",
  schema: OrderSchema,
  provider: "my-ecommerce" as const,
});

const refundRequested = defineEvent({
  name: "refund.requested",
  schema: RefundSchema,
  provider: "my-ecommerce" as const,
});

const webhook = customWebhook({
  name: "my-ecommerce",
  // Tell us where to find the event type
  getEventType: (headers) => headers["x-webhook-event"],
  // Optional: Extract delivery ID for logging/deduplication
  getDeliveryId: (headers) => headers["x-delivery-id"],
  // Optional: Verify webhook signatures
  verify: createHmacVerifier({
    algorithm: "sha256",
    signatureHeader: "x-webhook-signature",
    signaturePrefix: "sha256=",
  }),
})
  .event(orderCreated, async (payload) => {
    // payload is typed as OrderSchema!
    console.log(`New order: ${payload.orderId}`);
    await sendConfirmationEmail(payload.customer.email);
  })
  .event(refundRequested, async (payload) => {
    // payload is typed as RefundSchema!
    console.log(`Refund requested: ${payload.refundId}`);
  });
```

### Reusable Provider Package

Building a provider to share across your organization or publish to npm? Use `createProvider`:

```ts
import {
  createProvider,
  createWebhook,
  createHmacVerifier,
  defineEvent,
  z,
} from "@better-webhook/core";

// schemas.ts
export const PaymentSucceededSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  customer_email: z.string().email(),
});

export const PaymentFailedSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  error_code: z.string(),
  error_message: z.string(),
});

// provider.ts
const paymentSucceeded = defineEvent({
  name: "payment.succeeded",
  schema: PaymentSucceededSchema,
  provider: "payment-gateway" as const,
});

const paymentFailed = defineEvent({
  name: "payment.failed",
  schema: PaymentFailedSchema,
  provider: "payment-gateway" as const,
});

export interface PaymentGatewayOptions {
  secret?: string;
}

function createPaymentGatewayProvider(options?: PaymentGatewayOptions) {
  return createProvider({
    name: "payment-gateway",
    secret: options?.secret,
    getEventType: (headers) => headers["x-event-type"],
    getDeliveryId: (headers) => headers["x-request-id"],
    verify: createHmacVerifier({
      algorithm: "sha256",
      signatureHeader: "x-signature",
    }),
  });
}

// Public API - matches the pattern of built-in providers
export function paymentGateway(options?: PaymentGatewayOptions) {
  return createWebhook(createPaymentGatewayProvider(options));
}

// Usage is identical to built-in providers.
const webhook = paymentGateway({ secret: "sk_..." })
  .event(paymentSucceeded, async (payload) => {
    await fulfillOrder(payload.id);
    await sendReceipt(payload.customer_email);
  })
  .event(paymentFailed, async (payload) => {
    await flagPaymentFailure(payload.id, payload.error_code);
  });
```

### Verification Helpers

#### HMAC Verification

Most webhook providers use HMAC signatures. We make it easy:

```ts
import { createHmacVerifier } from "@better-webhook/core";

// GitHub-style: sha256=<hex>
const githubVerifier = createHmacVerifier({
  algorithm: "sha256",
  signatureHeader: "x-hub-signature-256",
  signaturePrefix: "sha256=",
});

// Base64-encoded signatures
const base64Verifier = createHmacVerifier({
  algorithm: "sha256",
  signatureHeader: "x-signature",
  signatureEncoding: "base64",
});

// SHA-1 (for legacy systems)
const sha1Verifier = createHmacVerifier({
  algorithm: "sha1",
  signatureHeader: "x-signature",
});
```

#### Custom Verification Logic

For complex signature formats (like Stripe's `t=timestamp,v1=signature`), use the low-level `verifyHmac`:

```ts
import { verifyHmac } from "@better-webhook/core";

function stripeVerify(
  rawBody: string | Buffer,
  headers: Headers,
  secret: string,
): boolean {
  const signatureHeader = headers["stripe-signature"];
  if (!signatureHeader) return false;

  // Parse Stripe's format: t=1234567890,v1=abc123...
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => part.split("=")),
  );

  const timestamp = parts["t"];
  const signature = parts["v1"];

  // Stripe signs: timestamp.payload
  const signedPayload = `${timestamp}.${rawBody}`;

  return verifyHmac({
    algorithm: "sha256",
    rawBody: signedPayload,
    secret,
    signature,
  });
}
```

### Provider Without Verification

For development or trusted internal services, you must explicitly disable
verification:

```ts
import { customWebhook, defineEvent, z } from "@better-webhook/core";

const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});

const userCreated = defineEvent({
  name: "user.created",
  schema: UserSchema,
  provider: "internal-service" as const,
});

const userDeleted = defineEvent({
  name: "user.deleted",
  schema: UserSchema,
  provider: "internal-service" as const,
});

const webhook = customWebhook({
  name: "internal-service",
  getEventType: (headers) => headers["x-event-type"],
  verification: "disabled",
})
  .event(userCreated, async (payload) => {
    await indexUser(payload.id);
  })
  .event(userDeleted, async (payload) => {
    await removeUser(payload.id);
  });
```

## Observability

`@better-webhook/core` now exposes a minimal vendor-neutral `.instrument(...)` hook on the builder. For OpenTelemetry traces and metrics, use `@better-webhook/otel`.

```ts
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { createOpenTelemetryInstrumentation } from "@better-webhook/otel";

const webhook = github()
  .instrument(createOpenTelemetryInstrumentation())
  .event(push, handler);
```

Instrumentation callbacks are isolated from webhook processing. If an instrumentation callback throws, webhook processing still continues.

The instrumentation API is request-scoped: `onRequestStart(context)` can return a `WebhookRequestInstrumentation` object for downstream lifecycle callbacks such as verification failures, replay events, handler failures, completion, and optional handler wrapping.

## API Reference

### Functions

| Function                      | Description                                        |
| ----------------------------- | -------------------------------------------------- |
| `customWebhook(config)`       | Create a webhook builder with inline configuration |
| `createProvider(config)`      | Create a reusable provider instance                |
| `createWebhook(provider)`     | Create a webhook builder from a provider           |
| `createHmacVerifier(options)` | Create an HMAC verification function               |
| `verifyHmac(options)`         | Low-level HMAC verification                        |
| `createInMemoryReplayStore()` | Create an in-memory replay/idempotency store       |

### Types

```ts
interface ProviderConfig {
  name: string;
  secret?: string;
  verification?: "required" | "disabled";
  getEventType: (headers: Headers, body?: unknown) => string | undefined;
  getDeliveryId?: (headers: Headers) => string | undefined;
  getPayload?: (body: unknown) => unknown;
  getReplayContext?: (
    headers: Headers,
    body?: unknown,
  ) => { replayKey?: string; timestamp?: number };
  verify?: (
    rawBody: string | Buffer,
    headers: Headers,
    secret: string,
  ) => boolean;
}

interface HmacVerifyOptions {
  algorithm: "sha1" | "sha256" | "sha384" | "sha512";
  signatureHeader: string;
  signaturePrefix?: string;
  signatureEncoding?: "hex" | "base64";
}

interface HandlerContext {
  eventType: string;
  provider: string;
  deliveryId?: string;
  headers: Record<string, string | undefined>;
  rawBody: string;
  receivedAt: Date;
}

interface ErrorContext {
  eventType: string;
  deliveryId?: string;
  payload: unknown;
}

interface ReplayContext {
  provider: string;
  eventType?: string;
  deliveryId?: string;
  replayKey?: string;
  timestamp?: number;
}

type ReplayReserveResult = "reserved" | "duplicate";

interface AtomicReplayStore {
  reserve(
    key: string,
    inFlightTtlSeconds: number,
  ): Promise<ReplayReserveResult> | ReplayReserveResult;
  commit(key: string, ttlSeconds: number): Promise<void> | void;
  release(key: string): Promise<void> | void;
}

type ReplayStore = AtomicReplayStore;

interface ReplayPolicy {
  ttlSeconds: number;
  inFlightTtlSeconds?: number;
  timestampToleranceSeconds?: number;
  key(context: ReplayContext): string | undefined;
  onDuplicate?: "conflict" | "ignore";
}

// Event handler signature
type EventHandler<T> = (
  payload: T,
  context: HandlerContext,
) => Promise<void> | void;

// Enable replay protection on a webhook builder
webhook.withReplayProtection({
  store: replayStore,
  policy: optionalPolicy,
});

interface WebhookInstrumentationContext {
  provider: string;
  eventType?: string;
  deliveryId?: string;
  rawBodyBytes: number;
  receivedAt: Date;
}

interface WebhookInstrumentation {
  onRequestStart?(
    context: WebhookInstrumentationContext,
  ): WebhookRequestInstrumentation | void;
}

interface WebhookRequestInstrumentation {
  wrapHandler?(
    next: () => Promise<void>,
    data: WebhookHandlerStartedData,
  ): Promise<void> | void;
  onBodyTooLarge?(data: WebhookBodyTooLargeData): void;
  onJsonParseFailed?(data: WebhookJsonParseFailedData): void;
  onVerificationSucceeded?(data: WebhookVerificationSucceededData): void;
  onVerificationFailed?(data: WebhookVerificationFailedData): void;
  onReplaySkipped?(data: WebhookReplaySkippedData): void;
  onReplayFreshnessRejected?(data: WebhookReplayFreshnessRejectedData): void;
  onReplayReserved?(data: WebhookReplayReservedData): void;
  onReplayDuplicate?(data: WebhookReplayDuplicateData): void;
  onReplayCommitted?(data: WebhookReplayCommittedData): void;
  onReplayReleased?(data: WebhookReplayReleasedData): void;
  onEventUnhandled?(data: WebhookEventUnhandledData): void;
  onSchemaValidationSucceeded?(
    data: WebhookSchemaValidationSucceededData,
  ): void;
  onSchemaValidationFailed?(data: WebhookSchemaValidationFailedData): void;
  onHandlerStarted?(data: WebhookHandlerStartedData): void;
  onHandlerSucceeded?(data: WebhookHandlerSucceededData): void;
  onHandlerFailed?(data: WebhookHandlerFailedData): void;
  onCompleted?(data: WebhookCompletedData): void;
}
```

When implementing `wrapHandler`, call `next()` at most once and await or return it.

## License

MIT
