# @better-webhook/otel

OpenTelemetry bridge for Better Webhook delivery observability.

```ts
import { trace } from "@opentelemetry/api";
import { createWebhookEndpoint } from "@better-webhook/core";
import { otel } from "@better-webhook/otel";

const endpoint = createWebhookEndpoint({
  provider,
  telemetry: otel({ tracer: trace.getTracer("webhooks") }),
  handlers,
});
```

The bridge records a delivery span with provider, event type and id when available, verification result, replay result, idempotency result, handler result, response status, duplicate/ignored/rejected booleans, and sanitized errors. Payload contents are not recorded by default.
