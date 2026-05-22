# Express Example Application

This Example Application is a Workspace Consumer for the Express Framework Adapter. It is a Progressive Capability Showcase: each provider route keeps the webhook setup visible while still demonstrating signature verification, Idempotency, Replay Protection, Event Handlers, response behavior, console Manual Example Feedback, and Delivery Observability.

The current provider endpoints are Stripe at `/webhooks/stripe` and GitHub at `/webhooks/github`. The app is intentionally self-contained and does not share helper modules with other examples.

## Run

Start the Express development server:

```sh
bun --filter @better-webhook/example-express run dev
```

The default Stripe Webhook Endpoint is `http://127.0.0.1:3000/webhooks/stripe`.
The default GitHub Webhook Endpoint is `http://127.0.0.1:3000/webhooks/github`.

## Sender Scripts

Run these Stripe Sender Scripts while the development server is running:

```sh
bun --filter @better-webhook/example-express run send:stripe:checkout
bun --filter @better-webhook/example-express run send:stripe:invoice
bun --filter @better-webhook/example-express run send:stripe:unknown
bun --filter @better-webhook/example-express run send:stripe:duplicate
bun --filter @better-webhook/example-express run send:stripe:replay
bun --filter @better-webhook/example-express run send:stripe:ignored
bun --filter @better-webhook/example-express run send:stripe:failure
```

Expected Manual Example Feedback:

- `send:stripe:checkout` returns `200` and logs `handled checkout.session.completed`.
- `send:stripe:invoice` returns `200` and logs `handled invoice.paid`.
- `send:stripe:unknown` returns `200` and logs `catch-all handled unknown verified event`.
- `send:stripe:duplicate` returns `200` twice; the second delivery logs `status=duplicate`.
- `send:stripe:replay` returns `200` then `400`; the second exact signed Webhook Delivery logs `reason=replayed_delivery`.
- `send:stripe:ignored` returns `200` and logs `status=ignored` for a known verified event without a matching Event Handler.
- `send:stripe:failure` returns `500` and logs the intentional Event Handler failure.

Run these GitHub Sender Scripts while the development server is running:

```sh
bun --filter @better-webhook/example-express run send:github:pull-request
bun --filter @better-webhook/example-express run send:github:issue-comment
bun --filter @better-webhook/example-express run send:github:check-run
bun --filter @better-webhook/example-express run send:github:duplicate
bun --filter @better-webhook/example-express run send:github:replay
bun --filter @better-webhook/example-express run send:github:ignored
bun --filter @better-webhook/example-express run send:github:unknown
bun --filter @better-webhook/example-express run send:github:failure
```

Expected GitHub Manual Example Feedback:

- `send:github:pull-request` returns `200` and logs `handled pull_request`.
- `send:github:issue-comment` returns `200` and logs `handled issue_comment`.
- `send:github:check-run` returns `200` and logs `handled check_run`.
- `send:github:duplicate` returns `200` twice; the second delivery logs `status=duplicate`.
- `send:github:replay` returns `200` then `400`; the second exact signed Webhook Delivery logs `reason=replayed_delivery`.
- `send:github:ignored` returns `200` and logs `status=ignored` for a known verified event without a matching Event Handler.
- `send:github:unknown` returns `200` and logs `catch-all handled unknown verified`.
- `send:github:failure` returns `500` and logs the intentional Event Handler failure.

## Local Telemetry Sink

The application configures OpenTelemetry export itself and wires the SDK OpenTelemetry bridge into the Webhook Endpoint. The default Local Telemetry Sink is motel at `http://127.0.0.1:27686`.

The OTLP trace exporter sends to:

```text
http://127.0.0.1:27686/v1/traces
```

App-level environment overrides:

- `BETTER_WEBHOOK_OTEL_ENDPOINT`: base OTLP HTTP endpoint, default `http://127.0.0.1:27686`.
- `OTEL_SERVICE_NAME`: service name, default `better-webhook-example-express`.
- `PORT`: Express port, default `3000`.

Stripe endpoint overrides:

- `STRIPE_WEBHOOK_SECRET`: Provider Secret used by both server and Stripe Sender Scripts.
- `STRIPE_WEBHOOK_URL`: full Stripe Sender Script target URL.
- `STRIPE_WEBHOOK_IDEMPOTENCY_TTL_MS`: in-memory Idempotency Store TTL.
- `STRIPE_WEBHOOK_REPLAY_WINDOW_MS`: Replay Protection window and in-memory Replay Store TTL.

GitHub endpoint overrides:

- `GITHUB_WEBHOOK_SECRET`: Provider Secret used by both server and GitHub Sender Scripts.
- `GITHUB_WEBHOOK_URL`: full GitHub Sender Script target URL.
- `GITHUB_WEBHOOK_IDEMPOTENCY_TTL_MS`: in-memory Idempotency Store TTL.
- `GITHUB_WEBHOOK_REPLAY_WINDOW_MS`: Replay Protection window and in-memory Replay Store TTL.

## Local-Only Configuration

The default Provider Secret, in-memory Idempotency Store, and in-memory Replay Store are Provider Example Configuration for local development. Production webhook endpoints should use real secret management and durable coordination stores.

Behavior is manually verified through the dev server, Sender Scripts, console logs, and exported telemetry. This Example Application intentionally does not add automated behavioral tests for Delivery Scenarios.
