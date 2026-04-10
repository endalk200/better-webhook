# NestJS Example

A NestJS app showing the default multi-provider setup for `@better-webhook/nestjs`.

## Choose This Example If...

- you want controller-based webhook routing in NestJS
- you want raw-body verification with Nest's Express platform
- you want GET endpoints that expose supported event metadata

## What It Demonstrates

- one NestJS handler module per provider under `src/webhooks`
- controller routing for both webhook POST handlers and metadata GET endpoints
- representative event handling for GitHub, Ragie, Stripe, and Recall

Representative events in this app:

- GitHub: `push`, `pull_request`, `issues`
- Ragie: `document_status_updated`, `connection_sync_finished`, `entity_extracted`
- Stripe: `charge.failed`, `checkout.session.completed`, `payment_intent.succeeded`
- Recall: `participant_events.join`, `participant_events.chat_message`, `transcript.data`, `bot.done`

## Quick Start

```bash
pnpm install
pnpm --filter @better-webhook/nestjs-example dev
```

Server URL: `http://localhost:3003`

If you are running multiple examples at once, override `PORT`. `3003` is also used by `express-github-inmemory-replay-example`.

## Configuration

Create your env vars before sending requests:

```bash
GITHUB_WEBHOOK_SECRET=your-github-secret
RAGIE_WEBHOOK_SECRET=your-ragie-secret
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-secret
RECALL_WEBHOOK_SECRET=whsec_your-recall-secret
PORT=3003
```

| Variable                | Required | Description                             |
| ----------------------- | -------- | --------------------------------------- |
| `GITHUB_WEBHOOK_SECRET` | Yes      | Secret used to verify GitHub signatures |
| `RAGIE_WEBHOOK_SECRET`  | Yes      | Secret used to verify Ragie signatures  |
| `STRIPE_WEBHOOK_SECRET` | Yes      | Secret used to verify Stripe signatures |
| `RECALL_WEBHOOK_SECRET` | Yes      | Secret used to verify Recall signatures |
| `PORT`                  | No       | Override the default port (`3003`)      |

## Endpoints

- `POST /webhooks/github` verifies and handles GitHub webhook events
- `GET /webhooks/github` returns `{ status, endpoint, supportedEvents }` for the GitHub route
- `POST /webhooks/ragie` verifies and handles Ragie webhook events
- `GET /webhooks/ragie` returns `{ status, endpoint, supportedEvents }` for the Ragie route
- `POST /webhooks/stripe` verifies and handles Stripe webhook events
- `GET /webhooks/stripe` returns `{ status, endpoint, supportedEvents }` for the Stripe route
- `POST /webhooks/recall` verifies and handles Recall webhook events
- `GET /webhooks/recall` returns `{ status, endpoint, supportedEvents }` for the Recall route
- `GET /health` returns `{ status, timestamp }` so you can confirm the app is up

## Try It

Send a signed GitHub `push` event:

```bash
SECRET="your-github-secret"
PAYLOAD='{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Test commit","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'
SIGNATURE=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')

curl -X POST "http://localhost:3003/webhooks/github" \
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
- verified but unhandled events can return `204`

## File Layout

- `src/main.ts` boots Nest with `rawBody: true`
- `src/webhooks.controller.ts` wires routes and metadata endpoints
- `src/webhooks/github.webhook.ts` handles GitHub events and exports `githubInfo`
- `src/webhooks/ragie.webhook.ts` handles Ragie events and exports `ragieInfo`
- `src/webhooks/stripe.webhook.ts` handles Stripe events and exports `stripeInfo`
- `src/webhooks/recall.webhook.ts` handles Recall events and exports `recallInfo`

## Recall Note

The Recall example stays intentionally small and typed by inference. Handlers receive unwrapped `body.data`, but that payload still includes nested Recall-specific fields such as `payload.data.participant` and `payload.data.code`.

## Advanced Topics

This example keeps the default flow minimal. For replay protection and telemetry, use the canonical SDK docs:

- `apps/docs/content/docs/sdk/providers.mdx`
- `apps/docs/content/docs/sdk/replay-idempotency.mdx`
- `apps/docs/content/docs/sdk/opentelemetry.mdx`

## Troubleshooting

- Keep `rawBody: true` enabled in `src/main.ts`.
- `401` usually means the configured secret does not match the sender.
- `204` is expected for verified but unhandled events.
