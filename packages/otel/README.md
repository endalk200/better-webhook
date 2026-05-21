# @better-webhook/otel

Record Better Webhook delivery spans with OpenTelemetry-compatible tracers
without capturing webhook payload contents by default.

`@better-webhook/otel` is the OpenTelemetry bridge for Better Webhook Delivery
Observability. It implements the telemetry hooks from `@better-webhook/core` so
you can see verification, replay protection, idempotency, handler, and response
outcomes for each webhook delivery.

## Why use this package?

- Create one span for each webhook delivery.
- Attach provider, event, pipeline result, and response attributes.
- Record sanitized pipeline errors.
- Avoid recording event payload contents by default.
- Use a small tracer interface compatible with `@opentelemetry/api`.

## Installation

Install the OpenTelemetry bridge with core and your OpenTelemetry API package:

```sh
pnpm add @better-webhook/core @better-webhook/otel @opentelemetry/api
```

You will usually also install a provider and framework adapter:

```sh
pnpm add @better-webhook/stripe @better-webhook/nextjs
```

## Getting started

Pass `otel()` as the endpoint telemetry implementation:

```ts
import { trace } from "@opentelemetry/api";
import { createWebhookEndpoint } from "@better-webhook/core";
import { otel } from "@better-webhook/otel";
import { stripe } from "@better-webhook/stripe";

const endpoint = createWebhookEndpoint({
  provider: stripe({ signingSecret: process.env.STRIPE_WEBHOOK_SECRET! }),
  telemetry: otel({ tracer: trace.getTracer("webhooks") }),
  handlers: {
    "invoice.paid": async ({ event }) => {
      event.payload.status;
    },
  },
});
```

Configure your OpenTelemetry SDK, exporter, and resource metadata in your
application as usual. This package only connects Better Webhook pipeline events
to a tracer.

## How it fits with Better Webhook

`@better-webhook/otel` implements core's `DeliveryTelemetry` contract. Core
calls telemetry hooks while processing each Webhook Delivery. The OpenTelemetry
bridge turns those hooks into a span named `better_webhook.delivery`.

This package does not verify providers, adapt framework requests, or change
pipeline behavior. It observes the outcome that core produces.

## Behavior and safety notes

The bridge records delivery metadata and processing outcomes, not payload
contents. This keeps observability useful without putting customer or provider
payload data into traces by default.

If core reports an error during event extraction or handler processing, the
bridge records sanitized error information on the active delivery span.

If the telemetry context is not an OpenTelemetry-compatible span, finish and
error hooks do nothing.

## Span attributes

The delivery span starts with:

- `webhook.provider`
- `http.request.method`
- `url.full`

When the delivery finishes, the bridge records:

- `webhook.event.type`
- `webhook.event.id`
- `webhook.result`
- `webhook.verification`
- `webhook.replay`
- `webhook.idempotency`
- `webhook.handler`
- `http.response.status_code`
- `webhook.duplicate`
- `webhook.ignored`
- `webhook.rejected`
- `webhook.reason`

Optional attributes are only set when core has the corresponding value.

## API summary

- `otel(options)`: creates a Better Webhook `DeliveryTelemetry`
  implementation.
- `OtelOptions`: accepts a tracer.
- `OtelTracer`: minimal tracer contract used by the bridge.
- `OtelSpan`: minimal span contract used by the bridge.

## Runtime support and limits

- Node.js 18 or newer.
- ESM-only package with TypeScript declarations.
- The package expects your application to configure OpenTelemetry SDK/exporter
  setup separately.
- Payload recording is not enabled by default.
