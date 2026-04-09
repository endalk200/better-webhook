# Hono Example

A Hono app showing the default multi-provider setup for `@better-webhook/hono`.

## Choose This Example If...

- you want minimal Hono route wiring
- you want one webhook file per provider
- you want to compare GitHub, Ragie, Stripe, and Recall in one app

## What It Demonstrates

- one Hono route per provider under `src/webhooks`
- adapter-based request handling with `toHonoNode(...)`
- representative event handling for GitHub, Ragie, Stripe, and Recall

Representative events in this app:

- GitHub: `push`, `pull_request`, `issues`
- Ragie: `document_status_updated`, `connection_sync_finished`, `entity_extracted`
- Stripe: `charge.failed`, `checkout.session.completed`, `payment_intent.succeeded`
- Recall: `participant_events.join`, `participant_events.chat_message`, `transcript.data`, `bot.done`

## Quick Start

```bash
pnpm install
pnpm --filter @better-webhook/hono-example dev
```

Server URL: `http://localhost:3004`

If you are running multiple examples at once, override `PORT`. `3004` is also used by `express-github-otel-example`.

## Configuration

Create your env vars before sending requests:

```bash
GITHUB_WEBHOOK_SECRET=your-github-secret
RAGIE_WEBHOOK_SECRET=your-ragie-secret
STRIPE_WEBHOOK_SECRET=your-stripe-secret
RECALL_WEBHOOK_SECRET=your-recall-secret
PORT=3004
```

| Variable                | Required | Description                             |
| ----------------------- | -------- | --------------------------------------- |
| `GITHUB_WEBHOOK_SECRET` | Yes      | Secret used to verify GitHub signatures |
| `RAGIE_WEBHOOK_SECRET`  | Yes      | Secret used to verify Ragie signatures  |
| `STRIPE_WEBHOOK_SECRET` | Yes      | Secret used to verify Stripe signatures |
| `RECALL_WEBHOOK_SECRET` | Yes      | Secret used to verify Recall signatures |
| `PORT`                  | No       | Override the default port (`3004`)      |

## Endpoints

- `POST /webhooks/github` verifies and handles GitHub webhook events
- `POST /webhooks/ragie` verifies and handles Ragie webhook events
- `POST /webhooks/stripe` verifies and handles Stripe webhook events
- `POST /webhooks/recall` verifies and handles Recall webhook events
- `GET /health` returns `{ status, timestamp }` so you can confirm the app is up

## Try It

Send a signed GitHub `push` event:

```bash
SECRET="your-github-secret"
PAYLOAD='{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Test commit","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'
SIGNATURE=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')

curl -X POST "http://localhost:3004/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-123" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

Expected result:

- the request succeeds with a verified response
- the app logs `GitHub push received`
- the app logs `GitHub webhook processed`

## File Layout

- `src/index.ts` creates the Hono app and mounts routes
- `src/webhooks/github.ts` handles GitHub events
- `src/webhooks/ragie.ts` handles Ragie events
- `src/webhooks/stripe.ts` handles Stripe events
- `src/webhooks/recall.ts` handles Recall events

## Recall Note

The Recall handlers intentionally rely on type inference. Your handler receives unwrapped `body.data`, but nested properties such as `payload.data.participant` still come from Recall's event schema.

## Advanced Topics

This example keeps replay protection and telemetry out of the default flow. For those topics, use the canonical SDK docs:

- `apps/docs/content/docs/sdk/providers.mdx`
- `apps/docs/content/docs/sdk/replay-idempotency.mdx`
- `apps/docs/content/docs/sdk/opentelemetry.mdx`

## Troubleshooting

- `401` usually means the configured secret does not match the sender.
- Do not read or consume the raw request before `toHonoNode(...)` runs.
- Sign the exact raw payload bytes you send.
