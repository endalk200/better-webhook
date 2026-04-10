# Express GitHub Prisma Replay Example

An Express app showing GitHub replay protection with a Postgres-backed replay store implemented locally with Prisma.

## Choose This Example If...

- you need durable replay protection backed by Postgres
- you want to see a concrete `ReplayStore` implementation
- you want duplicate detection that survives process restarts

## What This Example Focuses On

- replay protection configured with `.withReplayProtection(...)`
- a local Prisma-backed `ReplayStore`
- durable duplicate detection for the GitHub `push` event

## Quick Start

This example expects an existing Postgres database.
Set `DATABASE_URL` before running `prisma:push`, and set `GITHUB_WEBHOOK_SECRET` before sending signed requests.

```bash
pnpm install
pnpm --filter @better-webhook/express-github-prisma-replay-example prisma:generate
pnpm --filter @better-webhook/express-github-prisma-replay-example prisma:push
pnpm --filter @better-webhook/express-github-prisma-replay-example dev
```

Server URL: `http://localhost:3005`

## Configuration

Create your env vars before sending requests:

```bash
GITHUB_WEBHOOK_SECRET=your-github-secret
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/better_webhook
PORT=3005
```

| Variable                | Required | Description                             |
| ----------------------- | -------- | --------------------------------------- |
| `GITHUB_WEBHOOK_SECRET` | Yes      | Secret used to verify GitHub signatures |
| `DATABASE_URL`          | Yes      | Postgres connection string for Prisma   |
| `PORT`                  | No       | Override the default port (`3005`)      |

## Endpoints

- `POST /webhooks/github` verifies the GitHub request, checks the replay store, and handles the event
- `GET /health` runs a database check before returning `{ status, timestamp }`, so it confirms both app liveness and DB reachability

## Expected Behavior

Send a signed GitHub `push` event:

```bash
SECRET="your-github-secret"
DELIVERY_ID="prisma-replay-demo-1"
PAYLOAD='{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","private":false},"commits":[{"id":"abc123","message":"Prisma replay demo","timestamp":"2024-01-01T00:00:00Z","url":"https://example.com","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"head_commit":null,"before":"000","after":"abc","created":false,"deleted":false,"forced":false,"base_ref":null,"compare":"https://example.com","pusher":{"name":"test"},"sender":{"login":"test","id":1,"type":"User"}}'
SIGNATURE=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')

curl -i -X POST "http://localhost:3005/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: $DELIVERY_ID" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

Expected flow:

- the first request succeeds and logs `GitHub push accepted`
- the same request with the same `X-GitHub-Delivery` returns `409`
- restarting the server does not clear replay history because the delivery id is stored in Postgres
- changing `DELIVERY_ID` to a new value makes the request succeed again

## Limitations And Production Scope

This example demonstrates one way to implement the `ReplayStore` contract. It is not trying to become a reusable Prisma package or a full persistence architecture.

## File Layout

- `prisma/schema.prisma` defines the datasource and replay record model
- `src/prisma.ts` creates the Prisma client
- `src/replay-store.ts` implements the Prisma-backed `ReplayStore`
- `src/webhooks/github.ts` configures GitHub verification and replay protection
- `src/index.ts` mounts routes and health checks

## Canonical Docs

Use the main docs for broader replay/idempotency guidance:

- `apps/docs/content/docs/sdk/replay-idempotency.mdx`
- `apps/docs/content/docs/sdk/providers.mdx`

## Troubleshooting

- If `prisma db push` fails, verify that `DATABASE_URL` points to a reachable Postgres database.
- `401` usually means the configured secret does not match the sender.
- `409` on the second request is the expected duplicate behavior.
- Express must keep `express.raw({ type: "application/json" })` on the webhook route.
