# @better-webhook/otel Agent Guide

## Package role

`@better-webhook/otel` is the OpenTelemetry bridge for Better Webhook Delivery Observability. It implements core's `DeliveryTelemetry` contract by creating one span per Webhook Delivery and recording pipeline outcome attributes.

This package does not configure an OpenTelemetry SDK, exporter, or resource. It does not verify providers, adapt framework requests, parse events, or change pipeline behavior.

## Install

```sh
npm install @better-webhook/core @better-webhook/otel @opentelemetry/api
```

Most applications also install a provider and framework adapter:

```sh
npm install @better-webhook/stripe @better-webhook/nextjs
```

`@opentelemetry/api` is needed for the example below. The package contract only requires an object matching the exported `OtelTracer` shape.

## Primary APIs

- `otel(options)`: creates a core `DeliveryTelemetry` implementation.

`OtelOptions`:

- `tracer`: object with `startSpan(name, options?)`.

The span name is `better_webhook.delivery`.

## Types and contracts

- `OtelTracer`: minimal tracer contract compatible with `@opentelemetry/api` tracers.
- `OtelSpan`: minimal span contract with `setAttribute`, optional `addEvent`, optional `recordException`, and `end`.
- `OtelOptions`: options accepted by `otel()`.

The bridge accepts the small structural tracer/span contracts instead of importing OpenTelemetry types directly.

## Canonical example

```ts
import { trace } from "@opentelemetry/api";
import { createWebhookEndpoint } from "@better-webhook/core";
import { otel } from "@better-webhook/otel";
import { stripe } from "@better-webhook/stripe";

export const endpoint = createWebhookEndpoint({
  provider: stripe({ signingSecret: process.env.STRIPE_WEBHOOK_SECRET! }),
  telemetry: otel({ tracer: trace.getTracer("webhooks") }),
  handlers: {
    "invoice.paid": async ({ event }) => {
      event.payload.status;
    },
  },
});
```

## Behavior defaults

The span starts with:

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

Optional attributes are only set when core supplies a value. Payload contents are not recorded by default.

## Gotchas

- Configure the OpenTelemetry SDK and exporter in the application; this package only consumes a tracer.
- If the telemetry context is not span-shaped, finish and error hooks do nothing.
- Errors recorded by core are sanitized to provider, error name, and message.
- The bridge ends the delivery span when core finishes processing the Webhook Delivery.

## Do / do not

Do pass `otel({ tracer })` to `createWebhookEndpoint({ telemetry })`.
Do keep payload recording out of traces unless the application explicitly owns that policy elsewhere.
Do use normal OpenTelemetry setup for exporters, resources, sampling, and context propagation.

Do not expect this package to initialize OpenTelemetry.
Do not add provider payloads to span attributes by default.
Do not use telemetry hooks to change webhook response behavior.
