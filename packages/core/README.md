# @better-webhook/core

**Type-safe webhooks in TypeScript. Verified. Validated. Delightful.**

Stop wrestling with raw webhook payloads. `better-webhook` gives you fully-typed event handlers, automatic signature verification, and schema validation—all with a beautiful, chainable API.

```ts
import { github } from "@better-webhook/github";

const webhook = github().event("push", async (payload) => {
  // ✨ payload is fully typed!
  console.log(`${payload.pusher.name} pushed to ${payload.repository.name}`);
});
```

## Why better-webhook?

- **🔒 Secure by default** — HMAC signature verification out of the box
- **📝 Fully typed** — TypeScript autocomplete for every event payload
- **✅ Schema validated** — Zod validation catches malformed webhooks
- **🔗 Chainable API** — Register multiple handlers with elegant fluent syntax
- **🎯 Framework adapters** — First-class support for Next.js, Express, NestJS

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
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github()
  .event("push", async (payload) => {
    console.log(`Push to ${payload.repository.full_name}`);
    console.log(`Commits: ${payload.commits.length}`);
  })
  .event("pull_request", async (payload) => {
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

## Error Handling

Gracefully handle failures with the built-in error hooks:

```ts
const webhook = github()
  .event("push", async (payload) => {
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
const webhook = github().event("push", async (payload, context) => {
  // Know which provider sent this webhook
  console.log(`Provider: ${context.provider}`); // "github"

  // Access the event type
  console.log(`Event: ${context.eventType}`); // "push"

  // Get all request headers (normalized to lowercase)
  console.log(`User-Agent: ${context.headers["user-agent"]}`);

  // Access provider-specific headers (e.g., GitHub's delivery ID)
  console.log(`Delivery ID: ${context.headers["x-github-delivery"]}`);

  // Access the raw body for advanced use cases
  console.log(`Raw body length: ${context.rawBody.length}`);

  // Know when the webhook was received
  console.log(`Received at: ${context.receivedAt.toISOString()}`);

  await processWebhook(payload);
});
```

### HandlerContext Properties

| Property     | Type                                | Description                                    |
| ------------ | ----------------------------------- | ---------------------------------------------- |
| `eventType`  | `string`                            | The event type (e.g., "push", "order.created") |
| `provider`   | `string`                            | Provider name (e.g., "github", "stripe")       |
| `headers`    | `Record<string, string\|undefined>` | Normalized request headers (lowercase keys)    |
| `rawBody`    | `string`                            | The raw request body as a string               |
| `receivedAt` | `Date`                              | Timestamp when the webhook was received        |

### Using Context for Deduplication

Provider-specific delivery IDs can be accessed from headers:

```ts
const processedIds = new Set<string>();

const webhook = github().event("push", async (payload, context) => {
  // GitHub sends delivery ID in x-github-delivery header
  const deliveryId = context.headers["x-github-delivery"];

  // Skip if we've already processed this webhook
  if (deliveryId && processedIds.has(deliveryId)) {
    console.log(`Skipping duplicate delivery: ${deliveryId}`);
    return;
  }

  // Mark as processed
  if (deliveryId) {
    processedIds.add(deliveryId);
  }

  await processWebhook(payload);
});
```

### Context in Multiple Handlers

All handlers for the same event receive the same context object:

```ts
const webhook = github()
  .event("push", async (payload, context) => {
    // Log the webhook
    await logger.info(`Received ${context.eventType}`, {
      provider: context.provider,
      receivedAt: context.receivedAt,
    });
  })
  .event("push", async (payload, context) => {
    // Both handlers receive the exact same context
    await processPayload(payload);
  });
```

## Multiple Handlers

Register multiple handlers for the same event—they run sequentially:

```ts
const webhook = github()
  .event("push", async (payload) => {
    // First: Update database
    await db.commits.insertMany(payload.commits);
  })
  .event("push", async (payload) => {
    // Second: Send notifications
    await slack.notify(`New push to ${payload.repository.name}`);
  })
  .event("push", async (payload) => {
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

```ts
// Option 1: Environment variable (recommended)
// Set GITHUB_WEBHOOK_SECRET=your-secret
const webhook = github().event("push", handler);

// Option 2: Explicit secret
const webhook = github({ secret: "your-secret" }).event("push", handler);

// Option 3: At adapter level
export const POST = toNextJS(webhook, { secret: "your-secret" });
```

## Creating Custom Providers

Need to handle webhooks from a service we don't have a pre-built provider for? Create your own in minutes:

### Quick Custom Webhook

For one-off integrations, use `customWebhook`:

```ts
import { customWebhook, createHmacVerifier, z } from "@better-webhook/core";

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
const webhook = customWebhook({
  name: "my-ecommerce",
  schemas: {
    "order.created": OrderSchema,
    "order.updated": OrderSchema,
    "refund.requested": RefundSchema,
  },
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
  .event("order.created", async (payload) => {
    // payload is typed as OrderSchema!
    console.log(`New order: ${payload.orderId}`);
    await sendConfirmationEmail(payload.customer.email);
  })
  .event("refund.requested", async (payload) => {
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
const PaymentSchemas = {
  "payment.succeeded": PaymentSucceededSchema,
  "payment.failed": PaymentFailedSchema,
} as const;

export interface PaymentGatewayOptions {
  secret?: string;
}

function createPaymentGatewayProvider(options?: PaymentGatewayOptions) {
  return createProvider({
    name: "payment-gateway",
    secret: options?.secret,
    schemas: PaymentSchemas,
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

// Usage is identical to built-in providers!
const webhook = paymentGateway({ secret: "sk_..." }).event(
  "payment.succeeded",
  async (payload) => {
    await fulfillOrder(payload.id);
    await sendReceipt(payload.customer_email);
  }
);
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
  secret: string
): boolean {
  const signatureHeader = headers["stripe-signature"];
  if (!signatureHeader) return false;

  // Parse Stripe's format: t=1234567890,v1=abc123...
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => part.split("="))
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

For development or trusted internal services:

```ts
const webhook = customWebhook({
  name: "internal-service",
  schemas: {
    "user.created": UserSchema,
    "user.deleted": UserSchema,
  },
  getEventType: (headers) => headers["x-event-type"],
  // No verify function = skip verification
});
```

## API Reference

### Functions

| Function                      | Description                                        |
| ----------------------------- | -------------------------------------------------- |
| `customWebhook(config)`       | Create a webhook builder with inline configuration |
| `createProvider(config)`      | Create a reusable provider instance                |
| `createWebhook(provider)`     | Create a webhook builder from a provider           |
| `createHmacVerifier(options)` | Create an HMAC verification function               |
| `verifyHmac(options)`         | Low-level HMAC verification                        |

### Types

```ts
interface ProviderConfig<EventMap> {
  name: string;
  schemas: EventMap;
  secret?: string;
  getEventType: (headers: Headers) => string | undefined;
  getDeliveryId?: (headers: Headers) => string | undefined;
  verify?: (
    rawBody: string | Buffer,
    headers: Headers,
    secret: string
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
  headers: Record<string, string | undefined>;
  rawBody: string;
  receivedAt: Date;
}

interface ErrorContext {
  eventType: string;
  deliveryId?: string;
  payload: unknown;
}

// Event handler signature
type EventHandler<T> = (
  payload: T,
  context: HandlerContext
) => Promise<void> | void;
```

## License

MIT
