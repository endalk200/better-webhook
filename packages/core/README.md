# @better-webhook/core

Core webhook handling functionality for better-webhook. Provides the foundation for building webhook handlers with type-safe event handling, signature verification, and schema validation.

## Installation

```bash
npm install @better-webhook/core
# or
pnpm add @better-webhook/core
# or
yarn add @better-webhook/core
```

## Usage

### Using Built-in Providers

For common services like GitHub, Stripe, etc., use the pre-built provider packages:

```bash
npm install @better-webhook/github
```

```ts
import { github } from "@better-webhook/github";

const webhook = github({ secret: "your-secret" }).event(
  "push",
  async (payload) => {
    console.log(`Push to ${payload.repository.name}`);
  }
);
```

### Creating Custom Providers

For services that don't have a pre-built provider, you can create your own using the core package utilities.

#### Quick Start with `customWebhook`

The simplest way to create a custom webhook handler:

```ts
import { customWebhook, createHmacVerifier, z } from "@better-webhook/core";

// Define your event schemas
const OrderEventSchema = z.object({
  orderId: z.string(),
  status: z.enum(["pending", "completed", "cancelled"]),
  amount: z.number(),
  customer: z.object({
    id: z.string(),
    email: z.string().email(),
  }),
});

const RefundEventSchema = z.object({
  refundId: z.string(),
  orderId: z.string(),
  amount: z.number(),
  reason: z.string().optional(),
});

// Create the webhook handler
const webhook = customWebhook({
  name: "my-ecommerce",
  schemas: {
    "order.created": OrderEventSchema,
    "order.updated": OrderEventSchema,
    "refund.requested": RefundEventSchema,
  },
  // Extract event type from headers
  getEventType: (headers) => headers["x-webhook-event"],
  // Optional: Extract delivery ID for logging/deduplication
  getDeliveryId: (headers) => headers["x-delivery-id"],
  // Optional: Verify webhook signature
  verify: createHmacVerifier({
    algorithm: "sha256",
    signatureHeader: "x-webhook-signature",
    signaturePrefix: "sha256=", // Optional prefix
  }),
})
  .event("order.created", async (payload) => {
    // payload is fully typed as OrderEventSchema
    console.log(`New order: ${payload.orderId} for ${payload.customer.email}`);
  })
  .event("refund.requested", async (payload) => {
    // payload is fully typed as RefundEventSchema
    console.log(`Refund requested: ${payload.refundId}`);
  });
```

#### Advanced: Using `createProvider` for Reusable Providers

If you need to share a provider across your application or publish it as a package:

```ts
import {
  createProvider,
  createWebhook,
  createHmacVerifier,
  z,
} from "@better-webhook/core";

// Define schemas
const PaymentSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(["pending", "succeeded", "failed"]),
});

// Create a reusable provider
export function createPaymentProvider(options?: { secret?: string }) {
  return createProvider({
    name: "payment-gateway",
    secret: options?.secret,
    schemas: {
      "payment.succeeded": PaymentSchema,
      "payment.failed": PaymentSchema,
    },
    getEventType: (headers) => headers["x-event-type"],
    getDeliveryId: (headers) => headers["x-request-id"],
    verify: createHmacVerifier({
      algorithm: "sha256",
      signatureHeader: "x-signature",
    }),
  });
}

// Export a convenience function like built-in providers
export function paymentGateway(options?: { secret?: string }) {
  return createWebhook(createPaymentProvider(options));
}

// Usage
const webhook = paymentGateway({ secret: "my-secret" }).event(
  "payment.succeeded",
  async (payload) => {
    console.log(`Payment received: ${payload.id}`);
  }
);
```

### Verification Helpers

#### `createHmacVerifier`

Creates a verification function for HMAC-based signatures:

```ts
import { createHmacVerifier } from "@better-webhook/core";

// GitHub-style (sha256=<hex>)
const githubVerifier = createHmacVerifier({
  algorithm: "sha256",
  signatureHeader: "x-hub-signature-256",
  signaturePrefix: "sha256=",
});

// Stripe-style (t=timestamp,v1=signature)
// For complex formats, use the low-level verifyHmac function

// Base64 encoded signature
const base64Verifier = createHmacVerifier({
  algorithm: "sha256",
  signatureHeader: "x-signature",
  signatureEncoding: "base64",
});
```

#### `verifyHmac`

Low-level function for custom verification logic:

```ts
import { verifyHmac } from "@better-webhook/core";

function customVerify(
  rawBody: string | Buffer,
  headers: Headers,
  secret: string
): boolean {
  // Extract signature from complex header format
  const signatureHeader = headers["x-signature"];
  const parts = signatureHeader?.split(",");
  const signature = parts?.find((p) => p.startsWith("v1="))?.slice(3);

  return verifyHmac({
    algorithm: "sha256",
    rawBody,
    secret,
    signature,
  });
}
```

### Provider Without Verification

For development or trusted internal services where signature verification isn't needed:

```ts
const webhook = customWebhook({
  name: "internal-service",
  schemas: {
    "user.created": UserSchema,
  },
  getEventType: (headers) => headers["x-event-type"],
  // No verify function = verification is skipped
});
```

### Error Handling

```ts
const webhook = customWebhook({
  name: "my-provider",
  schemas: { "event.type": MySchema },
  getEventType: (headers) => headers["x-event-type"],
})
  .event("event.type", async (payload) => {
    // Handle event
  })
  .onError((error, context) => {
    console.error(`Error handling ${context.eventType}:`, error);
    console.error("Payload:", context.payload);
  })
  .onVerificationFailed((reason, headers) => {
    console.error("Verification failed:", reason);
  });
```

## API Reference

### Types

```ts
// Provider configuration
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

// HMAC verification options
interface HmacVerifyOptions {
  algorithm: "sha1" | "sha256" | "sha384" | "sha512";
  signatureHeader: string;
  signaturePrefix?: string;
  signatureEncoding?: "hex" | "base64";
}
```

### Functions

- `customWebhook(config)` - Create a webhook builder with inline configuration
- `createProvider(config)` - Create a reusable provider instance
- `createWebhook(provider)` - Create a webhook builder from a provider
- `createHmacVerifier(options)` - Create an HMAC verification function
- `verifyHmac(options)` - Low-level HMAC verification

## License

MIT
