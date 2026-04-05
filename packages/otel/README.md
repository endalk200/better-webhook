# @better-webhook/otel

OpenTelemetry instrumentation for `better-webhook`.

This package connects Better Webhook's builder-level instrumentation API to the OpenTelemetry API. Add it with `.instrument(...)` on the webhook builder, then pass that builder to any adapter.

## Installation

```bash
npm install @better-webhook/otel @opentelemetry/api
# or
pnpm add @better-webhook/otel @opentelemetry/api
# or
yarn add @better-webhook/otel @opentelemetry/api
```

```ts
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { createOpenTelemetryInstrumentation } from "@better-webhook/otel";

const webhook = github()
  .instrument(
    createOpenTelemetryInstrumentation({
      includeEventTypeAttribute: true,
    }),
  )
  .event(push, async (payload) => {
    console.log(payload.repository.full_name);
  });
```

## Defaults

- Creates one processing span per webhook request
- Emits metrics for request count, completed requests, duration, verification failures, schema failures, handler failures, replay duplicates, and body-too-large rejections
- Emits span events for major lifecycle transitions by default
- Keeps `eventType`, `deliveryId`, and `replayKey` attributes opt-in to avoid high-cardinality telemetry by default

## Options

```ts
createOpenTelemetryInstrumentation({
  emitMetrics: true,
  emitSpanEvents: true,
  includeEventTypeAttribute: false,
  includeDeliveryIdAttribute: false,
  includeReplayKeyAttribute: false,
});
```

Use the attribute options carefully:

- `includeEventTypeAttribute`: usually safe enough when your event set is bounded
- `includeDeliveryIdAttribute`: often high-cardinality, usually better left off
- `includeReplayKeyAttribute`: often high-cardinality, usually better left off

## Runtime Setup

The package uses the OpenTelemetry API, so it is safe to install without configuring an SDK. To export traces and metrics, register an OpenTelemetry SDK and exporters in your application runtime.

## Adapter Usage

Instrumentation belongs on the builder, not the adapter:

```ts
import { toExpress } from "@better-webhook/express";

app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook),
);
```
