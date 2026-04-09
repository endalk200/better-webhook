# Express GitHub OpenTelemetry Example

An Express app showing GitHub webhook instrumentation with `@better-webhook/otel` plus a local OpenTelemetry runtime.

## Choose This Example If...

- you want local visibility into spans and metrics
- you want to see builder-level instrumentation in a small app
- you want a GitHub-only telemetry example before wiring a collector

## What This Example Focuses On

- builder instrumentation with `.instrument(createOpenTelemetryInstrumentation(...))`
- local SDK startup before the server begins handling requests
- console-exported spans and metrics for a GitHub `push` event

## Quick Start

```bash
pnpm install
pnpm --filter @better-webhook/express-github-otel-example dev
```

Server URL: `http://localhost:3004`

If you are running multiple examples at once, override `PORT`. `3004` is also used by `hono-example`.

## Configuration

Create your env vars before sending requests:

```bash
GITHUB_WEBHOOK_SECRET=your-github-secret
PORT=3004
```

| Variable                | Required | Description                             |
| ----------------------- | -------- | --------------------------------------- |
| `GITHUB_WEBHOOK_SECRET` | Yes      | Secret used to verify GitHub signatures |
| `PORT`                  | No       | Override the default port (`3004`)      |

## Endpoints

- `POST /webhooks/github` verifies and handles GitHub webhook events
- `GET /health` returns `{ status, timestamp }` for app liveness only; it does not validate exporter or collector health

## Expected Behavior

Send a signed GitHub `push` event:

```bash
SECRET="your-github-secret"
PAYLOAD='{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Telemetry demo","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'
SIGNATURE=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')

curl -i -X POST "http://localhost:3004/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: telemetry-demo-1" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

Expected result:

- the request succeeds with a verified response
- the app logs `GitHub push received`
- the app logs `GitHub webhook processed`
- you see a console-exported `better-webhook.process` span
- you see periodic metric export output such as `better_webhook.requests`, `better_webhook.completed`, and `better_webhook.duration`

## Limitations And Production Scope

This example is optimized for local visibility, not production telemetry architecture.

- it uses local SDK setup and console exporters so you can see telemetry immediately
- it does not configure OTLP exporters, a collector, or deployment-specific resource conventions
- `deliveryId` and other high-cardinality attributes stay off by default

## File Layout

- `src/index.ts` starts telemetry, boots Express, and flushes on shutdown
- `src/telemetry.ts` configures the OpenTelemetry SDK and console exporters
- `src/webhooks/github.ts` handles GitHub events and adds instrumentation

## Canonical Docs

Use the main docs for broader telemetry guidance:

- `apps/docs/content/docs/sdk/opentelemetry.mdx`
- `apps/docs/content/docs/sdk/providers.mdx`

## Troubleshooting

- If you only see handler logs, make sure the telemetry SDK started before the server began listening.
- Express must keep `express.raw({ type: "application/json" })` on the webhook route.
- Sign the exact raw payload bytes you send.
