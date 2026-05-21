# Express + Stripe Example Application

This Example Application is a Workspace Consumer for one Express Framework Adapter and one Stripe Provider Definition. It is a local Capability Showcase for signature verification, Idempotency, Replay Protection, Event Handlers, response behavior, console Manual Example Feedback, and Delivery Observability.

It is self-contained under this directory and intentionally does not share helper modules with other examples.

## Run

Start the Express development server:

```sh
devbox run -- pnpm --filter @better-webhook/example-express-stripe run dev
```

The default Webhook Endpoint is `http://127.0.0.1:3000/webhooks/stripe`.

## Sender Scripts

Run these Sender Scripts while the development server is running:

```sh
devbox run -- pnpm --filter @better-webhook/example-express-stripe run send:checkout
devbox run -- pnpm --filter @better-webhook/example-express-stripe run send:invoice
devbox run -- pnpm --filter @better-webhook/example-express-stripe run send:unknown
devbox run -- pnpm --filter @better-webhook/example-express-stripe run send:duplicate
devbox run -- pnpm --filter @better-webhook/example-express-stripe run send:replay
devbox run -- pnpm --filter @better-webhook/example-express-stripe run send:ignored
devbox run -- pnpm --filter @better-webhook/example-express-stripe run send:failure
```

Expected Manual Example Feedback:

- `send:checkout` returns `200` and logs `handled checkout.session.completed`.
- `send:invoice` returns `200` and logs `handled invoice.paid`.
- `send:unknown` returns `200` and logs `catch-all handled unknown verified event`.
- `send:duplicate` returns `200` twice; the second delivery logs `status=duplicate`.
- `send:replay` returns `200` then `400`; the second exact signed Webhook Delivery logs `reason=replayed_delivery`.
- `send:ignored` returns `200` and logs `status=ignored` for a known verified event without a matching Event Handler.
- `send:failure` returns `500` and logs the intentional Event Handler failure.

## Local Telemetry Sink

The application configures OpenTelemetry export itself and wires the SDK OpenTelemetry bridge into the Webhook Endpoint. The default Local Telemetry Sink is motel at `http://127.0.0.1:27686`.

The OTLP trace exporter sends to:

```text
http://127.0.0.1:27686/v1/traces
```

Set these variables to override local defaults:

- `BETTER_WEBHOOK_OTEL_ENDPOINT`: base OTLP HTTP endpoint, default `http://127.0.0.1:27686`.
- `OTEL_SERVICE_NAME`: service name, default `better-webhook-example-express-stripe`.
- `STRIPE_WEBHOOK_SECRET`: Provider Secret used by both server and Sender Scripts.
- `PORT`: Express port, default `3000`.
- `BETTER_WEBHOOK_URL`: full Sender Script target URL.
- `BETTER_WEBHOOK_ENDPOINT_IDENTITY`: Endpoint Identity used in coordination keys.
- `BETTER_WEBHOOK_IDEMPOTENCY_TTL_MS`: in-memory Idempotency Store TTL.
- `BETTER_WEBHOOK_REPLAY_WINDOW_MS`: Replay Protection window and in-memory Replay Store TTL.

## Local-Only Configuration

The default Provider Secret, in-memory Idempotency Store, and in-memory Replay Store are Example Configuration for local development. Production webhook endpoints should use real secret management and durable coordination stores.

Behavior is manually verified through the dev server, Sender Scripts, console logs, and exported telemetry. This Example Application intentionally does not add automated behavioral tests for Delivery Scenarios.
